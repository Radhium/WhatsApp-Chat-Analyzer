// app.js
// Entry point for index.html.
// Owns the drop zone interaction, file validation, parsing pipeline,
// and sessionStorage handoff to dashboard.html.

import { parseChat } from "./parser.js";
import { computeStats } from "./stats.js";

// ─── DOM References ───────────────────────────────────────────────────────────

const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const exportToggle = document.getElementById("exportToggle");
const exportSteps = document.getElementById("exportSteps");

// ─── Export Instructions Toggle ───────────────────────────────────────────────

exportToggle.addEventListener("click", () => {
  const isOpen = exportSteps.classList.contains("open");
  exportSteps.classList.toggle("open");
  exportToggle.setAttribute("aria-expanded", String(!isOpen));
  exportSteps.setAttribute("aria-hidden", String(isOpen));
});

// ─── Drop Zone — Visual States ────────────────────────────────────────────────

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("drag-over");
});

["dragleave", "dragend"].forEach((evt) => {
  dropZone.addEventListener(evt, () => dropZone.classList.remove("drag-over"));
});

// ─── File Entry Points ────────────────────────────────────────────────────────

// Drop
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

// Click / file picker
fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (file) handleFile(file);
  // Reset so the same file can be re-selected if needed after an error.
  fileInput.value = "";
});

// ─── File Handling ────────────────────────────────────────────────────────────

function handleFile(file) {
  const validationError = validateFile(file);
  if (validationError) {
    showError(validationError);
    return;
  }

  clearError();
  showLoading();

  const reader = new FileReader();

  reader.onload = (e) => {
    const rawText = e.target.result;

    if (!rawText || rawText.trim().length === 0) {
      hideLoading();
      showError(
        "This file appears to be empty. Export your chat again and try dropping the .txt file.",
      );
      return;
    }

    const parsed = parseChat(rawText);

    if (parsed.total === 0) {
      hideLoading();
      showError(
        "No messages found. Make sure you're uploading a WhatsApp .txt export, not another type of file.",
      );
      return;
    }

    const stats = computeStats(parsed);

    // Combine into the single chatData object that dashboard.html expects.
    // Date objects must be serialised as ISO strings — they don't survive JSON.
    const chatData = {
      messageList: parsed.messageList.map((msg) => ({
        ...msg,
        timestamp: msg.timestamp.toISOString(),
      })),
      userCounts: parsed.userCounts,
      hourCounts: parsed.hourCounts,
      dayCounts: parsed.dayCounts,
      total: parsed.total,
      firstDate: parsed.firstDate.toISOString(),
      lastDate: parsed.lastDate.toISOString(),
      chatDurationDays: parsed.chatDurationDays,
      participants: parsed.participants,
      responseTimes: stats.responseTimes,
      fastest: stats.fastest,
      slowest: stats.slowest,
      longestStreak: stats.longestStreak,
      currentStreak: stats.currentStreak,
      longestSilenceDays: stats.longestSilenceDays,
      activeDays: stats.activeDays,
    };

    try {
      sessionStorage.setItem("chatData", JSON.stringify(chatData));
    } catch {
      // sessionStorage can throw if the payload is too large (very rare).
      hideLoading();
      showError(
        "This chat is too large to process in the browser. Try a shorter export.",
      );
      return;
    }

    window.location.href = "../dashboard/dashboard.html";
  };

  reader.onerror = () => {
    hideLoading();
    showError("Could not read the file. Try again.");
  };

  reader.readAsText(file, "utf-8");
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateFile(file) {
  const name = file.name.toLowerCase();

  if (name.endsWith(".zip")) {
    return "ZIP files aren't supported — WhatsApp puts the chat inside the ZIP as a .txt file. Extract it first, then upload the .txt.";
  }

  if (!name.endsWith(".txt")) {
    return "Only .txt files are accepted. Make sure you're uploading a WhatsApp chat export.";
  }

  // 50 MB cap. Larger than any realistic chat export.
  const maxBytes = 50 * 1024 * 1024;
  if (file.size > maxBytes) {
    return "This file is over 50 MB, which is larger than expected for a WhatsApp export. Check that you selected the right file.";
  }

  return null;
}

// ─── UI State ─────────────────────────────────────────────────────────────────

function showError(message) {
  let errorEl = document.getElementById("uploadError");

  if (!errorEl) {
    errorEl = document.createElement("p");
    errorEl.id = "uploadError";
    errorEl.className = "upload-error";
    dropZone.insertAdjacentElement("afterend", errorEl);
  }

  errorEl.textContent = message;
  errorEl.hidden = false;
}

function clearError() {
  const errorEl = document.getElementById("uploadError");
  if (errorEl) errorEl.hidden = true;
}

function showLoading() {
  dropZone.classList.add("loading");

  const headline = dropZone.querySelector(".drop-zone-headline");
  if (headline) {
    headline.dataset.original = headline.textContent;
    headline.textContent = "Analyzing\u2026";
  }
}

function hideLoading() {
  dropZone.classList.remove("loading");

  const headline = dropZone.querySelector(".drop-zone-headline");
  if (headline && headline.dataset.original) {
    headline.textContent = headline.dataset.original;
    delete headline.dataset.original;
  }
}
