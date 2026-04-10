// Chrome tab group supported colors
const COLORS = [
  "grey",
  "blue",
  "red",
  "yellow",
  "green",
  "pink",
  "purple",
  "cyan",
  "orange",
];

function getDefaultRules() {
  return [
    {
      id: crypto.randomUUID(),
      name: "GitHub",
      color: "purple",
      type: "prefix",
      pattern: "https://github.com/",
      enabled: true,
      priority: 0,
    },
    {
      id: crypto.randomUUID(),
      name: "Google Docs",
      color: "blue",
      type: "prefix",
      pattern: "https://docs.google.com/",
      enabled: true,
      priority: 0,
    },
    {
      id: crypto.randomUUID(),
      name: "Stack Overflow",
      color: "orange",
      type: "prefix",
      pattern: "https://stackoverflow.com/",
      enabled: true,
      priority: 0,
    },
    {
      id: crypto.randomUUID(),
      name: "Localhost",
      color: "red",
      type: "regex",
      pattern: "^https?://localhost(:\\d+)?/",
      enabled: true,
      priority: 0,
    },
  ];
}

/**
 * Load default rules from rules.local.json if it exists,
 * otherwise fall back to built-in generic examples.
 * Each rule gets a fresh UUID assigned.
 * @returns {Promise<Array>}
 */
async function getLocalOrDefaultRules() {
  try {
    const url = chrome.runtime.getURL("rules.local.json");
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.status);
    const list = await res.json();
    if (Array.isArray(list) && list.length > 0) {
      return list.map((r) => ({
        id: crypto.randomUUID(),
        name: String(r.name ?? ""),
        color: r.color ?? "blue",
        type: r.type ?? "prefix",
        pattern: String(r.pattern ?? ""),
        enabled: r.enabled !== false,
        priority: r.priority ?? 0,
      }));
    }
  } catch {
    // rules.local.json not found or invalid — use built-in defaults
  }
  return getDefaultRules();
}

/**
 * Test a single URL against a single rule.
 * @param {string} url
 * @param {{ type: string, pattern: string, enabled: boolean }} rule
 * @returns {boolean}
 */
function matchRule(url, rule) {
  if (!rule.enabled || !url) return false;
  try {
    switch (rule.type) {
      case "prefix":
        return url.startsWith(rule.pattern);
      case "contains":
        return url.includes(rule.pattern);
      case "regex":
        return new RegExp(rule.pattern).test(url);
      default:
        return false;
    }
  } catch {
    return false;
  }
}

/**
 * Return the first matching rule for a URL (first-match-wins).
 * @param {string} url
 * @param {Array} rules
 * @returns {object|null}
 */
function findMatchingRule(url, rules) {
  return rules.find((rule) => matchRule(url, rule)) ?? null;
}

/**
 * Load rules from storage. Falls back to local file or built-in defaults on first run.
 * @returns {Promise<Array>}
 */
async function loadRules() {
  const { rules } = await chrome.storage.sync.get("rules");
  if (!rules) {
    const defaults = await getLocalOrDefaultRules();
    await chrome.storage.sync.set({ rules: defaults });
    return defaults;
  }
  return rules;
}

/**
 * Persist rules to storage.
 * @param {Array} rules
 */
async function saveRules(rules) {
  await chrome.storage.sync.set({ rules });
}

/**
 * Extract root domain (last two labels) from a URL.
 * e.g. docs.google.com → google.com, 192.168.1.1 → 192.168.1.1
 * @param {string} url
 * @returns {string|null}
 */
function extractRootDomain(url) {
  try {
    const hostname = new URL(url).hostname;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return hostname;
    const parts = hostname.split(".");
    return parts.length > 2 ? parts.slice(-2).join(".") : hostname;
  } catch {
    return null;
  }
}

/**
 * Deterministically map a domain string to a tab group color.
 * @param {string} domain
 * @returns {string}
 */
function domainToColor(domain) {
  let hash = 0;
  for (let i = 0; i < domain.length; i++) {
    hash = (hash * 31 + domain.charCodeAt(i)) >>> 0;
  }
  return COLORS[hash % COLORS.length];
}

/**
 * Load global settings from storage.
 * @returns {Promise<{autoDomain: boolean, showTabCount: boolean, enhanceTitle: boolean}>}
 */
async function loadSettings() {
  const { settings } = await chrome.storage.sync.get("settings");
  return {
    autoDomain: true,
    showTabCount: true,
    enhanceTitle: true,
    ...settings,
  };
}

/**
 * Persist global settings to storage.
 * @param {{autoDomain: boolean}} settings
 */
async function saveSettings(settings) {
  await chrome.storage.sync.set({ settings });
}
