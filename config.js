const CONFIG = {
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbwnRReho9B7Ovd7EBGDhphhz5UAXziHVg-5q9v5MsDsePZiqHOXVi9b4ZGu0Dyrkuqs/exec",
  APPS_SCRIPT_TOKEN: "BvksJJ3f_aoyQjjhN0igjLlGEuE8bMDJ",
  DEFAULT_YEAR: 2026,
  AUTO_REFRESH_MINUTES: 10,
  LEAD_SHEETS: [
    { name: "LEADS TIKTOK V.2", platform: "TikTok", cols: { asesor: "ASESOR", supervisor: "SUPERVISOR", statusGestion: "Status Gestión", tipificacion: "estaus", qtyVenta: "QTY Venta", planVendido: "Plan Vendido", canalVenta: "Canal de venta", remarketing: "Remarketing", fecha: "Fecha", anio: "Año", mes: "Mes " } },
    { name: "SALES REVOLUTION | LEADS META |", platform: "Meta", cols: { asesor: "ASESOR", supervisor: "SUPERVISOR", statusGestion: "Status Gestión", tipificacion: "estaus", qtyVenta: "QTY Venta", planVendido: "Plan Vendido", canalVenta: "Canal de venta", remarketing: "Remarketing", fecha: "created_time", anio: "Año", mes: "Mes " } },
    { name: "SALES REVOLUTION | LEADS META", platform: "Meta", cols: { asesor: "ASESOR", supervisor: "SUPERVISOR", statusGestion: "Status Gestión", tipificacion: "Observaciones", qtyVenta: "QTY Venta", planVendido: "Plan Vendido", canalVenta: "Canal de venta", remarketing: "Remarketing", fecha: "Fecha", anio: "Año", mes: "Mes " } },
    { name: "LEADS TIKTOK SR", platform: "TikTok", cols: { asesor: "Vendedor Asignado", supervisor: "SUPERVISOR", statusGestion: "Status Gestión", tipificacion: "Observaciones", qtyVenta: "QTY Venta", planVendido: "Plan Vendido", canalVenta: "Canal de venta", remarketing: "Remarketing", fecha: "Fecha", anio: "Año", mes: "Mes " } },
  ],
  RESUMEN_SHEETS: [
    { name: "RESUMEN META", platform: "Meta" },
    { name: "RESUMEN TIKTOK", platform: "TikTok" },
  ],
  MESES: { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 },
  MESES_NOMBRE: ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"],
};

function appsScriptUrl() {
  const params = new URLSearchParams({ token: CONFIG.APPS_SCRIPT_TOKEN });
  return `${CONFIG.APPS_SCRIPT_URL}?${params.toString()}`;
}
