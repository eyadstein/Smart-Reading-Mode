// content.js — Smart Reading Mode (fully self-contained, no imports)

// ─── Guard against double injection ────────────────────────────────────────
if (window.__srmLoaded) {
  throw new Error('SRM already loaded');
}
window.__srmLoaded = true;

// ─── Groq API ──────────────────────────────────────────────────────────────
const GROQ_URL   = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

async function getApiKey() {
  try {
    const data = await chrome.storage.local.get('settings');
    return data.settings?.apiKey || '';
  } catch {
    return '';
  }
}

async function callGroq(system, user, maxTokens = 400) {
  const apiKey = await getApiKey();
  if (!apiKey) throw new Error('No API key — click the extension icon and paste your Groq key (free at console.groq.com)');

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      max_tokens: maxTokens,
      temperature: 0.4,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Groq error ${res.status}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

// ─── State ─────────────────────────────────────────────────────────────────
const SRM = {
  sidebarOpen: false,
  readingMode: false,
  pageText: '',
  sessionStart: Date.now(),
};

// ─── Get page text ─────────────────────────────────────────────────────────
function getPageText() {
  const el = document.querySelector('article, main, [role="main"]') || document.body;
  return (el.innerText || '').slice(0, 4000);
}

// ─── Inject CSS ────────────────────────────────────────────────────────────
function injectStyles() {
  if (document.getElementById('srm-styles')) return;
  const style = document.createElement('style');
  style.id = 'srm-styles';
  style.textContent = `
    #srm-tooltip {
      position: fixed;
      z-index: 2147483647;
      display: none;
      background: #0f0f0f;
      border: 1px solid #2a2a2a;
      border-radius: 8px;
      padding: 4px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.6);
      gap: 2px;
      pointer-events: all;
    }
    .srm-tip-btn {
      background: transparent;
      border: none;
      color: #e0e0e0;
      font-size: 12px;
      font-family: 'JetBrains Mono', monospace;
      padding: 6px 10px;
      border-radius: 5px;
      cursor: pointer;
      white-space: nowrap;
    }
    .srm-tip-btn:hover { background: #1e1e1e; color: #fff; }

    #srm-sidebar {
      position: fixed;
      top: 0;
      right: -380px;
      width: 360px;
      height: 100vh;
      z-index: 2147483646;
      background: #0a0a0a;
      border-left: 1px solid #1e1e1e;
      display: flex;
      flex-direction: column;
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      color: #d4d4d4;
      transition: right 0.3s ease;
      box-shadow: -4px 0 32px rgba(0,0,0,0.5);
    }
    #srm-sidebar.open { right: 0; }

    .srm-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px;
      border-bottom: 1px solid #1e1e1e;
      background: #080808;
      flex-shrink: 0;
    }
    .srm-logo { font-size: 13px; font-weight: 700; color: #fff; }
    .srm-hbtn {
      background: transparent; border: none; color: #666;
      font-size: 14px; cursor: pointer; padding: 4px 8px;
      border-radius: 4px; font-family: inherit;
    }
    .srm-hbtn:hover { background: #1e1e1e; color: #fff; }

    .srm-tabs { display: flex; border-bottom: 1px solid #1e1e1e; flex-shrink: 0; }
    .srm-tab {
      flex: 1; background: transparent; border: none;
      border-bottom: 2px solid transparent;
      color: #555; font-family: inherit; font-size: 12px;
      padding: 10px 0; cursor: pointer; transition: all 0.15s;
    }
    .srm-tab:hover { color: #aaa; }
    .srm-tab.active { color: #fff; border-bottom-color: #3b82f6; }

    .srm-panel { display: none; flex-direction: column; flex: 1; overflow: hidden; }
    .srm-panel.active { display: flex; }

    .srm-result {
      flex: 1; overflow-y: auto; padding: 16px; line-height: 1.7;
    }
    .srm-result::-webkit-scrollbar { width: 3px; }
    .srm-result::-webkit-scrollbar-thumb { background: #2a2a2a; }

    .srm-hint { color: #3a3a3a; font-size: 12px; line-height: 1.7; }
    .srm-hint p { margin: 0 0 8px; }

    .srm-label {
      font-size: 11px; color: #444; margin-bottom: 10px;
      padding-bottom: 10px; border-bottom: 1px solid #1a1a1a;
      font-style: italic;
    }
    .srm-answer { color: #d4d4d4; font-size: 13px; line-height: 1.7; }

    .srm-loading { display: flex; align-items: center; gap: 10px; color: #444; font-size: 12px; }
    .srm-spinner {
      width: 14px; height: 14px; border: 2px solid #222;
      border-top-color: #3b82f6; border-radius: 50%;
      animation: srm-spin 0.7s linear infinite; flex-shrink: 0;
    }
    @keyframes srm-spin { to { transform: rotate(360deg); } }
    .srm-error { color: #f87171; font-size: 12px; padding: 8px; background: rgba(248,113,113,0.08); border-radius: 6px; line-height: 1.5; }

    .srm-qrow {
      display: flex; gap: 6px; padding: 12px 16px;
      border-top: 1px solid #1a1a1a; background: #080808; flex-shrink: 0;
    }
    #srm-q {
      flex: 1; background: #111; border: 1px solid #222; border-radius: 6px;
      color: #d4d4d4; font-family: inherit; font-size: 12px;
      padding: 8px 10px; outline: none;
    }
    #srm-q:focus { border-color: #3b82f6; }
    #srm-q::placeholder { color: #333; }
    #srm-ask {
      background: #3b82f6; border: none; border-radius: 6px;
      color: #fff; font-family: inherit; font-size: 11px;
      font-weight: 600; padding: 8px 12px; cursor: pointer;
    }
    #srm-ask:hover { background: #2563eb; }

    #srm-sum-btn {
      margin: 12px; padding: 10px; background: #111;
      border: 1px solid #2a2a2a; border-radius: 8px;
      color: #d4d4d4; font-family: inherit; font-size: 12px;
      cursor: pointer; flex-shrink: 0;
    }
    #srm-sum-btn:hover { border-color: #3b82f6; color: #fff; }

    .srm-toast {
      position: fixed; bottom: 24px; left: 50%;
      transform: translateX(-50%) translateY(10px);
      background: #1a1a1a; border: 1px solid #2a2a2a;
      color: #d4d4d4; font-family: 'JetBrains Mono', monospace;
      font-size: 12px; padding: 8px 16px; border-radius: 8px;
      z-index: 2147483647; opacity: 0; transition: all 0.2s; pointer-events: none;
    }
    .srm-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }

    body.srm-reading * { visibility: hidden !important; }
    body.srm-reading article *, body.srm-reading main *,
    body.srm-reading #srm-sidebar *, body.srm-reading #srm-sidebar,
    body.srm-reading #srm-tooltip *, body.srm-reading #srm-tooltip { visibility: visible !important; }
    body.srm-reading { background: #0f0f0f !important; }
    body.srm-reading article, body.srm-reading main {
      max-width: 720px !important; margin: 60px auto !important;
      padding: 0 24px !important; font-size: 18px !important;
      line-height: 1.8 !important; color: #e0e0e0 !important;
    }
  `;
  document.head.appendChild(style);
}

// ─── Tooltip ───────────────────────────────────────────────────────────────
let tooltip;

function createTooltip() {
  tooltip = document.createElement('div');
  tooltip.id = 'srm-tooltip';
  tooltip.innerHTML = `
    <button class="srm-tip-btn" data-a="explain">🧠 Explain</button>
    <button class="srm-tip-btn" data-a="define">📖 Define</button>
    <button class="srm-tip-btn" data-a="simplify">✂️ Simplify</button>
    <button class="srm-tip-btn" data-a="save">💾 Save</button>
  `;
  document.body.appendChild(tooltip);

  tooltip.addEventListener('mousedown', e => e.preventDefault());
  tooltip.addEventListener('click', async e => {
    const btn = e.target.closest('[data-a]');
    if (!btn) return;
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (!text) return;
    tooltip.style.display = 'none';
    const action = btn.dataset.a;
    if (action === 'save') { saveHighlight(text); return; }
    openSidebar();
    await runAI(action, text);
  });
}

function showTooltip(x, y) {
  tooltip.style.display = 'flex';
  tooltip.style.left = x + 'px';
  tooltip.style.top  = y + 'px';
}

function hideTooltip() {
  if (tooltip) tooltip.style.display = 'none';
}

document.addEventListener('mouseup', e => {
  if (e.target.closest('#srm-tooltip') || e.target.closest('#srm-sidebar')) return;
  setTimeout(() => {
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (!text || text.length < 3) { hideTooltip(); return; }
    const range = sel.getRangeAt(0);
    const rect  = range.getBoundingClientRect();
    const x = rect.left + rect.width / 2 - 140;
    const y = rect.top - 50;
    showTooltip(Math.max(4, x), Math.max(4, y));
  }, 10);
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { hideTooltip(); closeSidebar(); }
});

// ─── Sidebar ───────────────────────────────────────────────────────────────
let sidebar, resultEl, summaryEl;

function createSidebar() {
  sidebar = document.createElement('div');
  sidebar.id = 'srm-sidebar';
  sidebar.innerHTML = `
    <div class="srm-header">
      <span class="srm-logo">⚡ Smart Reader</span>
      <div style="display:flex;gap:4px">
        <button class="srm-hbtn" id="srm-rm-btn" title="Reading Mode">📖</button>
        <button class="srm-hbtn" id="srm-close" title="Close">✕</button>
      </div>
    </div>
    <div class="srm-tabs">
      <button class="srm-tab active" data-tab="ai">AI</button>
      <button class="srm-tab" data-tab="summary">Summary</button>
    </div>
    <div class="srm-panel active" id="srm-panel-ai">
      <div class="srm-result" id="srm-result">
        <div class="srm-hint">
          <p>Highlight any text and click <strong>Explain</strong>, <strong>Define</strong>, or <strong>Simplify</strong>.</p>
          <p>Or type a question below.</p>
        </div>
      </div>
      <div class="srm-qrow">
        <input id="srm-q" placeholder="Ask anything about this page..." />
        <button id="srm-ask">Ask</button>
      </div>
    </div>
    <div class="srm-panel" id="srm-panel-summary">
      <div class="srm-result" id="srm-sum-result">
        <div class="srm-hint"><p>Click the button below to summarize this page.</p></div>
      </div>
      <button id="srm-sum-btn">🤖 Generate Summary</button>
    </div>
  `;
  document.body.appendChild(sidebar);

  resultEl  = sidebar.querySelector('#srm-result');
  summaryEl = sidebar.querySelector('#srm-sum-result');

  sidebar.querySelector('#srm-close').onclick = closeSidebar;
  sidebar.querySelector('#srm-rm-btn').onclick = toggleReadingMode;

  sidebar.querySelectorAll('.srm-tab').forEach(tab => {
    tab.onclick = () => {
      sidebar.querySelectorAll('.srm-tab').forEach(t => t.classList.remove('active'));
      sidebar.querySelectorAll('.srm-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      sidebar.querySelector(`#srm-panel-${tab.dataset.tab}`).classList.add('active');
    };
  });

  const qInput = sidebar.querySelector('#srm-q');
  sidebar.querySelector('#srm-ask').onclick = () => askQuestion(qInput.value.trim());
  qInput.addEventListener('keydown', e => { if (e.key === 'Enter') askQuestion(qInput.value.trim()); });

  sidebar.querySelector('#srm-sum-btn').onclick = summarizePage;
}

function openSidebar() {
  SRM.sidebarOpen = true;
  sidebar.classList.add('open');
}

function closeSidebar() {
  SRM.sidebarOpen = false;
  sidebar.classList.remove('open');
}

function toggleSidebar() {
  SRM.sidebarOpen ? closeSidebar() : openSidebar();
}

// ─── AI Actions ────────────────────────────────────────────────────────────
function setLoading(el, msg) {
  el.innerHTML = `<div class="srm-loading"><div class="srm-spinner"></div><span>${msg}</span></div>`;
}

function setError(el, msg) {
  el.innerHTML = `<div class="srm-error">⚠️ ${msg}</div>`;
}

function setResult(el, label, text) {
  const safe = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const html  = safe.replace(/\n\n/g,'</p><p>').replace(/\n/g,'<br>');
  el.innerHTML = `<div class="srm-label">${label}</div><div class="srm-answer"><p>${html}</p></div>`;
}

async function runAI(action, text) {
  // switch to AI tab
  sidebar.querySelectorAll('.srm-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'ai'));
  sidebar.querySelectorAll('.srm-panel').forEach(p => p.classList.toggle('active', p.id === 'srm-panel-ai'));

  const prompts = {
    explain:  ['You are a reading assistant. Explain clearly in 2-4 sentences. Plain prose, no markdown headers.', `Explain: "${text}"`],
    define:   ['You are a dictionary. Give a definition in 1-2 sentences then one example. No markdown.', `Define: "${text}"`],
    simplify: ['Rewrite in simple plain English (10th grade). Return only the rewritten text.', text],
  };

  const [sys, usr] = prompts[action] || prompts.explain;
  setLoading(resultEl, action === 'explain' ? 'Explaining...' : action === 'define' ? 'Defining...' : 'Simplifying...');

  try {
    const result = await callGroq(sys, usr, 300);
    setResult(resultEl, `"${text.slice(0, 60)}${text.length > 60 ? '…' : ''}"`, result);
  } catch (err) {
    setError(resultEl, err.message);
  }
}

async function askQuestion(q) {
  if (!q) return;
  sidebar.querySelector('#srm-q').value = '';
  openSidebar();
  sidebar.querySelectorAll('.srm-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'ai'));
  sidebar.querySelectorAll('.srm-panel').forEach(p => p.classList.toggle('active', p.id === 'srm-panel-ai'));
  setLoading(resultEl, 'Thinking...');
  try {
    const pageText = getPageText();
    const result = await callGroq(
      'Answer questions about the article. Be direct. No markdown headers.',
      `Article: "${pageText}"\n\nQuestion: ${q}`, 400
    );
    setResult(resultEl, `Q: ${q}`, result);
  } catch (err) {
    setError(resultEl, err.message);
  }
}

async function summarizePage() {
  setLoading(summaryEl, 'Summarizing...');
  try {
    const pageText = getPageText();
    const result = await callGroq(
      'Summarize this article in 3-5 bullet points. Each bullet starts with "•". Be concise and insightful.',
      `Summarize:\n\n${pageText}`, 500
    );
    const html = result.replace(/•\s?/g, '<br>• ').replace(/\n/g, '<br>');
    summaryEl.innerHTML = `<div class="srm-answer">${html}</div>`;
  } catch (err) {
    setError(summaryEl, err.message);
  }
}

// ─── Reading Mode ──────────────────────────────────────────────────────────
function toggleReadingMode() {
  SRM.readingMode = !SRM.readingMode;
  document.body.classList.toggle('srm-reading', SRM.readingMode);
  sidebar.querySelector('#srm-rm-btn').textContent = SRM.readingMode ? '🌐' : '📖';
}

// ─── Save Highlight ────────────────────────────────────────────────────────
function saveHighlight(text) {
  try {
    chrome.runtime.sendMessage({ action: 'SAVE_HIGHLIGHT', text, url: location.href, title: document.title, color: 'yellow', savedAt: Date.now() });
  } catch {}
  showToast('Highlight saved ✓');
}

// ─── Toast ─────────────────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.createElement('div');
  t.className = 'srm-toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2500);
}

// ─── Export Highlights ─────────────────────────────────────────────────────
async function exportHighlights() {
  try {
    const data = await chrome.storage.local.get('highlights');
    const highlights = Object.values(data.highlights || {});
    if (!highlights.length) { showToast('No highlights saved yet'); return; }
    const md = highlights.map(h =>
      `> ${h.text}\n\n*[${h.title || 'Page'}](${h.url}) — ${new Date(h.savedAt).toLocaleDateString()}*`
    ).join('\n\n---\n\n');
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'highlights.md'; a.click();
    URL.revokeObjectURL(url);
    showToast('Highlights exported ✓');
  } catch (e) { showToast('Export failed: ' + e.message); }
}

// ─── Message listener ──────────────────────────────────────────────────────
try {
  chrome.runtime.onMessage.addListener(msg => {
    if (msg.action === 'TOGGLE_SIDEBAR')      toggleSidebar();
    if (msg.action === 'TOGGLE_READING_MODE') toggleReadingMode();
    if (msg.action === 'EXPLAIN_TEXT')        { openSidebar(); runAI('explain', msg.text); }
    if (msg.action === 'DEFINE_WORD')         { openSidebar(); runAI('define',  msg.text); }
    if (msg.action === 'DO_SUMMARIZE')        { openSidebar(); summarizePage(); }
    if (msg.action === 'EXPORT')              { exportHighlights(); }
  });
} catch {}

// ─── Boot ──────────────────────────────────────────────────────────────────
injectStyles();
createTooltip();
createSidebar();
SRM.pageText = getPageText();
