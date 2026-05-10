// storage.js — chrome.storage.local abstraction
// Handles: highlights, reading stats, user settings

export const StorageManager = {

  // ─── Highlights ───────────────────────────────────────────────────────────

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

  // ─── Settings ────────────────────────────────────────────────────────────

  async getSettings() {
    const data = await chrome.storage.local.get('settings');
    return {
      theme: 'dark',
      fontSize: 18,
      lineHeight: 1.8,
      maxWidth: 720,
      fontFamily: 'Georgia',
      highlightColor: 'yellow',
      autoSidebar: false,
      ...data.settings,
    };
  },

  async saveSettings(settings) {
    const current = await this.getSettings();
    await chrome.storage.local.set({ settings: { ...current, ...settings } });
  },

  // ─── Session Tracking ─────────────────────────────────────────────────────

  async trackSession(data) {
    const stored = await chrome.storage.local.get('stats');
    const stats = stored.stats || { totalTime: 0, pagesRead: 0, highlightCount: 0, sessions: [] };
    stats.totalTime += data.duration || 0;
    stats.pagesRead += 1;
    stats.sessions.push({ url: data.url, duration: data.duration, date: Date.now() });
    if (stats.sessions.length > 100) stats.sessions = stats.sessions.slice(-100);
    await chrome.storage.local.set({ stats });
  },

  async getStats() {
    const data = await chrome.storage.local.get(['stats', 'highlights']);
    const stats = data.stats || { totalTime: 0, pagesRead: 0, sessions: [] };
    const highlightCount = Object.keys(data.highlights || {}).length;
    return { ...stats, highlightCount };
  },

  // ─── Export ───────────────────────────────────────────────────────────────

  async exportHighlights() {
    const highlights = await this.getHighlights();
    return JSON.stringify(highlights, null, 2);
  },
};
