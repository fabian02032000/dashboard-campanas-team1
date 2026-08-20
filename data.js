// ============================================================================
// ETL: descarga las hojas del Google Sheet, las normaliza y calcula todas las
// métricas que usa el dashboard. No toca el DOM — solo devuelve datos listos.
// ============================================================================

// ---- utilidades básicas ----------------------------------------------------

function cleanText(v) {
  if (v === null || v === undefined) return "";
  return String(v).replace(/\s+/g, " ").trim();
}

function upper(v) {
  return cleanText(v).toUpperCase();
}

function parseNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return isFinite(v) ? v : null;
  const s = String(v).replace(/,/g, "").replace(/[^\d.\-]/g, "");
  if (s === "" || s === "-" || s === ".") return null;
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
}

// Construye una fecha (UTC-neutral, solo Y-M-D) a partir de Año/Mes/Dia, o si
// no hay, intenta parsear el string de Fecha directamente.
function buildDate(anioRaw, mesRaw, diaRaw, fechaRaw) {
  const anio = parseInt(anioRaw, 10);
  const mes = parseInt(mesRaw, 10);
  const dia = parseInt(diaRaw, 10);
  if (anio && mes && mes >= 1 && mes <= 12 && dia && dia >= 1 && dia <= 31) {
    return new Date(Date.UTC(anio, mes - 1, dia));
  }
  if (fechaRaw) {
    const s = String(fechaRaw).trim();
    // ISO con offset: 2026-05-19T15:34:23-05:00
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    // M/D/YYYY [hh:mm:ss]
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return new Date(Date.UTC(+m[3], +m[1] - 1, +m[2]));
    // gviz Date(y,m,d,...)
    m = s.match(/^Date\((\d+),(\d+),(\d+)/);
    if (m) return new Date(Date.UTC(+m[1], +m[2], +m[3]));
    const d = new Date(s);
    if (!isNaN(d.getTime())) return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  }
  return null;
}

function monthKey(date) {
  if (!date) return null;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

// ---- descarga + parseo CSV -------------------------------------------------

async function fetchSheetRows(sheetName) {
  const url = csvUrlForSheet(sheetName);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`No se pudo leer la pestaña "${sheetName}" (HTTP ${res.status}). ¿Está compartida como "Cualquiera con el enlace: Lector"?`);
  }
  const text = await res.text();
  const parsed = Papa.parse(text, { header: false, skipEmptyLines: false });
  return parsed.data; // array de arrays (filas x columnas), tal cual el sheet
}

async function fetchSheetAsObjects(sheetName) {
  const rows = await fetchSheetRows(sheetName);
  if (!rows.length) return [];
  const headers = rows[0].map((h) => cleanText(h));
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => cleanText(c) === "")) continue;
    const obj = {};
    headers.forEach((h, idx) => {
      if (h) obj[h] = row[idx];
    });
    out.push(obj);
  }
  return out;
}

// ---- normalización de leads -------------------------------------------------

const TIPIF_VENTA_PREFIX = "VENTA";
const ESTADOS_GESTION_VALIDOS = new Set(["CONTACTO", "NO CONTACTO"]);

function normalizeLeadSheet(sheetCfg, rawRows) {
  const c = sheetCfg.cols;
  const out = [];
  for (const r of rawRows) {
    const asesor = cleanText(r[c.asesor]) || "Sin asignar";
    const supervisor = cleanText(r[c.supervisor]) || "Sin asignar";
    let statusGestion = upper(r[c.statusGestion]);
    if (!ESTADOS_GESTION_VALIDOS.has(statusGestion)) statusGestion = statusGestion ? null : null;
    const tipRaw = cleanText(r[c.tipificacion]);
    const tipificacion = tipRaw || null;
    const isVenta = !!tipRaw && upper(tipRaw).startsWith(TIPIF_VENTA_PREFIX);
    const planVendido = parseNumber(r[c.planVendido]);
    const canalVenta = cleanText(r[c.canalVenta]) || null;
    const remarketing = upper(r[c.remarketing]) === "SÍ" || upper(r[c.remarketing]) === "SI";
    const date = buildDate(r[c.anio], r[c.mes], r["Dia"], r[c.fecha]);
    const mk = monthKey(date);

    out.push({
      platform: sheetCfg.platform,
      sourceSheet: sheetCfg.name,
      asesor,
      supervisor,
      statusGestion, // 'CONTACTO' | 'NO CONTACTO' | null (sin gestionar)
      gestionado: statusGestion !== null,
      contactado: statusGestion === "CONTACTO",
      tipificacion,
      isVenta,
      planVendido,
      canalVenta,
      remarketing,
      date,
      monthKey: mk,
    });
  }
  return out;
}

async function loadAllLeads() {
  const results = await Promise.all(
    CONFIG.LEAD_SHEETS.map((cfg) => fetchSheetAsObjects(cfg.name))
  );
  let all = [];
  results.forEach((rows, i) => {
    all = all.concat(normalizeLeadSheet(CONFIG.LEAD_SHEETS[i], rows));
  });
  return all;
}

// ---- parseo de hojas RESUMEN (inversión mensual) ---------------------------
// Formato: bloques de 3 columnas [Etiqueta, Valor, (vacío)] repetidos. Fila 0
// trae el título de cada bloque (mes), filas siguientes traen métrica/valor.

function parseResumenSheet(rows2D, platform) {
  if (!rows2D.length) return [];
  const headerRow = rows2D[0];
  const numBlocks = Math.ceil(headerRow.length / 3);
  const out = []; // { platform, mes(1-12), inversion, leadsReportado, ventasReportado }

  for (let b = 1; b < numBlocks; b++) { // b=0 es "RESUMEN GENERAL" (total), lo saltamos
    const titulo = cleanText(headerRow[b * 3]);
    if (!titulo) continue;
    const mesMatch = Object.keys(CONFIG.MESES).find((m) =>
      titulo.toLowerCase().includes(m)
    );
    if (!mesMatch) continue;
    const mesNum = CONFIG.MESES[mesMatch];

    const metricas = {};
    for (let ri = 1; ri < rows2D.length; ri++) {
      const row = rows2D[ri];
      if (!row) continue;
      const label = cleanText(row[b * 3]);
      const value = row[b * 3 + 1];
      if (!label) continue;
      metricas[label] = value;
    }

    out.push({
      platform,
      mes: mesNum,
      monthKey: `${CONFIG.DEFAULT_YEAR}-${String(mesNum).padStart(2, "0")}`,
      inversion: parseNumber(metricas["Inversión"]) || 0,
      leadsReportado: parseNumber(metricas["Leads"]) || 0,
      ventasReportado: parseNumber(metricas["Ventas"]) || 0,
    });
  }
  return out;
}

async function loadInversion() {
  const results = await Promise.all(
    CONFIG.RESUMEN_SHEETS.map((cfg) => fetchSheetRows(cfg.name))
  );
  let all = [];
  results.forEach((rows2D, i) => {
    all = all.concat(parseResumenSheet(rows2D, CONFIG.RESUMEN_SHEETS[i].platform));
  });
  return all;
}

// ---- carga completa ---------------------------------------------------------

async function loadDashboardData() {
  const [leads, inversion] = await Promise.all([loadAllLeads(), loadInversion()]);
  return { leads, inversion, loadedAt: new Date() };
}
