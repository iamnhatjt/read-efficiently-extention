// VibeRead content script — injected into every page
// Provides page text extraction helper and keyboard shortcut listener.
"use strict";

// Listen for Alt+V at the page level (backup if command doesn't fire)
document.addEventListener("keydown", (e) => {
  if (e.altKey && e.key === "v") {
    chrome.runtime.sendMessage({
      type: "OPEN_READER",
      tabId: null,
      tabUrl: location.href,
      tabTitle: document.title,
    });
  }
});
