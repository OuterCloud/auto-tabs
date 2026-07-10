# Auto Tab Groups

English | [中文](./README.md)

A Chrome extension (Manifest V3) that automatically groups tabs based on custom URL rules.

## Features

- **Auto Grouping**: Automatically matches rules and groups tabs when they finish loading
- **One-click Organize**: Click the extension icon to organize all open tabs at once
- **Three Matching Modes**: URL prefix, URL contains, and regular expression
- **Rule Priority**: List order determines priority; first match wins
- **Group Reuse**: Adds tabs to existing groups with the same name instead of creating duplicates
- **Drag to Reorder**: Drag rows in the settings page to adjust rule priority
- **Enable/Disable**: Temporarily disable a rule without deleting it
- **Import/Export**: Backup and restore rules as JSON files
- **Group Sorting**: Tab groups are arranged by rule priority (higher = further left), same priority sorted alphabetically, with 300ms debounce
- **Auto Domain Grouping**: Tabs not matching any rule are grouped by root domain with a hash-based color; can be toggled off
- **Tab Count Display**: Shows tab count in group titles when a group has multiple tabs, e.g. "GitHub (3)"
- **Title Enhancement**: Appends URL path info to tab titles to distinguish same-site pages
- **MRU Group Sorting**: Tab groups are sorted by most recently used — the group you just visited stays at the top, followed by previously used groups in recency order, so you never have to search blindly
- **Tab Renaming**: Set custom names for tabs via right-click context menu or extension popup, useful for distinguishing identical-title tabs (e.g. multiple terminal sessions)

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" and select this project directory
4. The extension icon appears in the toolbar — done!

> 💡 **Recommended: Enable vertical tabs** — Go to `chrome://flags/#sidebar-tabs` (or Chrome Settings → Appearance → Tab bar) to enable the vertical tab bar. Group names and tab titles display fully in vertical mode. Horizontal tabs work too, but group names may be truncated with many tabs.

## Usage

### Popup

Click the extension icon to open the popup:

- View tab statistics for the current window (total / matched / grouped)
- Click "Organize Tabs" to apply rules to all open tabs immediately
- Click "Manage Rules" to jump to the settings page

### Settings Page

Right-click the extension icon → "Options", or click "Manage Rules" in the popup.

| Action              | Description                                                                         |
| ------------------- | ----------------------------------------------------------------------------------- |
| Add Rule            | Specify name, match type, pattern, and color                                        |
| Edit Rule           | Click the ✏️ button to modify an existing rule                                     |
| Delete Rule         | Click the 🗑 button, confirm to delete                                              |
| Adjust Priority     | Drag the ⠿ handle on the left to reorder                                           |
| Set Group Priority  | Set a priority value (-100~100) when adding/editing to control group position       |
| Enable/Disable      | Toggle the switch to temporarily disable a rule                                     |
| Export              | Save current rules as a JSON file                                                   |
| Import              | Restore rules from a JSON file (overwrites current rules)                           |
| Auto Domain Group   | Toggle at the top of the page to control auto-grouping by domain                    |
| Show Tab Count      | Display tab count in group titles                                                   |
| Title Enhancement   | Append URL path to tab titles for same-site differentiation                         |
| MRU Group Sorting   | Sort groups by most recently used, latest at top                                    |
| Rename Tab          | Set a custom name for the current tab via popup or right-click menu                 |

### Rule Matching Types

| Type       | Description                  | Example                              |
| ---------- | ---------------------------- | ------------------------------------ |
| URL Prefix | URL starts with the string   | `https://github.com/`                |
| URL Contains | URL includes the string    | `jira`                               |
| Regex      | URL matches the regex        | `^https?://\d+\.\d+\.\d+\.\d+:\d+` |

## Default Rules

The following rules are loaded on first install (editable in settings):

| Name           | Color  | Type   | Pattern                       | Priority |
| -------------- | ------ | ------ | ----------------------------- | -------- |
| GitHub         | Purple | Prefix | `https://github.com/`         | 0        |
| Google Docs    | Blue   | Prefix | `https://docs.google.com/`    | 0        |
| Stack Overflow | Orange | Prefix | `https://stackoverflow.com/`  | 0        |
| Localhost      | Red    | Regex  | `^https?://localhost(:\d+)?/` | 0        |

### Custom Preset Rules

To replace the built-in defaults (e.g., add internal company sites), create `rules.local.json` in the project root:

```json
[
  {
    "name": "Internal GitLab",
    "color": "orange",
    "type": "prefix",
    "pattern": "https://git.example.com/",
    "enabled": true,
    "priority": 0
  },
  {
    "name": "Jira",
    "color": "blue",
    "type": "prefix",
    "pattern": "https://jira.example.com/",
    "enabled": true,
    "priority": 0
  }
]
```

This file is in `.gitignore` and won't be committed. The extension reads it on first load as default rules; if not found, built-in examples are used.

## File Structure

```
auto-tabs/
├── manifest.json        # MV3 extension manifest
├── background.js        # Service Worker, listens to tab events
├── content.js           # Title enhancement (injected into pages)
├── utils/
│   └── rules.js         # Rule load/save/match logic (shared module)
├── popup.html/js/css    # Popup window
├── options.html/js/css  # Rule management settings page
├── icons/               # 16/48/128px extension icons
└── rules.local.json     # Optional: custom preset rules (not committed)
```

## Permissions

| Permission  | Purpose                                          |
| ----------- | ------------------------------------------------ |
| `tabs`      | Read tab URLs, listen to load events             |
| `tabGroups` | Create, query, and update tab groups             |
| `storage`   | Persist rules via `chrome.storage.sync`          |
| `scripting`     | Dynamically inject content script for title enhancement |
| `contextMenus`  | Right-click "Rename Tab" context menu item              |
