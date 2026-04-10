// options.js — Rules management page
// utils/rules.js is loaded as a <script> tag before this file

const COLOR_HEX = {
  grey: "#9e9e9e",
  blue: "#1a73e8",
  red: "#d93025",
  yellow: "#f9ab00",
  green: "#1e8e3e",
  pink: "#e52592",
  purple: "#9334e6",
  cyan: "#129eaf",
  orange: "#fa7b17",
};

const TYPE_LABEL = { prefix: "URL 前缀", contains: "URL 包含", regex: "正则" };

let rules = [];
let settings = {};
let editingId = null; // null = adding new, string = editing existing
let dragSrcIndex = null;

// ─── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  [rules, settings] = await Promise.all([loadRules(), loadSettings()]);
  document.getElementById("toggle-auto-domain").checked = settings.autoDomain;
  document.getElementById("toggle-show-tab-count").checked =
    settings.showTabCount;
  document.getElementById("toggle-enhance-title").checked =
    settings.enhanceTitle;
  renderTable();
  bindEvents();
});

// ─── Render ────────────────────────────────────────────────────────────────────
function renderTable() {
  const tbody = document.getElementById("rules-tbody");
  const empty = document.getElementById("empty-state");
  const count = document.getElementById("rules-count");

  count.textContent = `${rules.length} 条规则`;

  if (rules.length === 0) {
    tbody.innerHTML = "";
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  tbody.innerHTML = rules
    .map(
      (rule, index) => `
    <tr draggable="true" data-index="${index}" data-id="${rule.id}">
      <td><span class="drag-handle" title="拖拽排序">⠿</span></td>
      <td><span class="color-dot" style="background:${
        COLOR_HEX[rule.color] ?? "#9e9e9e"
      }"></span></td>
      <td class="cell-priority">${rule.priority ?? 0}</td>
      <td>${escHtml(rule.name)}</td>
      <td><span class="type-badge">${
        TYPE_LABEL[rule.type] ?? rule.type
      }</span></td>
      <td class="cell-pattern">${escHtml(rule.pattern)}</td>
      <td>
        <label class="toggle">
          <input type="checkbox" ${rule.enabled ? "checked" : ""} data-id="${
        rule.id
      }">
          <span class="toggle-slider"></span>
        </label>
      </td>
      <td>
        <div class="action-btns">
          <button class="btn-icon" title="编辑" data-action="edit" data-id="${
            rule.id
          }">✏️</button>
          <button class="btn-icon danger" title="删除" data-action="delete" data-id="${
            rule.id
          }">🗑</button>
        </div>
      </td>
    </tr>
  `,
    )
    .join("");

  // Drag-and-drop events
  tbody.querySelectorAll("tr[draggable]").forEach((row) => {
    row.addEventListener("dragstart", onDragStart);
    row.addEventListener("dragover", onDragOver);
    row.addEventListener("drop", onDrop);
    row.addEventListener("dragend", onDragEnd);
  });

  // Toggle enabled
  tbody.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener("change", async (e) => {
      const id = e.target.dataset.id;
      const rule = rules.find((r) => r.id === id);
      if (rule) {
        rule.enabled = e.target.checked;
        await saveRules(rules);
        showToast("已保存");
      }
    });
  });

  // Edit / Delete buttons
  tbody.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const { action, id } = e.currentTarget.dataset;
      if (action === "edit") openEditForm(id);
      if (action === "delete") deleteRule(id);
    });
  });
}

// ─── Form ──────────────────────────────────────────────────────────────────────
function openAddForm() {
  editingId = null;
  document.getElementById("form-title").textContent = "添加规则";
  document.getElementById("f-name").value = "";
  document.getElementById("f-priority").value = "0";
  document.getElementById("f-pattern").value = "";
  document.getElementById("f-type").value = "prefix";
  setFormColor("blue");
  showForm();
}

function openEditForm(id) {
  const rule = rules.find((r) => r.id === id);
  if (!rule) return;
  editingId = id;
  document.getElementById("form-title").textContent = "编辑规则";
  document.getElementById("f-name").value = rule.name;
  document.getElementById("f-priority").value = String(rule.priority ?? 0);
  document.getElementById("f-pattern").value = rule.pattern;
  document.getElementById("f-type").value = rule.type;
  setFormColor(rule.color);
  showForm();
}

function showForm() {
  const form = document.getElementById("rule-form");
  form.style.display = "block";
  document.getElementById("f-name").focus();
}

function hideForm() {
  document.getElementById("rule-form").style.display = "none";
  editingId = null;
}

function setFormColor(color) {
  document.getElementById("f-color").value = color;
  document.querySelectorAll(".color-btn").forEach((btn) => {
    btn.classList.toggle("selected", btn.dataset.color === color);
  });
}

async function saveForm() {
  const name = document.getElementById("f-name").value.trim();
  const rawPri = parseInt(document.getElementById("f-priority").value, 10);
  const priority = Number.isNaN(rawPri)
    ? 0
    : Math.max(-100, Math.min(100, rawPri));
  const pattern = document.getElementById("f-pattern").value.trim();
  const type = document.getElementById("f-type").value;
  const color = document.getElementById("f-color").value;

  if (!name) {
    alert("请输入规则名称");
    return;
  }
  if (!pattern) {
    alert("请输入匹配模式");
    return;
  }

  if (type === "regex") {
    try {
      new RegExp(pattern);
    } catch {
      alert("正则表达式格式错误");
      return;
    }
  }

  if (editingId) {
    const rule = rules.find((r) => r.id === editingId);
    if (rule) Object.assign(rule, { name, priority, pattern, type, color });
  } else {
    rules.push({
      id: crypto.randomUUID(),
      name,
      priority,
      pattern,
      type,
      color,
      enabled: true,
    });
  }

  await saveRules(rules);
  renderTable();
  hideForm();
  showToast(editingId ? "规则已更新" : "规则已添加");
}

// ─── Delete ────────────────────────────────────────────────────────────────────
async function deleteRule(id) {
  if (!confirm("确认删除该规则？")) return;
  rules = rules.filter((r) => r.id !== id);
  await saveRules(rules);
  renderTable();
  showToast("规则已删除");
}

// ─── Drag and drop ─────────────────────────────────────────────────────────────
function onDragStart(e) {
  dragSrcIndex = parseInt(this.dataset.index);
  this.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
}

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  document
    .querySelectorAll("#rules-tbody tr")
    .forEach((r) => r.classList.remove("drag-over"));
  this.classList.add("drag-over");
}

function onDrop(e) {
  e.preventDefault();
  const destIndex = parseInt(this.dataset.index);
  if (dragSrcIndex === destIndex) return;

  const [moved] = rules.splice(dragSrcIndex, 1);
  rules.splice(destIndex, 0, moved);

  saveRules(rules);
  renderTable();
  showToast("顺序已更新");
}

function onDragEnd() {
  document.querySelectorAll("#rules-tbody tr").forEach((r) => {
    r.classList.remove("dragging", "drag-over");
  });
}

// ─── Import / Export ───────────────────────────────────────────────────────────
function exportRules() {
  const json = JSON.stringify(rules, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "auto-tab-groups-rules.json";
  a.click();
  URL.revokeObjectURL(url);
}

function importRules(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      if (!Array.isArray(imported)) throw new Error("格式错误");
      // Ensure each rule has an id
      const normalized = imported.map((r) => ({
        id: r.id ?? crypto.randomUUID(),
        name: String(r.name ?? ""),
        color: r.color ?? "blue",
        type: r.type ?? "prefix",
        pattern: String(r.pattern ?? ""),
        enabled: r.enabled !== false,
        priority: Math.max(-100, Math.min(100, parseInt(r.priority, 10) || 0)),
      }));
      rules = normalized;
      await saveRules(rules);
      renderTable();
      showToast(`已导入 ${rules.length} 条规则`);
    } catch {
      alert("导入失败：JSON 格式错误");
    }
  };
  reader.readAsText(file);
}

// ─── Toast ─────────────────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2000);
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Event bindings ────────────────────────────────────────────────────────────
function bindEvents() {
  document.getElementById("btn-add").addEventListener("click", openAddForm);
  document.getElementById("btn-cancel").addEventListener("click", hideForm);
  document.getElementById("btn-save").addEventListener("click", saveForm);

  document.getElementById("btn-export").addEventListener("click", exportRules);

  document.getElementById("btn-import").addEventListener("click", () => {
    document.getElementById("file-input").click();
  });

  document.getElementById("file-input").addEventListener("change", (e) => {
    if (e.target.files[0]) importRules(e.target.files[0]);
    e.target.value = "";
  });

  // Color picker
  document.querySelectorAll(".color-btn").forEach((btn) => {
    btn.addEventListener("click", () => setFormColor(btn.dataset.color));
  });

  // Auto-domain toggle
  document
    .getElementById("toggle-auto-domain")
    .addEventListener("change", async (e) => {
      settings.autoDomain = e.target.checked;
      await saveSettings(settings);
      showToast(e.target.checked ? "自动域名分组已开启" : "自动域名分组已关闭");
    });

  // Show tab count toggle
  document
    .getElementById("toggle-show-tab-count")
    .addEventListener("change", async (e) => {
      settings.showTabCount = e.target.checked;
      await saveSettings(settings);
      showToast(e.target.checked ? "显示标签数量已开启" : "显示标签数量已关闭");
    });

  // Enhance title toggle
  document
    .getElementById("toggle-enhance-title")
    .addEventListener("change", async (e) => {
      settings.enhanceTitle = e.target.checked;
      await saveSettings(settings);
      showToast(
        e.target.checked
          ? "标签标题增强已开启，新加载的页面将生效"
          : "标签标题增强已关闭",
      );
    });
}
