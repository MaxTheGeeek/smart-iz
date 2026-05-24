# Smartiz

> **Smartiz** is a premium, AI-powered desktop companion designed for high-performance job application drafting and multi-chapter book translation. 

Built on a hybrid architecture combining an **Electron/React desktop shell** with a fast **async FastAPI Python sidecar**, Smartiz provides an offline-first workspace to parse resumes, orchestrate context-aware cover letters, run real-time ATS/QA evaluations, and read/translate literary PDF volumes page-by-page.

---

## 🚀 Git Repository Short Description

> **Smartiz** is an AI-powered desktop suite combining a context-aware job application drafting room with a multi-chapter book translator, built using Electron, React, Tailwind CSS, FastAPI, SQLite, and Redis.

---

## 🛠️ Key Features

### 📝 1. The Writing Room
* **Contextual Ingestion:** Ingests PDF/DOCX resumes alongside targeted job descriptions in a clean drag-and-drop workspace.
* **LLM Engine & Fallback Chain:** Supports modern API providers (OpenRouter, Groq) with an automated fallback chain ensuring prompt generation never fails.
* **Multi-Agent Generation:** Streams custom cover letters live to the client UI using Server-Sent Events (SSE).

### 🔍 2. Pixel-Perfect Document Editor & QA Workstation
* **Fixed Geometry Lock:** Strict scrollbar-free `1280x820` layout optimized for premium desktop focus.
* **Collapsible QA popover:** Real-time scoring and alignment audits against target job requirements, collapsed into a floating header badge.
* **Bespoke Spacing Overlays:** Renders pixel-perfect PDF drafts matching custom template specifications.

### 📚 3. Multi-Chapter Book Translator
* **Auto-Segmentation:** Ingests massive PDF volumes, extracts Table of Contents (TOC) structures, and segments documents by chapters automatically.
* **Bi-Directional Translation:** High-fidelity page-by-page translation supporting RTL/LTR literary standards.
* **Dual Caching Layer:** Caches translated pages in an asynchronous Redis pipeline for instantaneous pagination retrieval.
* **Bilingual Export:** Compiles and exports translated chapters into beautifully aligned PDF files.

### 📑 4. PDF Merge Workstation
* Combine compiled cover letters, resumes, and academic transcripts into a single unified application PDF with an interactive ordering queue.

---

## 💻 Tech Stack

### Frontend (Desktop Shell)
* **Core Framework:** React 19, TypeScript 6
* **Desktop Runtime:** Electron 42 (Node integration isolated, context bridge secured)
* **Styling System:** Tailwind CSS, PostCSS (harmonized under custom midnight-cream tokens)
* **State Management:** Zustand 5
* **Queries & SSE:** TanStack React Query 5, SSE EventStream

### Backend (Python Sidecar)
* **API Framework:** FastAPI, Uvicorn (spawns seamlessly on port `8765` under Electron boot)
* **Data Storage:** SQLite (Async SQLAlchemy ORM Engine)
* **Caching Pipeline:** Redis (Fast daemonized cache for translator page records)
* **Document Services:** PyPDFium2, PDFMiner.six, python-docx, ReportLab (PDF Layout Compiles)
* **Freezing Tool:** PyInstaller 6 (bundles python into a single-file platform-native binary)

---

## 📦 Installation & Setup

### Prerequisites
* **Node.js** (v18 or higher)
* **Python** (v3.10 or higher, only for development runtime)
* **Redis** (optional, for book translator caching)

---

## 🛠️ Development Setup

To run the application in a hot-reloading development environment:

### 1. Start Python Sidecar
In a new terminal tab, navigate to `/sidecar`, set up your virtual environment, and boot the server:
```bash
cd sidecar
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py --port 8765
```

### 2. Start Electron & React UI
In your primary root directory, install dependencies and boot the hot-reloading GUI:
```bash
# Install package dependencies
npm install

# Start both Vite dev server & Electron process
npm run dev
```

---

## 🚀 Building & Packaging for Production

Smartiz compiles into a standalone distributable installer with the Python backend embedded natively. No external dependencies are needed for the end-user.

### 1. Compile Python Standalone Sidecar
Generates a platform-native executable binary inside the sidecar build folder:
```bash
cd sidecar
source .venv/bin/activate
pip install pyinstaller
pyinstaller --onefile --name smartiz-sidecar main.py \
  --add-data "prompts:prompts" \
  --hidden-import tiktoken_ext.openai_public \
  --hidden-import tiktoken_ext.cl100k_base
```

### 2. Compile and Package Electron GUI
Compiles the React assets and packages the app into an installer (.dmg, .exe, or .AppImage):
```bash
# Builds UI assets & runs electron-builder
npm run dist
```
* **Output Path:** Distributables are generated at `dist/installers/Smartiz-1.0.0-[arch].dmg` (or relevant OS extension).

---

## 📖 User Guide

### Setting Up API Credentials
1. Launch **Smartiz**.
2. Click **Settings & Profiles** (or the gear icon) in the bottom-left of the sidebar.
3. Choose your LLM provider (OpenRouter or Groq) and paste your API key.
4. Click **Save Configuration**.

### Creating your First Cover Letter
1. Click **New Cover Letter** in the writing room sidebar.
2. Drag and drop your target resume (PDF/DOCX) and paste the Job Description.
3. Configure target templates, company name, and styles.
4. Click **Analyze & Generate** to watch your letter stream live!
5. In the editor screen, click the **QA Badge** to audit the ATS quality score, and click **Export Letter PDF** to save.

### Translating a Book
1. Navigate to **Translator** in the sidebar.
2. Upload your PDF book.
3. Select your target translation language.
4. Go chapter-by-chapter, reading the original page on the left and streaming the high-fidelity translation on the right.
5. Click **Export Chapter PDF** to generate a bilingual book copy!

---

## 🔒 Security & Privacy

Smartiz is built offline-first. Your resumes, job target documents, translations, and SQLite database data **never** leave your local computer. API calls are sent directly to the selected LLM endpoint securely via SSL, preserving absolute user data confidentiality.
