// VibeRead Popup script
"use strict";

// ── Load persisted settings + stats ─────────────────────────────────────────
async function loadState() {
  const data = await chrome.storage.local.get(["settings", "stats"]);
  const settings = data.settings || {};
  const stats = data.stats || { totalWords: 0, sessions: 0, streak: 0 };

  document.getElementById("wpmVal").textContent = settings.wpm || 300;
  document.getElementById("statWords").textContent = formatNum(
    stats.totalWords || 0,
  );
  document.getElementById("statSessions").textContent = stats.sessions || 0;
  document.getElementById("statStreak").textContent =
    (stats.streak || 0) + "🔥";
}

function formatNum(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n;
}

// ── Button actions ───────────────────────────────────────────────────────────
document.getElementById("btnReadPage").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  chrome.runtime.sendMessage({
    type: "OPEN_READER",
    tabId: tab.id,
    tabUrl: tab.url,
    tabTitle: tab.title,
  });
  window.close();
});

document.getElementById("btnOpenPdf").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("pdf/pdf-reader.html") });
  window.close();
});

document.getElementById("btnPasteText").addEventListener("click", async () => {
  await chrome.storage.local.set({
    pendingReaderPayload: { text: "", title: "Pasted Text", pasteMode: true },
  });
  chrome.windows.create({
    url: chrome.runtime.getURL("reader/reader.html?mode=paste"),
    type: "popup",
    width: 1100,
    height: 700,
  });
  window.close();
});

document.getElementById("btnKindle").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url || "";
  if (!url.includes("read.amazon")) {
    chrome.tabs.create({ url: "https://read.amazon.com" });
  } else {
    chrome.runtime.sendMessage({
      type: "OPEN_READER",
      tabId: tab.id,
      tabUrl: tab.url,
      tabTitle: "Kindle: " + tab.title,
    });
  }
  window.close();
});

document.getElementById("btnSettings").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("settings/settings.html") });
  window.close();
});

document.getElementById("btnStats").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("stats/stats.html") });
  window.close();
});

// WPM Badge click → quick increment
document.getElementById("wpmBadge").addEventListener("click", async () => {
  const data = await chrome.storage.local.get("settings");
  const s = data.settings || {};
  const steps = [
    100, 150, 200, 250, 300, 350, 400, 500, 600, 700, 800, 1000, 1200,
  ];
  const cur = s.wpm || 300;
  const idx = steps.indexOf(cur);
  const next = steps[(idx + 1) % steps.length];
  s.wpm = next;
  await chrome.storage.local.set({ settings: s });
  document.getElementById("wpmVal").textContent = next;
});

loadState();
