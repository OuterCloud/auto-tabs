// content-rename.js — Listens for rename messages from background SW
// Injected declaratively via manifest to all pages, avoiding dynamic executeScript crashes.

(function () {
  let currentCustomName = null;
  let observer = null;
  let updating = false; // Guard flag to prevent infinite MutationObserver loop

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action !== "applyRename") return;

    currentCustomName = message.name || null;

    if (currentCustomName) {
      // Signal to content.js (title enhancer) to stop overriding
      window.__autoTabGroupsRenamed = true;

      updating = true;
      document.title = currentCustomName;
      updating = false;

      // Set up observer to keep the title (only once)
      if (!observer) {
        const titleEl = document.querySelector("title");
        if (titleEl) {
          observer = new MutationObserver(() => {
            if (updating) return; // Prevent re-entry
            if (currentCustomName && document.title !== currentCustomName) {
              updating = true;
              document.title = currentCustomName;
              updating = false;
            }
          });
          observer.observe(titleEl, {
            childList: true,
            characterData: true,
            subtree: true,
          });
        }
      }
    } else {
      // Clear custom name — disconnect observer, let content.js resume
      window.__autoTabGroupsRenamed = false;
      if (observer) {
        observer.disconnect();
        observer = null;
      }
    }

    sendResponse({ ok: true });
  });
})();
