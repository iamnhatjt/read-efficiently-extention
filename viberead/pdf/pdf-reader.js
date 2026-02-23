/**
 * VibeRead PDF Reader Engine
 *
 * Features:
 *  - Drag-and-drop / file picker PDF loading
 *  - SHA-256 hash for progress identity (file rename-safe)
 *  - Page-by-page text extraction via pdf.js
 *  - Auto-resume from exact word and page after browser close
 *  - Auto-save every 5s + on pause/close
 *  - Global progress bar spanning the whole document
 *  - Thumbnail sidebar
 *  - RSVP with ORP focal word, context lines
 *  - Keyboard shortcuts matching reader.js
 *  - Export/import progress JSON
 */
"use strict";

// ── pdf.js setup ─────────────────────────────────────────────────────────
import { GlobalWorkerOptions, getDocument } from "../lib/pdf.min.mjs";
GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("lib/pdf.worker.min.mjs");

// ════════════════════════════════════════════════════════════════════════════
// State
// ════════════════════════════════════════════════════════════════════════════
const st = {
  // PDF metadata
  pdfDoc: null,
  pdfHash: "",
  fileName: "",
  totalPages: 0,
  pageTexts: [], // array of string[] (words per page)
  pageWordStart: [], // global word index where each page starts

  // RSVP
  allWords: [], // flat array across all pages
  chunks: [], // { tokens, focal, wordStart, pageIdx }
  chunkIdx: 0,
  playing: false,
  timerId: null,

  // Settings
  wpm: 300,
  wat: 1,

  // Session timer
  sessionTimerId: null,
  sessionElapsed: 0,

  // Saved progress (loaded from storage)
  savedProgress: null,
};

// DOM refs
const $ = (id) => document.getElementById(id);
const dom = {
  landingScreen: $("landingScreen"),
  loadingScreen: $("loadingScreen"),
  loadingPct: $("loadingPct"),
  loadingMsg: $("loadingMsg"),
  readerUI: $("readerUI"),
  resumeBanner: $("resumeBanner"),
  resumeTitle: $("resumeTitle"),
  resumeSub: $("resumeSub"),
  btnResume: $("btnResume"),
  btnStartFresh: $("btnStartFresh"),

  dropZone: $("dropZone"),
  fileInput: $("fileInput"),
  btnBrowse: $("btnBrowse"),
  recentItems: $("recentItems"),

  pdfTitle: $("pdfTitle"),
  timeLeft: $("timeLeft"),
  topWpm: $("topWpm"),
  wordProgress: $("wordProgress"),

  wordBox: $("wordBox"),
  orp: $("orp"),
  ctxAbove: $("ctxAbove"),
  ctxBelow: $("ctxBelow"),
  pauseOverlay: $("pauseOverlay"),
  pauseMsg: $("pauseMsg"),
  globalProgress: $("globalProgress"),

  btnPlay: $("btnPlay"),
  btnPrev: $("btnPrev"),
  btnNext: $("btnNext"),
  btnRew10: $("btnRew10"),
  btnFwd10: $("btnFwd10"),
  wpmSlider: $("wpmSlider"),
  wpmLabel: $("wpmLabel"),
  watVal: $("watVal"),
  pageNum: $("pageNum"),
  btnPP: $("btnPP"),
  btnNP: $("btnNP"),
  btnPrevPage: $("btnPrevPage"),
  btnNextPage: $("btnNextPage"),
  btnSidebar: $("btnSidebar"),
  btnFullscreen: $("btnFullscreen"),
  btnExport: $("btnExport"),
  btnClose: $("btnClose"),
  sidebar: $("sidebar"),
  sidebarInner: $("sidebarInner"),
  toast: $("toast"),
  sessionTimer: $("sessionTimer"),
};

// ════════════════════════════════════════════════════════════════════════════
// Utility
// ════════════════════════════════════════════════════════════════════════════
function showToast(msg, ms = 3000) {
  dom.toast.textContent = msg;
  dom.toast.classList.add("show");
  setTimeout(() => dom.toast.classList.remove("show"), ms);
}

function fmtRelTime(ts) {
  if (!ts) return "Unknown";
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ════════════════════════════════════════════════════════════════════════════
// SHA-256 Hash
// ════════════════════════════════════════════════════════════════════════════
async function sha256(buffer) {
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ════════════════════════════════════════════════════════════════════════════
// Drop Zone
// ════════════════════════════════════════════════════════════════════════════
dom.dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dom.dropZone.classList.add("dragover");
});
dom.dropZone.addEventListener("dragleave", () =>
  dom.dropZone.classList.remove("dragover"),
);
dom.dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dom.dropZone.classList.remove("dragover");
  const file = e.dataTransfer.files[0];
  if (file?.type === "application/pdf") loadPDF(file);
  else showToast("Please drop a PDF file.");
});

dom.dropZone.addEventListener("click", (e) => {
  if (e.target !== dom.btnBrowse) dom.fileInput.click();
});
dom.btnBrowse.addEventListener("click", (e) => {
  e.stopPropagation();
  dom.fileInput.click();
});
dom.fileInput.addEventListener("change", () => {
  const file = dom.fileInput.files?.[0];
  if (file) loadPDF(file);
});

// ════════════════════════════════════════════════════════════════════════════
// Load Recent PDFs list
// ════════════════════════════════════════════════════════════════════════════
async function loadRecent() {
  try {
    const data = await chrome.storage.local.get("pdfProgress");
    const progress = data.pdfProgress || {};
    const entries = Object.values(progress)
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, 5);

    dom.recentItems.innerHTML = "";
    if (!entries.length) {
      dom.recentItems.innerHTML =
        '<p style="font-size:12px;color:var(--muted)">No recent PDFs yet.</p>';
      return;
    }

    entries.forEach((p) => {
      const pct =
        p.totalWords > 0 ? Math.round((p.wordIndex / p.totalWords) * 100) : 0;
      const div = document.createElement("div");
      div.className = "recent-item";
      div.innerHTML = `
        <span class="ri-icon">📄</span>
        <div class="ri-info">
          <div class="ri-name">${p.fileName || "Unknown PDF"}</div>
          <div class="ri-meta">Page ${p.currentPage || 1}/${p.totalPages || "?"} · ${fmtRelTime(p.timestamp)}</div>
        </div>
        <div class="ri-prog"><div class="ri-prog-bar" style="width:${pct}%"></div></div>
        <span class="ri-pct">${pct}%</span>
      `;
      div.title = `${p.fileName} — Click to ${pct > 0 ? "resume" : "open"}`;
      // Recent items can only be opened by re-selecting the file (we can't reopen by hash alone
      // without File System Access API, which requires user gesture each time)
      div.addEventListener("click", () => {
        showToast("Select the same PDF file to resume your progress.");
        dom.fileInput.click();
      });
      dom.recentItems.appendChild(div);
    });
  } catch {}
}

// ════════════════════════════════════════════════════════════════════════════
// Load PDF
// ════════════════════════════════════════════════════════════════════════════
async function loadPDF(file) {
  // Show loading
  dom.landingScreen.style.display = "none";
  dom.loadingScreen.style.display = "flex";
  dom.loadingPct.textContent = "0%";
  dom.loadingMsg.textContent = "Reading file…";

  try {
    const buffer = await file.arrayBuffer();

    // Hash
    dom.loadingMsg.textContent = "Computing file hash…";
    const hash = await sha256(buffer);
    st.pdfHash = hash;
    st.fileName = file.name;

    // Check saved progress
    const data = await chrome.storage.local.get("pdfProgress");
    const progress = (data.pdfProgress || {})[hash];
    st.savedProgress = progress || null;

    // Load pdf.js
    dom.loadingMsg.textContent = "Loading PDF…";
    const pdf = await getDocument({ data: buffer }).promise;
    st.pdfDoc = pdf;
    st.totalPages = pdf.numPages;

    // Extract text page by page
    dom.loadingMsg.textContent = `Extracting text from ${pdf.numPages} pages…`;
    st.pageTexts = [];
    st.pageWordStart = [];
    st.allWords = [];

    for (let pg = 1; pg <= pdf.numPages; pg++) {
      const pct = Math.round((pg / pdf.numPages) * 100);
      dom.loadingPct.textContent = pct + "%";
      dom.loadingMsg.textContent = `Extracting page ${pg}/${pdf.numPages}…`;

      const page = await pdf.getPage(pg);
      const content = await page.getTextContent();
      const pageText = content.items.map((i) => i.str).join(" ");
      const words = pageText.split(/\s+/).filter((w) => w.length > 0);

      st.pageWordStart.push(st.allWords.length);
      st.pageTexts.push(words);
      st.allWords.push(...words);
    }

    dom.loadingMsg.textContent = "Building reading chunks…";
    buildChunks();

    // Thumbnails (async, low priority)
    generateThumbnails();

    // Show reader
    dom.loadingScreen.style.display = "none";
    dom.readerUI.style.display = "flex";

    st.playing = false;
    dom.pdfTitle.textContent = `${file.name} — Page 1/${st.totalPages}`;
    dom.pdfTitle.title = dom.pdfTitle.textContent;

    updateStats();

    // Show resume banner if we have saved progress
    if (st.savedProgress && st.savedProgress.wordIndex > 0) {
      showResumeBanner(st.savedProgress);
    } else {
      dom.pauseOverlay.classList.add("visible");
      dom.pauseMsg.innerHTML = `<span class="big">⏸</span><span>Press <kbd style="background:var(--surface2);border:1px solid var(--border);padding:2px 8px;border-radius:4px">Space</kbd> to start</span>`;
    }

    updateWordDisplay();
    updatePageIndicator();

    // Load settings
    await loadSettings();
  } catch (err) {
    dom.loadingScreen.style.display = "none";
    dom.landingScreen.style.display = "flex";
    showToast(`Error loading PDF: ${err.message}`);
    console.error("PDF load error:", err);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Resume Banner
// ════════════════════════════════════════════════════════════════════════════
function showResumeBanner(progress) {
  const pct =
    st.allWords.length > 0
      ? Math.round((progress.wordIndex / st.allWords.length) * 100)
      : 0;
  dom.resumeTitle.textContent = `Resume from Page ${progress.currentPage} (${pct}% complete)`;
  dom.resumeSub.textContent = `Last read ${fmtRelTime(progress.timestamp)} · ${progress.lastWpm || 300} WPM`;
  dom.resumeBanner.style.display = "flex";
  dom.pauseOverlay.classList.add("visible");
  dom.pauseMsg.innerHTML = `<span class="big">⏸</span><span>Choose resume or start below</span>`;
}

dom.btnResume.addEventListener("click", () => {
  if (!st.savedProgress) return;
  dom.resumeBanner.style.display = "none";

  // Jump to saved word
  const targetWord = st.savedProgress.wordIndex || 0;
  const wpm = st.savedProgress.lastWpm || 300;
  const wat = st.savedProgress.lastWat || 1;

  setWPM(wpm);
  setWAT(wat);

  // Find chunk
  st.chunkIdx = findChunkByWordIndex(targetWord);
  updateWordDisplay();
  updatePageIndicator();
  updateStats();

  dom.pauseOverlay.classList.remove("visible");
  play();
});

dom.btnStartFresh.addEventListener("click", () => {
  dom.resumeBanner.style.display = "none";
  st.chunkIdx = 0;
  updateWordDisplay();
  updatePageIndicator();
  updateStats();
  dom.pauseOverlay.classList.add("visible");
  dom.pauseMsg.innerHTML = `<span class="big">⏸</span><span>Press <kbd style="background:var(--surface2);border:1px solid var(--border);padding:2px 8px;border-radius:4px">Space</kbd> to start</span>`;
});

// ════════════════════════════════════════════════════════════════════════════
// Chunk Building
// ════════════════════════════════════════════════════════════════════════════
function buildChunks() {
  st.chunks = [];
  let globalIdx = 0;

  st.pageTexts.forEach((words, pageIdx) => {
    for (let i = 0; i < words.length; i += st.wat) {
      const tokens = words.slice(i, i + st.wat);

      // Focal: longest word index
      let focal = 0,
        maxLen = 0;
      tokens.forEach((w, j) => {
        if (w.length > maxLen) {
          maxLen = w.length;
          focal = j;
        }
      });

      st.chunks.push({
        tokens,
        focal,
        wordStart: globalIdx + i,
        pageIdx,
      });
    }
    globalIdx += words.length;
  });
}

function findChunkByWordIndex(wordIdx) {
  let lo = 0,
    hi = st.chunks.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (st.chunks[mid].wordStart <= wordIdx) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

// ════════════════════════════════════════════════════════════════════════════
// Word Display
// ════════════════════════════════════════════════════════════════════════════
function updateWordDisplay() {
  if (!st.chunks.length) return;
  const chunk = st.chunks[st.chunkIdx];
  if (!chunk) return;

  const orp = dom.orp;
  dom.wordBox.innerHTML = "";
  dom.wordBox.appendChild(orp);

  chunk.tokens.forEach((word, i) => {
    const span = document.createElement("span");
    span.className = "token" + (i === chunk.focal ? " focal" : "");
    span.textContent = word;
    dom.wordBox.appendChild(span);
  });

  // Context
  const prev = st.chunks[st.chunkIdx - 1];
  const next = st.chunks[st.chunkIdx + 1];
  dom.ctxAbove.textContent = prev ? prev.tokens.join(" ") : "";
  dom.ctxBelow.textContent = next ? next.tokens.join(" ") : "";
}

function updatePageIndicator() {
  if (!st.chunks.length) return;
  const chunk = st.chunks[st.chunkIdx];
  const page = (chunk?.pageIdx ?? 0) + 1;
  dom.pageNum.textContent = `${page}/${st.totalPages}`;
  dom.pdfTitle.textContent = `${st.fileName} — Page ${page}/${st.totalPages}`;

  // Highlight active thumbnail
  document.querySelectorAll(".thumb").forEach((el, i) => {
    el.classList.toggle("active", i === (chunk?.pageIdx ?? 0));
  });
}

function updateStats() {
  if (!st.chunks.length) return;
  const chunk = st.chunks[st.chunkIdx];
  const wordIdx = chunk?.wordStart ?? 0;

  // Global progress
  const totalWords = st.allWords.length;
  const pct = totalWords > 0 ? (wordIdx / totalWords) * 100 : 0;
  dom.globalProgress.style.width = pct.toFixed(2) + "%";

  dom.wordProgress.textContent = `${wordIdx}/${totalWords}`;

  // Time left
  const wordsLeft = totalWords - wordIdx;
  const secsLeft = Math.ceil((wordsLeft / st.wpm) * 60);
  const m = Math.floor(secsLeft / 60);
  const s = secsLeft % 60;
  dom.timeLeft.textContent = `${m}:${String(s).padStart(2, "0")}`;
}

// ════════════════════════════════════════════════════════════════════════════
// Thumbnails
// ════════════════════════════════════════════════════════════════════════════
async function generateThumbnails() {
  dom.sidebarInner.innerHTML = "";
  const THUMB_W = 110;

  for (let pg = 1; pg <= Math.min(st.totalPages, 50); pg++) {
    const wrapper = document.createElement("div");
    wrapper.className = "thumb";
    wrapper.dataset.page = pg;

    const pgNum = document.createElement("span");
    pgNum.className = "pg-num";
    pgNum.textContent = pg;
    wrapper.appendChild(pgNum);

    wrapper.addEventListener("click", () => jumpToPage(pg));
    dom.sidebarInner.appendChild(wrapper);

    // Render canvas asynchronously
    (async () => {
      try {
        const page = await st.pdfDoc.getPage(pg);
        const viewport = page.getViewport({ scale: 1 });
        const scale = THUMB_W / viewport.width;
        const vp = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = vp.width;
        canvas.height = vp.height;
        const ctx = canvas.getContext("2d");
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        wrapper.insertBefore(canvas, pgNum);
      } catch {
        /* ignore thumbnail errors */
      }
    })();
  }
}

function jumpToPage(pageNum) {
  const pageIdx = pageNum - 1;
  // Find first chunk of that page
  const idx = st.chunks.findIndex((c) => c.pageIdx === pageIdx);
  if (idx !== -1) {
    st.chunkIdx = idx;
    updateWordDisplay();
    updatePageIndicator();
    updateStats();
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Playback
// ════════════════════════════════════════════════════════════════════════════
function intervalMs() {
  const base = (60 / st.wpm) * 1000;
  const chunk = st.chunks[st.chunkIdx];
  if (!chunk) return base;
  const maxLen = Math.max(...chunk.tokens.map((w) => w.length));
  let mult = 1 + Math.max(0, (maxLen - 6) * 0.04);
  const last = chunk.tokens[chunk.tokens.length - 1] || "";
  if (/[.!?]$/.test(last)) mult *= 1.6;
  else if (/[,;:]$/.test(last)) mult *= 1.2;
  return base * st.wat * mult;
}

function play() {
  if (st.playing) return;
  if (st.chunkIdx >= st.chunks.length - 1 && st.chunks.length > 1)
    st.chunkIdx = 0;
  st.playing = true;
  dom.pauseOverlay.classList.remove("visible");
  dom.btnPlay.textContent = "⏸ Pause";
  // Enter reading mode
  document.body.classList.add("reading");
  startSessionTimer();
  tick();
}

function pause() {
  if (!st.playing) return;
  st.playing = false;
  clearTimeout(st.timerId);
  stopSessionTimer();
  // Exit reading mode
  document.body.classList.remove("reading");
  dom.pauseOverlay.classList.add("visible");
  dom.pauseMsg.innerHTML = `<span class="big">⏸</span><span>Paused — press <kbd style="background:var(--surface2);border:1px solid var(--border);padding:2px 8px;border-radius:4px">Space</kbd> to resume</span>`;
  dom.btnPlay.textContent = "▶ Play";
  saveProgress();
}

function togglePlay() {
  st.playing ? pause() : play();
}

function tick() {
  if (!st.playing) return;
  updateWordDisplay();
  updatePageIndicator();
  updateStats();

  if (st.chunkIdx >= st.chunks.length - 1) {
    pause();
    dom.pauseMsg.innerHTML = `<span class="big">✅</span><span>Finished! Great reading session.</span>`;
    return;
  }

  st.timerId = setTimeout(() => {
    st.chunkIdx++;
    tick();
  }, intervalMs());
}

function stepBy(n) {
  st.chunkIdx = Math.max(0, Math.min(st.chunks.length - 1, st.chunkIdx + n));
  updateWordDisplay();
  updatePageIndicator();
  updateStats();
}

function rewindSec(sec) {
  const skip = Math.round((sec / 60) * st.wpm);
  st.chunkIdx = findChunkByWordIndex(
    Math.max(0, (st.chunks[st.chunkIdx]?.wordStart ?? 0) - skip),
  );
  updateWordDisplay();
  updatePageIndicator();
  updateStats();
}

function fwdSec(sec) {
  const skip = Math.round((sec / 60) * st.wpm);
  st.chunkIdx = findChunkByWordIndex(
    (st.chunks[st.chunkIdx]?.wordStart ?? 0) + skip,
  );
  updateWordDisplay();
  updatePageIndicator();
  updateStats();
}

function prevPage() {
  const cur = st.chunks[st.chunkIdx]?.pageIdx ?? 0;
  if (cur <= 0) return;
  jumpToPage(cur); // go to start of current page
  setTimeout(() => jumpToPage(cur), 10); // then previous
  jumpToPage(cur); // = go to previous page start
  // Actually: find first chunk of page cur-1
  const idx = st.chunks.findIndex((c) => c.pageIdx === cur - 1);
  if (idx !== -1) {
    st.chunkIdx = idx;
    updateWordDisplay();
    updatePageIndicator();
    updateStats();
  }
}

function nextPage() {
  const cur = st.chunks[st.chunkIdx]?.pageIdx ?? 0;
  const idx = st.chunks.findIndex((c) => c.pageIdx === cur + 1);
  if (idx !== -1) {
    st.chunkIdx = idx;
    updateWordDisplay();
    updatePageIndicator();
    updateStats();
  }
}

// ════════════════════════════════════════════════════════════════════════════
// WPM + WAT
// ════════════════════════════════════════════════════════════════════════════
function setWPM(val) {
  st.wpm = Math.min(1200, Math.max(100, val));
  dom.wpmSlider.value = st.wpm;
  dom.wpmLabel.textContent = st.wpm;
  dom.topWpm.textContent = st.wpm;
  if (st.playing) {
    clearTimeout(st.timerId);
    tick();
  }
}

function setWAT(val) {
  st.wat = Math.min(5, Math.max(1, val));
  dom.watVal.textContent = st.wat;
  const curWord = st.chunks[st.chunkIdx]?.wordStart ?? 0;
  buildChunks();
  st.chunkIdx = findChunkByWordIndex(curWord);
  updateWordDisplay();
}

// ════════════════════════════════════════════════════════════════════════════
// Progress Persistence
// ════════════════════════════════════════════════════════════════════════════
async function saveProgress() {
  if (!st.pdfHash) return;
  try {
    const data = await chrome.storage.local.get("pdfProgress");
    const all = data.pdfProgress || {};
    const chunk = st.chunks[st.chunkIdx];
    all[st.pdfHash] = {
      pdfHash: st.pdfHash,
      fileName: st.fileName,
      currentPage: (chunk?.pageIdx ?? 0) + 1,
      totalPages: st.totalPages,
      wordIndex: chunk?.wordStart ?? 0,
      totalWords: st.allWords.length,
      lastWpm: st.wpm,
      lastWat: st.wat,
      timestamp: Date.now(),
    };
    await chrome.storage.local.set({ pdfProgress: all });
  } catch (e) {
    console.warn("saveProgress error", e);
  }
}

async function loadSettings() {
  try {
    const data = await chrome.storage.local.get("settings");
    const s = data.settings || {};
    if (s.wpm) setWPM(s.wpm);
    if (s.wat) setWAT(s.wat);
  } catch {}
}

// Auto-save every 5 seconds
let autoSaveInterval = null;
function startAutoSave() {
  stopAutoSave();
  autoSaveInterval = setInterval(saveProgress, 5000);
}
function stopAutoSave() {
  if (autoSaveInterval) clearInterval(autoSaveInterval);
}

window.addEventListener("beforeunload", () => {
  if (st.pdfHash) saveProgress();
});

// ════════════════════════════════════════════════════════════════════════════
// Export Progress
// ════════════════════════════════════════════════════════════════════════════
dom.btnExport.addEventListener("click", async () => {
  try {
    const data = await chrome.storage.local.get("pdfProgress");
    const json = JSON.stringify(data.pdfProgress || {}, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "viberead-progress.json";
    a.click();
    URL.revokeObjectURL(url);
    showToast("Progress exported!", 2000);
  } catch {
    showToast("Export failed.");
  }
});

// ════════════════════════════════════════════════════════════════════════════
// Keyboard Shortcuts
// ════════════════════════════════════════════════════════════════════════════
document.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
  switch (e.key) {
    case " ":
      e.preventDefault();
      togglePlay();
      break;
    case "ArrowLeft":
      e.preventDefault();
      prevPage();
      break;
    case "ArrowRight":
      e.preventDefault();
      nextPage();
      break;
    case "ArrowUp":
      e.preventDefault();
      setWPM(st.wpm + 25);
      break;
    case "ArrowDown":
      e.preventDefault();
      setWPM(st.wpm - 25);
      break;
    case "j":
    case "J":
      rewindSec(10);
      break;
    case "l":
    case "L":
      fwdSec(10);
      break;
    case "k":
    case "K":
      togglePlay();
      break;
    case "f":
    case "F":
      toggleFullscreen();
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
// UI Bindings
// ════════════════════════════════════════════════════════════════════════════
dom.btnPlay.addEventListener("click", togglePlay);
dom.btnPrev.addEventListener("click", () => stepBy(-1));
dom.btnNext.addEventListener("click", () => stepBy(1));
dom.btnRew10.addEventListener("click", () => rewindSec(10));
dom.btnFwd10.addEventListener("click", () => fwdSec(10));
dom.btnPrevPage.addEventListener("click", prevPage);
dom.btnNextPage.addEventListener("click", nextPage);
dom.btnPP.addEventListener("click", prevPage);
dom.btnNP.addEventListener("click", nextPage);

dom.wpmSlider.addEventListener("input", () =>
  setWPM(parseInt(dom.wpmSlider.value)),
);
$("watDown").addEventListener("click", () => setWAT(st.wat - 1));
$("watUp").addEventListener("click", () => setWAT(st.wat + 1));

dom.btnSidebar.addEventListener("click", () => {
  dom.sidebar.classList.toggle("open");
});
dom.btnFullscreen.addEventListener("click", toggleFullscreen);
dom.btnClose.addEventListener("click", () => {
  if (st.pdfHash) saveProgress();
  window.close();
});

function toggleFullscreen() {
  if (!document.fullscreenElement)
    document.documentElement.requestFullscreen().catch(() => {});
  else document.exitFullscreen().catch(() => {});
}

// ════════════════════════════════════════════════════════════════════════════
// Session Timer
// ════════════════════════════════════════════════════════════════════════════
function startSessionTimer() {
  st.sessionElapsed = 0;
  updateSessionTimerDisplay();
  st.sessionTimerId = setInterval(() => {
    st.sessionElapsed++;
    updateSessionTimerDisplay();
  }, 1000);
}

function stopSessionTimer() {
  if (st.sessionTimerId) {
    clearInterval(st.sessionTimerId);
    st.sessionTimerId = null;
  }
}

function updateSessionTimerDisplay() {
  const el = dom.sessionTimer;
  if (!el) return;
  const m = Math.floor(st.sessionElapsed / 60);
  const s = st.sessionElapsed % 60;
  el.textContent = `${m}:${String(s).padStart(2, "0")}`;
}

// ════════════════════════════════════════════════════════════════════════════
// Init
// ════════════════════════════════════════════════════════════════════════════
loadRecent();
startAutoSave();
