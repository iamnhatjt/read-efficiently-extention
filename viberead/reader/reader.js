/**
 * VibeRead — RSVP Reader Engine
 * Handles word chunking, timing, ORP focal point, themes, TTS, hotkeys,
 * statistics persistence, and settings sync.
 */
"use strict";

// ════════════════════════════════════════════════════════════════════════════
// State
// ════════════════════════════════════════════════════════════════════════════
const state = {
  words: [], // flat array of all words
  chunks: [], // array of { tokens:string[], focal:number }
  chunkIdx: 0,
  playing: false,
  timerId: null,
  ttsActive: false,
  ttsUtterance: null,

  // Settings (loaded from storage)
  wpm: 300,
  wat: 1, // words at a time
  theme: "dark",
  fontSize: 5,
  font: "Georgia, serif",
  ctxMode: "both",
  orpMode: "line",
  ttsRate: 1,
  ttsVoiceIdx: 0,
  maxSessionTime: 0, // max minutes per read session (0 = unlimited)

  // Session timer
  sessionTimerId: null,
  sessionElapsed: 0, // seconds elapsed in current play session

  // Source
  title: "VibeRead",
  source: "web",
};

// ════════════════════════════════════════════════════════════════════════════
// DOM refs
// ════════════════════════════════════════════════════════════════════════════
const $ = (id) => document.getElementById(id);
const dom = {
  body: document.body,
  docTitle: $("docTitle"),
  timeLeft: $("timeLeft"),
  topWpm: $("topWpm"),
  wordProgress: $("wordProgress"),
  wordBox: $("wordBox"),
  mainWord: $("mainWord"),
  ctxAbove: $("ctxAbove"),
  ctxBelow: $("ctxBelow"),
  orp: $("orp"),
  progressBar: $("progressBar"),
  pauseOverlay: $("pauseOverlay"),
  pauseMsg: $("pauseMsg"),
  countdown: $("countdown"),
  btnPlay: $("btnPlay"),
  btnPrev: $("btnPrev"),
  btnNext: $("btnNext"),
  btnRew10: $("btnRew10"),
  btnFwd10: $("btnFwd10"),
  wpmSlider: $("wpmSlider"),
  wpmLabel: $("wpmLabel"),
  topWpmDisp: $("topWpm"),
  watVal: $("watVal"),
  btnTTS: $("btnTTS"),
  btnFullscreen: $("btnFullscreen"),
  btnSettings: $("btnSettings"),
  btnClose: $("btnClose"),
  settingsPanel: $("settingsPanel"),
  closeSettings: $("closeSettings"),
  themeGrid: $("themeGrid"),
  fontSizeSlider: $("fontSizeSlider"),
  fontSizeVal: $("fontSizeVal"),
  fontPicker: $("fontPicker"),
  ctxMode: $("ctxMode"),
  orpMode: $("orpMode"),
  ttsVoice: $("ttsVoice"),
  ttsRate: $("ttsRate"),
  ttsRateVal: $("ttsRateVal"),
  pasteModal: $("pasteModal"),
  pasteArea: $("pasteArea"),
  cancelPaste: $("cancelPaste"),
  confirmPaste: $("confirmPaste"),
  sessionTimer: $("sessionTimer"),
  sessionTimerStat: $("sessionTimerStat"),
  maxSessionTime: $("maxSessionTime"),
};

// ════════════════════════════════════════════════════════════════════════════
// Themes
// ════════════════════════════════════════════════════════════════════════════
const THEMES = [
  {
    id: "dark",
    label: "Dark",
    bg: "#0d0d11",
    fg: "#e8e8f0",
    accent: "#f97316",
  },
  {
    id: "midnight",
    label: "Midnight",
    bg: "#060610",
    fg: "#c0c0e0",
    accent: "#818cf8",
  },
  {
    id: "sepia",
    label: "Sepia",
    bg: "#1a1510",
    fg: "#ddd0bb",
    accent: "#d4875a",
  },
  {
    id: "forest",
    label: "Forest",
    bg: "#0a1410",
    fg: "#c8dcc8",
    accent: "#4ade80",
  },
  {
    id: "ocean",
    label: "Ocean",
    bg: "#06101a",
    fg: "#b0d4f0",
    accent: "#38bdf8",
  },
  {
    id: "sunset",
    label: "Sunset",
    bg: "#1a0a10",
    fg: "#f0c8d8",
    accent: "#f472b6",
  },
  {
    id: "slate",
    label: "Slate",
    bg: "#111218",
    fg: "#d0d4e0",
    accent: "#94a3b8",
  },
  {
    id: "warm",
    label: "Warm",
    bg: "#1a1208",
    fg: "#ede0cc",
    accent: "#fbbf24",
  },
  {
    id: "paper",
    label: "Paper",
    bg: "#f5f0e8",
    fg: "#2c2820",
    accent: "#c05c2a",
  },
  {
    id: "matrix",
    label: "Matrix",
    bg: "#001200",
    fg: "#00dd00",
    accent: "#00ff41",
  },
  {
    id: "purple",
    label: "Purple",
    bg: "#0e0a18",
    fg: "#d8c8f0",
    accent: "#a78bfa",
  },
  { id: "ice", label: "Ice", bg: "#060a10", fg: "#c8dde8", accent: "#67e8f9" },
];

function buildThemeGrid() {
  THEMES.forEach((t) => {
    const sw = document.createElement("div");
    sw.className = "theme-swatch" + (t.id === state.theme ? " active" : "");
    sw.style.background = `linear-gradient(135deg, ${t.bg} 60%, ${t.accent} 140%)`;
    sw.dataset.theme = t.id;
    sw.innerHTML = `<span class="name">${t.label}</span>`;
    sw.addEventListener("click", () => applyTheme(t.id));
    dom.themeGrid.appendChild(sw);
  });
}

function applyTheme(id) {
  THEMES.forEach((t) => dom.body.classList.remove("theme-" + t.id));
  dom.body.classList.add("theme-" + id);
  state.theme = id;
  document.querySelectorAll(".theme-swatch").forEach((sw) => {
    sw.classList.toggle("active", sw.dataset.theme === id);
  });
  saveSettings();
}

// ════════════════════════════════════════════════════════════════════════════
// Text Processing & Chunking
// ════════════════════════════════════════════════════════════════════════════

/**
 * Split raw text into individual words, filter empties.
 */
function tokenize(text) {
  return text.split(/\s+/).filter((w) => w.length > 0);
}

/**
 * Build chunks of `wat` words. The focal word (ORP) is computed
 * using a simple heuristic: ~40% into the group, favouring longer words.
 */
function buildChunks(words, wat) {
  const chunks = [];
  for (let i = 0; i < words.length; i += wat) {
    const tokens = words.slice(i, i + wat);
    // Focal: pick the longest word in the group; default to middle
    let focal = 0;
    let maxLen = 0;
    tokens.forEach((w, j) => {
      if (w.length > maxLen) {
        maxLen = w.length;
        focal = j;
      }
    });
    chunks.push({ tokens, focal, wordStart: i });
  }
  return chunks;
}

/**
 * Load text from chrome.storage (set by background) or URL param.
 */
async function loadSource() {
  const params = new URLSearchParams(location.search);
  const mode = params.get("mode");

  if (mode === "paste") {
    openPasteModal();
    return;
  }

  try {
    const data = await chrome.storage.local.get("pendingReaderPayload");
    const payload = data.pendingReaderPayload;

    if (payload?.text?.trim()) {
      setWords(tokenize(payload.text), payload.title || "Web Page");
    } else if (payload?.pasteMode) {
      openPasteModal();
    } else {
      setWords(tokenize(DEMO_TEXT), "VibeRead Demo");
    }
  } catch {
    setWords(tokenize(DEMO_TEXT), "VibeRead Demo");
  }
}

function setWords(words, title) {
  state.words = words;
  state.chunks = buildChunks(words, state.wat);
  state.chunkIdx = 0;
  state.title = title || "VibeRead";
  dom.docTitle.textContent = state.title;
  dom.docTitle.title = state.title;
  updateWordDisplay();
  updateProgress();
}

// ════════════════════════════════════════════════════════════════════════════
// Display
// ════════════════════════════════════════════════════════════════════════════
function updateWordDisplay() {
  if (!state.chunks.length) return;
  const chunk = state.chunks[state.chunkIdx];
  if (!chunk) return;

  // Clear old tokens
  // Keep #orp in place
  const orp = dom.orp;
  dom.wordBox.innerHTML = "";
  dom.wordBox.appendChild(orp);

  // Render tokens
  chunk.tokens.forEach((word, i) => {
    const span = document.createElement("span");
    span.className = "word-token" + (i === chunk.focal ? " focal" : "");
    span.textContent = word;
    dom.wordBox.appendChild(span);
  });

  // Context lines (prev / next chunk text)
  if (state.ctxMode !== "none") {
    const prev = state.chunks[state.chunkIdx - 1];
    const next = state.chunks[state.chunkIdx + 1];
    if (state.ctxMode !== "below")
      dom.ctxAbove.textContent = prev ? prev.tokens.join(" ") : "";
    else dom.ctxAbove.textContent = "";
    if (state.ctxMode !== "above")
      dom.ctxBelow.textContent = next ? next.tokens.join(" ") : "";
    else dom.ctxBelow.textContent = "";
  } else {
    dom.ctxAbove.textContent = "";
    dom.ctxBelow.textContent = "";
  }
}

function updateProgress() {
  if (!state.chunks.length) return;
  const pct = (state.chunkIdx / (state.chunks.length - 1)) * 100;
  dom.progressBar.style.width = pct.toFixed(1) + "%";

  // word counts
  const wordIdx = state.chunks[state.chunkIdx]?.wordStart ?? 0;
  dom.wordProgress.textContent = `${wordIdx}/${state.words.length}`;

  // time left
  const wordsLeft = state.words.length - wordIdx;
  const secsLeft = Math.ceil((wordsLeft / state.wpm) * 60);
  const m = Math.floor(secsLeft / 60);
  const s = secsLeft % 60;
  dom.timeLeft.textContent = `${m}:${String(s).padStart(2, "0")}`;
}

// ════════════════════════════════════════════════════════════════════════════
// Playback
// ════════════════════════════════════════════════════════════════════════════

/** Interval (ms) between chunks based on WPM + word count adjustments */
function intervalMs() {
  const base = (60 / state.wpm) * 1000; // ms per word
  const chunk = state.chunks[state.chunkIdx];
  if (!chunk) return base;
  // Longer words get extra time; punctuation at end → pause
  const maxLen = Math.max(...chunk.tokens.map((w) => w.length));
  let mult = 1 + Math.max(0, (maxLen - 6) * 0.04);
  const lastWord = chunk.tokens[chunk.tokens.length - 1] || "";
  if (/[.!?]$/.test(lastWord)) mult *= 1.6;
  else if (/[,;:]$/.test(lastWord)) mult *= 1.2;
  return base * state.wat * mult;
}

function play() {
  if (state.playing) return;
  if (state.chunkIdx >= state.chunks.length - 1 && state.chunks.length > 1) {
    state.chunkIdx = 0;
  }
  state.playing = true;
  dom.pauseOverlay.classList.remove("visible");
  dom.btnPlay.textContent = "⏸ Pause";
  // Enter reading mode — hide chrome
  dom.body.classList.add("reading");
  // Start session timer
  startSessionTimer();
  tick();
}

function pause() {
  if (!state.playing) return;
  state.playing = false;
  clearTimeout(state.timerId);
  stopSessionTimer();
  // Exit reading mode — show chrome
  dom.body.classList.remove("reading");
  dom.pauseOverlay.classList.add("visible");
  dom.pauseMsg.innerHTML = `<span class="big">⏸</span><span>Paused — press <kbd style="background:var(--surface2);border:1px solid var(--border);padding:2px 8px;border-radius:4px;">Space</kbd> to resume</span>`;
  dom.btnPlay.textContent = "▶ Play";
  saveStats();
  saveSettings();
}

function togglePlay() {
  state.playing ? pause() : play();
}

function tick() {
  if (!state.playing) return;
  updateWordDisplay();
  updateProgress();

  if (state.chunkIdx >= state.chunks.length - 1) {
    pause();
    dom.pauseMsg.innerHTML = `<span class="big">✅</span><span>Done! Great reading session.</span>`;
    onSessionComplete();
    return;
  }

  state.timerId = setTimeout(() => {
    state.chunkIdx++;
    tick();
  }, intervalMs());
}

function stepBy(n) {
  state.chunkIdx = Math.max(
    0,
    Math.min(state.chunks.length - 1, state.chunkIdx + n),
  );
  updateWordDisplay();
  updateProgress();
  if (!state.playing) {
    dom.wordBox.classList.add("flashing");
    setTimeout(() => dom.wordBox.classList.remove("flashing"), 160);
  }
}

function rewindSeconds(sec) {
  const wordsToSkip = Math.round((sec / 60) * state.wpm);
  // find chunk whose wordStart is closest to (current - wordsToSkip)
  const targetWord = Math.max(
    0,
    (state.chunks[state.chunkIdx]?.wordStart ?? 0) - wordsToSkip,
  );
  // binary search
  let lo = 0,
    hi = state.chunks.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (state.chunks[mid].wordStart <= targetWord) lo = mid;
    else hi = mid - 1;
  }
  state.chunkIdx = lo;
  updateWordDisplay();
  updateProgress();
}

function forwardSeconds(sec) {
  const wordsToSkip = Math.round((sec / 60) * state.wpm);
  const targetWord =
    (state.chunks[state.chunkIdx]?.wordStart ?? 0) + wordsToSkip;
  let lo = 0,
    hi = state.chunks.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (state.chunks[mid].wordStart <= targetWord) lo = mid;
    else hi = mid - 1;
  }
  state.chunkIdx = lo;
  updateWordDisplay();
  updateProgress();
}

// ════════════════════════════════════════════════════════════════════════════
// Session Timer (max reading time per session)
// ════════════════════════════════════════════════════════════════════════════
function startSessionTimer() {
  state.sessionElapsed = 0;
  updateSessionTimerDisplay();
  state.sessionTimerId = setInterval(() => {
    state.sessionElapsed++;
    updateSessionTimerDisplay();
    // Check max session limit
    if (state.maxSessionTime > 0) {
      const maxSecs = state.maxSessionTime * 60;
      const remaining = maxSecs - state.sessionElapsed;
      if (remaining <= 0) {
        pause();
        dom.pauseMsg.innerHTML = `<span class="big">⏰</span><span>Session limit reached (${state.maxSessionTime} min). Take a break!</span>`;
        return;
      }
    }
  }, 1000);
}

function stopSessionTimer() {
  if (state.sessionTimerId) {
    clearInterval(state.sessionTimerId);
    state.sessionTimerId = null;
  }
}

function updateSessionTimerDisplay() {
  const el = dom.sessionTimer;
  if (!el) return;
  const m = Math.floor(state.sessionElapsed / 60);
  const s = state.sessionElapsed % 60;
  el.textContent = `${m}:${String(s).padStart(2, "0")}`;

  // Color coding when maxSessionTime is set
  if (state.maxSessionTime > 0) {
    const maxSecs = state.maxSessionTime * 60;
    const remaining = maxSecs - state.sessionElapsed;
    const pctLeft = remaining / maxSecs;
    el.classList.remove("warning", "critical");
    if (pctLeft <= 0.1) el.classList.add("critical");
    else if (pctLeft <= 0.25) el.classList.add("warning");
  } else {
    el.classList.remove("warning", "critical");
  }
}

// ════════════════════════════════════════════════════════════════════════════
// WPM + WAT
// ════════════════════════════════════════════════════════════════════════════
function setWPM(val) {
  state.wpm = Math.min(1200, Math.max(100, val));
  dom.wpmSlider.value = state.wpm;
  dom.wpmLabel.textContent = state.wpm;
  dom.topWpm.textContent = state.wpm;
  if (state.playing) {
    clearTimeout(state.timerId);
    tick();
  }
}

function setWAT(val) {
  state.wat = Math.min(5, Math.max(1, val));
  dom.watVal.textContent = state.wat;
  // Rebuild chunks from same word position
  const currentWord = state.chunks[state.chunkIdx]?.wordStart ?? 0;
  state.chunks = buildChunks(state.words, state.wat);
  // find nearest chunk
  let best = 0;
  for (let i = 0; i < state.chunks.length; i++) {
    if (state.chunks[i].wordStart <= currentWord) best = i;
  }
  state.chunkIdx = best;
  updateWordDisplay();
  updateProgress();
}

// ════════════════════════════════════════════════════════════════════════════
// TTS
// ════════════════════════════════════════════════════════════════════════════
function toggleTTS() {
  if (state.ttsActive) {
    speechSynthesis.cancel();
    state.ttsActive = false;
    dom.btnTTS.style.color = "";
    dom.btnTTS.title = "Text-to-speech";
  } else {
    const text = state.words
      .slice(state.chunks[state.chunkIdx]?.wordStart ?? 0)
      .join(" ");
    const utt = new SpeechSynthesisUtterance(text);
    const voices = speechSynthesis.getVoices();
    if (voices[state.ttsVoiceIdx]) utt.voice = voices[state.ttsVoiceIdx];
    utt.rate = state.ttsRate;
    utt.onend = () => {
      state.ttsActive = false;
      dom.btnTTS.style.color = "";
    };
    speechSynthesis.speak(utt);
    state.ttsActive = true;
    dom.btnTTS.style.color = "var(--accent)";
    dom.btnTTS.title = "Stop TTS";
  }
}

function populateTTSVoices() {
  const voices = speechSynthesis.getVoices();
  dom.ttsVoice.innerHTML = "";
  voices.forEach((v, i) => {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = `${v.name} (${v.lang})`;
    dom.ttsVoice.appendChild(opt);
  });
}

speechSynthesis.onvoiceschanged = populateTTSVoices;

// ════════════════════════════════════════════════════════════════════════════
// Settings Persistence
// ════════════════════════════════════════════════════════════════════════════
async function loadSettings() {
  try {
    const data = await chrome.storage.local.get("settings");
    const s = data.settings || {};
    if (s.wpm) setWPM(s.wpm);
    if (s.wat) setWAT(s.wat);
    if (s.theme) applyTheme(s.theme);
    if (s.fontSize) {
      state.fontSize = s.fontSize;
      applyFontSize();
    }
    if (s.font) {
      state.font = s.font;
      applyFont();
    }
    if (s.ctxMode) {
      state.ctxMode = s.ctxMode;
      dom.ctxMode.value = s.ctxMode;
    }
    if (s.orpMode) {
      state.orpMode = s.orpMode;
      dom.orpMode.value = s.orpMode;
      applyORP();
    }
    if (s.ttsRate) {
      state.ttsRate = s.ttsRate;
      dom.ttsRate.value = s.ttsRate;
      dom.ttsRateVal.textContent = s.ttsRate + "x";
    }
    if (typeof s.maxSessionTime === "number") {
      state.maxSessionTime = s.maxSessionTime;
      if (dom.maxSessionTime) dom.maxSessionTime.value = s.maxSessionTime;
    }
  } catch {
    /* no chrome API (debugging in browser) */
  }
}

async function saveSettings() {
  try {
    await chrome.storage.local.set({
      settings: {
        wpm: state.wpm,
        wat: state.wat,
        theme: state.theme,
        fontSize: state.fontSize,
        font: state.font,
        ctxMode: state.ctxMode,
        orpMode: state.orpMode,
        ttsRate: state.ttsRate,
        maxSessionTime: state.maxSessionTime,
      },
    });
  } catch {}
}

function applyFontSize() {
  document.documentElement.style.setProperty(
    "--word-size",
    state.fontSize + "rem",
  );
  dom.fontSizeSlider.value = state.fontSize;
  dom.fontSizeVal.textContent = state.fontSize + "rem";
}

function applyFont() {
  document.documentElement.style.setProperty("--word-font", state.font);
  dom.fontPicker.value = state.font;
}

function applyORP() {
  dom.orp.style.display = state.orpMode === "none" ? "none" : "";
}

// ════════════════════════════════════════════════════════════════════════════
// Statistics
// ════════════════════════════════════════════════════════════════════════════
let sessionWordCount = 0;
let sessionStart = Date.now();

function trackWords() {
  const chunk = state.chunks[state.chunkIdx];
  if (chunk) sessionWordCount += chunk.tokens.length;
}

async function saveStats() {
  try {
    const data = await chrome.storage.local.get("stats");
    const stats = data.stats || {
      totalWords: 0,
      sessions: 0,
      streak: 0,
      lastDate: "",
    };
    stats.totalWords = (stats.totalWords || 0) + sessionWordCount;
    stats.sessions = (stats.sessions || 0) + 1;

    const today = new Date().toDateString();
    if (stats.lastDate === today) {
      // same day, no streak change
    } else {
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      stats.streak = stats.lastDate === yesterday ? (stats.streak || 0) + 1 : 1;
      stats.lastDate = today;
    }
    await chrome.storage.local.set({ stats });
    sessionWordCount = 0;
  } catch {}
}

function onSessionComplete() {
  // Count all words in session
  sessionWordCount = state.words.length;
  saveStats();
}

// ════════════════════════════════════════════════════════════════════════════
// Paste Modal
// ════════════════════════════════════════════════════════════════════════════
function openPasteModal() {
  dom.pasteModal.classList.add("open");
  setTimeout(() => dom.pasteArea.focus(), 100);
}

dom.cancelPaste.addEventListener("click", () => {
  dom.pasteModal.classList.remove("open");
  if (!state.words.length) setWords(tokenize(DEMO_TEXT), "VibeRead Demo");
});

dom.confirmPaste.addEventListener("click", () => {
  const text = dom.pasteArea.value.trim();
  if (!text) return;
  dom.pasteModal.classList.remove("open");
  setWords(tokenize(text), "Pasted Text");
});

// ════════════════════════════════════════════════════════════════════════════
// Keyboard Shortcuts
// ════════════════════════════════════════════════════════════════════════════
document.addEventListener("keydown", (e) => {
  if (
    dom.pasteModal.classList.contains("open") ||
    e.target.tagName === "TEXTAREA" ||
    e.target.tagName === "INPUT" ||
    e.target.tagName === "SELECT"
  )
    return;

  switch (e.key) {
    case " ":
      e.preventDefault();
      togglePlay();
      break;
    case "ArrowLeft":
      e.preventDefault();
      stepBy(-1);
      break;
    case "ArrowRight":
      e.preventDefault();
      stepBy(1);
      break;
    case "ArrowUp":
      e.preventDefault();
      setWPM(state.wpm + 25);
      break;
    case "ArrowDown":
      e.preventDefault();
      setWPM(state.wpm - 25);
      break;
    case "j":
    case "J":
      rewindSeconds(10);
      break;
    case "l":
    case "L":
      forwardSeconds(10);
      break;
    case "k":
    case "K":
      togglePlay();
      break;
    case "f":
    case "F":
      toggleFullscreen();
      break;
    case "s":
    case "S":
      toggleSettings();
      break;
    case "1":
      setWAT(1);
      break;
    case "2":
      setWAT(2);
      break;
    case "3":
      setWAT(3);
      break;
    case "4":
      setWAT(4);
      break;
    case "5":
      setWAT(5);
      break;
  }
});

// ════════════════════════════════════════════════════════════════════════════
// UI Event Bindings
// ════════════════════════════════════════════════════════════════════════════
dom.btnPlay.addEventListener("click", togglePlay);
dom.btnPrev.addEventListener("click", () => stepBy(-1));
dom.btnNext.addEventListener("click", () => stepBy(1));
dom.btnRew10.addEventListener("click", () => rewindSeconds(10));
dom.btnFwd10.addEventListener("click", () => forwardSeconds(10));
dom.btnTTS.addEventListener("click", toggleTTS);
dom.btnFullscreen.addEventListener("click", toggleFullscreen);
dom.btnClose.addEventListener("click", () => window.close());

dom.btnSettings.addEventListener("click", toggleSettings);
dom.closeSettings.addEventListener("click", toggleSettings);

// WPM slider
dom.wpmSlider.addEventListener("input", () =>
  setWPM(parseInt(dom.wpmSlider.value)),
);

// WAT
$("watDown").addEventListener("click", () => setWAT(state.wat - 1));
$("watUp").addEventListener("click", () => setWAT(state.wat + 1));

// Settings panel controls
dom.fontSizeSlider.addEventListener("input", () => {
  state.fontSize = parseFloat(dom.fontSizeSlider.value);
  applyFontSize();
  saveSettings();
});
dom.fontPicker.addEventListener("change", () => {
  state.font = dom.fontPicker.value;
  applyFont();
  saveSettings();
});
dom.ctxMode.addEventListener("change", () => {
  state.ctxMode = dom.ctxMode.value;
  updateWordDisplay();
  saveSettings();
});
dom.orpMode.addEventListener("change", () => {
  state.orpMode = dom.orpMode.value;
  applyORP();
  saveSettings();
});
dom.ttsRate.addEventListener("input", () => {
  state.ttsRate = parseFloat(dom.ttsRate.value);
  dom.ttsRateVal.textContent = state.ttsRate + "x";
  saveSettings();
});
dom.ttsVoice.addEventListener("change", () => {
  state.ttsVoiceIdx = parseInt(dom.ttsVoice.value);
});
if (dom.maxSessionTime) {
  dom.maxSessionTime.addEventListener("change", () => {
    state.maxSessionTime = parseInt(dom.maxSessionTime.value);
    saveSettings();
  });
}

function toggleSettings() {
  dom.settingsPanel.classList.toggle("open");
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
    dom.btnFullscreen.textContent = "⛶";
  } else {
    document.exitFullscreen().catch(() => {});
  }
}

// Auto-save every 5s
setInterval(saveSettings, 5000);

// Save on close
window.addEventListener("beforeunload", () => {
  if (state.playing) {
    pause();
  } else {
    saveSettings();
  }
});

// ════════════════════════════════════════════════════════════════════════════
// Demo Text
// ════════════════════════════════════════════════════════════════════════════
const DEMO_TEXT = `Welcome to VibeRead — the premium speed reading extension with native PDF support.
VibeRead uses RSVP technology — Rapid Serial Visual Presentation — to display words one at a time at the center of your vision.
This eliminates the eye movements that slow traditional reading by up to 80 percent.
Studies show that most people read at 200 to 300 words per minute, but can comprehend up to 1000 words per minute with training.
The focal word — highlighted in orange — is aligned with your eye's optimal recognition point, known as the ORP.
You can adjust words per minute using the slider below or the up and down arrow keys.
Press Space to pause and resume. Use J and L to rewind or fast-forward ten seconds.
Press numbers 1 through 5 to change how many words appear at once.
For PDFs, click the PDF button in the popup to open any local PDF and resume exactly where you left off — even after closing the browser.
VibeRead automatically saves your progress using a SHA-256 hash of the file, so renamed files are still recognized.
Enjoy reading faster. Let's go.`;

// ════════════════════════════════════════════════════════════════════════════
// Init
// ════════════════════════════════════════════════════════════════════════════
async function init() {
  buildThemeGrid();
  await loadSettings();
  await loadSource();
  populateTTSVoices();
  applyFontSize();
  applyFont();
  applyORP();
  updateWordDisplay();
  updateProgress();
  // Show first word
  if (state.chunks.length) {
    dom.pauseOverlay.classList.add("visible");
  }
}

init();
