# Smartiz — Full Product Refactor Specification

> **Version:** 1.0  
> **Date:** 2026-05-25  
> **Scope:** UI/UX, Architecture, Security, Authentication  
> **App type:** Local desktop app (Electron / Tauri + Python backend + LLM via OpenRouter / Ollama / Grok)

---

## Table of Contents

1. [Authentication Decision](#1-authentication-decision)
2. [Global Navigation & Information Architecture](#2-global-navigation--information-architecture)
3. [Book / PDF Translator](#3-book--pdf-translator)
4. [Visual PDF Combiner (Merge)](#4-visual-pdf-combiner-merge)
5. [Settings & Control Panel](#5-settings--control-panel)
6. [Writing Room / Cover Letter Flow](#6-writing-room--cover-letter-flow)
7. [Security — Cross-Cutting Concerns](#7-security--cross-cutting-concerns)
8. [First-Launch Setup Flow](#8-first-launch-setup-flow)

---

## 1. Authentication Decision

### Verdict: Remove the fake login. Do not add a real one.

Smartiz is a **single-user local desktop application**. It has no remote server, no multi-tenant database, and no network session to protect. A traditional username/password login screen on a local app is security theater — it provides zero real protection because:

- Credentials would be stored locally anyway (accessible to anyone with filesystem access)
- Anyone with physical access to the machine bypasses a local login in under a minute
- It adds friction every time the user opens the app with no security benefit

**The current fake login must be removed entirely.** It gives users false confidence.

---

### What to implement instead

The real threats for Smartiz are different from what a login screen solves:

| Real threat | Correct mitigation |
|---|---|
| API keys readable in plaintext config files | OS keychain storage (electron-keytar / keyring) |
| Conversation history readable by others on shared machine | SQLCipher encrypted local database |
| LLM API keys exposed to renderer process / frontend | All LLM calls proxied through main process only |
| Casual access on a shared/family computer | Optional 4-digit local PIN screen lock |
| Sensitive data in logs or error reports | Scrub all personal data and keys from logs |

---

### Optional: Local PIN screen lock

This is the **only scenario** where a "login" makes sense for Smartiz — shared machines (family computer, work laptop used by multiple people). It is **off by default** and opt-in during first-launch setup.

**How it works:**
- User sets a 4-digit PIN during setup (stored as a `bcrypt` hash locally — never plaintext)
- When the app is minimized or the screen locks, Smartiz shows a PIN entry overlay
- Incorrect PIN: show attempt counter, lock for 30 seconds after 5 failed attempts
- PIN reset: requires deleting the local app data folder (documented in help)
- This is a **screen lock**, not an authentication system — it protects against casual access, not a determined attacker

**Implementation:**
```js
// Store PIN during setup (main process only)
const bcrypt = require('bcrypt');
const hashedPin = await bcrypt.hash(userPin, 12);
// Store hashedPin in encrypted local config via electron-store with encryptionKey from OS keychain

// Verify on unlock
const isValid = await bcrypt.compare(enteredPin, storedHash);
```

---

## 2. Global Navigation & Information Architecture

### Issue: "New cover letter" is the wrong primary CTA

The primary button in the sidebar launches directly into cover letter mode. This forces all users — even those who just want to chat or ask a question — into an overly specific context.

**Fix:** Rename to "New chat". Cover letter is a *skill*, not the app's identity.

---

### Sidebar restructure

**Before:**
```
+ New cover letter
  Writing room
  Settings & profiles
  Translator
  Merge PDFs
RECENT
  ...
```

**After:**
```
+ New chat              ← primary CTA, keyboard shortcut ⌘N
─────────────────
  Writing room
  Settings & profiles
─────────────────
TOOLS ▾               ← collapsible section
  Translator
  Merge PDFs
─────────────────
RECENT
  ...
```

---

### Skill/intent picker inside chat

After opening a new chat, show a mode picker in the empty chat state (before the user types anything):

```
What would you like to do?

[💬 Chat freely]   [📝 Cover letter]   [🌐 Translate]   [📂 Analyze file]
```

- Selecting a skill sets the system prompt context for that session
- The selected skill is shown as a small chip/badge in the chat header: `📝 Cover letter mode`
- User can switch mode mid-session via a dropdown in the chat header
- Free chat must always be the default — never auto-select a skill

---

## 3. Book / PDF Translator

### Issue 1: Table of contents leaking into translations

The LLM is receiving raw PDF index/TOC pages and translating them. These pages must be excluded.

**Fix — TOC detection and stripping:**

```python
import fitz  # PyMuPDF

def extract_toc_and_body_pages(pdf_path):
    doc = fitz.open(pdf_path)
    toc = doc.get_toc()  # Returns [[level, title, page], ...]
    
    # Detect TOC pages heuristically if metadata TOC is empty
    toc_page_indices = set()
    if not toc:
        for i, page in enumerate(doc):
            text = page.get_text()
            lines = text.strip().splitlines()
            # TOC pages: many lines ending with page numbers, low body word count
            dotted_lines = sum(1 for l in lines if l.strip().endswith(tuple('0123456789')))
            if dotted_lines > len(lines) * 0.5 and len(lines) > 5:
                toc_page_indices.add(i)
    else:
        # Mark the pages before the first actual chapter as TOC
        first_chapter_page = toc[0][2] - 1 if toc else 0
        for i in range(min(first_chapter_page, 10)):
            toc_page_indices.add(i)
    
    body_pages = [i for i in range(len(doc)) if i not in toc_page_indices]
    return toc, body_pages
```

- Parsed TOC entries populate the **left chapter panel** as clickable navigation
- Chapter panel heading changes from "Extracted index rails" to **"Chapters"**
- Clicking a chapter jumps the reader to that page number

---

### Issue 2: Pagination shows all 593 pages inline

Replace the single-row page scroll with windowed pagination.

**New pagination behavior:**
- Show max **15 page numbers** at a time
- Format: `[◀]  1  2  ...  11  12  13  14  15  ...  593  [▶]`
- Between the arrows: a text input showing `Page 291 of 593` — user types a number and presses Enter to jump
- Keyboard: `←` / `→` arrow keys navigate pages when the translation panel is focused
- Current page number is always visible and centered

---

### Issue 3: No in-content navigation arrows

Users must scroll back to the top to change pages. This breaks reading flow.

**Fix:** Add floating left/right arrow buttons inside the translation reading panel:

- Positioned on the left and right edges of the translation content area, vertically centered
- `position: sticky` within the scroll container (not `fixed` — avoids iframe issues)
- Opacity `0.3` idle, `1.0` on hover, smooth transition
- These are **independent** of the top pagination bar — both remain functional
- On mobile/narrow viewport: show only bottom-center prev/next buttons instead

---

### Issue 4: No loading state during translation

**Fix:** When a page translation is in progress:
- Show animated shimmer skeleton (3–5 lines of varying width) inside the translation panel
- Header shows: `Translating page 291 of 593…` with a subtle spinner
- If translation fails: show inline error card with **"Retry this page"** button and the error reason
- Cache completed translations locally — navigating back to a translated page must be instant (no re-call to LLM)

---

### Issue 5: Chapter panel lacks hierarchy and visual state

**Fix — chapter card structure:**

```
▼ Part I — Introduction             ← collapsible group (if book has parts)
   Chapter 1 — Getting Started      ← active: left 2px accent border + tint bg
   pages 1–22                       ✓ translated
   Chapter 2 — Variables
   pages 23–44                      ○ not yet translated
▼ Part II — Core Concepts
   ...
```

- Active chapter: `border-left: 2px solid <accent>`, background tint at 8% opacity
- Translated chapters: small `✓` checkmark indicator
- In-progress chapter: animated spinner in place of checkmark
- Chapter groups are collapsible

---

## 4. Visual PDF Combiner (Merge)

### Layout refactor

Remove the split drop-zone / slot-list layout. Replace with a single full-width flow:

```
┌──────────────────────────────────────────────────┐
│  ⊕  Drop PDFs here or  [Browse]     (2–5 files)  │  ← compact 60px drop bar, always visible
└──────────────────────────────────────────────────┘

ASSEMBLY QUEUE (3/5)

┌─────────────────────────────────────────────────────┐
│ ⠿  [thumbnail]  Bewerbung_Majid…_DotNet.pdf  41.3KB │ ↑ ↓ ×
│                  1 page                              │
├─────────────────────────────────────────────────────┤
│ ⠿  [thumbnail]  Bewerbung_Majid…_CSharp.pdf  41.6KB │ ↑ ↓ ×
│                  1 page                              │
└─────────────────────────────────────────────────────┘

                              [Combine & Save PDF →]
```

---

### Slot card requirements

Each card must show:
- **Drag handle** `⠿` on the far left (drag-to-reorder)
- **Page 1 thumbnail** rendered at `80×110px` (use PyMuPDF / pdf.js to render)
- **Filename** — truncated in the **middle** (not the end), so both the prefix and suffix are visible:  
  `Bewerbung_Majid_Behzadi_…_CSharp.pdf`
- **Full filename on hover** via native `title` tooltip attribute
- **File size** and **page count**
- **Delete button** `×` on the right
- Up/Down arrow buttons remain as **secondary/accessibility** controls

---

### Drag-and-drop reorder

- Implement with `SortableJS` (web) or native HTML5 drag events
- Show a ghost/placeholder card at the drop target position while dragging
- Animate the reorder with a smooth transition (150ms ease)

---

### 5-document limit enforcement

- When user tries to add a 6th file: **do not add it**
- Immediately show a **toast notification** (top-right, auto-dismiss 3s):  
  `"Maximum 5 documents — remove one to add another"`
- Slot counter `(5/5)` turns **amber/warning color** at max capacity
- The drop zone becomes visually disabled (reduced opacity, "not-allowed" cursor) when at 5/5

---

### File validation before adding to queue

```python
import magic  # python-magic

ALLOWED_MIME = {"application/pdf"}
MAX_SIZE_BYTES = 50 * 1024 * 1024  # 50MB

def validate_pdf(file_path: str) -> tuple[bool, str]:
    # Check file size
    size = os.path.getsize(file_path)
    if size > MAX_SIZE_BYTES:
        return False, f"File too large ({size // 1024 // 1024}MB). Maximum is 50MB."
    
    # Check magic bytes — not just extension
    mime = magic.from_file(file_path, mime=True)
    if mime not in ALLOWED_MIME:
        return False, f"Invalid file type ({mime}). Only PDF files are accepted."
    
    # Check PDF magic bytes directly
    with open(file_path, "rb") as f:
        header = f.read(5)
    if header != b"%PDF-":
        return False, "File does not appear to be a valid PDF."
    
    return True, ""
```

---

## 5. Settings & Control Panel

### Layout: Replace sub-menu with horizontal tabs

**Before:** Vertical left menu + form side by side (cramped, unfinished)

**After:** Horizontal tab bar across the top of the settings content area

```
[ Profile ]  [ Resumes ]  [ PDF Templates ]  [ API & LLMs ]
─────────────────────────────────────────────────────────────
(full-width form content here)
```

- Active tab: bottom border `2px solid <accent>`, font-weight 500
- Tab bar sits below the "Settings & Control Panel" heading
- Full content width is now available for forms

---

### Save feedback

- After "Save Profile" is clicked:
  - Show a spinner inside the button while saving
  - On success: button text becomes `✓ Saved` for 2 seconds, then reverts
  - On failure: show a red inline error below the form with the reason
- Never let a save action complete silently with no feedback

---

### Form validation (client-side, inline, non-blocking)

| Field | Validation rule | Error message |
|---|---|---|
| Full name | Non-empty, min 2 chars | "Please enter your full name" |
| Email | Valid email format | "Enter a valid email address" |
| Phone | Digits, +, -, spaces, () only | "Phone number contains invalid characters" |
| LinkedIn URL | Starts with `https://` or empty | "URL must start with https://" |
| GitHub URL | Starts with `https://` or empty | "URL must start with https://" |
| Portfolio URL | Starts with `https://` or empty | "URL must start with https://" |

- Validate on `blur` (when user leaves the field) — never on every keystroke
- Error message appears as small red text directly below the field
- Do **not** use browser native `alert()` or modal dialogs for validation errors

---

### API keys — security-first display

This is the most security-sensitive part of the settings UI:

```
OpenRouter API Key
[••••••••••••••••••••  abcd]  [👁 Reveal]  [Re-enter key]
Last updated: 3 days ago

Grok API Key  
[Not configured]  [+ Add key]
```

**Rules:**
- Keys are **always masked** by default (`type="password"` equivalent)
- Show only the **last 4 characters** of a saved key
- "Reveal" button shows the full key for 10 seconds, then re-masks automatically
- "Re-enter key" button clears the field and lets the user paste a new key
- Keys are stored in the **OS keychain**, never in a flat config file:

```js
// Electron — main process only
const keytar = require('keytar');

// Save
await keytar.setPassword('smartiz', 'openrouter_api_key', apiKey);

// Read  
const key = await keytar.getPassword('smartiz', 'openrouter_api_key');

// Delete
await keytar.deletePassword('smartiz', 'openrouter_api_key');
```

- API keys must **never** be passed through IPC to the renderer process
- Keys must **never** appear in logs, error messages, or crash reports
- The renderer only receives a boolean: `{ openrouter: true, grok: false }` (configured or not)

---

## 6. Writing Room / Cover Letter Flow

### Issue 1: Zero skills detected — no fallback

When skill detection returns 0 results, show a helpful fallback instead of an empty section:

```
⚠ Skills couldn't be auto-detected from this posting.

Paste the job requirements below and we'll extract the key skills:
┌──────────────────────────────────────────────┐
│                                              │
│   Paste job description here...             │
│                                              │
└──────────────────────────────────────────────┘
                          [Extract skills →]
```

- Trigger LLM skill extraction on the pasted text
- Populate the "Key skills identified" list with the results
- If extraction still fails, allow the user to type skills manually as comma-separated tags

---

### Issue 2: Voice/tone selection — weak active state

The currently selected card looks almost identical to unselected cards.

**Active state requirements:**
- `border-left: 2px solid <accent color>`
- Background: accent color at 8% opacity
- A filled dot `●` next to the title (in accent color)
- Title font-weight: 500

**Unselected state:**
- No left border accent
- Default background
- No dot indicator
- Title font-weight: 400

Never rely on subtle background color shift alone to convey selection state.

---

### Issue 3: PDF template thumbnails too small to evaluate

**Fix:**
- On hover over any template card: show a popover with a `200×280px` rendered thumbnail preview
- On click: open a full-screen preview modal showing the complete template (A4 proportions)
- Modal has two buttons: `Use this template` and `Cancel`
- The selected template card gets a `✓ Selected` badge in the bottom-right corner

---

### Issue 4: Raw LLM model string in status bar is confusing

**Before:** `llama-3.3-70b · setup mode` / `gemini-2.0-flash-exp · cached / idle`

**After:**

```
● Local AI · Ready          (green dot)
● Cloud AI · Online         (green dot)
◌ Local AI · Loading...     (yellow dot, animated)
✕ Cloud AI · Offline        (red dot)
```

- On hover: tooltip shows the technical model name, version, context window, and current status
- Status dot colors: green = ready, yellow = loading/busy, red = offline/error, blue = cached
- The status bar is always visible at the bottom of the screen

---

## 7. Security — Cross-Cutting Concerns

### LLM output sanitization

**Never render raw LLM HTML directly into the DOM.**

```js
// WRONG — XSS risk
translationPanel.innerHTML = llmResponse;

// CORRECT — sanitize first
import DOMPurify from 'dompurify';
import { marked } from 'marked';

const html = DOMPurify.sanitize(marked.parse(llmResponse), {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'blockquote', 'code', 'pre'],
  ALLOWED_ATTR: []
});
translationPanel.innerHTML = html;
```

This applies to: translation panel, writing room output, chat responses, and any LLM-generated preview.

---

### File upload validation (all file inputs)

Before processing any user-uploaded file:

1. Check file extension matches actual MIME type (prevent extension spoofing)
2. Check file size is under the configured limit (default: 50MB)
3. For PDFs: verify magic bytes start with `%PDF-`
4. For images: verify JPEG/PNG/WEBP magic bytes match the claimed type
5. Reject invalid files with a clear, user-friendly error message
6. **Never send unvalidated files to the LLM or any external API**

---

### IPC security (Electron)

```js
// preload.js — expose only what is needed, nothing more
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('smartiz', {
  // LLM calls — renderer never sees the API key
  sendMessage: (messages, skill) => ipcRenderer.invoke('llm:send', messages, skill),
  
  // API key status only — never the key itself
  getApiKeyStatus: () => ipcRenderer.invoke('keys:status'),
  
  // File operations
  selectFile: (filters) => ipcRenderer.invoke('file:select', filters),
  mergePdfs: (filePaths) => ipcRenderer.invoke('pdf:merge', filePaths),
});

// Never do this:
// contextBridge.exposeInMainWorld('keys', { openrouter: process.env.OPENROUTER_KEY })
```

---

### Data at rest — encrypted local database

If Smartiz stores conversation history, cover letters, or applicant profiles locally:

- Use **SQLCipher** (encrypted SQLite) for the local database
- Database encryption key is derived from a machine-unique identifier (OS keychain)
- Never store the database key in plaintext anywhere
- On first launch, generate and store the key via:

```python
import keyring
import secrets

def get_or_create_db_key() -> str:
    key = keyring.get_password("smartiz", "db_encryption_key")
    if not key:
        key = secrets.token_hex(32)
        keyring.set_password("smartiz", "db_encryption_key", key)
    return key
```

---

### No telemetry, no analytics, no phone-home

Smartiz handles sensitive personal data (resumes, cover letters, API keys, applicant profiles). The app must:

- Never send conversation content, prompts, or responses to any third-party analytics service
- Never include crash reporters that attach file contents or environment variables
- Never log personal data (name, email, address, API keys) to disk
- Include a clear statement in the About page: "Smartiz never sends your data anywhere except the LLM provider you configure."

---

## 8. First-Launch Setup Flow

Replace the fake login with a useful one-time onboarding flow. This runs only once, on first launch.

```
Step 1 of 3 — Welcome to Smartiz
─────────────────────────────────
Let's set up your applicant profile.
This information will be used to fill cover letter templates automatically.

Full name:        [                    ]
Email:            [                    ]
Phone:            [                    ]
Home address:     [                    ]

                              [Continue →]

─────────────────────────────────
Step 2 of 3 — Connect your AI
─────────────────────────────────
Smartiz uses an LLM to generate text. Choose how to connect:

○ Local model (Ollama)     — Free, private, runs on your machine
                             [Select model ▾]  llama3.2, qwen3, gemma3...

○ OpenRouter (cloud)       — Requires API key, access to 200+ models
                             API key: [                    ]  [Paste]

○ Grok (xAI)               — Requires API key
                             API key: [                    ]  [Paste]

                    [← Back]              [Continue →]

─────────────────────────────────
Step 3 of 3 — Optional screen lock
─────────────────────────────────
Do you share this computer with others?

○ No — open Smartiz directly (recommended for personal machines)
○ Yes — set a 4-digit PIN to protect my data

If yes:  PIN: [  ] [  ] [  ] [  ]      Confirm: [  ] [  ] [  ] [  ]

                    [← Back]            [Finish setup →]
```

**After setup:**
- Profile data is saved to the local (encrypted) database
- API keys are saved to the OS keychain immediately — never written to disk as plaintext
- PIN (if set) is stored as a bcrypt hash
- The onboarding screens are never shown again
- User lands directly in the Writing room (new chat)

---

*End of Smartiz Refactor Specification v1.0*
