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
  const ventas = leads.filter((l) => l.isVenta).length;
  const montoVendido = sum(leads.filter((l) => l.isVenta).map((l) => l.planVendido || 0));
  const inversion = sum(inversionRows.map((r) => r.inversion));

  return {
    leadsIngresados,
    gestionados,
    contacto,
    noContacto,
    ventas,
    montoVendido,
    inversion,
    pctGestion: safeDiv(gestionados, leadsIngresados),
    pctContacto: safeDiv(contacto, gestionados),
    cvr: safeDiv(ventas, leadsIngresados),
    vendidoPorContacto: safeDiv(ventas, contacto),
    efectividadGestion: safeDiv(ventas, gestionados),
    cpl: safeDiv(inversion, leadsIngresados),
    cpa: safeDiv(inversion, ventas),
    ticketPromedio: safeDiv(montoVendido, ventas),
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
