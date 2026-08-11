// content-rename.js — Listens for rename messages from background SW
// Injected declaratively via manifest to all pages, avoiding dynamic executeScript crashes.

(function () {
  let currentCustomName = null;
  let observer = null;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action !== "applyRename") return;

    currentCustomName = message.name || null;

    if (currentCustomName) {
      document.title = currentCustomName;

      // Set up observer to keep the title
      if (!observer) {
        const titleEl = document.querySelector("title");
        if (titleEl) {
          observer = new MutationObserver(() => {
            if (currentCustomName && document.title !== currentCustomName) {
              document.title = currentCustomName;
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
      // Clear custom name — disconnect observer
      if (observer) {
        observer.disconnect();
        observer = null;
      }
    }

    sendResponse({ ok: true });
  });
})();
