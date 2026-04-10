// content.js — Enhance tab title with URL path for better identification
// Injected programmatically by background.js when enhanceTitle is enabled.

(function () {
  let updating = false;

  function getPathSuffix() {
    return location.pathname === "/" ? "" : location.pathname;
  }

  function stripSuffix(title) {
    return title.replace(/\s-\s\/\S*$/, "");
  }

  function enhance() {
    if (updating) return;
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

  // Initial enhancement
  enhance();

  // Watch for SPA title changes (framework updates document.title)
  const titleEl = document.querySelector("title");
  if (titleEl) {
    new MutationObserver(() => enhance()).observe(titleEl, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  // Watch for SPA navigation (URL path changes without page reload)
  let lastPath = location.pathname;
  setInterval(() => {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      enhance();
    }
  }, 1000);
})();
