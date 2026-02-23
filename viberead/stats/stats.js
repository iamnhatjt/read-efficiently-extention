// VibeRead Statistics page
"use strict";

function formatNum(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 10_000) return (n / 1_000).toFixed(0) + "K";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

function fmtRelTime(ts) {
  if (!ts) return "Unknown";
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d > 1 ? "s" : ""} ago`;
}

async function loadStats() {
  try {
    const data = await chrome.storage.local.get([
      "stats",
      "pdfProgress",
      "settings",
    ]);
    const stats = data.stats || {};
    const pdfProgress = data.pdfProgress || {};
    const settings = data.settings || {};

    // Main stats
    const totalWords = stats.totalWords || 0;
    const sessions = stats.sessions || 0;
    const streak = stats.streak || 0;

    // Estimate hours saved: assume average reader = 230 WPM; VibeRead avg = user's wpm
    const userWpm = settings.wpm || 300;
    const avgBaseWpm = 230;
    const speedMultiplier = userWpm / avgBaseWpm;
    const hoursSaved = Math.max(
      0,
      (totalWords / avgBaseWpm - totalWords / userWpm) / 60,
    );

    document.getElementById("totalWords").textContent = formatNum(totalWords);
    document.getElementById("streak").textContent = streak;
    document.getElementById("sessions").textContent = formatNum(sessions);
    document.getElementById("hoursRead").textContent =
      hoursSaved.toFixed(1) + "h";
    document.getElementById("pdfCount").textContent =
      Object.keys(pdfProgress).length;
    document.getElementById("avgWpm").textContent = userWpm;

    // PDF List
    const entries = Object.values(pdfProgress).sort(
      (a, b) => (b.timestamp || 0) - (a.timestamp || 0),
    );
    const pdfList = document.getElementById("pdfList");

    if (!entries.length) return; // keep empty state

    pdfList.innerHTML = "";
    entries.forEach((p) => {
      const pct =
        p.totalWords > 0 ? Math.round((p.wordIndex / p.totalWords) * 100) : 0;
      const row = document.createElement("div");
      row.className = "pdf-row";
      row.innerHTML = `
        <span class="pdf-icon">📄</span>
        <div class="pdf-info">
          <div class="pdf-name">${p.fileName || "Unknown PDF"}</div>
          <div class="pdf-meta">
            Page ${p.currentPage || 1}/${p.totalPages || "?"} ·
            ${formatNum(p.wordIndex || 0)} / ${formatNum(p.totalWords || 0)} words ·
            Last: ${fmtRelTime(p.timestamp)}
          </div>
        </div>
        <div class="pdf-right">
          <span class="pdf-pct">${pct}%</span>
          <div class="prog"><div class="prog-bar" style="width:${pct}%"></div></div>
        </div>
      `;
      pdfList.appendChild(row);
    });
  } catch (e) {
    console.error("Stats load error", e);
  }
}

// Animate numbers on load
function animateVal(el, target, isFloat = false) {
  const str = el.textContent;
  // Only animate if it's a plain number
  const num = parseFloat(str.replace(/[KMh]/g, ""));
  if (isNaN(num)) return;
  // Just set directly for simplicity (could add requestAnimationFrame counter)
}

loadStats();
