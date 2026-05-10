// background.js — Service Worker (no imports, all inlined)
// Handles: context menus, keyboard commands, cross-tab messaging, storage ops

// ─── StorageManager (inlined from storage.js) ──────────────────────────────

const StorageManager = {
  async saveHighlight(highlight) {
    const id = `h_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const data = await chrome.storage.local.get('highlights');
    const highlights = data.highlights || {};
    highlights[id] = { ...highlight, id };
    await chrome.storage.local.set({ highlights });
    return { id };
  },

  async getHighlights(url = null) {
    const data = await chrome.storage.local.get('highlights');
    const all = Object.values(data.highlights || {});
    if (!url) return all;
    return all.filter(h => h.url === url);
  },

  async deleteHighlight(id) {
    const data = await chrome.storage.local.get('highlights');
    const highlights = data.highlights || {};
    delete highlights[id];
    await chrome.storage.local.set({ highlights });
  },

  async getStats() {
    const data = await chrome.storage.local.get(['stats', 'highlights']);
    const stats = data.stats || { totalTime: 0, pagesRead: 0, sessions: [] };
    const highlightCount = Object.keys(data.highlights || {}).length;
    return { ...stats, highlightCount };
  },

  async trackSession(sessionData) {
    const stored = await chrome.storage.local.get('stats');
    const stats = stored.stats || { totalTime: 0, pagesRead: 0, sessions: [] };
    stats.totalTime += sessionData.duration || 0;
    stats.pagesRead += 1;
    stats.sessions.push({ url: sessionData.url, duration: sessionData.duration, date: Date.now() });
    if (stats.sessions.length > 100) stats.sessions = stats.sessions.slice(-100);
    await chrome.storage.local.set({ stats });
  },
};

// ─── Context Menu Setup ────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'srm-explain',
    title: '🧠 Explain with Smart Reading Mode',
    contexts: ['selection'],
  });
  chrome.contextMenus.create({
    id: 'srm-save-highlight',
    title: '💾 Save this highlight',
    contexts: ['selection'],
  });
  chrome.contextMenus.create({
    id: 'srm-define',
    title: '📖 Define selected word',
    contexts: ['selection'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const text = info.selectionText?.trim();
  if (!text || !tab?.id) return;

  const actions = {
    'srm-explain':        { action: 'EXPLAIN_TEXT',  text },
    'srm-save-highlight': { action: 'SAVE_HIGHLIGHT', text, url: tab.url, title: tab.title },
    'srm-define':         { action: 'DEFINE_WORD',   text },
  };

  const payload = actions[info.menuItemId];
  if (payload) chrome.tabs.sendMessage(tab.id, payload);
});

// ─── Keyboard Commands ──────────────────────────────────────────────────────

chrome.commands.onCommand.addListener((command, tab) => {
  if (!tab?.id) return;
  const commandMap = {
    'toggle-reading-mode': { action: 'TOGGLE_READING_MODE' },
    'toggle-sidebar':      { action: 'TOGGLE_SIDEBAR' },
  };
  const payload = commandMap[command];
  if (payload) chrome.tabs.sendMessage(tab.id, payload);
});

// ─── Message Routing ────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {

    case 'SAVE_HIGHLIGHT':
      StorageManager.saveHighlight({
        text: message.text,
        url: message.url || sender.tab?.url,
        title: message.title || sender.tab?.title,
        color: message.color || 'yellow',
        note: message.note || '',
        savedAt: Date.now(),
      }).then(result => sendResponse({ success: true, id: result.id }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;

    case 'GET_HIGHLIGHTS':
      StorageManager.getHighlights(message.url)
        .then(highlights => sendResponse({ highlights }))
        .catch(() => sendResponse({ highlights: [] }));
      return true;

    case 'DELETE_HIGHLIGHT':
      StorageManager.deleteHighlight(message.id)
        .then(() => sendResponse({ success: true }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;

    case 'GET_STATS':
      StorageManager.getStats()
        .then(stats => sendResponse({ stats }))
        .catch(() => sendResponse({ stats: {} }));
      return true;

    case 'TRACK_SESSION':
      StorageManager.trackSession(message.data)
        .then(() => sendResponse({ success: true }))
        .catch(() => sendResponse({ success: false }));
      return true;
  }
});
