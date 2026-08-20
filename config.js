// ============================================================================
// CONFIGURACIÓN DEL DASHBOARD
// Edita solo este archivo si cambian los nombres de las pestañas del Sheet,
// el ID del Sheet, o el año de la data.
// ============================================================================

const CONFIG = {
  // ID del Google Sheet (se saca de la URL: .../d/ESTE_ID/edit)
  SHEET_ID: "1qPsMI1J83Mluz22YnGo_DBEqKM5Sdww-QiLLdvJjNRo",

  // Año que asumimos para las hojas RESUMEN META / RESUMEN TIKTOK
  // (esas hojas no traen columna de año, solo el nombre del mes).
  // Si la campaña cruza a otro año, hay que separar el resumen por año a mano.
  DEFAULT_YEAR: 2026,

  // Cada cuánto se refresca el dashboard solo (en minutos). 0 = no auto-refresh.
  AUTO_REFRESH_MINUTES: 10,

  // --------------------------------------------------------------------------
  // HOJAS DE LEADS "crudas" (una fila = un lead). Se unifican todas en un solo
  // dataset. Si agregas una hoja nueva (ej. una V.3), solo tienes que sumar un
  // objeto más a este arreglo con el mapeo de columnas correcto.
  // --------------------------------------------------------------------------
  LEAD_SHEETS: [
    {
      name: "LEADS TIKTOK V.2",
      platform: "TikTok",
      cols: {
        asesor: "ASESOR",
        supervisor: "SUPERVISOR",
        statusGestion: "Status Gestión",
        tipificacion: "estaus",
        qtyVenta: "QTY Venta",
        planVendido: "Plan Vendido",
        canalVenta: "Canal de venta",
        remarketing: "Remarketing",
        fecha: "Fecha",
        anio: "Año",
        mes: "Mes ",
      },
    },
    {
      name: "SALES REVOLUTION | LEADS META |",
      platform: "Meta",
      cols: {
        asesor: "ASESOR",
        supervisor: "SUPERVISOR",
        statusGestion: "Status Gestión",
        tipificacion: "estaus",
        qtyVenta: "QTY Venta",
        planVendido: "Plan Vendido",
        canalVenta: "Canal de venta",
        remarketing: "Remarketing",
        fecha: "created_time",
        anio: "Año",
        mes: "Mes ",
      },
    },
    {
      name: "SALES REVOLUTION | LEADS META",
      platform: "Meta",
      cols: {
        asesor: "ASESOR",
        supervisor: "SUPERVISOR",
        statusGestion: "Status Gestión",
        tipificacion: "Observaciones",
        qtyVenta: "QTY Venta",
        planVendido: "Plan Vendido",
        canalVenta: "Canal de venta",
        remarketing: "Remarketing",
        fecha: "Fecha",
        anio: "Año",
        mes: "Mes ",
      },
    },
    {
      name: "LEADS TIKTOK SR",
      platform: "TikTok",
      cols: {
        asesor: "Vendedor Asignado",
        supervisor: "SUPERVISOR",
        statusGestion: "Status Gestión",
        tipificacion: "Observaciones",
        qtyVenta: "QTY Venta",
        planVendido: "Plan Vendido",
        canalVenta: "Canal de venta",
        remarketing: "Remarketing",
        fecha: "Fecha",
        anio: "Año",
        mes: "Mes ",
      },
    },
  ],

  // --------------------------------------------------------------------------
  // HOJAS RESUMEN (para sacar la Inversión / gasto mensual por plataforma).
  // Formato especial: bloques de 3 columnas (Etiqueta, Valor, vacío) repetidos.
  // El primer bloque es el total general y se ignora (se recalcula sumando
  // los meses, para no depender de una celda que puede quedar desactualizada).
  // --------------------------------------------------------------------------
  RESUMEN_SHEETS: [
    { name: "RESUMEN META", platform: "Meta" },
    { name: "RESUMEN TIKTOK", platform: "TikTok" },
  ],

  // Mapeo de nombres de mes en español -> número de mes (1-12)
  MESES: {
    enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
    julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10,
    noviembre: 11, diciembre: 12,
  },
  MESES_NOMBRE: [
    "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ],
};

// URL de exportación CSV de una pestaña por nombre (no requiere "Publicar en
// la web", solo que el Sheet esté compartido como "Cualquiera con el enlace: Lector").
function csvUrlForSheet(sheetName) {
  const base = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq`;
  const params = new URLSearchParams({
    tqx: "out:csv",
    sheet: sheetName,
  });
  return `${base}?${params.toString()}`;
}
