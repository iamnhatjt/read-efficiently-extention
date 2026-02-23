// VibeRead — background service worker (Manifest V3)
"use strict";

// ── Keyboard shortcut: Alt+V → open reader for current tab ──────────────────
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "open-reader") {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab) openReaderForTab(tab.id, tab.url, tab.title);
  }
});

// ── Message bus ─────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "EXTRACT_PAGE_TEXT") {
    extractPageText(msg.tabId, msg.tabUrl, msg.tabTitle)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true; // keep channel open
  }

  if (msg.type === "OPEN_READER") {
    openReaderForTab(msg.tabId, msg.tabUrl, msg.tabTitle);
    sendResponse({ ok: true });
  }

  if (msg.type === "OPEN_PDF_READER") {
    openPdfReader();
    sendResponse({ ok: true });
  }
});

/**
 * Injects Readability + extracts text from a live tab.
 */
async function extractPageText(tabId, tabUrl, tabTitle) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: extractReadable,
    });
    const text = results?.[0]?.result || "";
    return { text, title: tabTitle, url: tabUrl, source: "readability" };
  } catch (e) {
    return {
      text: "",
      title: tabTitle,
      url: tabUrl,
      source: "error",
      error: e.message,
    };
  }
}

/**
 * Runs inside the target page — extracts readable text with a simple
 * fallback when Mozilla Readability is not available.
 */
function extractReadable() {
  // Try innerText of <article> or <main> first
  const article =
    document.querySelector("article") ||
    document.querySelector("main") ||
    document.body;
  let text = (article.innerText || "").replace(/\s+/g, " ").trim();
  // Strip very short "paragraphs" (navigation, ads)
  text = text
    .split(/\n+/)
    .filter((l) => l.trim().length > 40)
    .join("\n\n");
  return text;
}

/**
 * Opens the RSVP reader window for a tab's content.
 */
async function openReaderForTab(tabId, tabUrl, tabTitle) {
  // Extract text from page
  let textData;
  try {
    const res = await extractPageText(tabId, tabUrl, tabTitle);
    textData = res;
  } catch {
    textData = { text: "", title: tabTitle, url: tabUrl };
  }

  // Store payload in local storage so reader.html can fetch it
  await chrome.storage.local.set({ pendingReaderPayload: textData });

  // Open reader window
  chrome.windows.create({
    url: chrome.runtime.getURL("reader/reader.html"),
    type: "popup",
    width: 1100,
    height: 700,
  });
}

/**
 * Opens the PDF reader window.
 */
function openPdfReader() {
  chrome.windows.create({
    url: chrome.runtime.getURL("pdf/pdf-reader.html"),
    type: "popup",
    width: 1100,
    height: 700,
  });
}
