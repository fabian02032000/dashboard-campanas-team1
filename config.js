// ============================================================================
// CONFIGURACIÓN DEL DASHBOARD
// Edita solo este archivo si cambian los nombres de las pestañas del Sheet,
// el ID del Sheet, o el año de la data.
// ============================================================================

const CONFIG = {
  // URL de tu Apps Script publicado como "Aplicación web" (termina en /exec).
  // Ver AppsScript_Code.gs para cómo generarla.
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbwnRReho9B7Ovd7EBGDhphhz5UAXziHVg-5q9v5MsDsePZiqHOXVi9b4ZGu0Dyrkuqs/exec",

  // La misma clave secreta que pusiste en AppsScript_Code.gs (SECRET_TOKEN).
  APPS_SCRIPT_TOKEN: "BvksJJ3f_aoyQjjhN0igjLlGEuE8bMDJ",

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
        adNombre: "Ad name",
        adsetNombre: "Ad group name",
        campanaNombre: "Campaign name",
      },
    },
    {
      name: "SALES REVOLUTION | LEADS META | FILTROS",
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
        adNombre: "ad_name",
        adsetNombre: "adset_name",
        campanaNombre: "campaign_name",
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
        adNombre: "ad_name",
        adsetNombre: "adset_name",
        campanaNombre: "campaign_name",
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
        adNombre: "ad_name",
        adsetNombre: "adgroup_name",
        campanaNombre: "campaign_name",
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

// URL del endpoint privado (Apps Script) con la clave secreta pegada.
function appsScriptUrl() {
  const params = new URLSearchParams({ token: CONFIG.APPS_SCRIPT_TOKEN });
  return `${CONFIG.APPS_SCRIPT_URL}?${params.toString()}`;
}
