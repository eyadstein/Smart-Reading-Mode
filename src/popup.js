// popup.js — no modules, plain script

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function injectIfNeeded(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['src/content.js']
    });
  } catch {
    // already injected or restricted page — that's fine
  }
}

async function sendMsg(action) {
  const tab = await getActiveTab();
  if (!tab?.id) return;
  await injectIfNeeded(tab.id);
  try {
    await chrome.tabs.sendMessage(tab.id, { action });
  } catch {
    // retry after inject
    setTimeout(async () => {
      try { await chrome.tabs.sendMessage(tab.id, { action }); } catch {}
    }, 300);
  }
}

function showStatus(msg, type) {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.style.color = type === 'error' ? '#f87171' : '#4ade80';
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 2500);
}

async function loadStats() {
  try {
    const data = await chrome.storage.local.get(['stats', 'highlights']);
    const stats = data.stats || {};
    const hCount = Object.keys(data.highlights || {}).length;
    document.getElementById('stat-h').textContent = hCount;
    document.getElementById('stat-p').textContent = stats.pagesRead || 0;
    document.getElementById('stat-t').textContent = stats.totalTime
      ? (stats.totalTime / 3600).toFixed(1) : '0';
  } catch {}
}

async function loadKey() {
  try {
    const data = await chrome.storage.local.get('settings');
    const key = data.settings?.apiKey || '';
    if (key) {
      document.getElementById('key-input').value = key;
    }
  } catch {}
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadStats();
  await loadKey();

  document.getElementById('btn-rm').onclick = async () => {
    await sendMsg('TOGGLE_READING_MODE');
    window.close();
  };

  document.getElementById('btn-sidebar').onclick = async () => {
    await sendMsg('TOGGLE_SIDEBAR');
    window.close();
  };

  document.getElementById('btn-summarize').onclick = async () => {
    await sendMsg('TOGGLE_SIDEBAR');
    setTimeout(async () => {
      const tab = await getActiveTab();
      if (tab?.id) {
        try { await chrome.tabs.sendMessage(tab.id, { action: 'DO_SUMMARIZE' }); } catch {}
      }
    }, 500);
    window.close();
  };

  document.getElementById('btn-export').onclick = async () => {
    const tab = await getActiveTab();
    if (!tab?.id) return;
    await injectIfNeeded(tab.id);
    try { await chrome.tabs.sendMessage(tab.id, { action: 'EXPORT' }); } catch {}
    window.close();
  };

  document.getElementById('save-key').onclick = async () => {
    const key = document.getElementById('key-input').value.trim();
    if (!key) { showStatus('Enter a key first', 'error'); return; }
    const data = await chrome.storage.local.get('settings');
    const settings = data.settings || {};
    settings.apiKey = key;
    await chrome.storage.local.set({ settings });
    showStatus('Key saved ✓', 'ok');
  };
});
