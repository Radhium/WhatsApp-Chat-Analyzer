// stats.js
// Computes derived statistics from the parsed message list.
// Input: the result object from parseChat() in parser.js.
// Output: response time data and streak/silence data, ready for render.js.

// ─── Response Time ────────────────────────────────────────────────────────────

// The response time threshold. Gaps longer than this are silences, not responses.
// A gap of 25 hours is someone not replying overnight — not a slow response.
const RESPONSE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

// Computes average response time per user.
// A "response" is: User B sends a message after User A's last message,
// and the gap between those two timestamps is under 24 hours.
//
// We walk the message list in order. Each time the sender changes,
// that's a potential response — record the gap if it's under the threshold.
function computeResponseTimes(messageList) {
  // Only works meaningfully with 2+ participants.
  if (messageList.length < 2) return {};

  // responseSamples: { "Tanmoy": [4200000, 180000, ...], ... }
  // Each value is a gap in milliseconds.
  const responseSamples = {};

  for (let i = 1; i < messageList.length; i++) {
    const prev = messageList[i - 1];
    const curr = messageList[i];

    // Same sender continuing their own message — not a response.
    if (curr.sender === prev.sender) continue;

    const gap = curr.timestamp - prev.timestamp;

    // Gap over threshold = silence, skip.
    if (gap > RESPONSE_THRESHOLD_MS || gap < 0) continue;

    if (!responseSamples[curr.sender]) {
      responseSamples[curr.sender] = [];
    }
    responseSamples[curr.sender].push(gap);
  }

  // Convert sample arrays to summary stats per user.
  const result = {};
  for (const [user, samples] of Object.entries(responseSamples)) {
    if (samples.length === 0) continue;

    const sorted = [...samples].sort((a, b) => a - b);
    const avg = samples.reduce((sum, v) => sum + v, 0) / samples.length;
    const median = sorted[Math.floor(sorted.length / 2)];

    result[user] = {
      avgMs: Math.round(avg),
      medianMs: median,
      sampleCount: samples.length,
      // Human-readable versions for render.js.
      avgFormatted: formatDuration(avg),
      medianFormatted: formatDuration(median),
    };
  }

  return result;
}

// Determines which participant is the fastest and slowest responder.
// Returns an object with "fastest" and "slowest" keys.
// Only meaningful with 2+ participants who have response data.
function getFastestAndSlowest(responseTimes) {
  const users = Object.entries(responseTimes);
  if (users.length === 0) return { fastest: null, slowest: null };

  users.sort((a, b) => a[1].avgMs - b[1].avgMs);

  return {
    fastest: users[0][0],
    slowest: users[users.length - 1][0],
  };
}

// ─── Streaks & Silences ───────────────────────────────────────────────────────

// Computes longest active streak, current streak, and longest silence.
// Works from the dayCounts map (YYYY-MM-DD keys) returned by parser.js.
function computeStreaks(dayCounts, lastDate) {
  if (Object.keys(dayCounts).length === 0) {
    return {
      longestStreak: 0,
      currentStreak: 0,
      longestSilenceDays: 0,
      activeDays: 0,
    };
  }

  // Sort the active day keys chronologically.
  const activeDays = Object.keys(dayCounts).sort();
  const activeDaySet = new Set(activeDays);
  const totalActiveDays = activeDays.length;

  // Walk through all days from first to last, tracking streaks.
  const firstDay = activeDays[0];
  const lastDay = activeDays[activeDays.length - 1];

  let longestStreak = 0;
  let currentRun = 0;
  let longestSilenceDays = 0;
  let lastActiveDay = null;

  // Iterate over each calendar day in the range, not just active days.
  // This lets us correctly detect silences and break streaks.
  const cursor = new Date(firstDay + "T00:00:00");
  const end = new Date(lastDay + "T00:00:00");

  while (cursor <= end) {
    const key = toDateKey(cursor);
    const isActive = activeDaySet.has(key);

    if (isActive) {
      currentRun++;
      longestStreak = Math.max(longestStreak, currentRun);

      if (lastActiveDay) {
        const gap = daysBetween(lastActiveDay, cursor);
        // gap of 1 = consecutive days, no silence.
        // gap > 1 = silent days in between.
        if (gap > 1) {
          longestSilenceDays = Math.max(longestSilenceDays, gap - 1);
        }
      }
      lastActiveDay = new Date(cursor);
    } else {
      currentRun = 0;
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  // Current streak: count back from the most recent message day.
  // "Current" means the streak is still alive — it hasn't been broken.
  const today = lastDate ? toDateKey(lastDate) : lastDay;
  let currentStreak = 0;
  const check = new Date(today + "T00:00:00");

  while (true) {
    const key = toDateKey(check);
    if (!activeDaySet.has(key)) break;
    currentStreak++;
    check.setDate(check.getDate() - 1);
  }

  return {
    longestStreak,
    currentStreak,
    longestSilenceDays,
    activeDays: totalActiveDays,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Returns the number of whole days between two Date objects.
function daysBetween(a, b) {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round(Math.abs(b - a) / msPerDay);
}

// Converts a YYYY-MM-DD string into a Date object (local timezone, midnight).
function toDateKey(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Formats a duration in milliseconds into a human-readable string.
// Examples: "3 min", "1 hr 12 min", "4 hrs"
function formatDuration(ms) {
  const totalMinutes = Math.round(ms / 60000);

  if (totalMinutes < 1) return "< 1 min";
  if (totalMinutes < 60) return `${totalMinutes} min`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (minutes === 0) return `${hours} hr${hours !== 1 ? "s" : ""}`;
  return `${hours} hr ${minutes} min`;
}

// ─── Main Export ──────────────────────────────────────────────────────────────

// Accepts the full result object from parseChat().
// Returns all derived stats in one object, ready for render.js.
function computeStats(parsedData) {
  const { messageList, dayCounts, lastDate } = parsedData;

  const responseTimes = computeResponseTimes(messageList);
  const { fastest, slowest } = getFastestAndSlowest(responseTimes);
  const streaks = computeStreaks(dayCounts, lastDate);

  return {
    responseTimes, // { "Tanmoy": { avgMs, medianMs, avgFormatted, medianFormatted, sampleCount }, ... }
    fastest, // name of fastest responder, or null
    slowest, // name of slowest responder, or null
    ...streaks, // longestStreak, currentStreak, longestSilenceDays, activeDays
  };
}

export { computeStats, formatDuration };
