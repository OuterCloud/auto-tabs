// background.js — Service Worker
// Import shared rule utilities via importScripts (MV3 service worker)
importScripts("utils/rules.js");

// Debounce timer for reorderGroups per windowId
const _reorderTimers = {};
const REORDER_DEBOUNCE_MS = 300;

// Debounce timer for updateGroupTitles per windowId
const _titleTimers = {};
const TITLE_DEBOUNCE_MS = 200;

// ─── Core: organize a single tab ──────────────────────────────────────────────

/**
 * Find an existing tab group by name in the given window.
 * Handles titles with tab count suffix, e.g. "GitHub (3)".
 * @param {number} windowId
 * @param {string} name
 * @returns {Promise<number|null>} groupId or null
 */
async function findGroupByName(windowId, name) {
  const groups = await chrome.tabGroups.query({ windowId });
  return (
    groups.find((g) => {
      const baseName = g.title.replace(/\s*\(\d+\)$/, "");
      return baseName === name;
    })?.id ?? null
  );
}

/**
 * Update all managed group titles in a window to include tab count.
 * e.g. "GitHub" → "GitHub (3)" when showTabCount is enabled.
 * @param {number} windowId
 * @param {Array} rules
 */
async function updateGroupTitles(windowId, rules) {
  try {
    const settings = await loadSettings();
    const groups = await chrome.tabGroups.query({ windowId });
    const allTabs = await chrome.tabs.query({ windowId });

    for (const group of groups) {
      // Count tabs in this group
      const count = allTabs.filter((t) => t.groupId === group.id).length;
      if (count === 0) continue;

      // Determine the base name (strip existing count suffix)
      const baseName = group.title.replace(/\s*\(\d+\)$/, "");

      // Build desired title
      const desiredTitle =
        settings.showTabCount && count > 1
          ? `${baseName} (${count})`
          : baseName;

      if (group.title !== desiredTitle) {
        try {
          await chrome.tabGroups.update(group.id, { title: desiredTitle });
        } catch {
          /* group may have been removed */
        }
      }
    }
  } catch (err) {
    console.warn("[AutoTabGroups] updateGroupTitles error:", err.message);
  }
}

/**
 * Schedule a debounced title update for a window.
 * @param {number} windowId
 * @param {Array} rules
 */
function scheduleUpdateTitles(windowId, rules) {
  clearTimeout(_titleTimers[windowId]);
  _titleTimers[windowId] = setTimeout(() => {
    delete _titleTimers[windowId];
    updateGroupTitles(windowId, rules);
  }, TITLE_DEBOUNCE_MS);
}

// Track tabs that already have the title enhancement injected
const _enhancedTabs = new Set();

/**
 * Inject content.js into a tab to enhance its title with URL path info.
 * Only injects if enhanceTitle setting is enabled and tab hasn't been injected yet.
 * @param {number} tabId
 * @param {string} url
 */
async function maybeEnhanceTitle(tabId, url) {
  if (
    !url ||
    url.startsWith("chrome://") ||
    url.startsWith("chrome-extension://")
  )
    return;
  if (_enhancedTabs.has(tabId)) return;

  try {
    const settings = await loadSettings();
    if (!settings.enhanceTitle) return;

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"],
    });
    _enhancedTabs.add(tabId);
  } catch (err) {
    // Tab may not be injectable (e.g. chrome web store)
    console.warn("[AutoTabGroups] enhanceTitle inject error:", err.message);
  }
}

/**
 * Apply rules to a single tab. Skips tabs with no URL or chrome:// URLs.
 * @param {number} tabId
 * @param {string} url
 * @param {number} windowId
 * @param {Array} rules
 */
async function organizeTab(tabId, url, windowId, rules) {
  if (
    !url ||
    url.startsWith("chrome://") ||
    url.startsWith("chrome-extension://")
  )
    return;

  const rule = findMatchingRule(url, rules);

  if (!rule) {
    const settings = await loadSettings();
    if (!settings.autoDomain) return;

    const domain = extractRootDomain(url);
    if (!domain) return;

    const color = domainToColor(domain);
    try {
      let groupId = await findGroupByName(windowId, domain);
      if (groupId == null) {
        groupId = await chrome.tabs.group({ tabIds: [tabId] });
        await chrome.tabGroups.update(groupId, { title: domain, color });
      } else {
        const current = await chrome.tabs.get(tabId);
        if (current.groupId === groupId) return; // already in the correct group
        await chrome.tabs.group({ groupId, tabIds: [tabId] });
      }
      scheduleReorder(windowId, rules);
      scheduleUpdateTitles(windowId, rules);
    } catch (err) {
      console.warn("[AutoTabGroups] autoDomain error:", err.message);
    }
    return;
  }

  try {
    let groupId = await findGroupByName(windowId, rule.name);

    if (groupId == null) {
      // Create a new group containing this tab
      groupId = await chrome.tabs.group({ tabIds: [tabId] });
      await chrome.tabGroups.update(groupId, {
        title: rule.name,
        color: rule.color,
      });
    } else {
      const current = await chrome.tabs.get(tabId);
      if (current.groupId === groupId) return; // already in the correct group
      // Add tab to existing group
      await chrome.tabs.group({ groupId, tabIds: [tabId] });
    }
    scheduleReorder(windowId, rules);
    scheduleUpdateTitles(windowId, rules);
  } catch (err) {
    // Tab may have been closed; ignore
    console.warn("[AutoTabGroups] organizeTab error:", err.message);
  }
}

// ─── Reorder tab groups by priority ────────────────────────────────────────

/**
 * Reorder tab groups in a window by priority (DESC) then title (ASC).
 * Only moves groups that match a rule or an auto-domain group.
 * Unmanaged groups (manually created, from other extensions) are left in place.
 * @param {number} windowId
 * @param {Array} rules
 */
async function reorderGroups(windowId, rules) {
  try {
    const groups = await chrome.tabGroups.query({ windowId });
    const settings = await loadSettings();

    // Build a list of { groupId, priority, title } for managed groups only
    const managed = [];
    for (const group of groups) {
      const baseName = group.title.replace(/\s*\(\d+\)$/, "");
      const rule = rules.find((r) => r.name === baseName);
      if (rule) {
        managed.push({
          groupId: group.id,
          priority: rule.priority ?? 0,
          title: group.title,
        });
      } else if (settings.autoDomain && group.title) {
        // Auto-domain groups: treated as priority 0
        managed.push({ groupId: group.id, priority: 0, title: group.title });
      }
      // else: unmanaged group, skip
    }

    if (managed.length < 2) return; // nothing to reorder

    // Sort: higher priority first, then alphabetically by title
    managed.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.title.localeCompare(b.title);
    });

    // Move groups in order. Moving to index -1 appends to the end,
    // so we iterate in order and each group stacks after the previous.
    for (const item of managed) {
      try {
        await chrome.tabGroups.move(item.groupId, { index: -1 });
      } catch (err) {
        // Group may have been removed mid-reorder; skip and continue
        console.warn("[AutoTabGroups] reorderGroups move error:", err.message);
      }
    }
  } catch (err) {
    console.warn("[AutoTabGroups] reorderGroups error:", err.message);
  }
}

/**
 * Schedule a debounced reorder for a window.
 * Collapses rapid consecutive calls (e.g., many tabs opening at once).
 * @param {number} windowId
 * @param {Array} rules
 */
function scheduleReorder(windowId, rules) {
  clearTimeout(_reorderTimers[windowId]);
  _reorderTimers[windowId] = setTimeout(() => {
    delete _reorderTimers[windowId];
    reorderGroups(windowId, rules);
  }, REORDER_DEBOUNCE_MS);
}

// ─── Organize all tabs in all windows ─────────────────────────────────────────

async function organizeAllTabs() {
  const rules = await loadRules();
  const windows = await chrome.windows.getAll({ populate: true });

  for (const win of windows) {
    for (const tab of win.tabs) {
      if (tab.url && tab.status === "complete") {
        await organizeTab(tab.id, tab.url, tab.windowId, rules);
        await maybeEnhanceTitle(tab.id, tab.url);
      }
    }
    // Reorder groups immediately after organizing all tabs in this window
    await reorderGroups(win.id, rules);
    await updateGroupTitles(win.id, rules);
  }
}

// ─── Tab event listeners ───────────────────────────────────────────────────────

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only act when the tab finishes loading (has a final URL)
  if (changeInfo.status !== "complete") return;
  const rules = await loadRules();
  await organizeTab(tabId, tab.url, tab.windowId, rules);
  await maybeEnhanceTitle(tabId, tab.url);
});

// Clean up tracking when tab is closed
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  _enhancedTabs.delete(tabId);
  if (removeInfo.isWindowClosing) return;
  const rules = await loadRules();
  scheduleUpdateTitles(removeInfo.windowId, rules);
});

// Update group titles when a tab is detached from a group
chrome.tabs.onDetached.addListener(async (tabId, detachInfo) => {
  const rules = await loadRules();
  scheduleUpdateTitles(detachInfo.oldWindowId, rules);
});

// ─── Message handler (from popup) ─────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "organizeAll") {
    organizeAllTabs()
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true; // keep channel open for async response
  }

  if (message.action === "getStats") {
    getStats().then((stats) => sendResponse(stats));
    return true;
  }
});

// ─── Stats helper (for popup) ─────────────────────────────────────────────────

async function getStats() {
  const [tabs, rules] = await Promise.all([
    chrome.tabs.query({ currentWindow: true }),
    loadRules(),
  ]);

  let grouped = 0;
  let matched = 0;

  for (const tab of tabs) {
    if (tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) grouped++;
    if (tab.url && findMatchingRule(tab.url, rules)) matched++;
  }

  return { total: tabs.length, grouped, matched };
}
