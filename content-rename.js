// content-rename.js — Listens for rename messages from background SW
// Injected declaratively via manifest to all pages.

(function () {
  let currentCustomName = null;
  let observer = null;
  let updating = false; // Guard flag to prevent infinite MutationObserver loop

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === "applyRename") {
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
              if (updating) return;
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
        window.__autoTabGroupsRenamed = false;
        if (observer) {
          observer.disconnect();
          observer = null;
        }
      }

      sendResponse({ ok: true });
      return;
    }

    if (message.action === "promptRename") {
      const newName = window.prompt("输入自定义标签名称：", message.currentTitle || "");
      sendResponse({ name: newName || null });
      return;
    }
  });
})();
