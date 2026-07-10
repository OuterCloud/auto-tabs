const btnOrganize = document.getElementById('btn-organize');
const statusMsg   = document.getElementById('status-msg');
const statTotal   = document.getElementById('stat-total');
const statMatched = document.getElementById('stat-matched');
const statGrouped = document.getElementById('stat-grouped');
const linkOptions = document.getElementById('link-options');
const renameInput = document.getElementById('rename-input');
const btnRename   = document.getElementById('btn-rename');
const renameHint  = document.getElementById('rename-hint');

// Load stats on open
chrome.runtime.sendMessage({ action: 'getStats' }, (stats) => {
  if (!stats) return;
  statTotal.textContent   = stats.total;
  statMatched.textContent = stats.matched;
  statGrouped.textContent = stats.grouped;
});

// Pre-fill rename input with current tab title (or existing custom name)
chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
  const tab = tabs[0];
  if (!tab) return;
  const key = `tabName_${tab.id}`;
  const data = await chrome.storage.session.get(key);
  renameInput.value = data[key] || tab.title || '';
  renameInput.select();
});

// Rename current tab
btnRename.addEventListener('click', doRename);
renameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doRename();
});

async function doRename() {
  const newName = renameInput.value.trim();
  if (!newName) return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  const key = `tabName_${tab.id}`;
  await chrome.storage.session.set({ [key]: newName });

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (name) => {
        document.title = name;
        const titleEl = document.querySelector('title');
        if (titleEl) {
          new MutationObserver(() => {
            if (document.title !== name) document.title = name;
          }).observe(titleEl, { childList: true, characterData: true, subtree: true });
        }
      },
      args: [newName],
    });
    renameHint.className = 'rename-hint';
    renameHint.textContent = '已重命名';
    setTimeout(() => { renameHint.textContent = ''; }, 2000);
  } catch (err) {
    renameHint.className = 'rename-hint error';
    renameHint.textContent = '重命名失败';
  }
}

// Organize all
btnOrganize.addEventListener('click', () => {
  btnOrganize.disabled = true;
  statusMsg.className = 'status-msg';
  statusMsg.textContent = '整理中…';

  chrome.runtime.sendMessage({ action: 'organizeAll' }, (res) => {
    btnOrganize.disabled = false;
    if (res?.ok) {
      statusMsg.textContent = '整理完成！';
      // Refresh stats
      chrome.runtime.sendMessage({ action: 'getStats' }, (stats) => {
        if (!stats) return;
        statTotal.textContent   = stats.total;
        statMatched.textContent = stats.matched;
        statGrouped.textContent = stats.grouped;
      });
    } else {
      statusMsg.className = 'status-msg error';
      statusMsg.textContent = '出错了，请重试';
    }
  });
});

// Open options page
linkOptions.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});
