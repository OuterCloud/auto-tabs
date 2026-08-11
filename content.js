// content.js — Enhance tab title with URL path for better identification
// Injected declaratively via manifest. Activates only when signaled by background.

(function () {
  let active = false;
  let updating = false;

  function getPathSuffix() {
    return location.pathname === "/" ? "" : location.pathname;
  }

  function stripSuffix(title) {
    return title.replace(/\s-\s\/\S*$/, "");
  }

  function enhance() {
    if (updating) return;
    // Don't override custom rename
    if (window.__autoTabGroupsRenamed) return;
    if (!active) return;

    const suffix = getPathSuffix();
    if (!suffix) return;

    const base = stripSuffix(document.title);
    const desired = `${base} - ${suffix}`;
    if (document.title !== desired) {
      updating = true;
      document.title = desired;
      updating = false;
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === "enableEnhanceTitle") {
      active = true;
      enhance();
      // Watch for SPA title changes
      const titleEl = document.querySelector("title");
      if (titleEl) {
        new MutationObserver(() => enhance()).observe(titleEl, {
          childList: true,
          characterData: true,
          subtree: true,
        });
      }
      // Watch for SPA navigation
      let lastPath = location.pathname;
      setInterval(() => {
        if (location.pathname !== lastPath) {
          lastPath = location.pathname;
          enhance();
        }
      }, 1000);
      sendResponse({ ok: true });
    }
  });
})();
