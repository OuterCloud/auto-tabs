# Auto Tab Groups

Chrome MV3 extension. Auto-groups tabs by URL rules. Vanilla JS, no build step, no dependencies.

## File Map

| File | Role |
|---|---|
| `manifest.json` | MV3 manifest (permissions: tabs, tabGroups, storage) |
| `background.js` | Service Worker -- listens to tab events, applies grouping |
| `utils/rules.js` | Shared module -- rule matching, storage, domain helpers |
| `popup.html/js/css` | Toolbar popup -- stats + "organize all" button |
| `options.html/js/css` | Options page -- rule CRUD, drag-reorder, import/export |

## Key Concepts

- **Rule**: `{id, name, color, type, pattern, enabled, priority}`. Types: `prefix`, `contains`, `regex`.
- **First-match-wins**: rule list order = matching priority.
- **Group reuse**: finds existing group by name before creating a new one.
- **Group ordering**: tab groups are physically reordered in the strip by `priority` (higher = further left), then alphabetically by title. Debounced at 300ms.
- **Auto-domain fallback**: unmatched tabs grouped by root domain (toggle in settings).
- **Storage**: `chrome.storage.sync`.
- **Valid colors**: grey, blue, red, yellow, green, pink, purple, cyan, orange.

## Conventions

- No build tools or external dependencies.
- UI strings in Chinese; code and comments in English.
