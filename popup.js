const btnOrganize = document.getElementById('btn-organize');
const statusMsg   = document.getElementById('status-msg');
const statTotal   = document.getElementById('stat-total');
const statMatched = document.getElementById('stat-matched');
const statGrouped = document.getElementById('stat-grouped');
const linkOptions = document.getElementById('link-options');

// Load stats on open
chrome.runtime.sendMessage({ action: 'getStats' }, (stats) => {
  if (!stats) return;
  statTotal.textContent   = stats.total;
  statMatched.textContent = stats.matched;
  statGrouped.textContent = stats.grouped;
});

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
