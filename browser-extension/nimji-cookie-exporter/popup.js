/* global chrome, document, navigator, console */

const statusEl = document.getElementById("status");
const atTokenStateEl = document.getElementById("atTokenState");
const fSidStateEl = document.getElementById("fSidState");
const envOutputEl = document.getElementById("envOutput");
const refreshBtn = document.getElementById("refreshBtn");
const copyBtn = document.getElementById("copyBtn");
const clearBtn = document.getElementById("clearBtn");

const atTokenDot = document.getElementById("atTokenDot");
const fSidDot = document.getElementById("fSidDot");

function mask(value) {
  if (!value) return "missing";
  if (value.length <= 10) return "captured";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function formatLastCapture(ms) {
  if (!ms || !Number.isFinite(ms)) return "never";
  return new Date(ms).toLocaleString();
}

function setStatus(text, ok) {
  statusEl.textContent = text;
  statusEl.className = ok ? "status success" : "status error";
}

async function requestExport() {
  return chrome.runtime.sendMessage({ type: "get-export" });
}

async function clearCapture() {
  return chrome.runtime.sendMessage({ type: "clear-capture" });
}

async function ensureGeminiIsOpen() {
  try {
    const tabs = await chrome.tabs.query({ url: "*://gemini.google.com/*" });
    if (tabs.length === 0) {
      await chrome.tabs.create({ url: "https://gemini.google.com/" });
    } else {
      const tab = tabs[0];
      if (tab && tab.id !== undefined) {
        await chrome.tabs.update(tab.id, { active: true });
        if (tab.windowId) {
          await chrome.windows.update(tab.windowId, { focused: true });
        }
      }
    }
  } catch (err) {
    console.error("Failed to query or open Gemini tab:", err);
  }
}

async function refresh() {
  const result = await requestExport();
  if (!result || !result.ok) {
    setStatus("Failed to read extension state.", false);
    return;
  }

  atTokenStateEl.textContent = mask(result.atToken);
  fSidStateEl.textContent = mask(result.fSid);
  envOutputEl.value = result.envBlock || "";

  if (result.atToken) {
    atTokenDot.className = "badge-dot captured";
  } else {
    atTokenDot.className = "badge-dot missing";
  }

  if (result.fSid) {
    fSidDot.className = "badge-dot captured";
  } else {
    fSidDot.className = "badge-dot missing";
  }

  if (result.hasAll) {
    setStatus(`Ready. Captured all values. Last capture: ${formatLastCapture(result.lastCapturedAt)}`, true);
  } else {
    setStatus(
      "Missing tokens. Click here to open or focus gemini.google.com.",
      false
    );
  }
}

refreshBtn.addEventListener("click", () => {
  void refresh();
});

copyBtn.addEventListener("click", async () => {
  const text = envOutputEl.value;
  if (!text) {
    setStatus("Nothing to copy yet.", false);
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    setStatus("Copied export block to clipboard.", true);
  } catch {
    setStatus("Clipboard write failed. Copy manually from the textarea.", false);
  }
});

clearBtn.addEventListener("click", async () => {
  await clearCapture();
  await refresh();
  setStatus("Captured tokens cleared.", true);
});

statusEl.addEventListener("click", () => {
  void ensureGeminiIsOpen();
});

async function init() {
  await refresh();
  const result = await requestExport();
  if (!result || !result.hasAll) {
    await ensureGeminiIsOpen();
  }
}

void init();
