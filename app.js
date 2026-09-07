// ============================================================================
// Render del dashboard: toma los datos ya calculados (metrics.js) y pinta
// KPIs, gráficos (Chart.js) y tablas. Se re-ejecuta cada vez que cambia un
// filtro, sin volver a pedir datos al Sheet.
// ============================================================================

let DASHBOARD_DATA = null;
let charts = {};

const fmtInt = (n) => (n === null || n === undefined ? "—" : Math.round(n).toLocaleString("es-PE"));
const fmtPct = (n) => (n === null || n === undefined ? "—" : (n * 100).toFixed(1) + "%");
const fmtMoney = (n) =>
  n === null || n === undefined ? "—" : "S/ " + n.toLocaleString("es-PE", { maximumFractionDigits: 1 });

function seriesColor(i) {
  return getComputedStyle(document.documentElement).getPropertyValue(`--series-${(i % 8) + 1}`).trim();
}
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// ---- filtros -----------------------------------------------------------

function currentFilters() {
  return {
    platform: document.getElementById("f-platform").value,
    monthKey: document.getElementById("f-month").value,
    asesor: document.getElementById("f-asesor").value,
  };
}

function populateFilterOptions() {
  const monthSel = document.getElementById("f-month");
  const asesorSel = document.getElementById("f-asesor");
  const months = getAvailableMonths(DASHBOARD_DATA);
  const asesores = getAvailableAsesores(DASHBOARD_DATA);

  months.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m.value;
    opt.textContent = m.label;
    monthSel.appendChild(opt);
  });
  asesores.forEach((a) => {
    const opt = document.createElement("option");
    opt.value = a;
    opt.textContent = a;
    asesorSel.appendChild(opt);
  });
}

// ---- filtros de la pestaña "Rendimiento por anuncio" ------------------------
// Independientes de los filtros generales (excepto Plataforma, que aplica a
// todo el dashboard): Campaña, Conjunto de anuncios y Mes.

function currentAdFilters() {
  return {
    platform: document.getElementById("f-platform").value,
    monthKey: document.getElementById("f-ads-month").value,
    campana: document.getElementById("f-ads-campana").value,
    adset: document.getElementById("f-ads-adset").value,
  };
}

function populateAdFilterOptions() {
  const campanaSel = document.getElementById("f-ads-campana");
  const monthSel = document.getElementById("f-ads-month");

  getAvailableCampanas(DASHBOARD_DATA).forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    campanaSel.appendChild(opt);
  });
  getAvailableMonths(DASHBOARD_DATA).forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m.value;
    opt.textContent = m.label;
    monthSel.appendChild(opt);
  });
  refreshAdsetOptions("Todos");
}

// El conjunto de anuncios depende de la campaña elegida (cascada): al cambiar
// la campaña, solo mostramos los conjuntos que existen dentro de ella.
function refreshAdsetOptions(campana) {
  const adsetSel = document.getElementById("f-ads-adset");
  const currentVal = adsetSel.value;
  const adsets = getAvailableAdsets(DASHBOARD_DATA, campana);

  adsetSel.innerHTML = "";
  const optTodos = document.createElement("option");
  optTodos.value = "Todos";
  optTodos.textContent = "Todos";
  adsetSel.appendChild(optTodos);
  adsets.forEach((a) => {
    const opt = document.createElement("option");
    opt.value = a;
    opt.textContent = a;
    adsetSel.appendChild(opt);
  });
  adsetSel.value = adsets.includes(currentVal) ? currentVal : "Todos";
}

// ---- KPIs generales ------------------------------------------------------

function renderGeneralKpis(k) {
  const tiles = [
    ["Leads ingresados", fmtInt(k.leadsIngresados), null],
    ["Leads gestionados", fmtInt(k.gestionados), `${fmtPct(k.pctGestion)} del total`],
    ["Contactados", fmtInt(k.contacto), `${fmtPct(k.pctContacto)} de gestionados`],
    ["Ventas (clientes)", fmtInt(k.ventas), `${fmtPct(k.vendidoPorContacto)} de contactados`],
    ["Unidades vendidas", fmtInt(k.unidadesVendidas), "líneas totales (multi cuenta 2, 3…)"],
    ["CVR", fmtPct(k.cvr), "ventas / leads"],
    ["CPL", fmtMoney(k.cpl), "inversión / lead"],
    ["CPA", fmtMoney(k.cpa), "inversión / unidad vendida"],
    ["Inversión", fmtMoney(k.inversion), null],
  ];
  const el = document.getElementById("kpi-general");
  el.innerHTML = tiles
    .map(
      ([label, value, sub]) => `
      <div class="kpi-tile">
        <div class="label">${label}</div>
        <div class="value ${value.length > 8 ? "small" : ""}">${value}</div>
        ${sub ? `<div class="sub">${sub}</div>` : ""}
      </div>`
    )
    .join("");
}

// ---- resumen mensual -----------------------------------------------------

function renderMonthly(rows) {
  const ctx = document.getElementById("chart-monthly");
  const labels = rows.map((r) => r.label);
  if (charts.monthly) charts.monthly.destroy();
  charts.monthly = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Leads ingresados",
          data: rows.map((r) => r.leadsIngresados),
          backgroundColor: cssVar("--series-1"),
          borderRadius: 4,
          maxBarThickness: 36,
        },
        {
          label: "Leads vendidos",
          data: rows.map((r) => r.ventas),
          backgroundColor: cssVar("--series-2"),
          borderRadius: 4,
          maxBarThickness: 36,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { position: "top", labels: { color: cssVar("--text-secondary"), usePointStyle: true } },
        tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmtInt(c.raw)}` } },
      },
      scales: {
        x: { ticks: { color: cssVar("--text-muted") }, grid: { display: false } },
        y: {
          beginAtZero: true,
          ticks: { color: cssVar("--text-muted") },
          grid: { color: cssVar("--gridline") },
        },
      },
    },
  });

  const table = document.getElementById("table-monthly");
  table.innerHTML = `
    <thead><tr>
      <th class="left">Mes</th><th>Leads</th><th>Gestión.</th><th>Contacto</th><th>Ventas</th><th>Unidades</th>
      <th>% Gestión</th><th>% Contacto</th><th>CVR</th><th>Vendido/Contacto</th>
      <th>Inversión</th><th>CPL</th><th>CPA</th>
    </tr></thead>
    <tbody>
      ${rows
        .map(
          (r) => `<tr>
            <td class="left">${r.label}</td>
            <td>${fmtInt(r.leadsIngresados)}</td>
            <td>${fmtInt(r.gestionados)}</td>
            <td>${fmtInt(r.contacto)}</td>
            <td>${fmtInt(r.ventas)}</td>
            <td>${fmtInt(r.unidadesVendidas)}</td>
            <td>${fmtPct(r.pctGestion)}</td>
            <td>${fmtPct(r.pctContacto)}</td>
            <td>${fmtPct(r.cvr)}</td>
            <td>${fmtPct(r.vendidoPorContacto)}</td>
            <td>${fmtMoney(r.inversion)}</td>
            <td>${fmtMoney(r.cpl)}</td>
            <td>${fmtMoney(r.cpa)}</td>
          </tr>`
        )
        .join("")}
    </tbody>`;
}

// ---- plan más vendido -------------------------------------------------------

function renderPlanRanking(rows) {
  const ctx = document.getElementById("chart-plan");
  if (charts.plan) charts.plan.destroy();
  charts.plan = new Chart(ctx, {
    type: "bar",
    data: {
      labels: rows.map((r) => r.label),
      datasets: [
        {
          label: "Ventas",
          data: rows.map((r) => r.ventas),
          backgroundColor: cssVar("--series-3"),
          borderRadius: 4,
          maxBarThickness: 48,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (c) => {
              const r = rows[c.dataIndex];
              return [`Ventas: ${fmtInt(r.ventas)} (${fmtPct(r.pctVentas)})`, `Unidades: ${fmtInt(r.unidades)}`];
            },
          },
        },
      },
      scales: {
        x: { ticks: { color: cssVar("--text-muted") }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { color: cssVar("--text-muted") }, grid: { color: cssVar("--gridline") } },
      },
    },
  });

  const table = document.getElementById("table-plan");
  table.innerHTML = `
    <thead><tr><th class="left">Plan</th><th>Ventas (clientes)</th><th>% de ventas</th><th>Unidades</th></tr></thead>
    <tbody>
      ${rows
        .map(
          (r) => `<tr>
            <td class="left">${r.label}</td>
            <td>${fmtInt(r.ventas)}</td>
            <td>${fmtPct(r.pctVentas)}</td>
            <td>${fmtInt(r.unidades)}</td>
          </tr>`
        )
        .join("")}
    </tbody>`;
}

// ---- torta de tipificaciones ----------------------------------------------

function renderTipificaciones(rows) {
  const ctx = document.getElementById("chart-tipif");
  const colors = rows.map((r, i) => (r.isOther ? cssVar("--text-muted") : seriesColor(i)));
  if (charts.tipif) charts.tipif.destroy();
  charts.tipif = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: rows.map((r) => r.label),
      datasets: [{ data: rows.map((r) => r.value), backgroundColor: colors, borderColor: cssVar("--surface-1"), borderWidth: 2 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "58%",
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (c) => `${c.label}: ${fmtInt(c.raw)} (${fmtPct(rows[c.dataIndex].pct)})`,
          },
        },
      },
    },
  });

  const legend = document.getElementById("legend-tipif");
  legend.innerHTML = rows
    .map(
      (r, i) => `<li>
        <span class="swatch" style="background:${r.isOther ? cssVar("--text-muted") : seriesColor(i)}"></span>
        <span>${r.label}</span>
        <span class="val">${fmtInt(r.value)} · ${fmtPct(r.pct)}</span>
      </li>`
    )
    .join("");
}

// ---- ranking por asesor -----------------------------------------------------

function renderAsesores(rows) {
  const ctx = document.getElementById("chart-asesor");
  const top = rows.slice(0, 12);
  if (charts.asesor) charts.asesor.destroy();
  charts.asesor = new Chart(ctx, {
    type: "bar",
    data: {
      labels: top.map((r) => r.asesor),
      datasets: [
        {
          label: "Ventas",
          data: top.map((r) => r.ventas),
          backgroundColor: cssVar("--series-1"),
          borderRadius: 4,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (c) => {
              const r = top[c.dataIndex];
              return [`Ventas: ${fmtInt(r.ventas)}`, `Efectividad (vs gestionados): ${fmtPct(r.efectividadGestion)}`, `Vendido/Contacto: ${fmtPct(r.vendidoPorContacto)}`];
            },
          },
        },
      },
      scales: {
        x: { beginAtZero: true, ticks: { color: cssVar("--text-muted") }, grid: { color: cssVar("--gridline") } },
        y: { ticks: { color: cssVar("--text-secondary") }, grid: { display: false } },
      },
    },
  });

  const table = document.getElementById("table-asesor");
  table.innerHTML = `
    <thead><tr>
      <th class="left">#</th><th class="left">Asesor</th><th class="left">Supervisor</th>
      <th>Leads</th><th>Gestión.</th><th>Contacto</th><th>Ventas</th><th>Unidades</th>
      <th>% Gestión</th><th>% Contacto</th><th>CVR</th>
      <th>Efect. (vs gestión.)</th><th>Vendido/Contacto</th>
    </tr></thead>
    <tbody>
      ${rows
        .map(
          (r, i) => `<tr>
            <td class="${i === 0 ? "rank-1" : ""}">${i + 1}</td>
            <td class="left">${r.asesor}</td>
            <td class="left">${r.supervisor}</td>
            <td>${fmtInt(r.leadsIngresados)}</td>
            <td>${fmtInt(r.gestionados)}</td>
            <td>${fmtInt(r.contacto)}</td>
            <td>${fmtInt(r.ventas)}</td>
            <td>${fmtInt(r.unidadesVendidas)}</td>
            <td>${fmtPct(r.pctGestion)}</td>
            <td>${fmtPct(r.pctContacto)}</td>
            <td>${fmtPct(r.cvr)}</td>
            <td>${fmtPct(r.efectividadGestion)}</td>
            <td>${fmtPct(r.vendidoPorContacto)}</td>
          </tr>`
        )
        .join("")}
    </tbody>`;
}

// ---- rendimiento por anuncio ------------------------------------------------

// Siempre visible arriba de la pestaña: cuál anuncio vende más dentro del
// filtro actual (Campaña / Conjunto / Mes / Plataforma).
function renderAdHighlight(rows) {
  const el = document.getElementById("ad-highlight");
  if (!rows.length) {
    el.innerHTML = `<div class="ad-highlight-label">🏆 Anuncio con más ventas</div><div class="sub">No hay leads para este filtro.</div>`;
    return;
  }
  const top = rows[0];
  el.innerHTML = `
    <div class="ad-highlight-label">🏆 Anuncio con más ventas</div>
    <div class="ad-highlight-row">
      <div>
        <div class="ad-highlight-name">${top.ad}</div>
        <div class="ad-highlight-meta">${top.campana} · ${top.adset} · ${top.platform}</div>
      </div>
      <div class="ad-highlight-stats">
        <div>Ventas<strong>${fmtInt(top.ventas)}</strong></div>
        <div>Leads<strong>${fmtInt(top.leadsIngresados)}</strong></div>
        <div>CVR<strong>${fmtPct(top.cvr)}</strong></div>
      </div>
    </div>`;
}

function renderAdRanking(rows) {
  const ctx = document.getElementById("chart-ads");
  const top = rows.slice(0, 12);
  if (charts.ads) charts.ads.destroy();
  charts.ads = new Chart(ctx, {
    type: "bar",
    data: {
      labels: top.map((r) => r.ad),
      datasets: [
        {
          label: "Ventas",
          data: top.map((r) => r.ventas),
          backgroundColor: cssVar("--series-4"),
          borderRadius: 4,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => top[items[0].dataIndex].ad,
            label: (c) => {
              const r = top[c.dataIndex];
              return [
                `Conjunto: ${r.adset}`,
                `Campaña: ${r.campana}`,
                `Leads: ${fmtInt(r.leadsIngresados)}`,
                `Ventas: ${fmtInt(r.ventas)}`,
                `CVR: ${fmtPct(r.cvr)}`,
              ];
            },
          },
        },
      },
      scales: {
        x: { beginAtZero: true, ticks: { color: cssVar("--text-muted") }, grid: { color: cssVar("--gridline") } },
        y: { ticks: { color: cssVar("--text-secondary") }, grid: { display: false } },
      },
    },
  });

  const table = document.getElementById("table-ads");
  table.innerHTML = `
    <thead><tr>
      <th class="left">#</th><th class="left">Anuncio</th><th class="left">Conjunto</th><th class="left">Campaña</th>
      <th>Plataforma</th><th>Leads</th><th>Gestión.</th><th>Ventas</th><th>Unidades</th>
      <th>% Gestión</th><th>CVR</th><th>Efect. (vs gestión.)</th>
    </tr></thead>
    <tbody>
      ${rows
        .map(
          (r, i) => `<tr>
            <td class="${i === 0 ? "rank-1" : ""}">${i + 1}</td>
            <td class="left">${r.ad}</td>
            <td class="left">${r.adset}</td>
            <td class="left">${r.campana}</td>
            <td>${r.platform}</td>
            <td>${fmtInt(r.leadsIngresados)}</td>
            <td>${fmtInt(r.gestionados)}</td>
            <td>${fmtInt(r.ventas)}</td>
            <td>${fmtInt(r.unidadesVendidas)}</td>
            <td>${fmtPct(r.pctGestion)}</td>
            <td>${fmtPct(r.cvr)}</td>
            <td>${fmtPct(r.efectividadGestion)}</td>
          </tr>`
        )
        .join("")}
    </tbody>`;
}

// ---- orquestación ----------------------------------------------------------

function renderAll() {
  const filters = currentFilters();
  renderGeneralKpis(computeGeneralSummary(DASHBOARD_DATA, filters));
  renderMonthly(computeMonthlySummary(DASHBOARD_DATA, filters));
  renderTipificaciones(computeTipificaciones(DASHBOARD_DATA, filters));
  renderPlanRanking(computePlanRanking(DASHBOARD_DATA, filters));
  renderAsesores(computeAsesorRanking(DASHBOARD_DATA, filters));

  const sinFecha = applyFilters(DASHBOARD_DATA.leads, { platform: filters.platform, asesor: filters.asesor }).filter(
    (l) => !l.monthKey
  ).length;
  const caveat = document.getElementById("monthly-caveat");
  caveat.textContent = sinFecha > 0 ? `· ${sinFecha.toLocaleString("es-PE")} leads sin fecha en el Sheet (sí cuentan en el resumen general, no aparecen aquí)` : "";
}

// Pestaña "Rendimiento por anuncio": tiene sus propios filtros (Campaña,
// Conjunto, Mes) y comparte solo la Plataforma con el resto del dashboard.
function renderAdsTab() {
  const rows = computeAdRanking(DASHBOARD_DATA, currentAdFilters());
  renderAdHighlight(rows);
  renderAdRanking(rows);
}

function setStatus(msg, isError) {
  const el = document.getElementById("status-line");
  el.textContent = msg;
  el.classList.toggle("error", !!isError);
}

async function loadAndRender() {
  document.getElementById("loading").classList.remove("hidden");
  document.getElementById("error-holder").innerHTML = "";
  try {
    setStatus("Cargando…");
    DASHBOARD_DATA = await loadDashboardData();
    if (!DASHBOARD_DATA.leads.length) {
      throw new Error("Se conectó al Sheet pero no se encontraron leads. Revisa los nombres de las pestañas en config.js.");
    }
    if (document.getElementById("f-month").options.length <= 1) populateFilterOptions();
    if (document.getElementById("f-ads-campana").options.length <= 1) populateAdFilterOptions();
    document.getElementById("content").style.display = "block";
    renderAll();
    renderAdsTab();
    const now = new Date();
    const label = now.toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short" });
    setStatus(`Actualizado: ${label} · ${DASHBOARD_DATA.leads.length.toLocaleString("es-PE")} leads cargados`);
    document.getElementById("footer-updated").textContent = `Última carga: ${label}`;

    const missing = await getMissingSheets();
    if (missing.length) {
      document.getElementById("error-holder").innerHTML =
        `<div class="error-box">⚠️ No se encontró ${missing.length === 1 ? "esta pestaña" : "estas pestañas"} en el Sheet — sus leads NO están contados arriba: ${missing.map((m) => `"${m}"`).join(", ")}. Revisa que el nombre en config.js coincida exactamente con el nombre real de la pestaña.</div>`;
    }
  } catch (err) {
    console.error(err);
    setStatus("Error al cargar datos", true);
    document.getElementById("error-holder").innerHTML = `<div class="error-box">⚠️ ${err.message}</div>`;
  } finally {
    document.getElementById("loading").classList.add("hidden");
  }
}

// ---- pestañas (tabs) --------------------------------------------------------

function initTabs() {
  const buttons = document.querySelectorAll(".tab-btn");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.classList.contains("active")) return;
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
      // Los gráficos de Chart.js que estaban en una pestaña oculta (display:none)
      // se crean con tamaño 0, así que hay que forzar un resize al mostrar la pestaña.
      requestAnimationFrame(() => {
        Object.values(charts).forEach((c) => c && c.resize());
      });
    });
  });
}

// ---- tema claro/oscuro ------------------------------------------------------

function initTheme() {
  const saved = localStorage.getItem("dashboard-theme");
  if (saved) document.documentElement.setAttribute("data-theme", saved);
  document.getElementById("btn-theme").addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme");
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("dashboard-theme", next);
    // los charts leen colores de CSS vars, hay que repintar ambas pestañas
    renderAll();
    renderAdsTab();
  });
}

// ---- init ---------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initTabs();
  ["f-platform", "f-month", "f-asesor"].forEach((id) =>
    document.getElementById(id).addEventListener("change", renderAll)
  );
  // Plataforma es el único filtro que comparten ambas pestañas.
  document.getElementById("f-platform").addEventListener("change", renderAdsTab);
  document.getElementById("f-ads-campana").addEventListener("change", () => {
    refreshAdsetOptions(document.getElementById("f-ads-campana").value);
    renderAdsTab();
  });
  document.getElementById("f-ads-adset").addEventListener("change", renderAdsTab);
  document.getElementById("f-ads-month").addEventListener("change", renderAdsTab);
  document.getElementById("btn-refresh").addEventListener("click", loadAndRender);
  loadAndRender();

  if (CONFIG.AUTO_REFRESH_MINUTES > 0) {
    setInterval(loadAndRender, CONFIG.AUTO_REFRESH_MINUTES * 60 * 1000);
  }
});
