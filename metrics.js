// ============================================================================
// Cálculo de métricas a partir de los leads normalizados + inversión mensual.
// Todo recibe los datos ya cargados (data.js) y un objeto de filtros opcional.
// ============================================================================
 
function applyFilters(leads, filters) {
  return leads.filter((l) => {
    if (filters.platform && filters.platform !== "Todos" && l.platform !== filters.platform) return false;
    if (filters.monthKey && filters.monthKey !== "Todos" && l.monthKey !== filters.monthKey) return false;
    if (filters.asesor && filters.asesor !== "Todos" && l.asesor !== filters.asesor) return false;
    return true;
  });
}
 
function filterInversion(inversion, filters) {
  return inversion.filter((r) => {
    if (filters.platform && filters.platform !== "Todos" && r.platform !== filters.platform) return false;
    if (filters.monthKey && filters.monthKey !== "Todos" && r.monthKey !== filters.monthKey) return false;
    return true;
  });
}
 
function sum(arr) {
  return arr.reduce((a, b) => a + (b || 0), 0);
}
 
function safeDiv(a, b) {
  if (!b) return null;
  return a / b;
}
 
function baseKpis(leads, inversionRows) {
  const leadsIngresados = leads.length;
  const gestionados = leads.filter((l) => l.gestionado).length;
  const contacto = leads.filter((l) => l.contactado).length;
  const noContacto = leads.filter((l) => l.statusGestion === "NO CONTACTO").length;
  const ventas = leads.filter((l) => l.isVenta).length; // clientes/leads que compraron
  const unidadesVendidas = sum(leads.filter((l) => l.isVenta).map((l) => l.unidades)); // líneas totales (multi cuenta 2, 3...)
  const inversion = sum(inversionRows.map((r) => r.inversion));
 
  return {
    leadsIngresados,
    gestionados,
    contacto,
    noContacto,
    ventas,
    unidadesVendidas,
    inversion,
    pctGestion: safeDiv(gestionados, leadsIngresados),
    pctContacto: safeDiv(contacto, gestionados),
    cvr: safeDiv(ventas, leadsIngresados),
    vendidoPorContacto: safeDiv(ventas, contacto),
    efectividadGestion: safeDiv(ventas, gestionados),
    cpl: safeDiv(inversion, leadsIngresados),
    cpa: safeDiv(inversion, unidadesVendidas), // costo por unidad/línea vendida, no por cliente
  };
}
 
function computeGeneralSummary(data, filters) {
  const leads = applyFilters(data.leads, filters);
  const inv = filterInversion(data.inversion, filters);
  return baseKpis(leads, inv);
}
 
function computeMonthlySummary(data, filters) {
  const leads = applyFilters(data.leads, { platform: filters.platform, asesor: filters.asesor });
  const inv = filterInversion(data.inversion, { platform: filters.platform });
 
  const monthKeys = new Set();
  leads.forEach((l) => l.monthKey && monthKeys.add(l.monthKey));
  inv.forEach((r) => monthKeys.add(r.monthKey));
 
  const rows = Array.from(monthKeys)
    .sort()
    .map((mk) => {
      const kpis = baseKpis(
        leads.filter((l) => l.monthKey === mk),
        inv.filter((r) => r.monthKey === mk)
      );
      const [y, m] = mk.split("-").map(Number);
      return { monthKey: mk, label: `${CONFIG.MESES_NOMBRE[m]} ${y}`, ...kpis };
    });
  return rows;
}
 
const MAX_TIPIF_SLICES = 7; // + "Otras" = 8, coincide con las 8 posiciones de la paleta
 
function computeTipificaciones(data, filters) {
  const leads = applyFilters(data.leads, filters).filter((l) => l.tipificacion);
  const counts = new Map();
  leads.forEach((l) => {
    const key = l.tipificacion;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, MAX_TIPIF_SLICES);
  const rest = sorted.slice(MAX_TIPIF_SLICES);
  const otrasTotal = sum(rest.map((r) => r[1]));
  const result = top.map(([label, value]) => ({ label, value }));
  if (otrasTotal > 0) result.push({ label: "Otras", value: otrasTotal, isOther: true });
  const total = sum(result.map((r) => r.value));
  result.forEach((r) => (r.pct = safeDiv(r.value, total)));
  return result;
}
 
function computeAsesorRanking(data, filters) {
  const leads = applyFilters(data.leads, { platform: filters.platform, monthKey: filters.monthKey });
  const byAsesor = new Map();
  leads.forEach((l) => {
    if (!byAsesor.has(l.asesor)) byAsesor.set(l.asesor, []);
    byAsesor.get(l.asesor).push(l);
  });
 
  const rows = Array.from(byAsesor.entries())
    .filter(([asesor]) => asesor !== "Sin asignar")
    .map(([asesor, group]) => {
      const kpis = baseKpis(group, []); // la inversión no se prorratea por asesor
      const supervisores = new Set(group.map((l) => l.supervisor));
      return {
        asesor,
        supervisor: supervisores.size === 1 ? Array.from(supervisores)[0] : "Varios",
        ...kpis,
      };
    });
 
  rows.sort((a, b) => b.ventas - a.ventas);
  return rows;
}
 
function computePlanRanking(data, filters) {
  const leads = applyFilters(data.leads, filters).filter((l) => l.isVenta);
  const byPlan = new Map();
  leads.forEach((l) => {
    const key = l.planVendido !== null && l.planVendido !== undefined ? l.planVendido : "__sin_plan__";
    if (!byPlan.has(key)) byPlan.set(key, { plan: key, ventas: 0, unidades: 0 });
    const g = byPlan.get(key);
    g.ventas += 1;
    g.unidades += l.unidades || 0;
  });
  const totalVentas = leads.length;
  const rows = Array.from(byPlan.values()).map((g) => ({
    label: g.plan === "__sin_plan__" ? "Sin plan registrado" : `S/ ${g.plan}`,
    ventas: g.ventas,
    unidades: g.unidades,
    pctVentas: safeDiv(g.ventas, totalVentas),
  }));
  rows.sort((a, b) => b.ventas - a.ventas);
  return rows;
}
 
function computeAdRanking(data, filters) {
  let leads = applyFilters(data.leads, { platform: filters.platform, monthKey: filters.monthKey });
  if (filters.campana && filters.campana !== "Todos") {
    leads = leads.filter((l) => l.campanaNombre === filters.campana);
  }
  if (filters.adset && filters.adset !== "Todos") {
    leads = leads.filter((l) => l.adsetNombre === filters.adset);
  }
  const byAd = new Map();
  leads.forEach((l) => {
    // agrupamos por campaña + conjunto + anuncio: el mismo nombre de
    // anuncio se puede reusar en campañas distintas, y no queremos mezclar
    // su desempeño como si fuera uno solo.
    const key = l.campanaNombre + " ‖ " + l.adsetNombre + " ‖ " + l.adNombre;
    if (!byAd.has(key)) {
      byAd.set(key, { ad: l.adNombre, adset: l.adsetNombre, campana: l.campanaNombre, platform: l.platform, leads: [] });
    }
    byAd.get(key).leads.push(l);
  });
 
  const rows = Array.from(byAd.values()).map((g) => {
    const kpis = baseKpis(g.leads, []); // la inversión no se prorratea por anuncio
    return { ad: g.ad, adset: g.adset, campana: g.campana, platform: g.platform, ...kpis };
  });
 
  rows.sort((a, b) => b.ventas - a.ventas);
  return rows;
}
 
// ---- venta diaria + promedio de venta diaria por mes -----------------------
// No depende del filtro de Mes (queremos ver la serie completa en el tiempo);
// sí respeta Plataforma y Asesor, igual que el resumen mensual.
 
function computeDailySales(data, filters) {
  const scoped = applyFilters(data.leads, { platform: filters.platform, asesor: filters.asesor }).filter(
    (l) => l.date
  );
 
  // "Días con actividad": cualquier lead ese día (no solo ventas). Es el
  // denominador del promedio, para no premiar a los meses con pocos días de
  // campaña activa.
  const activeDaysByMonth = new Map(); // monthKey -> Set('YYYY-MM-DD')
  scoped.forEach((l) => {
    const dayKey = l.date.toISOString().slice(0, 10);
    if (!activeDaysByMonth.has(l.monthKey)) activeDaysByMonth.set(l.monthKey, new Set());
    activeDaysByMonth.get(l.monthKey).add(dayKey);
  });
 
  const byDay = new Map(); // 'YYYY-MM-DD' -> { mono, multi, total }
  scoped
    .filter((l) => l.isVenta)
    .forEach((l) => {
      const dayKey = l.date.toISOString().slice(0, 10);
      if (!byDay.has(dayKey)) byDay.set(dayKey, { mono: 0, multi: 0, total: 0 });
      const g = byDay.get(dayKey);
      if (upper(l.tipificacion).includes("MULTI")) g.multi += 1;
      else g.mono += 1;
      g.total += 1;
    });
 
  const allDayKeys = Array.from(new Set(Array.from(activeDaysByMonth.values()).flatMap((s) => Array.from(s)))).sort();
  const daily = allDayKeys.map((k) => {
    const g = byDay.get(k) || { mono: 0, multi: 0, total: 0 };
    return { date: k, mono: g.mono, multi: g.multi, total: g.total };
  });
 
  const monthlyTotals = new Map(); // monthKey -> total ventas del mes
  daily.forEach((d) => {
    const mk = d.date.slice(0, 7);
    monthlyTotals.set(mk, (monthlyTotals.get(mk) || 0) + d.total);
  });
 
  const monthly = Array.from(activeDaysByMonth.keys())
    .sort()
    .map((mk) => {
      const [y, m] = mk.split("-").map(Number);
      const diasActivos = activeDaysByMonth.get(mk).size;
      const totalVentas = monthlyTotals.get(mk) || 0;
      return {
        monthKey: mk,
        label: `${CONFIG.MESES_NOMBRE[m]} ${y}`,
        totalVentas,
        diasActivos,
        promedioDiario: diasActivos > 0 ? totalVentas / diasActivos : 0,
      };
    });
 
  return { daily, monthly };
}
 
function getAvailableCampanas(data) {
  const set = new Set(data.leads.map((l) => l.campanaNombre).filter(Boolean));
  return Array.from(set).sort();
}
 
function getAvailableAdsets(data, campana) {
  let leads = data.leads;
  if (campana && campana !== "Todos") leads = leads.filter((l) => l.campanaNombre === campana);
  const set = new Set(leads.map((l) => l.adsetNombre).filter(Boolean));
  return Array.from(set).sort();
}
 
function getAvailableMonths(data) {
  const keys = new Set();
  data.leads.forEach((l) => l.monthKey && keys.add(l.monthKey));
  data.inversion.forEach((r) => keys.add(r.monthKey));
  return Array.from(keys)
    .sort()
    .map((mk) => {
      const [y, m] = mk.split("-").map(Number);
      return { value: mk, label: `${CONFIG.MESES_NOMBRE[m]} ${y}` };
    });
}
 
function getAvailableAsesores(data) {
  const set = new Set(data.leads.map((l) => l.asesor).filter((a) => a && a !== "Sin asignar"));
  return Array.from(set).sort();
}
