# ⚡ Smart Reading Mode

> A Chrome Extension that transforms any webpage into a focused, AI-powered reading experience.

![Version](https://img.shields.io/badge/version-1.0.0-blue?style=flat-square&fontFamily=JetBrains+Mono)
![Manifest](https://img.shields.io/badge/manifest-v3-green?style=flat-square)
![Status](https://img.shields.io/badge/status-active-brightgreen?style=flat-square)

Part of the **Chrome Extension Portfolio Series** — a five-project progression from tab management to full-stack AI tools.

---

## Features

| Feature | Description |
|---|---|
| 🧠 **AI Explain** | Highlight any text → get an instant explanation powered by Claude |
| 📖 **AI Define** | Select a single word → get a clear definition + usage example |
| ✂️ **AI Simplify** | Rewrite complex passages in plain English |
| 🤖 **Ask Anything** | Type a question about the article in the sidebar Q&A panel |
| 📋 **Page Summarize** | 5-bullet AI summary of the full article in one click |
| 💾 **Highlight & Save** | Save quotes with color-coded marks, persisted to `chrome.storage.local` |
| 📥 **Export to Markdown** | Download all highlights as a clean `.md` file |
| 📊 **Reading Stats** | Track pages read, time spent, and total highlights across sessions |
| 🌙 **Reading Mode** | Strip distractions — renders article text in a clean, dark, focused layout |
| ⌨️ **Keyboard Shortcuts** | `Ctrl+Shift+R` reading mode · `Ctrl+Shift+S` sidebar · `Esc` close |

---

## Architecture

```
smart-reading-mode/
├── manifest.json          # Extension config (MV3), permissions, commands
├── popup.html             # Action popup — stats, quick controls, API key
├── src/
│   ├── popup.js           # Popup controller — loads stats, routes actions
│   ├── background.js      # Service worker — context menus, keyboard cmds, message routing
│   ├── content.js         # Content script — DOM injection, tooltip, sidebar, reading mode
│   ├── content.css        # Scoped styles for all injected UI
│   ├── ai.js              # Claude API integration layer (explain / define / summarize / ask)
│   └── storage.js         # chrome.storage.local abstraction (highlights, settings, stats)
└── icons/                 # Extension icons (16, 48, 128px)
```

### Data Flow

```
User selects text
      │
      ▼
content.js (tooltip appears)
      │
      ├─── "Explain" clicked ──► ai.js ──► Claude API ──► Sidebar renders result
      │
      ├─── "Save" clicked ──────► background.js (message) ──► storage.js ──► chrome.storage.local
      │
      └─── "Reading Mode" ──────► CSS class toggle on <body>

background.js
      │
      ├─── Context menu click ──► chrome.tabs.sendMessage(tab.id, {action}) ──► content.js
      └─── Keyboard command ───► chrome.tabs.sendMessage(tab.id, {action}) ──► content.js
```

### Key Chrome APIs Used

- `chrome.storage.local` — persistent highlights, settings, reading stats
- `chrome.contextMenus` — right-click menu items on selected text
- `chrome.commands` — global keyboard shortcut registration
- `chrome.tabs.sendMessage` / `chrome.runtime.onMessage` — background ↔ content messaging
- `chrome.scripting` — programmatic script injection
- Content Scripts (CSS + JS) — injected into every webpage

---

## Installation

### Development

```bash
git clone https://github.com/EyadAbouKer/Smart-Reading-Mode
cd "Smart Reading Mode"
python3 generate_icons.py   # generate placeholder icons
```

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** → select the `Smart Reading Mode/` folder
4. Pin the extension from the toolbar

### API Key Setup

1. Get a free API key at [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Click the extension icon → paste your key → Save
3. Start highlighting text on any article

> **Note:** For production, route API calls through a backend proxy instead of storing keys in `chrome.storage`. This architecture makes that swap trivial — just update `ai.js`.

---

## Usage

### Highlight Actions

1. Select any text on a webpage
2. A tooltip appears with four actions:
   - **🧠 Explain** — AI explanation with page context
   - **📖 Define** — dictionary-style definition
   - **✂️ Simplify** — plain-English rewrite
   - **💾 Save** — persist highlight to storage

### Sidebar Q&A

- Click the extension → **Open Sidebar**, or press `Ctrl+Shift+S`
- Type any question in the input box and press Enter

### Reading Mode

- Click **Reading Mode** in the popup, or press `Ctrl+Shift+R`
- Strips ads, navbars, and sidebars — shows only the article
- Press again to restore the original layout

---

## Skills Demonstrated

- **Content Scripts** — CSS + JS injection into live pages without breaking page styles
- **Background Service Worker** — persistent logic that survives popup close
- **Message Passing** — bi-directional background ↔ content communication pattern
- **chrome.storage API** — structured local storage with async/await abstraction layer
- **Context Menus API** — extending the browser's native right-click menu
- **External API Integration** — Claude Anthropic API calls with error handling
- **Reading Mode CSS** — `visibility: hidden` technique to isolate article content
- **Scoped Component Architecture** — all modules separated by concern, zero global state leakage

---

## Roadmap

- [ ] Multi-color highlight picker in tooltip
- [ ] Notion / Obsidian export integration  
- [ ] Reading time estimator per article
- [ ] Custom prompt templates
- [ ] Firefox port (MV3 compatible)
- [ ] Cloud sync via Firebase

---

## Portfolio Series

| # | Project | Focus |
|---|---|---|
| 1 | [Tab Commander Pro](../tab-commander-pro) | Chrome APIs, popup UI |
| **2** | **Smart Reading Mode** ← you are here | Content scripts, AI API, storage |
| 3 | Page Summarizer | Background workers, fetch patterns |
| 4 | AI Study Assistant | Full architecture, Claude integration |
| 5 | Extension + Dashboard | Full-stack, React, database |

---

*Built by Eyad · Computer Science @ Nile University*
