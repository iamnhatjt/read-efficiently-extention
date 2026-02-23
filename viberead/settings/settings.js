// VibeRead Settings page script
"use strict";

// ── Tabs ─────────────────────────────────────────────────────────────────────
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document
      .querySelectorAll(".tab")
      .forEach((t) => t.classList.remove("active"));
    document
      .querySelectorAll(".tab-panel")
      .forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById("tab-" + tab.dataset.tab).classList.add("active");
  });
});

// ── Themes ───────────────────────────────────────────────────────────────────
const THEMES = [
  { id: "dark", label: "Dark", bg: "#0d0d11", accent: "#f97316" },
  { id: "midnight", label: "Midnight", bg: "#060610", accent: "#818cf8" },
  { id: "sepia", label: "Sepia", bg: "#1a1510", accent: "#d4875a" },
  { id: "forest", label: "Forest", bg: "#0a1410", accent: "#4ade80" },
  { id: "ocean", label: "Ocean", bg: "#06101a", accent: "#38bdf8" },
  { id: "sunset", label: "Sunset", bg: "#1a0a10", accent: "#f472b6" },
  { id: "slate", label: "Slate", bg: "#111218", accent: "#94a3b8" },
  { id: "warm", label: "Warm", bg: "#1a1208", accent: "#fbbf24" },
  { id: "paper", label: "Paper", bg: "#f5f0e8", accent: "#c05c2a" },
  { id: "matrix", label: "Matrix", bg: "#001200", accent: "#00ff41" },
  { id: "purple", label: "Purple", bg: "#0e0a18", accent: "#a78bfa" },
  { id: "ice", label: "Ice", bg: "#060a10", accent: "#67e8f9" },
];

let selectedTheme = "dark";

function buildThemeGrid() {
  const grid = document.getElementById("themeGrid");
  grid.innerHTML = "";
  THEMES.forEach((t) => {
    const sw = document.createElement("div");
    sw.className = "theme-sw" + (t.id === selectedTheme ? " active" : "");
    sw.style.background = `linear-gradient(135deg, ${t.bg} 50%, ${t.accent} 170%)`;
    sw.title = t.label;
    sw.innerHTML = `<span class="name">${t.label}</span>`;
    sw.addEventListener("click", () => {
      selectedTheme = t.id;
      document
        .querySelectorAll(".theme-sw")
        .forEach((s) => s.classList.remove("active"));
      sw.classList.add("active");
    });
    grid.appendChild(sw);
  });
}

// ── Hotkeys ──────────────────────────────────────────────────────────────────
const DEFAULT_HOTKEYS = [
  { action: "Play / Pause", default: "Space", key: " " },
  { action: "Previous word", default: "← Left", key: "ArrowLeft" },
  { action: "Next word", default: "→ Right", key: "ArrowRight" },
  { action: "Speed up (+25 WPM)", default: "↑ Up", key: "ArrowUp" },
  { action: "Slow down (−25 WPM)", default: "↓ Down", key: "ArrowDown" },
  { action: "Rewind 10s", default: "J", key: "j" },
  { action: "Play/Pause (alt)", default: "K", key: "k" },
  { action: "Forward 10s", default: "L", key: "l" },
  { action: "Fullscreen", default: "F", key: "f" },
  { action: "Settings panel", default: "S", key: "s" },
  { action: "1 word at a time", default: "1", key: "1" },
  { action: "2 words at a time", default: "2", key: "2" },
  { action: "3 words at a time", default: "3", key: "3" },
  { action: "4 words at a time", default: "4", key: "4" },
  { action: "5 words at a time", default: "5", key: "5" },
];

function buildHotkeyTable() {
  const tbody = document.getElementById("hotkeyTable");
  tbody.innerHTML = "";
  DEFAULT_HOTKEYS.forEach((hk) => {
    const tr = document.createElement("tr");
    tr.className = "hotkey-row";
    tr.innerHTML = `
      <td>${hk.action}</td>
      <td><span class="key-badge"><span class="key">${hk.default}</span></span></td>
    `;
    tbody.appendChild(tr);
  });
}

// ── Load / Save Settings ─────────────────────────────────────────────────────
async function loadSettings() {
  try {
    const data = await chrome.storage.local.get("settings");
    const s = data.settings || {};

    selectedTheme = s.theme || "dark";
    buildThemeGrid();

    if (s.wpm) {
      document.getElementById("wpmSlider").value = s.wpm;
      document.getElementById("wpmVal").textContent = s.wpm;
    }
    if (s.wat) document.getElementById("watPicker").value = s.wat;
    if (s.fontSize) {
      document.getElementById("fontSizeSlider").value = s.fontSize;
      document.getElementById("fontSizeVal").textContent = s.fontSize + "rem";
    }
    if (s.font) document.getElementById("fontPicker").value = s.font;
    if (s.ctxMode) document.getElementById("ctxMode").value = s.ctxMode;
    if (s.orpMode) document.getElementById("orpMode").value = s.orpMode;
    if (s.ttsRate) {
      document.getElementById("ttsRate").value = s.ttsRate;
      document.getElementById("ttsRateVal").textContent = s.ttsRate + "x";
    }
    if (typeof s.punctPause === "boolean")
      document.getElementById("punctPause").checked = s.punctPause;
    if (typeof s.autoPage === "boolean")
      document.getElementById("autoPage").checked = s.autoPage;
  } catch {
    buildThemeGrid();
  }
}

async function saveSettings() {
  try {
    const s = {
      theme: selectedTheme,
      wpm: parseInt(document.getElementById("wpmSlider").value),
      wat: parseInt(document.getElementById("watPicker").value),
      fontSize: parseFloat(document.getElementById("fontSizeSlider").value),
      font: document.getElementById("fontPicker").value,
      ctxMode: document.getElementById("ctxMode").value,
      orpMode: document.getElementById("orpMode").value,
      ttsRate: parseFloat(document.getElementById("ttsRate").value),
      punctPause: document.getElementById("punctPause").checked,
      autoPage: document.getElementById("autoPage").checked,
    };
    await chrome.storage.local.set({ settings: s });
    toast("Settings saved ✓");
  } catch {
    toast("Error saving settings");
  }
}

// Live preview
document.getElementById("wpmSlider").addEventListener("input", (e) => {
  document.getElementById("wpmVal").textContent = e.target.value;
});
document.getElementById("fontSizeSlider").addEventListener("input", (e) => {
  document.getElementById("fontSizeVal").textContent = e.target.value + "rem";
});
document.getElementById("ttsRate").addEventListener("input", (e) => {
  document.getElementById("ttsRateVal").textContent =
    parseFloat(e.target.value) + "x";
});

document.getElementById("btnSave").addEventListener("click", saveSettings);

// ── Data Actions ─────────────────────────────────────────────────────────────
document.getElementById("btnExport").addEventListener("click", async () => {
  const data = await chrome.storage.local.get([
    "pdfProgress",
    "stats",
    "settings",
  ]);
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "viberead-backup.json";
  a.click();
  URL.revokeObjectURL(url);
  toast("Exported!");
});

document.getElementById("btnImport").addEventListener("click", () => {
  document.getElementById("importFile").click();
});
document.getElementById("importFile").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    await chrome.storage.local.set(data);
    toast("Imported successfully!");
    loadSettings();
  } catch {
    toast("Import failed: invalid JSON");
  }
});

document
  .getElementById("btnClearProgress")
  .addEventListener("click", async () => {
    if (
      !confirm("Delete ALL saved PDF reading positions? This cannot be undone.")
    )
      return;
    await chrome.storage.local.remove("pdfProgress");
    toast("Progress cleared.");
  });

document.getElementById("btnClearStats").addEventListener("click", async () => {
  if (!confirm("Reset all reading statistics?")) return;
  await chrome.storage.local.remove("stats");
  toast("Stats reset.");
});

// ── Toast ─────────────────────────────────────────────────────────────────────
function toast(msg, ms = 2500) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), ms);
}

// ── Init ──────────────────────────────────────────────────────────────────────
buildHotkeyTable();
loadSettings();
