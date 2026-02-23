<p align="center">
  <img src="viberead/icons/icon128.png" alt="VibeRead Logo" width="96" />
</p>

<h1 align="center">VibeRead</h1>

<p align="center">
  <strong>⚡ Premium Speed Reading Chrome Extension with Native PDF Support</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Manifest-V3-blue?style=flat-square" alt="Manifest V3" />
  <img src="https://img.shields.io/badge/Chrome-Extension-green?style=flat-square&logo=googlechrome&logoColor=white" alt="Chrome Extension" />
  <img src="https://img.shields.io/badge/PDF.js-Integrated-orange?style=flat-square" alt="PDF.js" />
  <img src="https://img.shields.io/badge/Offline-Ready-purple?style=flat-square" alt="Offline Ready" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT License" />
</p>

<p align="center">
  <em>Read any webpage or PDF at 300–1200 WPM using RSVP technology.<br/>
  Auto-resume PDFs exactly where you left off — even after closing the browser.</em>
</p>

---

## ✨ What is VibeRead?

**VibeRead** is a feature-rich Chrome extension that lets you speed-read any webpage or PDF using **RSVP** (Rapid Serial Visual Presentation) — displaying words one at a time at your eye's natural focal point.

Unlike traditional reading where your eyes zig-zag across lines, VibeRead keeps your gaze fixed while words flow to you, eliminating the eye movements that slow reading by up to **80%**.

> 💡 Most people read at 200–300 WPM. With VibeRead, you can comfortably reach **500–1000+ WPM** with practice.

---

## 🚀 Key Features

<table>
<tr>
<td width="50%">

### 📖 RSVP Reader

- Speed-read any webpage with one click
- **ORP focal highlighting** (Optimal Recognition Point)
- Adjustable **100–1200 WPM**
- **1–5 words at a time** display
- Context lines above & below
- Punctuation-aware timing pauses

</td>
<td width="50%">

### 📄 Native PDF Reader

- **Drag-and-drop** PDF loading
- **SHA-256 file hashing** for rename-safe progress
- **Auto-resume** from exact word & page
- **Thumbnail sidebar** with page navigation
- Auto-save every 5 seconds
- Export/import progress as JSON

</td>
</tr>
<tr>
<td>

### 🎨 Premium UI

- **12 beautiful color themes** (Dark, Midnight, Sepia, Forest, Ocean, Sunset, Slate, Warm, Paper, Matrix, Purple, Ice)
- **Reading Mode** — controls hide during playback for distraction-free reading
- Smooth animations & transitions
- Modern glassmorphism design

</td>
<td>

### ⏱ Smart Features

- **Session timer** with elapsed time tracking
- **Max session time** (Pomodoro-friendly: 5-60 min)
- **Estimated time remaining** based on current WPM
- **Statistics dashboard** — words read, sessions, streaks
- **Text-to-Speech** integration
- Full **keyboard shortcuts**

</td>
</tr>
</table>

---

## 🖼️ Screenshots

<details>
<summary><strong>📌 Extension Popup</strong></summary>
<br/>
<p>Clean dark popup with quick-access buttons, WPM badge, and reading stats at a glance.</p>
<ul>
  <li>⚡ One-click "VibeRead This Page" button</li>
  <li>📄 PDF Reader launcher</li>
  <li>📋 Paste Text mode</li>
  <li>📊 Live stats footer (Words Read · Sessions · Streak)</li>
</ul>
</details>

<details>
<summary><strong>📖 RSVP Reader</strong></summary>
<br/>
<p>Full-screen RSVP reader with ORP focal word in orange, context lines, and complete playback controls.</p>
<ul>
  <li>Top bar: Time Left · WPM · Words · Session timer</li>
  <li>Center: Focal word with ORP guide line</li>
  <li>Bottom: Play/Pause · Skip · WPM slider · WAT · TTS · Settings</li>
  <li>Controls auto-hide during reading for immersive experience</li>
</ul>
</details>

<details>
<summary><strong>📄 PDF Reader</strong></summary>
<br/>
<p>Drop a PDF and start speed-reading with automatic progress resume.</p>
<ul>
  <li>Drag & drop zone with file hash computation</li>
  <li>Resume banner when returning to a previously read PDF</li>
  <li>Thumbnail sidebar for visual page navigation</li>
  <li>Global progress bar spanning the entire document</li>
</ul>
</details>

---

## 📥 Installation

### From Source (Developer Mode)

```bash
# 1. Clone the repository
git clone https://github.com/your-username/viberead.git
cd viberead

# 2. Open Chrome Extensions page
#    Navigate to: chrome://extensions/

# 3. Enable "Developer mode" (top-right toggle)

# 4. Click "Load unpacked"

# 5. Select the `viberead/` folder
```

### Quick Install

1. Download or clone this repo
2. Open `chrome://extensions/`
3. Toggle **Developer Mode** on
4. Click **Load unpacked** → select the `viberead/` folder
5. Pin VibeRead to your toolbar — done! 🎉

---

## ⌨️ Keyboard Shortcuts

| Action              | Key            | Description                           |
| ------------------- | -------------- | ------------------------------------- |
| **Play / Pause**    | `Space` or `K` | Toggle reading                        |
| **Previous word**   | `←`            | Step back one chunk                   |
| **Next word**       | `→`            | Step forward one chunk                |
| **Speed up**        | `↑`            | +25 WPM                               |
| **Slow down**       | `↓`            | −25 WPM                               |
| **Rewind 10s**      | `J`            | Jump back ~10 seconds worth of words  |
| **Forward 10s**     | `L`            | Jump ahead ~10 seconds worth of words |
| **Fullscreen**      | `F`            | Toggle fullscreen mode                |
| **Settings**        | `S`            | Open/close settings panel             |
| **Words at a time** | `1`–`5`        | Set 1 to 5 words per chunk            |
| **Open reader**     | `Alt+V`        | Speed-read current tab (global)       |

---

## 🏗️ Architecture

```
viberead/
├── manifest.json           # Chrome MV3 manifest
├── background.js           # Service worker (shortcuts, messaging, text extraction)
├── popup.html / popup.js   # Extension popup UI
│
├── reader/
│   ├── reader.html         # RSVP reader (12 themes, settings panel, paste modal)
│   └── reader.js           # Reading engine (chunking, ORP, timing, TTS, stats)
│
├── pdf/
│   ├── pdf-reader.html     # PDF reader (drop zone, resume, thumbnails)
│   └── pdf-reader.js       # PDF engine (SHA-256, pdf.js, auto-resume, progress)
│
├── settings/
│   ├── settings.html       # Settings page (4 tabs: Interface, Reading, Hotkeys, Data)
│   └── settings.js         # Settings persistence & import/export
│
├── stats/
│   ├── stats.html          # Statistics dashboard (6 metric cards, PDF list)
│   └── stats.js            # Stats aggregation & display
│
├── content/
│   └── content.js          # Content script (Alt+V shortcut fallback)
│
├── lib/
│   ├── pdf.min.mjs         # pdf.js v4.2 (bundled for offline use)
│   └── pdf.worker.min.mjs  # pdf.js web worker
│
└── icons/
    ├── icon16/32/48/128.png # Extension icons
    └── author.jpg           # Author avatar
```

---

## 🎯 How It Works

### RSVP (Rapid Serial Visual Presentation)

```
Traditional reading:         VibeRead RSVP:

  Your eyes move across  →    Words come
  every line, scanning       to YOUR focal
  left to right, then        point. Eyes stay
  jumping back to the        fixed. Brain
  next line...               processes faster.

  ~250 WPM                   ~500+ WPM
```

1. **Text is extracted** from the current webpage or loaded PDF
2. **Words are chunked** into groups of 1–5 (configurable)
3. The **focal word** (ORP) is computed — the longest word gets highlighted
4. Words are displayed **one chunk at a time** at your set WPM
5. **Smart timing** adds micro-pauses at punctuation (periods, commas)

### PDF Progress Resume

```
PDF File → SHA-256 Hash → Unique ID → chrome.storage.local
                                          ↓
Browser Closed → Reopen Same PDF → Hash Matches → Resume! ✅
                                          ↓
File Renamed → Same Content → Same Hash → Still Resumes! ✅
```

---

## ⚙️ Settings

| Category      | Options                                                                     |
| ------------- | --------------------------------------------------------------------------- |
| **Interface** | 12 color themes, font family, font size, context lines, ORP guide           |
| **Reading**   | WPM (100–1200), words-at-a-time (1–5), punctuation pause, max session timer |
| **Hotkeys**   | Full keyboard shortcut reference                                            |
| **Data**      | Export/import progress JSON, clear progress, reset statistics               |

---

## 🛡️ Privacy

- ✅ **No analytics or tracking** — zero external requests
- ✅ **No data leaves your browser** — everything stays in `chrome.storage.local`
- ✅ **Fully offline** after install — pdf.js is bundled
- ✅ **Open source** — audit the code yourself

---

## 🧰 Tech Stack

| Technology               | Purpose                         |
| ------------------------ | ------------------------------- |
| **Chrome Manifest V3**   | Extension platform              |
| **Vanilla JS**           | Zero framework dependencies     |
| **pdf.js v4.2**          | PDF rendering & text extraction |
| **Web Speech API**       | Text-to-Speech                  |
| **Crypto API**           | SHA-256 file hashing            |
| **chrome.storage.local** | Settings & progress persistence |

---

## 🤝 Contributing

Contributions are welcome! Feel free to:

1. **Fork** this repository
2. Create a **feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. Open a **Pull Request**

---

## 📬 Contact

<p>
  <strong>Sunny Trinh</strong><br/>
  ✉️ <a href="mailto:iamnhatjt@gmail.com">iamnhatjt@gmail.com</a>
</p>

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Made with ♥ by <strong>Sunny Trinh</strong>
</p>

<p align="center">
  <em>Read faster. Learn more. Vibe on. ⚡</em>
</p>
