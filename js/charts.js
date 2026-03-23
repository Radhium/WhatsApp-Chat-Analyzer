// charts.js
// Renders all Chart.js charts on dashboard.html.
// Called by render.js after DOM is populated.
// Depends on Chart.js being loaded via CDN in dashboard.html.

// Colour ramp for messages-by-person bar chart (top 10 + others)
const BLUES = [
  "#1A73E8",
  "#3D8EF0",
  "#5A9CF0",
  "#78ADF3",
  "#93BBF5",
  "#AACBF7",
  "#B8D3F8",
  "#C8DBFA",
  "#D5E4FB",
  "#DFEBFC",
  "#E0E3E7", // "others" gets the neutral grey
];

const ACCENT = "#1A73E8";
const GRID_CLR = "#E0E3E7";

// Keep references so the resize handler can reach both charts
let messagesChart = null;
let activityChart = null;

// ─── Entry point ─────────────────────────────────────────────────────────────

export function renderCharts(data) {
  applyChartDefaults();
  messagesChart = renderMessagesChart(data);
  activityChart = renderActivityChart(data);
  attachResizeHandler();
}

// ─── Global Chart.js defaults ────────────────────────────────────────────────

function applyChartDefaults() {
  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.color = "#9AA0A6";
}

// ─── Messages by person (horizontal bar) ─────────────────────────────────────

function renderMessagesChart(data) {
  const canvas = document.getElementById("messagesChart");
  if (!canvas) return null;

  const { userCounts, participants } = data;

  const sorted = participants
    .slice()
    .sort((a, b) => (userCounts[b] ?? 0) - (userCounts[a] ?? 0));

  const top10 = sorted.slice(0, 10);
  const theRest = sorted.slice(10);

  const labels = top10.map((n) => n);
  const counts = top10.map((n) => userCounts[n] ?? 0);
  const colors = top10.map((_, i) => BLUES[i] ?? BLUES[BLUES.length - 2]);

  if (theRest.length > 0) {
    const othersTotal = theRest.reduce(
      (sum, n) => sum + (userCounts[n] ?? 0),
      0,
    );
    labels.push(`${theRest.length} others`);
    counts.push(othersTotal);
    colors.push(BLUES[BLUES.length - 1]);
  }

  return new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          data: counts,
          backgroundColor: colors,
          borderRadius: 4,
          borderSkipped: false,
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
            label: (ctx) => ` ${ctx.parsed.x.toLocaleString()} messages`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: GRID_CLR },
          border: { color: GRID_CLR },
          ticks: { font: { size: 11 } },
        },
        y: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            font: { size: 12, weight: "500" },
            color: "#444950",
          },
        },
      },
    },
  });
}

// ─── Activity by hour (area line chart) ──────────────────────────────────────

function renderActivityChart(data) {
  const canvas = document.getElementById("activityChart");
  if (!canvas) return null;

  const { hourCounts } = data;

  // Fill all 24 hours, defaulting to 0 for any hour with no messages
  const counts = Array.from(
    { length: 24 },
    (_, h) => hourCounts[String(h)] ?? 0,
  );

  const labels = Array.from({ length: 24 }, (_, h) => {
    if (h === 0) return "12 am";
    if (h < 12) return `${h} am`;
    if (h === 12) return "12 pm";
    return `${h - 12} pm`;
  });

  // Build a descriptive insight line below the chart
  updateActivityInsight(hourCounts);

  return new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          data: counts,
          borderColor: ACCENT,
          backgroundColor: "rgba(26,115,232,0.08)",
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: ACCENT,
          fill: true,
          tension: 0.4,
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
            label: (ctx) => ` ${ctx.parsed.y} messages`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { color: GRID_CLR },
          ticks: {
            font: { size: 11 },
            maxRotation: 0,
            maxTicksLimit: window.innerWidth < 768 ? 5 : 8,
          },
        },
        y: {
          grid: { color: GRID_CLR },
          border: { display: false },
          ticks: { font: { size: 11 } },
        },
      },
    },
  });
}

// Writes a human-readable insight line under the activity chart
function updateActivityInsight(hourCounts) {
  const insightEl = document
    .querySelector("#activityChart")
    ?.closest(".card")
    ?.querySelector('p[style*="font-size: 13px"]');

  if (!insightEl) return;

  const sorted = Object.entries(hourCounts)
    .map(([h, c]) => ({ h: parseInt(h, 10), c }))
    .sort((a, b) => b.c - a.c);

  if (!sorted.length) {
    insightEl.innerHTML = "";
    return;
  }

  const peakHour = sorted[0].h;
  const quietHour = sorted[sorted.length - 1].h;

  insightEl.innerHTML = `
    Peak activity at <strong style="color: var(--text-secondary)">${formatHour(peakHour)}.</strong>
    Quietest around <strong style="color: var(--text-secondary)">${formatHour(quietHour)}.</strong>
  `;
}

// ─── Resize handler ───────────────────────────────────────────────────────────

function attachResizeHandler() {
  window.addEventListener("resize", () => {
    messagesChart?.resize();
    activityChart?.resize();
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatHour(h) {
  if (h === 0) return "12 am";
  if (h < 12) return `${h} am`;
  if (h === 12) return "12 pm";
  return `${h - 12} pm`;
}
