// parser.js
// Reads raw WhatsApp .txt export and returns structured message data.
// Handles the DD/MM/YYYY, HH:MM - Sender: text format (Android/iOS 24h exports).

// A system message has no sender — it's just "Date, Time - Some notice."
// We detect this by checking if the line after the dash contains a colon (sender present)
// vs. being a bare notice string. This replaces the old 100-item string array.
function isSystemMessage(sender, content) {
  // These are the only real patterns WhatsApp generates without a sender colon.
  // If the regex somehow captures a sender, these guard against edge cases.
  const systemPatterns = [
    /^messages and calls are end-to-end encrypted/i,
    /^missed (voice|video) call/i,
    /^(voice|video) call/i,
    /^<media omitted>$/i,
    /security code (with|changed)/i,
    /changed the (subject|group|icon|description|settings)/i,
    /^(added|removed|left|joined|created group)/i,
    /now an admin/i,
    /invited.*to (the )?group/i,
    /this message was deleted/i,
    /deleted this message/i,
    /your (security|safety) number/i,
    /poll:/i,
    /poll ended/i,
  ];

  const text = content.trim().toLowerCase();
  return systemPatterns.some((pattern) => pattern.test(text));
}

// Parses a single line into its components. Returns null if the line is not
// a valid message line (continuation of previous message, blank line, etc.)
function parseLine(line) {
  // Format: DD/MM/YYYY, HH:MM - Sender: message content
  // The sender name can contain spaces, emoji, and most unicode characters.
  // We anchor on the timestamp pattern at the start.
  const match = line.match(
    /^(\d{1,2}\/\d{1,2}\/\d{2,4}),\s+(\d{1,2}:\d{2})\s+-\s+([^:]+):\s*([\s\S]*)$/,
  );

  if (!match) return null;

  const [, dateStr, timeStr, sender, content] = match;
  return { dateStr, timeStr, sender: sender.trim(), content: content.trim() };
}

// Converts DD/MM/YYYY into a JS Date object.
// All dates in the sample export are D/M/Y (day-first).
function parseDate(dateStr) {
  const [day, month, year] = dateStr.split("/").map(Number);
  const fullYear = year < 100 ? (year > 50 ? 1900 + year : 2000 + year) : year;
  return new Date(fullYear, month - 1, day);
}

// Returns a sortable YYYY-MM-DD string from a Date object.
// Used as a stable key for the daily activity map.
function toDateKey(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Main export. Accepts the full string content of a WhatsApp .txt export.
// Returns a structured result object ready for stats.js and render.js.
function parseChat(rawText) {
  const lines = rawText.split("\n");

  // messageList stores every valid message as a structured object.
  // This is what stats.js needs to compute response times and streaks.
  const messageList = [];

  // Aggregated counts — pre-built here so render.js doesn't re-iterate.
  const userCounts = {}; // { "Tanmoy": 142, "Saptarishi": 98, ... }
  const hourCounts = {}; // { "18": 34, "19": 71, ... }
  const dayCounts = {}; // { "2024-02-07": 12, ... } — keyed YYYY-MM-DD

  let firstDate = null;
  let lastDate = null;

  for (const line of lines) {
    const parsed = parseLine(line);
    if (!parsed) continue; // blank lines, multi-line continuations, non-message lines

    const { dateStr, timeStr, sender, content } = parsed;

    // Skip system-generated content. Media omitted counts as a real message
    // (it happened, it's part of the conversation rhythm) — but filter it from
    // response time analysis since it contributes no readable content.
    const isMedia = /^<media omitted>$/i.test(content);
    if (isSystemMessage(sender, content) && !sender) continue;

    const dateObj = parseDate(dateStr);
    const dateKey = toDateKey(dateObj);
    const hour = timeStr.split(":")[0]; // "18", "09", etc.

    // Build the full timestamp as a Date for response time calculation.
    const [h, min] = timeStr.split(":").map(Number);
    const timestamp = new Date(
      dateObj.getFullYear(),
      dateObj.getMonth(),
      dateObj.getDate(),
      h,
      min,
    );

    const message = {
      timestamp,
      dateKey,
      sender,
      content,
      isMedia,
    };

    messageList.push(message);

    // Update aggregates.
    userCounts[sender] = (userCounts[sender] || 0) + 1;
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    dayCounts[dateKey] = (dayCounts[dateKey] || 0) + 1;

    if (!firstDate || dateObj < firstDate) firstDate = dateObj;
    if (!lastDate || dateObj > lastDate) lastDate = dateObj;
  }

  const total = messageList.length;
  const chatDurationDays =
    firstDate && lastDate
      ? Math.round((lastDate - firstDate) / (1000 * 60 * 60 * 24))
      : 0;

  return {
    messageList, // Full array — consumed by stats.js
    userCounts, // Message totals per user
    hourCounts, // Message totals per hour of day
    dayCounts, // Message totals per calendar day (YYYY-MM-DD)
    total,
    firstDate, // Date object
    lastDate, // Date object
    chatDurationDays,
    participants: Object.keys(userCounts),
  };
}

export { parseChat };
