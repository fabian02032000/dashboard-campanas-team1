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

function renderGeneralKpis(k) {
  const tiles = [
    ["Leads ingresados", fmtInt(k.leadsIngresados), null],
    ["Leads gestionados", fmtInt(k.gestionados), `${fmtPct(k.pctGestion)} del total`],
    ["Contactados", fmtInt(k.contacto), `${fmtPct(k.pctContacto)} de gestionados`],
    ["Leads vendidos", fmtInt(k.ventas), `${fmtPct(k.vendidoPorContacto)} de contactados`],
    ["CVR", fmtPct(k.cvr), "ventas / leads"],
    ["CPL", fmtMoney(k.cpl), "inversión / lead"],
    ["CPA", fmtMoney(k.cpa), "inversión / venta"],
    ["Inversión", fmtMoney(k.inversion), null],
    ["Monto vendido", fmtMoney(k.montoVendido), `ticket prom. ${fmtMoney(k.ticketPromedio)}`],
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
      <th class="left">Mes</th><th>Leads</th><th>Gestión.</th><th>Contacto</th><th>Ventas</th>
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
      <th>Leads</th><th>Gestión.</th><th>Contacto</th><th>Ventas</th>
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

function renderAll() {
  const filters = currentFilters();
  renderGeneralKpis(computeGeneralSummary(DASHBOARD_DATA, filters));
  renderMonthly(computeMonthlySummary(DASHBOARD_DATA, filters));
  renderTipificaciones(computeTipificaciones(DASHBOARD_DATA, filters));
  renderAsesores(computeAsesorRanking(DASHBOARD_DATA, filters));

  const sinFecha = applyFilters(DASHBOARD_DATA.leads, { platform: filters.platform, asesor: filters.asesor }).filter(
    (l) => !l.monthKey
  ).length;
  const caveat = document.getElementById("monthly-caveat");
  caveat.textContent = sinFecha > 0 ? `· ${sinFecha.toLocaleString("es-PE")} leads sin fecha en el Sheet (sí cuentan en el resumen general, no aparecen aquí)` : "";
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
    document.getElementById("content").style.display = "block";
    renderAll();
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

function initTheme() {
  const saved = localStorage.getItem("dashboard-theme");
  if (saved) document.documentElement.setAttribute("data-theme", saved);
  document.getElementById("btn-theme").addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme");
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("dashboard-theme", next);
    renderAll();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  ["f-platform", "f-month", "f-asesor"].forEach((id) =>
    document.getElementById(id).addEventListener("change", renderAll)
  );
  document.getElementById("btn-refresh").addEventListener("click", loadAndRender);
  loadAndRender();

  if (CONFIG.AUTO_REFRESH_MINUTES > 0) {
    setInterval(loadAndRender, CONFIG.AUTO_REFRESH_MINUTES * 60 * 1000);
  }
});
