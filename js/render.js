// render.js
// Reads parsed chat data from sessionStorage, populates every section of dashboard.html.
// Called once on DOMContentLoaded. charts.js handles all canvas rendering.

import { renderCharts } from "./charts.js";
import { formatDuration } from "./stats.js";

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// ─── Entry point ─────────────────────────────────────────────────────────────

export function initDashboard() {
  const raw = sessionStorage.getItem("chatData");
  if (!raw) {
    // Nothing to show — send user back to upload
    window.location.href = "index.html";
    return;
  }

  const data = deserialise(raw);
  populateSummaryBar(data);
  populateMessagesSection(data);
  populateResponseTimeSection(data);
  populateStreaksSection(data);
  populateCalendar(data);
  populateFooter(data);
  renderCharts(data);
}

// ─── Deserialise ─────────────────────────────────────────────────────────────

// sessionStorage only holds strings. app.js serialises Date objects as ISO strings;
// we rebuild them here so the rest of render.js can treat them as real Date objects.
function deserialise(raw) {
  const data = JSON.parse(raw);
  data.firstDate = new Date(data.firstDate);
  data.lastDate = new Date(data.lastDate);

  // messageList timestamps also need rebuilding
  data.messageList = data.messageList.map((msg) => ({
    ...msg,
    timestamp: new Date(msg.timestamp),
  }));

  return data;
}

// ─── Summary bar ─────────────────────────────────────────────────────────────

function populateSummaryBar(data) {
  const bar = document.querySelector(".summary-bar-inner");
  if (!bar) return;

  const stats = bar.querySelectorAll(".summary-stat");

  // Total messages
  setText(stats[0], ".summary-number", data.total.toLocaleString());

  // Participants
  const count = data.participants.length;
  setText(stats[1], ".summary-number", count.toString());
  if (count <= 6) {
    // Names fit in the sub-label
    let sub = stats[1].querySelector(".summary-sub");
    if (!sub) {
      sub = document.createElement("span");
      sub.className = "summary-sub";
      stats[1].appendChild(sub);
    }
    sub.textContent = data.participants.join(", ");
  }

  // Chat duration
  setText(stats[2], ".summary-number", data.chatDurationDays.toString());

  // Date range
  const from = formatMonthYear(data.firstDate);
  const to = formatMonthYear(data.lastDate);
  setText(stats[3], ".summary-number", `${from} – ${to}`);
}

// ─── Messages by person ───────────────────────────────────────────────────────

function populateMessagesSection(data) {
  const { userCounts, participants } = data;

  // Sort users by message count, take top 10
  const sorted = participants
    .slice()
    .sort((a, b) => (userCounts[b] ?? 0) - (userCounts[a] ?? 0));

  const top10 = sorted.slice(0, 10);
  const theRest = sorted.slice(10);

  // Update the card title with participant count
  const cardTitle = document.querySelector(".main-grid .card-title");
  if (cardTitle) {
    const meta = cardTitle.querySelector(".card-title-meta");
    if (meta) meta.textContent = `${participants.length} participants`;
  }

  // Populate the table
  const tbody = document.querySelector(".user-table tbody");
  if (!tbody) return;

  const maxCount = userCounts[top10[0]] ?? 1;
  tbody.innerHTML = "";

  top10.forEach((name) => {
    const count = userCounts[name] ?? 0;
    const pct = Math.round((count / maxCount) * 100);
    tbody.appendChild(buildMessageRow(name, count, pct, false));
  });

  if (theRest.length > 0) {
    const othersCount = theRest.reduce(
      (sum, n) => sum + (userCounts[n] ?? 0),
      0,
    );
    const othersPct = Math.round((othersCount / maxCount) * 100);
    tbody.appendChild(
      buildMessageRow(`${theRest.length} others`, othersCount, othersPct, true),
    );
  }
}

function buildMessageRow(name, count, barPct, isOthers) {
  const tr = document.createElement("tr");
  if (isOthers) tr.style.background = "var(--bg-secondary)";

  tr.innerHTML = `
    <td class="td-name${isOthers ? " td-others" : ""}">${escapeHtml(name)}</td>
    <td class="td-count${isOthers ? " td-others" : ""}">${count.toLocaleString()}</td>
    <td class="td-bar-cell">
      <div class="progress-bar-track">
        <div class="progress-bar-fill" style="width: ${barPct}%${isOthers ? "; background: var(--border)" : ""}"></div>
      </div>
    </td>
  `;
  return tr;
}

// ─── Response time ────────────────────────────────────────────────────────────

function populateResponseTimeSection(data) {
  if (!data.responseTimes) return;

  // stats.js exports these as "fastest" and "slowest" (not fastestResponder/slowestResponder)
  const {
    responseTimes,
    fastest: fastestResponder,
    slowest: slowestResponder,
  } = data;
  const MIN_SAMPLES = 50;

  // Sort by avg ascending (fastest first)
  const eligible = Object.entries(responseTimes)
    .filter(([, rt]) => rt.sampleCount >= MIN_SAMPLES)
    .sort(([, a], [, b]) => a.avgMs - b.avgMs);

  const ineligible = Object.entries(responseTimes).filter(
    ([, rt]) => rt.sampleCount < MIN_SAMPLES,
  );

  const tbody = document.querySelector(
    '.card[style*="overflow"] .user-table tbody',
  );
  if (!tbody) return;
  tbody.innerHTML = "";

  eligible.forEach(([name, rt]) => {
    const isFastest = name === fastestResponder;
    const isSlowest = name === slowestResponder;
    tbody.appendChild(buildResponseRow(name, rt, isFastest, isSlowest));
  });

  if (ineligible.length > 0) {
    const tr = document.createElement("tr");
    tr.style.background = "var(--bg-secondary)";
    tr.innerHTML = `
      <td class="td-others rt-others-cell" colspan="4"
          style="font-size: 13px; padding: calc(var(--space) * 1.5) calc(var(--space) * 2)">
        ${ineligible.length} other${ineligible.length > 1 ? "s" : ""} not shown — fewer than ${MIN_SAMPLES} messages sent
      </td>
    `;
    tbody.appendChild(tr);
  }
}

function buildResponseRow(name, rt, isFastest, isSlowest) {
  const badge = isFastest
    ? `<span class="badge badge-fastest"><span class="badge-dot"></span>Fastest</span>`
    : isSlowest
      ? `<span class="badge badge-slowest"><span class="badge-dot"></span>Slowest</span>`
      : "";

  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td class="td-name">${escapeHtml(name)}</td>
    <td style="font-weight: 600; color: var(--text-primary)">${rt.avgFormatted}</td>
    <td class="td-median" style="color: var(--text-secondary)">${rt.medianFormatted}</td>
    <td>${badge}</td>
  `;
  return tr;
}

// ─── Streaks & silences ───────────────────────────────────────────────────────

function populateStreaksSection(data) {
  if (!data.longestStreak && data.longestStreak !== 0) return;

  const cards = document.querySelectorAll(".streak-card");
  if (cards.length < 3) return;

  // stats.js does not return streak date ranges (longestStreakStart etc. don't exist).
  // Sub-labels are left blank for longest streak and longest silence — only current
  // streak gets a text sub-label since that comes from the number itself.
  setStreakCard(cards[0], data.longestStreak, null, null, null);

  // Current streak
  const currentSub =
    data.currentStreak > 0 ? "Active today" : "No current streak";
  setStreakCard(cards[1], data.currentStreak, null, null, currentSub);

  // Longest silence
  setStreakCard(cards[2], data.longestSilenceDays, null, null, null, true);
}

function setStreakCard(card, number, startDate, endDate, forcedSub, isWarning) {
  const numEl = card.querySelector(".streak-number");
  const subEl = card.querySelector(".streak-sub");

  if (numEl) {
    numEl.textContent = number.toString();
    if (isWarning) numEl.style.color = "var(--warning)";
  }

  if (subEl) {
    if (forcedSub !== undefined && forcedSub !== null) {
      subEl.textContent = forcedSub;
    } else if (startDate && endDate) {
      subEl.textContent = `${formatShortDate(new Date(startDate))} – ${formatShortDate(new Date(endDate))}`;
    } else {
      subEl.textContent = "";
    }
  }
}

// ─── Activity calendar ────────────────────────────────────────────────────────

export function populateCalendar(data) {
  const grid = document.getElementById("calendarGrid");
  if (!grid) return;

  const { dayCounts, firstDate, lastDate } = data;

  // Build a sorted array of all dates in the chat range
  const start = new Date(firstDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(lastDate);
  end.setHours(0, 0, 0, 0);

  // Find max messages in a single day for intensity scale
  const counts = Object.values(dayCounts).map(Number);
  const maxDay = counts.length ? Math.max(...counts) : 1;
  const p66 = percentile(counts, 66);
  const p33 = percentile(counts, 33);

  grid.innerHTML = "";

  const cursor = new Date(start);
  while (cursor <= end) {
    const key = toDateKey(cursor);
    const count = dayCounts[key] ?? 0;
    const cell = document.createElement("div");
    cell.className = "cal-cell";

    if (count === 0) {
      cell.classList.add("silent");
    } else if (count >= p66) {
      cell.classList.add("active-max");
    } else if (count >= p33) {
      cell.classList.add("active-high");
    } else {
      cell.classList.add("active");
    }

    cell.title = `${key}: ${count} message${count !== 1 ? "s" : ""}`;
    grid.appendChild(cell);
    cursor.setDate(cursor.getDate() + 1);
  }

  // Update month labels to match actual date range
  populateMonthLabels(start, end);

  // Update the grid column count so cells stay square-ish
  const totalDays = Math.round((end - start) / 86400000) + 1;
  const cols = Math.min(totalDays, 52); // ~52 weeks max for readable display
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
}

function populateMonthLabels(start, end) {
  const container = document.querySelector(".timeline-months");
  if (!container) return;

  container.innerHTML = "";

  // Generate one label per month in range
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);

  while (cursor <= endMonth) {
    const span = document.createElement("span");
    span.textContent = MONTH_SHORT[cursor.getMonth()];
    container.appendChild(span);
    cursor.setMonth(cursor.getMonth() + 1);
  }
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function populateFooter(data) {
  const meta = document.querySelector(".footer-meta");
  if (meta)
    meta.textContent = `${data.total.toLocaleString()} messages analyzed`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setText(parent, selector, text) {
  const el = parent?.querySelector(selector);
  if (el) el.textContent = text;
}

function formatMonthYear(date) {
  return `${MONTH_SHORT[date.getMonth()]} ${date.getFullYear()}`;
}

function formatShortDate(date) {
  return `${MONTH_SHORT[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = arr.slice().sort((a, b) => a - b);
  const idx = Math.floor((p / 100) * sorted.length);
  return sorted[Math.min(idx, sorted.length - 1)];
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
