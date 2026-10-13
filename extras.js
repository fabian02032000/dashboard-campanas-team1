// ============================================================================
// extras.js — Complemento del dashboard (se carga DESPUÉS de app.js)
//   1) Suma la hoja "SMR | LEADS META | V.3" a las hojas de leads (plataforma Meta).
//   2) Pestaña "Llegada de leads": picos por hora, volumen por día y mapa de
//      calor día-de-semana × hora. Se puede ver general o por TikTok / Meta
//      (usa el filtro Plataforma de arriba).
//   3) Pestaña "SLA": minutos hábiles (L-V 9:00-18:00, hora de Lima) entre que
//      llega el lead y que lo tipifican CONTACTO / NO CONTACTO.
// No toca los archivos existentes: solo se agrega <script src="extras.js">
// al final de index.html (después de app.js).
// ============================================================================
(function () {
  "use strict";

  // ---- ajustes ---------------------------------------------------------------
  var LIMA_OFFSET_MS = -5 * 3600 * 1000; // Lima = UTC-5, sin horario de verano
  var HORA_INI = 9, HORA_FIN = 18;       // horario de atención (L-V)
  var SLA_OBJ_MIN = (typeof CONFIG !== "undefined" && CONFIG.SLA_OBJETIVO_MIN) || 15; // meta del SLA en minutos hábiles
  var DOW_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  var DOW_ORDER = [1, 2, 3, 4, 5, 6, 0]; // se muestra Lun → Dom
  var PLAT_COLOR_VAR = { Meta: "--series-1", TikTok: "--series-2" };

  // ---- 1) hoja V.3 -----------------------------------------------------------
  var V3_NAME = "SMR | LEADS META | V.3";
  if (typeof CONFIG !== "undefined" && CONFIG.LEAD_SHEETS && !CONFIG.LEAD_SHEETS.some(function (s) { return s.name === V3_NAME; })) {
    CONFIG.LEAD_SHEETS.push({
      name: V3_NAME,
      platform: "Meta",
      cols: {
        asesor: "ASESOR", supervisor: "SUPERVISOR", statusGestion: "Status Gestión", tipificacion: "estaus",
        qtyVenta: "QTY Venta", planVendido: "Plan Vendido", canalVenta: "Canal de venta", remarketing: "Remarketing",
        fecha: "created_time", anio: "Año", mes: "Mes ", adNombre: "ad_name", adsetNombre: "adset_name",
        campanaNombre: "campaign_name",
      },
    });
  }

  // ---- 2) campos nuevos en cada lead (hora de llegada + SLA) --------------------
  function parseArrivalMs(r, sheetCfg) {
    var ct = r["Creation time"]; // TikTok: segundos Unix (UTC)
    if (ct !== undefined && ct !== null && ct !== "" && !isNaN(Number(ct)) && Number(ct) > 1e9) return Number(ct) * 1000;
    var f = r[sheetCfg.cols.fecha];
    if (typeof f === "string" && f.indexOf("T") > 0) { // Meta: ISO con hora y zona
      var ms = Date.parse(f);
      if (!isNaN(ms)) return ms;
    }
    return null;
  }

  var origNormalize = normalizeLeadSheet;
  normalizeLeadSheet = function (sheetCfg, rawRows) {
    var out = origNormalize(sheetCfg, rawRows);
    for (var i = 0; i < out.length && i < rawRows.length; i++) {
      var r = rawRows[i], l = out[i];
      var ms = parseArrivalMs(r, sheetCfg);
      if (ms !== null) {
        var d = new Date(ms + LIMA_OFFSET_MS); // getUTC* sobre este objeto = hora de Lima
        l.arrivalMs = ms;
        l.arrHour = d.getUTCHours();
        l.arrDow = d.getUTCDay();
        l.arrDay = d.toISOString().slice(0, 10);
      }
      var sla = r["SLA (min)"];
      l.slaMin = sla === "" || sla === null || sla === undefined || isNaN(Number(sla)) ? null : Number(sla);
    }
    return out;
  };

  // Cuando termina cada carga de datos, repintamos las pestañas nuevas.
  var EX = { data: null };
  var origLoad = loadDashboardData;
  loadDashboardData = async function () {
    var d = await origLoad.apply(this, arguments);
    EX.data = d;
    setTimeout(renderExtras, 0);
    return d;
  };

  // ---- utilidades --------------------------------------------------------------
  var fInt = function (n) { return n === null || n === undefined ? "—" : Math.round(n).toLocaleString("es-PE"); };
  var fPct = function (n) { return n === null || n === undefined ? "—" : (n * 100).toFixed(1) + "%"; };
  var fMin = function (n) {
    if (n === null || n === undefined) return "—";
    if (n < 60) return n.toFixed(n < 10 ? 1 : 0) + " min";
    return (n / 60).toFixed(1) + " h";
  };
  var css = function (v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); };
  function median(arr) {
    if (!arr.length) return null;
    var s = arr.slice().sort(function (a, b) { return a - b; });
    var m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  function mean(arr) { return arr.length ? arr.reduce(function (a, b) { return a + b; }, 0) / arr.length : null; }
  function platformFilter() { return document.getElementById("f-platform").value; }
  function monthOptions() { return typeof getAvailableMonths === "function" && EX.data ? getAvailableMonths(EX.data) : []; }
  function destroy(key) { if (typeof charts !== "undefined" && charts[key]) { charts[key].destroy(); delete charts[key]; } }
  function hint(t) { return ' <span class="hint">' + t + "</span>"; }

  // ---- 3) inyectar pestañas ------------------------------------------------------
  function injectTabs() {
    var nav = document.querySelector(".tabs-nav");
    var lastPanel = document.querySelector(".tab-panel:last-of-type") || document.querySelector(".tab-panel");
    if (!nav || !lastPanel || document.getElementById("tab-llegadas")) return;

    function addTab(key, label, html) {
      var btn = document.createElement("button");
      btn.className = "tab-btn";
      btn.dataset.tab = key;
      btn.textContent = label;
      nav.appendChild(btn);
      var panel = document.createElement("div");
      panel.className = "tab-panel";
      panel.id = "tab-" + key;
      panel.innerHTML = html;
      var panels = document.querySelectorAll(".tab-panel");
      panels[panels.length - 1].insertAdjacentElement("afterend", panel);
      return btn;
    }

    addTab(
      "llegadas",
      "Llegada de leads",
      '<div class="filters"><label>Mes <select id="f-arr-month"><option value="Todos">Todos</option></select></label></div>' +
        '<h2 class="section-title">Resumen de llegada' + hint("respeta el filtro Plataforma de arriba (Todas / Meta / TikTok)") + "</h2>" +
        '<div class="kpi-grid" id="kpi-arr"></div>' +
        '<h2 class="section-title">Picos por hora' + hint("cuántos leads llegan en cada hora del día (hora de Lima)") + "</h2>" +
        '<div class="panel"><div class="chart-box"><canvas id="chart-arr-hour"></canvas></div></div>' +
        '<h2 class="section-title">Volumen de leads por día' + hint("leads que ingresan cada día") + "</h2>" +
        '<div class="panel"><div class="chart-box"><canvas id="chart-arr-daily"></canvas></div></div>' +
        '<h2 class="section-title">Mapa de calor' + hint("día de la semana × hora: más oscuro = más leads") + "</h2>" +
        '<div class="panel table-scroll"><table class="data-table" id="table-arr-heat"></table></div>' +
        '<h2 class="section-title">Leads por hora' + hint("detalle numérico") + "</h2>" +
        '<div class="panel table-scroll"><table class="data-table" id="table-arr-hour"></table></div>' +
        '<div class="hint" id="arr-caveat" style="margin-top:8px"></div>'
    );

    addTab(
      "sla",
      "SLA",
      '<div class="filters"><label>Mes <select id="f-sla-month"><option value="Todos">Todos</option></select></label></div>' +
        '<h2 class="section-title">SLA de tipificación' +
        hint("minutos hábiles (L-V, 9:00–18:00 Lima) desde que llega el lead hasta que se tipifica CONTACTO / NO CONTACTO; meta: " + SLA_OBJ_MIN + " min") + "</h2>" +
        '<div class="kpi-grid" id="kpi-sla"></div>' +
        '<div class="hint" id="sla-empty" style="margin:8px 0"></div>' +
        '<h2 class="section-title">Distribución del tiempo de respuesta</h2>' +
        '<div class="panel"><div class="chart-box short"><canvas id="chart-sla-dist"></canvas></div></div>' +
        '<h2 class="section-title">SLA por asesor</h2>' +
        '<div class="panel table-scroll"><table class="data-table" id="table-sla-asesor"></table></div>'
    );

    var buttons = document.querySelectorAll(".tab-btn");
    var mine = { llegadas: true, sla: true };
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (mine[btn.dataset.tab]) {
          if (btn.classList.contains("active")) return;
          document.querySelectorAll(".tab-btn").forEach(function (b) { b.classList.remove("active"); });
          btn.classList.add("active");
          document.querySelectorAll(".tab-panel").forEach(function (p) { p.classList.remove("active"); });
          document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
          requestAnimationFrame(function () {
            if (typeof charts !== "undefined") Object.values(charts).forEach(function (c) { c && c.resize(); });
          });
        } else {
          // el manejador original ya activó su pestaña; solo apagamos las nuevas
          ["llegadas", "sla"].forEach(function (k) {
            var b = document.querySelector('.tab-btn[data-tab="' + k + '"]');
            if (b) b.classList.remove("active");
            var p = document.getElementById("tab-" + k);
            if (p) p.classList.remove("active");
          });
        }
      });
    });

    document.getElementById("f-platform").addEventListener("change", renderExtras);
    document.getElementById("f-arr-month").addEventListener("change", renderExtras);
    document.getElementById("f-sla-month").addEventListener("change", renderExtras);
    var themeBtn = document.getElementById("btn-theme");
    if (themeBtn) themeBtn.addEventListener("click", function () { setTimeout(renderExtras, 0); });
  }

  // ---- 4) render ------------------------------------------------------------------
  function fillMonthSelect(id) {
    var sel = document.getElementById(id);
    if (!sel || sel.options.length > 1) return;
    monthOptions().forEach(function (m) {
      var o = document.createElement("option");
      o.value = m.value; o.textContent = m.label; sel.appendChild(o);
    });
    // por defecto: el mes más reciente (más útil para operar el día a día)
    var opts = monthOptions();
    if (opts.length) sel.value = opts[opts.length - 1].value;
  }

  function scoped(monthSelId) {
    var plat = platformFilter();
    var mk = document.getElementById(monthSelId).value;
    return EX.data.leads.filter(function (l) {
      if (plat !== "Todos" && l.platform !== plat) return false;
      if (mk !== "Todos" && l.monthKey !== mk) return false;
      return true;
    });
  }

  function tile(label, value, sub) {
    return '<div class="kpi-tile"><div class="label">' + label + '</div><div class="value ' + (String(value).length > 8 ? "small" : "") + '">' + value + "</div>" + (sub ? '<div class="sub">' + sub + "</div>" : "") + "</div>";
  }

  function renderArrivals() {
    var all = scoped("f-arr-month");
    var leads = all.filter(function (l) { return l.arrivalMs !== undefined; });
    var sinHora = all.length - leads.length;
    var plat = platformFilter();
    var platforms = plat === "Todos" ? ["Meta", "TikTok"] : [plat];

    // por hora
    var hours = {};
    platforms.forEach(function (p) { hours[p] = new Array(24).fill(0); });
    var heat = []; for (var i = 0; i < 7; i++) heat.push(new Array(24).fill(0));
    var daily = {}; // día -> {Meta, TikTok}
    var fuera = 0;
    leads.forEach(function (l) {
      hours[l.platform][l.arrHour]++;
      heat[l.arrDow][l.arrHour]++;
      if (!daily[l.arrDay]) daily[l.arrDay] = { Meta: 0, TikTok: 0 };
      daily[l.arrDay][l.platform]++;
      var habil = l.arrDow >= 1 && l.arrDow <= 5 && l.arrHour >= HORA_INI && l.arrHour < HORA_FIN;
      if (!habil) fuera++;
    });
    var totalHour = new Array(24).fill(0);
    platforms.forEach(function (p) { hours[p].forEach(function (v, h) { totalHour[h] += v; }); });
    var peakH = totalHour.indexOf(Math.max.apply(null, totalHour));
    var dowTotals = heat.map(function (row) { return row.reduce(function (a, b) { return a + b; }, 0); });
    var peakDow = dowTotals.indexOf(Math.max.apply(null, dowTotals));
    var days = Object.keys(daily).sort();
    var perDay = days.map(function (d) { return daily[d].Meta + daily[d].TikTok; });
    var maxDayIdx = perDay.indexOf(Math.max.apply(null, perDay));

    document.getElementById("kpi-arr").innerHTML = leads.length
      ? tile("Leads con hora registrada", fInt(leads.length), null) +
        tile("Hora pico", String(peakH).padStart(2, "0") + ":00–" + String(peakH + 1).padStart(2, "0") + ":00", fInt(totalHour[peakH]) + " leads (" + fPct(totalHour[peakH] / leads.length) + ")") +
        tile("Día de la semana pico", DOW_LABELS[peakDow], fInt(dowTotals[peakDow]) + " leads") +
        tile("Promedio de leads por día", (leads.length / days.length).toFixed(1), days.length + " días con leads") +
        tile("Día con más leads", maxDayIdx >= 0 ? days[maxDayIdx].slice(8, 10) + "/" + days[maxDayIdx].slice(5, 7) : "—", maxDayIdx >= 0 ? fInt(perDay[maxDayIdx]) + " leads" : "") +
        tile("Llegan fuera de horario", fPct(fuera / leads.length), "fuera de L-V " + HORA_INI + ":00–" + HORA_FIN + ":00")
      : tile("Sin datos", "—", "no hay leads con hora de llegada para este filtro");

    // gráfico por hora
    destroy("arrHour");
    var labelsH = []; for (var h = 0; h < 24; h++) labelsH.push(String(h).padStart(2, "0") + ":00");
    charts.arrHour = new Chart(document.getElementById("chart-arr-hour"), {
      type: "bar",
      data: {
        labels: labelsH,
        datasets: platforms.map(function (p) {
          return { label: p, data: hours[p], backgroundColor: css(PLAT_COLOR_VAR[p]), stack: "h", borderRadius: 3, maxBarThickness: 28 };
        }),
      },
      options: {
        responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { position: "top", labels: { color: css("--text-secondary"), usePointStyle: true } },
          tooltip: { callbacks: { afterTitle: function (items) { return "Total: " + fInt(totalHour[items[0].dataIndex]); } } },
        },
        scales: {
          x: { stacked: true, ticks: { color: css("--text-muted"), maxRotation: 60, minRotation: 60 }, grid: { display: false } },
          y: { stacked: true, beginAtZero: true, ticks: { color: css("--text-muted"), precision: 0 }, grid: { color: css("--gridline") } },
        },
      },
    });

    // gráfico por día
    destroy("arrDaily");
    charts.arrDaily = new Chart(document.getElementById("chart-arr-daily"), {
      type: "bar",
      data: {
        labels: days,
        datasets: platforms.map(function (p) {
          return { label: p, data: days.map(function (d) { return daily[d][p]; }), backgroundColor: css(PLAT_COLOR_VAR[p]), stack: "d", borderRadius: 3, maxBarThickness: 18 };
        }),
      },
      options: {
        responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { position: "top", labels: { color: css("--text-secondary"), usePointStyle: true } },
          tooltip: { callbacks: { afterTitle: function (items) { return "Total: " + fInt(perDay[items[0].dataIndex]); } } },
        },
        scales: {
          x: { stacked: true, ticks: { color: css("--text-muted"), maxRotation: 60, minRotation: 60, autoSkip: true, maxTicksLimit: 24 }, grid: { display: false } },
          y: { stacked: true, beginAtZero: true, ticks: { color: css("--text-muted"), precision: 0 }, grid: { color: css("--gridline") } },
        },
      },
    });

    // mapa de calor
    var maxCell = Math.max(1, Math.max.apply(null, heat.map(function (r) { return Math.max.apply(null, r); })));
    var head = "<thead><tr><th class=\"left\">Día</th>" + labelsH.map(function (l) { return "<th>" + l.slice(0, 2) + "</th>"; }).join("") + "<th>Total</th></tr></thead>";
    var body = DOW_ORDER.map(function (d) {
      return "<tr><td class=\"left\">" + DOW_LABELS[d] + "</td>" + heat[d].map(function (v) {
        var pct = Math.round((v / maxCell) * 100);
        return '<td style="background:color-mix(in srgb, ' + css("--series-1") + " " + pct + '%, transparent);text-align:center">' + (v || "") + "</td>";
      }).join("") + "<td><strong>" + fInt(dowTotals[d]) + "</strong></td></tr>";
    }).join("");
    document.getElementById("table-arr-heat").innerHTML = head + "<tbody>" + body + "</tbody>";

    // tabla por hora
    var th = "<thead><tr><th class=\"left\">Hora</th>" + platforms.map(function (p) { return "<th>" + p + "</th>"; }).join("") + "<th>Total</th><th>% del total</th></tr></thead>";
    var tb = labelsH.map(function (lab, h) {
      return "<tr><td class=\"left\">" + lab + "</td>" + platforms.map(function (p) { return "<td>" + fInt(hours[p][h]) + "</td>"; }).join("") + "<td><strong>" + fInt(totalHour[h]) + "</strong></td><td>" + fPct(leads.length ? totalHour[h] / leads.length : null) + "</td></tr>";
    }).join("");
    document.getElementById("table-arr-hour").innerHTML = th + "<tbody>" + tb + "</tbody>";

    document.getElementById("arr-caveat").textContent = sinHora > 0
      ? sinHora.toLocaleString("es-PE") + " leads de este filtro no traen hora exacta de llegada en el Sheet (solo fecha) y no aparecen en esta pestaña."
      : "";
  }

  var BUCKETS = [
    { label: "≤ 5 min", max: 5 }, { label: "5–15 min", max: 15 }, { label: "15–30 min", max: 30 },
    { label: "30–60 min", max: 60 }, { label: "1–2 h", max: 120 }, { label: "> 2 h", max: Infinity },
  ];

  function renderSla() {
    var all = scoped("f-sla-month");
    var medidos = all.filter(function (l) { return l.slaMin !== null && l.slaMin !== undefined; });
    var vals = medidos.map(function (l) { return l.slaMin; });
    var pendientes = all.filter(function (l) { return !l.gestionado; }).length;
    var enMeta = vals.filter(function (v) { return v <= SLA_OBJ_MIN; }).length;
    var en60 = vals.filter(function (v) { return v <= 60; }).length;

    document.getElementById("kpi-sla").innerHTML =
      tile("Leads con SLA medido", fInt(vals.length), "tipificados desde que se activó el SLA") +
      tile("Mediana", fMin(median(vals)), "tiempo típico de respuesta") +
      tile("Promedio", fMin(mean(vals)), null) +
      tile("Dentro de la meta (≤ " + SLA_OBJ_MIN + " min)", fPct(vals.length ? enMeta / vals.length : null), fInt(enMeta) + " de " + fInt(vals.length)) +
      tile("Dentro de 1 hora", fPct(vals.length ? en60 / vals.length : null), null) +
      tile("Sin tipificar todavía", fInt(pendientes), "leads sin Status Gestión");
    document.getElementById("sla-empty").textContent = vals.length
      ? ""
      : "Todavía no hay tipificaciones con SLA: se empieza a medir desde que se activó el registro en el Sheet (columnas “Fecha Tipificación” y “SLA (min)”). Los leads antiguos no tienen esta medición.";

    destroy("slaDist");
    var counts = BUCKETS.map(function () { return 0; });
    vals.forEach(function (v) { for (var i = 0; i < BUCKETS.length; i++) { if (v <= BUCKETS[i].max) { counts[i]++; break; } } });
    charts.slaDist = new Chart(document.getElementById("chart-sla-dist"), {
      type: "bar",
      data: { labels: BUCKETS.map(function (b) { return b.label; }), datasets: [{ label: "Leads", data: counts, backgroundColor: css("--series-3"), borderRadius: 4, maxBarThickness: 56 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return fInt(c.raw) + " leads (" + fPct(vals.length ? c.raw / vals.length : null) + ")"; } } } },
        scales: {
          x: { ticks: { color: css("--text-muted") }, grid: { display: false } },
          y: { beginAtZero: true, ticks: { color: css("--text-muted"), precision: 0 }, grid: { color: css("--gridline") } },
        },
      },
    });

    var by = {};
    medidos.forEach(function (l) { (by[l.asesor] = by[l.asesor] || []).push(l.slaMin); });
    var rows = Object.keys(by).map(function (a) {
      var v = by[a];
      return { asesor: a, n: v.length, med: median(v), avg: mean(v), meta: v.filter(function (x) { return x <= SLA_OBJ_MIN; }).length / v.length };
    }).sort(function (a, b) { return a.med - b.med; });
    document.getElementById("table-sla-asesor").innerHTML =
      "<thead><tr><th class=\"left\">Asesor</th><th>Leads medidos</th><th>Mediana</th><th>Promedio</th><th>% dentro de " + SLA_OBJ_MIN + " min</th></tr></thead><tbody>" +
      (rows.length ? rows.map(function (r) {
        return "<tr><td class=\"left\">" + r.asesor + "</td><td>" + fInt(r.n) + "</td><td>" + fMin(r.med) + "</td><td>" + fMin(r.avg) + "</td><td>" + fPct(r.meta) + "</td></tr>";
      }).join("") : "<tr><td class=\"left\" colspan=\"5\">Sin datos todavía</td></tr>") + "</tbody>";
  }

  function renderExtras() {
    try {
      if (!EX.data) return;
      injectTabs();
      fillMonthSelect("f-arr-month");
      fillMonthSelect("f-sla-month");
      renderArrivals();
      renderSla();
    } catch (err) {
      console.error("extras.js:", err);
    }
  }

  // Si el script se carga cuando la página ya está lista (p. ej. pruebas), no esperamos al DOMContentLoaded.
  if (document.readyState !== "loading") setTimeout(injectTabs, 0);
  else document.addEventListener("DOMContentLoaded", function () { setTimeout(injectTabs, 0); });
  window.__extras = { renderExtras: renderExtras, state: EX };
})();
