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

function buildDate(anioRaw, mesRaw, diaRaw, fechaRaw) {
  const anio = parseInt(anioRaw, 10);
  const mes = parseInt(mesRaw, 10);
  const dia = parseInt(diaRaw, 10);
  if (anio && mes && mes >= 1 && mes <= 12 && dia && dia >= 1 && dia <= 31) {
    return new Date(Date.UTC(anio, mes - 1, dia));
  }
  if (fechaRaw) {
    const s = String(fechaRaw).trim();
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return new Date(Date.UTC(+m[3], +m[1] - 1, +m[2]));
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

let _payloadCache = null;

async function fetchAppsScriptPayload() {
  if (_payloadCache) return _payloadCache;
  if (!CONFIG.APPS_SCRIPT_URL || CONFIG.APPS_SCRIPT_URL.startsWith("PEGA_AQUI")) {
    throw new Error("Falta configurar APPS_SCRIPT_URL en config.js (ver AppsScript_Code.gs).");
  }
  const res = await fetch(appsScriptUrl(), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`No se pudo contactar el Apps Script (HTTP ${res.status}). Revisa que esté implementado como "Aplicación web" con acceso "Cualquier usuario".`);
  }
  const json = await res.json();
  if (json.error) {
    throw new Error(`El Apps Script rechazó la petición: ${json.error}. Revisa que APPS_SCRIPT_TOKEN coincida con SECRET_TOKEN en el script.`);
  }
  _payloadCache = json;
  return json;
}

async function fetchSheetAsObjects(sheetName) {
  const payload = await fetchAppsScriptPayload();
  return payload.leadSheets[sheetName] || [];
}

async function fetchSheetRows(sheetName) {
  const payload = await fetchAppsScriptPayload();
  return payload.resumenSheets[sheetName] || [];
}

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
      statusGestion,
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

function parseResumenSheet(rows2D, platform) {
  if (!rows2D.length) return [];
  const headerRow = rows2D[0];
  const numBlocks = Math.ceil(headerRow.length / 3);
  const out = [];

  for (let b = 1; b < numBlocks; b++) {
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

async function loadDashboardData() {
  _payloadCache = null;
  const [leads, inversion] = await Promise.all([loadAllLeads(), loadInversion()]);
  return { leads, inversion, loadedAt: new Date() };
}
