# Milestone M13 — Translator Page: Full Overhaul

> **Adds to:** CoverCraft AI — Full Engineering Roadmap v1.2 + Smartiz Refactor Spec v1.0  
> **Milestone:** M13 — Translator Page: Collapsible Sidebar, Chapter Engine, Book-Quality Layout  
> **Depends on:** M0, M1, M3, M7, M9, M11, M12  
> **Estimated build time:** 4–5 developer days  
> **Screenshot reference:** `Screenshot_2026-05-25_at_22_00_28.png`  
> **Goal:** Fix every visual, functional, and structural issue in the Translator screen. The final result must feel like reading a professionally typeset book — with collapsible navigation, correct chapter detection, proper content formatting (headings, code blocks, callouts), and a translation layout that mirrors the original document's structure.

---

## Table of Contents

1. [Screen Audit — All Issues Found](#1-screen-audit--all-issues-found)
2. [New Layout Architecture](#2-new-layout-architecture)
3. [M13.1 — Collapsible App Sidebar](#m131--collapsible-app-sidebar)
4. [M13.2 — Header Bar Fixes](#m132--header-bar-fixes)
5. [M13.3 — Chapter Engine — Detection & Structure](#m133--chapter-engine--detection--structure)
6. [M13.4 — Chapter Panel (Left Rail)](#m134--chapter-panel-left-rail)
7. [M13.5 — Pagination Bar Fixes](#m135--pagination-bar-fixes)
8. [M13.6 — Translation Panel — Book-Quality Layout](#m136--translation-panel--book-quality-layout)
9. [M13.7 — Content Formatter — Titles, Code, Callouts](#m137--content-formatter--titles-code-callouts)
10. [M13.8 — In-Panel Navigation Arrows](#m138--in-panel-navigation-arrows)
11. [M13.9 — Logo Fix (Global)](#m139--logo-fix-global)
12. [M13.10 — Backend: Chapter Detection Service Rewrite](#m1310--backend-chapter-detection-service-rewrite)
13. [M13.11 — State Management](#m1311--state-management)
14. [M13.12 — Database Changes](#m1312--database-changes)
15. [M13.13 — Testing Checklist](#m1313--testing-checklist)
16. [Build Order & Estimates](#build-order--estimates)
17. [Deliverable Checklist](#deliverable-checklist)

---

## 1. Screen Audit — All Issues Found

> Based on `Screenshot_2026-05-25_at_22_00_28.png`. Every issue below must be resolved before M13 is complete.

### 1.1 Sidebar & Navigation

| # | Issue | Severity | Fix Reference |
|---|---|---|---|
| S1 | The main app sidebar (Writing room, Settings, Tools) stays open while using the Translator — it consumes ~188px of horizontal space that should go to the reading area | Critical | M13.1 |
| S2 | There is no way to hide or toggle the app sidebar when in a full-screen tool like Translator | Critical | M13.1 |
| S3 | When the sidebar is hidden, the chapter panel should expand to fill the left space, giving the book more horizontal room | High | M13.1 + M13.4 |
| S4 | The logo/brand mark is still broken (`[Smartiz]` as image fallback text) across all screens | High | M13.9 |

### 1.2 Header Bar

| # | Issue | Severity | Fix Reference |
|---|---|---|---|
| H1 | The book filename `C#_13_Programming_Essentials_NET_9_Edition_Learn_C#_and_NET_9_Programming.pdf` is displayed in full — it overflows the header width on any window size | Critical | M13.2 |
| H2 | No truncation strategy — the filename needs smart middle-truncation (`C#_13_Programming…NET_9_Programming.pdf`) so both ends are visible | High | M13.2 |
| H3 | The header shows `Chapter 15 of 15` but the book has 602 pages spread across what should be many more chapters — the chapter count is wrong because of the chapter detection bug | Critical | M13.3 |
| H4 | `Page 26 of 602 (Absolute: 39)` — the `(Absolute: 39)` parenthetical is a debug value, not user-facing copy | Medium | M13.2 |
| H5 | `Target: Persian (RTL)` is shown in a plain text string — should be a styled language badge with RTL/LTR indicator | Low | M13.2 |

### 1.3 Chapter Detection — Root Bug

| # | Issue | Severity | Fix Reference |
|---|---|---|---|
| C1 | **The chapter detection algorithm is fundamentally broken.** The panel shows 15 chapters for a 602-page book. Looking at the entries: "Creating an Example C# App (pages 8–8, 1 sheet)", "C# Variables and Constants (pages 9–9, 1 sheet)" — every "chapter" is exactly 1 page. This means the TOC entries are being treated as individual chapters instead of the actual book structure. | Critical | M13.3 |
| C2 | The last entry "C# Delegates (pages 14–615, 602 sheets)" is the entire book body dumped into a single chapter — everything that isn't a TOC entry gets grouped into one bucket | Critical | M13.3 |
| C3 | Table of contents pages (the index listing at the start of the book) are being parsed as chapter titles, producing false 1-page "chapters" for each TOC entry | Critical | M13.3 |
| C4 | There is no distinction between a TOC entry (which is just a reference) and an actual chapter start (which is a page with a heading) | Critical | M13.3 |
| C5 | The `✓` checkmark indicators on chapters in the current screenshot appear randomly — they don't reflect actual translation completion state | Medium | M13.4 |

### 1.4 Translation Panel Layout

| # | Issue | Severity | Fix Reference |
|---|---|---|---|
| T1 | Translation text is displayed as raw paragraph text with no structural formatting — headings appear as bold inline text, code samples appear as plain monospace text without syntax highlighting or a code editor style | Critical | M13.6 + M13.7 |
| T2 | The section heading "۳.۲ زبان میانی مشترک" (CIL) appears correctly centered and bold, but subsection and body text lose all hierarchy — everything renders at the same weight | High | M13.7 |
| T3 | Technical terms like `CIL`, `Visual Basic`, `Python`, `PowerShell`, `COBOL`, `C++` are shown in colored inline tags — but this is inconsistent and the styling is ad hoc, not based on a content parser | Medium | M13.7 |
| T4 | Code sample indicators in the original book (`CLI` button labels, inline code references) are not rendered as code elements — they appear as plain text or random colored spans | High | M13.7 |
| T5 | No horizontal reading constraints — the RTL Persian text spans the full panel width, making long lines unreadable (ideal max-width for body text: 680px at any language) | High | M13.6 |
| T6 | No distinction between the original PDF's content types: body paragraph, chapter heading (H1), section heading (H2), subsection (H3), inline code, code block, callout box, figure caption | High | M13.7 |
| T7 | The heading "( CIL" at the top of the panel has a broken parenthesis — the LLM is not cleaning up PDF extraction artifacts | Medium | M13.10 |

---

## 2. New Layout Architecture

### Three-panel layout with collapsible sidebar

```
BEFORE (current — wasted space):
┌──────────────┬──────────────┬──────────────────────────────────────┐
│  APP SIDEBAR │  CHAPTERS    │  TRANSLATION PANEL                   │
│  188px fixed │  250px fixed │  remaining width (~840px on 1280px)  │
└──────────────┴──────────────┴──────────────────────────────────────┘

AFTER (sidebar collapsed — maximum reading space):
┌────┬──────────────┬──────────────────────────────────────────────┐
│ ⟨  │  CHAPTERS    │  TRANSLATION PANEL                           │
│28px│  240px       │  remaining width (~1008px on 1280px)         │
└────┴──────────────┴──────────────────────────────────────────────┘
     ↑ collapsed sidebar = thin icon rail only

AFTER (sidebar expanded):
┌──────────────────────┬──────────────┬────────────────────────────┐
│  APP SIDEBAR         │  CHAPTERS    │  TRANSLATION PANEL         │
│  188px (slides in)   │  240px       │  remaining width           │
└──────────────────────┴──────────────┴────────────────────────────┘
```

### Layout CSS

```css
/* Translator page root grid */
.translator-layout {
  display: grid;
  /* Columns: [toggle rail] [chapter panel] [translation panel] */
  grid-template-columns: 28px 240px 1fr;
  height: 100vh;
  overflow: hidden;
  transition: grid-template-columns 0.22s ease;
}

/* When app sidebar is open, insert it before the toggle rail */
.translator-layout.sidebar-open {
  grid-template-columns: 188px 28px 240px 1fr;
}

/* Chapter panel expands when sidebar collapses */
.translator-layout.sidebar-collapsed .chapter-panel {
  /* 240px is the default — no change needed, grid handles it */
}

/* The translation panel always takes remaining space */
.translation-panel {
  overflow-y: auto;
  min-width: 0;   /* critical — prevents content from pushing grid */
}
```

---

## M13.1 — Collapsible App Sidebar

### Toggle mechanism

The app sidebar must be hideable from within any full-screen tool (Translator, Merge PDFs). A thin toggle rail replaces it when hidden.

```tsx
// renderer/src/components/layout/SidebarToggleRail.tsx
interface SidebarToggleRailProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function SidebarToggleRail({ isOpen, onToggle }: SidebarToggleRailProps) {
  return (
    <div
      className="sidebar-toggle-rail"
      onClick={onToggle}
      title={isOpen ? 'Hide sidebar (⌘\\)' : 'Show sidebar (⌘\\)'}
      role="button"
      aria-label={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
    >
      {/* Chevron icon flips direction */}
      <svg
        width="14" height="14" viewBox="0 0 14 14" fill="none"
        className={`toggle-chevron ${isOpen ? 'open' : 'closed'}`}
      >
        <path
          d={isOpen ? 'M9 2L4 7L9 12' : 'M5 2L10 7L5 12'}
          stroke="currentColor" strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
```

```css
.sidebar-toggle-rail {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 100%;
  background: var(--bg-app);
  border-right: 0.5px solid var(--border);
  cursor: pointer;
  color: var(--text-hint);
  transition: color 0.15s, background 0.15s;
  flex-shrink: 0;
}

.sidebar-toggle-rail:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

/* Chevron transition */
.toggle-chevron {
  transition: transform 0.2s ease;
}
```

### Keyboard shortcut

```tsx
// renderer/src/hooks/useSidebarToggle.ts
export function useSidebarToggle() {
  const [isOpen, setIsOpen] = useLocalStorage('sidebar-open', true);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        setIsOpen(v => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return { isOpen, toggle: () => setIsOpen(v => !v) };
}
```

### Sidebar slide animation

```css
/* App sidebar slides in/out smoothly */
.app-sidebar {
  width: 188px;
  overflow: hidden;
  transition: width 0.22s ease, opacity 0.2s ease;
  flex-shrink: 0;
}

.app-sidebar.collapsed {
  width: 0;
  opacity: 0;
  pointer-events: none;
}
```

**Persistence:** The sidebar open/closed state is persisted in `localStorage` per screen. The Translator page defaults to collapsed on first use (maximizing reading space). Writing room defaults to open.

---

## M13.2 — Header Bar Fixes

### Full header specification

```tsx
// renderer/src/components/translator/TranslatorHeader.tsx

export function TranslatorHeader({
  filename,
  targetLanguage,
  isRTL,
  currentChapterIndex,
  totalChapters,
  currentPage,
  totalPages,
  onExport,
  onClose,
}: Props) {

  // Smart filename truncation (fix H1, H2)
  const truncatedName = smartTruncate(filename, 52);

  return (
    <div className="translator-header">
      <div className="header-left">
        {/* Truncated filename — tooltip shows full name */}
        <span className="header-filename" title={filename}>
          {truncatedName}
        </span>
        <span className="header-divider">—</span>
        <span className="header-chapter-title">
          {/* Dynamic chapter title from active chapter */}
        </span>
      </div>

      <div className="header-meta">
        {/* Language badge (fix H5) */}
        <span className={`lang-badge ${isRTL ? 'rtl' : 'ltr'}`}>
          {isRTL && <span className="rtl-indicator">RTL</span>}
          {targetLanguage}
        </span>
        {/* Chapter position (fix H3) */}
        <span className="header-position">
          Chapter {currentChapterIndex + 1} of {totalChapters}
        </span>
        {/* Page position — no debug "Absolute" value (fix H4) */}
        <span className="header-position">
          Page {currentPage} of {totalPages}
        </span>
      </div>

      <div className="header-actions">
        <button className="export-btn" onClick={onExport}>
          ↓ Export Chapter PDF
        </button>
        <button className="close-btn" onClick={onClose} aria-label="Close translator">
          ✕
        </button>
      </div>
    </div>
  );
}

// Smart middle-truncation (fix H1, H2)
function smartTruncate(name: string, maxChars: number): string {
  if (name.length <= maxChars) return name;
  const half = Math.floor((maxChars - 3) / 2);
  return name.slice(0, half) + '…' + name.slice(name.length - half);
}
// Example: "C#_13_Programming_Essentials_NET_9_…ET_9_Programming.pdf"
```

```css
.translator-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 20px;
  height: 44px;
  background: var(--bg-app);
  border-bottom: 0.5px solid var(--border-strong);
  flex-shrink: 0;
  overflow: hidden;   /* critical — prevents any child from blowing out the row */
}

.header-filename {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 380px;   /* never wider than this — rest of header needs space */
  cursor: default;
}

.header-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  margin-left: auto;
}

.header-position {
  font-size: 11px;
  color: var(--text-hint);
  white-space: nowrap;
}

.lang-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--bg-sidebar);
  border: 0.5px solid var(--border);
  color: var(--text-muted);
  white-space: nowrap;
}

.rtl-indicator {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.5px;
  color: var(--accent);
}
```

---

## M13.3 — Chapter Engine — Detection & Structure Rewrite

### Root cause analysis of C1–C4

The current implementation reads the PDF's outline/bookmark data (or TOC text) and treats **each TOC line as a chapter**. This produces:
- 1-page "chapters" per TOC entry
- One giant catch-all chapter for the book body
- No actual detection of where chapters start in the text

### The correct approach: two-pass detection

```
PASS 1 — Read PDF structural metadata
  ↓ fitz.get_toc() → list of [level, title, page_number]
  This gives us the INTENDED structure, but many PDFs have inaccurate or missing bookmarks.

PASS 2 — Verify against actual page content
  For each chapter start page from Pass 1:
    → Read the page text
    → Confirm it contains a heading that matches the chapter title
    → If not found, scan ±3 pages to find the actual chapter start
  
  For PDFs with no TOC metadata:
    → Scan all pages for heading patterns (large font, short line, numbered section)
    → Group consecutive body pages under the nearest heading
```

### Python implementation

```python
# sidecar/services/chapter_detector.py

import fitz
import re
from dataclasses import dataclass
from typing import Optional

@dataclass
class Chapter:
    index: int
    title: str
    level: int            # 1 = top-level chapter, 2 = section, 3 = subsection
    page_start: int       # 0-based PDF page index
    page_end: int         # 0-based, inclusive
    page_count: int
    is_toc_page: bool = False   # True if this is the table-of-contents listing itself

def detect_chapters(pdf_path: str) -> tuple[list[Chapter], set[int]]:
    """
    Returns:
        chapters: list of real content chapters (TOC listing pages excluded)
        toc_page_indices: set of page indices that ARE the table of contents
    """
    doc = fitz.open(pdf_path)
    total_pages = len(doc)

    # ── PASS 1: Get TOC from PDF metadata ──
    raw_toc = doc.get_toc()   # [[level, title, page_1based], ...]

    # ── IDENTIFY TOC LISTING PAGES ──
    # These are pages that ARE the table of contents, not content pages.
    # Heuristic: a page where >40% of lines end with a page number
    toc_page_indices: set[int] = set()
    for i in range(min(total_pages, 20)):  # TOC is always in first ~20 pages
        page = doc[i]
        text = page.get_text()
        lines = [l.strip() for l in text.splitlines() if l.strip()]
        if not lines:
            continue
        # Lines ending with a number (after optional dots/spaces)
        numeric_tail = sum(1 for l in lines if re.search(r'[\.\s]+\d{1,4}\s*$', l))
        if len(lines) >= 4 and numeric_tail / len(lines) > 0.40:
            toc_page_indices.add(i)

    if not raw_toc:
        # ── PASS 2A: No metadata — scan pages for heading patterns ──
        chapters = _detect_chapters_by_content(doc, toc_page_indices)
    else:
        # ── PASS 2B: Metadata exists — validate and build chapters ──
        chapters = _build_chapters_from_toc(doc, raw_toc, toc_page_indices, total_pages)

    # Final guard: merge any chapter with page_count == 0
    chapters = [c for c in chapters if c.page_count > 0]

    return chapters, toc_page_indices


def _build_chapters_from_toc(
    doc: fitz.Document,
    raw_toc: list,
    toc_page_indices: set[int],
    total_pages: int,
) -> list[Chapter]:
    """Build chapters from PDF metadata TOC, skipping TOC listing pages."""
    # Filter to level-1 entries only (top-level chapters)
    # Level-2+ (sections/subsections) are grouped under their parent chapter
    top_level = [entry for entry in raw_toc if entry[0] == 1]

    if not top_level:
        # Fall back to all levels if no level-1 entries
        top_level = raw_toc

    chapters = []
    for i, (level, title, page_1based) in enumerate(top_level):
        page_start = page_1based - 1  # convert to 0-based

        # Skip if this page falls within the TOC listing section
        if page_start in toc_page_indices:
            continue

        # Determine page_end: start of next chapter - 1, or end of doc
        if i + 1 < len(top_level):
            next_start = top_level[i + 1][2] - 1
            page_end = next_start - 1
        else:
            page_end = total_pages - 1

        # Sanity check: must have at least 1 page
        if page_end < page_start:
            page_end = page_start

        chapters.append(Chapter(
            index=len(chapters),
            title=_clean_title(title),
            level=level,
            page_start=page_start,
            page_end=page_end,
            page_count=page_end - page_start + 1,
        ))

    return chapters


def _detect_chapters_by_content(
    doc: fitz.Document,
    toc_page_indices: set[int],
) -> list[Chapter]:
    """
    Fallback: scan page text for heading patterns when PDF has no metadata TOC.
    A heading is identified by:
    - Short line (< 80 chars)
    - Followed by body text
    - Optionally preceded by a chapter/section number pattern
    """
    chapter_starts = []
    total_pages = len(doc)

    for i in range(total_pages):
        if i in toc_page_indices:
            continue

        page = doc[i]
        blocks = page.get_text("blocks")  # [(x0,y0,x1,y1,text,block_no,block_type)]

        if not blocks:
            continue

        # Get first meaningful text block
        for block in blocks:
            text = block[4].strip()
            if not text or len(text) < 3:
                continue

            # Heading patterns:
            # "Chapter 3 — Variables"
            # "3.2 Common Language"
            # "CHAPTER THREE"
            is_heading = (
                len(text) < 80 and
                '\n' not in text and
                (
                    re.match(r'^(Chapter|CHAPTER|Section|SECTION)\s+\d', text) or
                    re.match(r'^\d+[\.\d]*\s+[A-ZÀ-Ö\u0600-\u06FF]', text) or
                    (text.isupper() and len(text) > 4 and len(text) < 60)
                )
            )

            if is_heading:
                chapter_starts.append((i, text))
            break  # Only check the first text block per page

    # Build chapters from detected starts
    chapters = []
    for idx, (page_start, title) in enumerate(chapter_starts):
        page_end = chapter_starts[idx + 1][0] - 1 if idx + 1 < len(chapter_starts) else total_pages - 1
        if page_end < page_start:
            page_end = page_start
        chapters.append(Chapter(
            index=idx,
            title=_clean_title(title),
            level=1,
            page_start=page_start,
            page_end=page_end,
            page_count=page_end - page_start + 1,
        ))

    # If still nothing found, treat entire book as one chapter
    if not chapters:
        chapters.append(Chapter(
            index=0,
            title="Full Document",
            level=1,
            page_start=0,
            page_end=total_pages - 1,
            page_count=total_pages,
        ))

    return chapters


def _clean_title(title: str) -> str:
    """Remove PDF extraction artifacts from chapter titles."""
    # Remove leading/trailing whitespace and control characters
    title = title.strip()
    # Remove stray parentheses at start/end: "( CIL" → "CIL"
    title = re.sub(r'^[\(\[\s]+', '', title)
    title = re.sub(r'[\)\]\s]+$', '', title)
    # Normalize multiple spaces
    title = re.sub(r'\s{2,}', ' ', title)
    return title
```

### Expected result for the C# book example

**Before (broken):**
```
Chapter 1: Creating an Example C# App   (pages 8–8,   1 page)
Chapter 2: C# Variables and Constants   (pages 9–9,   1 page)
...
Chapter 15: C# Delegates               (pages 14–615, 602 pages)
```

**After (correct):**
```
Chapter 1:  Getting Started             (pages 1–22,   22 pages)
Chapter 2:  C# Fundamentals            (pages 23–58,  36 pages)
Chapter 3:  Variables and Constants     (pages 59–94,  36 pages)
Chapter 4:  Operators and Expressions   (pages 95–130, 36 pages)
...
Chapter 15: Delegates and Events        (pages 561–615, 55 pages)
```

---

## M13.4 — Chapter Panel (Left Rail)

### Full visual specification

```tsx
// renderer/src/components/translator/ChapterPanel.tsx

interface ChapterPanelProps {
  chapters: Chapter[];
  activeChapterIndex: number;
  onChapterSelect: (index: number) => void;
  translationProgress: Record<number, 'none' | 'partial' | 'complete'>;
}

export function ChapterPanel({
  chapters,
  activeChapterIndex,
  onChapterSelect,
  translationProgress,
}: ChapterPanelProps) {
  return (
    <aside className="chapter-panel">
      <div className="chapter-panel-header">
        <span className="chapter-panel-title">Chapters</span>
        <span className="chapter-count">{chapters.length}</span>
      </div>

      <div className="chapter-list">
        {chapters.map((chapter, i) => {
          const progress = translationProgress[i] ?? 'none';
          const isActive = i === activeChapterIndex;

          return (
            <button
              key={chapter.index}
              className={`chapter-item ${isActive ? 'active' : ''} progress-${progress}`}
              onClick={() => onChapterSelect(i)}
            >
              <div className="chapter-item-body">
                <span className="chapter-item-title">{chapter.title}</span>
                <span className="chapter-item-meta">
                  pages {chapter.page_start + 1}–{chapter.page_end + 1}
                </span>
              </div>
              <div className="chapter-item-indicator">
                {progress === 'complete' && <span className="indicator-check">✓</span>}
                {progress === 'partial'  && <span className="indicator-partial">◑</span>}
                {progress === 'none'     && <span className="indicator-empty" />}
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
```

```css
.chapter-panel {
  display: flex;
  flex-direction: column;
  width: 240px;
  flex-shrink: 0;
  background: var(--bg-sidebar);
  border-right: 0.5px solid var(--border-strong);
  height: 100%;
  overflow: hidden;
}

.chapter-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px 10px;
  border-bottom: 0.5px solid var(--border);
  flex-shrink: 0;
}

.chapter-panel-title {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  color: var(--text-hint);
}

.chapter-count {
  font-size: 10px;
  color: var(--text-hint);
  background: var(--bg-hover);
  padding: 1px 6px;
  border-radius: 8px;
}

.chapter-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px 0;
}

/* Chapter item */
.chapter-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px 9px 16px;
  background: none;
  border: none;
  border-left: 2px solid transparent;  /* reserve space — no layout shift on active */
  cursor: pointer;
  text-align: left;
  transition: background 0.12s;
}

.chapter-item:hover {
  background: var(--bg-hover);
}

/* Active chapter — MUST be unambiguous */
.chapter-item.active {
  background: rgba(192, 57, 43, 0.07);
  border-left-color: var(--accent);
}

.chapter-item-body {
  flex: 1;
  min-width: 0;
}

.chapter-item-title {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
}

.chapter-item.active .chapter-item-title {
  color: var(--accent);
}

.chapter-item-meta {
  display: block;
  font-size: 10.5px;
  color: var(--text-hint);
  margin-top: 1px;
}

/* Progress indicators */
.indicator-check   { color: var(--green); font-size: 11px; }
.indicator-partial { color: var(--text-hint); font-size: 11px; }
.indicator-empty   { 
  display: inline-block;
  width: 7px; height: 7px;
  border-radius: 50%;
  border: 1px solid var(--border-strong);
}
```

---

## M13.5 — Pagination Bar Fixes

The current pagination shows every page number in a single scrollable row. This is already documented in the Smartiz Refactor Spec (Section 3, Issue 2) and the M11 roadmap. This milestone enforces those specs and adds the missing implementation detail.

### Pagination component (complete implementation)

```tsx
// renderer/src/components/translator/PaginationBar.tsx

interface PaginationBarProps {
  currentPage: number;           // 1-based, within current chapter
  totalPages: number;            // total pages in current chapter
  onPageChange: (page: number) => void;
}

export function PaginationBar({ currentPage, totalPages, onPageChange }: PaginationBarProps) {
  const [inputValue, setInputValue] = useState(String(currentPage));
  const WINDOW = 7;  // pages shown on each side of current

  // Sync input when page changes externally
  useEffect(() => { setInputValue(String(currentPage)); }, [currentPage]);

  const handleInputCommit = () => {
    const n = parseInt(inputValue, 10);
    if (!isNaN(n) && n >= 1 && n <= totalPages) {
      onPageChange(n);
    } else {
      setInputValue(String(currentPage));  // reset invalid input
    }
  };

  // Build the visible page window
  const pages = buildPageWindow(currentPage, totalPages, WINDOW);

  return (
    <div className="pagination-bar">
      {/* Prev arrow */}
      <button
        className="page-arrow"
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage <= 1}
        aria-label="Previous page"
      >
        ◀
      </button>

      {/* Page number window */}
      <div className="page-window">
        {pages.map((entry, i) => {
          if (entry === '...') {
            return <span key={`ellipsis-${i}`} className="page-ellipsis">…</span>;
          }
          const pageNum = entry as number;
          return (
            <button
              key={pageNum}
              className={`page-pill ${pageNum === currentPage ? 'active' : ''}`}
              onClick={() => onPageChange(pageNum)}
            >
              {pageNum}
            </button>
          );
        })}
      </div>

      {/* Jump-to input */}
      <div className="page-jump">
        <span className="page-jump-label">Page</span>
        <input
          className="page-jump-input"
          type="text"
          inputMode="numeric"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onBlur={handleInputCommit}
          onKeyDown={e => { if (e.key === 'Enter') handleInputCommit(); }}
          aria-label="Jump to page"
        />
        <span className="page-jump-label">of {totalPages}</span>
      </div>

      {/* Next arrow */}
      <button
        className="page-arrow"
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage >= totalPages}
        aria-label="Next page"
      >
        ▶
      </button>
    </div>
  );
}

/**
 * Build the visible page pill array with ellipsis markers.
 * Always shows: first page, last page, current±window, ellipsis where needed.
 */
function buildPageWindow(current: number, total: number, halfWindow: number): (number | '...')[] {
  if (total <= halfWindow * 2 + 3) {
    // Small enough to show all pages
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const result: (number | '...')[] = [];
  const lo = Math.max(2, current - halfWindow);
  const hi = Math.min(total - 1, current + halfWindow);

  result.push(1);
  if (lo > 2) result.push('...');
  for (let p = lo; p <= hi; p++) result.push(p);
  if (hi < total - 1) result.push('...');
  result.push(total);

  return result;
}
```

```css
.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 20px;
  border-bottom: 0.5px solid var(--border);
  background: var(--bg-app);
  flex-shrink: 0;
}

.page-arrow {
  width: 28px;
  height: 28px;
  border: 0.5px solid var(--border-strong);
  border-radius: 6px;
  background: var(--bg-surface);
  color: var(--text-muted);
  cursor: pointer;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.page-arrow:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.page-window {
  display: flex;
  align-items: center;
  gap: 3px;
}

.page-pill {
  min-width: 28px;
  height: 28px;
  padding: 0 6px;
  border-radius: 5px;
  border: none;
  background: none;
  font-size: 12px;
  color: var(--text-muted);
  cursor: pointer;
  transition: background 0.1s;
}

.page-pill:hover { background: var(--bg-hover); }

.page-pill.active {
  background: var(--text-primary);
  color: var(--bg-app);
  font-weight: 500;
}

.page-ellipsis {
  font-size: 12px;
  color: var(--text-hint);
  padding: 0 2px;
}

.page-jump {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: 12px;
  padding-left: 12px;
  border-left: 0.5px solid var(--border);
}

.page-jump-label {
  font-size: 11px;
  color: var(--text-hint);
  white-space: nowrap;
}

.page-jump-input {
  width: 44px;
  height: 26px;
  text-align: center;
  font-size: 12px;
  border: 0.5px solid var(--border-strong);
  border-radius: 5px;
  background: var(--bg-surface);
  color: var(--text-primary);
  outline: none;
}

.page-jump-input:focus {
  border-color: var(--text-primary);
}
```

---

## M13.6 — Translation Panel — Book-Quality Layout

### The translation panel must look like a typeset book, not a chat response

```tsx
// renderer/src/components/translator/TranslationPanel.tsx

export function TranslationPanel({
  content,        // parsed ContentBlock[]
  isRTL,
  isLoading,
  error,
  onRetry,
}: Props) {
  return (
    <div className={`translation-panel ${isRTL ? 'rtl' : 'ltr'}`}>

      {/* Loading state — skeleton shimmer */}
      {isLoading && <TranslationSkeleton isRTL={isRTL} />}

      {/* Error state */}
      {error && !isLoading && (
        <div className="translation-error">
          <span>{error}</span>
          <button onClick={onRetry}>Retry this page</button>
        </div>
      )}

      {/* Rendered content */}
      {!isLoading && !error && content && (
        <article className="book-article">
          {content.map((block, i) => (
            <ContentBlock key={i} block={block} isRTL={isRTL} />
          ))}
        </article>
      )}

      {/* In-panel navigation arrows (see M13.8) */}
      <InPanelNavArrows />
    </div>
  );
}
```

```css
/* Translation panel outer container */
.translation-panel {
  flex: 1;
  overflow-y: auto;
  background: var(--bg-surface);
  position: relative;
}

/* The readable article — NEVER full width */
.book-article {
  max-width: 720px;
  margin: 0 auto;
  padding: 48px 40px 80px;

  /* Typography base */
  font-family: var(--font-serif);
  font-size: 16px;
  line-height: 1.75;
  color: var(--text-primary);
}

/* RTL articles */
.rtl .book-article {
  direction: rtl;
  font-family: 'Vazirmatn', 'Tahoma', var(--font-serif);
  font-size: 16.5px;   /* slightly larger for Persian comfort */
  line-height: 1.9;
  text-align: justify;
}
```

---

## M13.7 — Content Formatter — Titles, Code, Callouts

### The LLM translation output must preserve document structure

The LLM must be prompted to return structured JSON, not plain translated text. The frontend then renders each block type with the appropriate component.

### Backend: Structured translation prompt

```python
# sidecar/prompts/translate_page.txt

You are a professional technical translator. Translate the following page content into {target_language}.

CRITICAL RULES:
1. Preserve ALL structural elements exactly: headings, subheadings, code blocks, inline code, lists, callouts.
2. Do NOT translate: code, programming language keywords, technical identifiers, variable names, class names, method names, file paths, URLs.
3. Return ONLY a JSON array of content blocks. No markdown, no extra text, no explanation.
4. Clean PDF extraction artifacts: remove stray parentheses, fix broken hyphenation, normalize spacing.

Block types to use:
- "h1": main chapter heading
- "h2": section heading  
- "h3": subsection heading
- "paragraph": regular body text
- "code_block": multi-line code sample (preserve original language, do not translate)
- "inline_code": short inline code reference within a paragraph — keep as-is
- "callout": note/warning/tip box (translate the label and content)
- "list": bullet or numbered list
- "figure_caption": caption under a figure or table
- "page_break_hint": explicit page break in the original

Output format example:
[
  {"type": "h2", "content": "۳.۲ زبان میانی مشترک"},
  {"type": "paragraph", "content": "برخلاف کامپایلرهای C و ++C که کد منبع را به کد ماشین..."},
  {"type": "code_block", "language": "csharp", "content": "public class Program {\n    static void Main() { }\n}"},
  {"type": "callout", "label": "نکته", "variant": "info", "content": "این ویژگی فقط در NET 9 موجود است."},
  {"type": "list", "ordered": false, "items": ["Visual Basic", "Python", "PowerShell", "COBOL", "C++"]}
]

PAGE CONTENT TO TRANSLATE:
---
{page_text}
---
```

### Frontend: ContentBlock renderer

```tsx
// renderer/src/components/translator/ContentBlock.tsx

type BlockType =
  | { type: 'h1' | 'h2' | 'h3'; content: string }
  | { type: 'paragraph'; content: string }
  | { type: 'code_block'; language: string; content: string }
  | { type: 'inline_code'; content: string }
  | { type: 'callout'; label: string; variant: 'info' | 'warning' | 'tip'; content: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'figure_caption'; content: string };

export function ContentBlock({ block, isRTL }: { block: BlockType; isRTL: boolean }) {
  switch (block.type) {
    case 'h1':
      return <h1 className="book-h1">{block.content}</h1>;

    case 'h2':
      return <h2 className="book-h2">{block.content}</h2>;

    case 'h3':
      return <h3 className="book-h3">{block.content}</h3>;

    case 'paragraph':
      // Parse inline code markers within paragraph text
      return <p className="book-p" dangerouslySetInnerHTML={{ __html: parseInlineCode(block.content) }} />;

    case 'code_block':
      return <CodeBlock language={block.language} code={block.content} />;

    case 'callout':
      return (
        <div className={`book-callout callout-${block.variant}`}>
          <span className="callout-label">{block.label}</span>
          <p className="callout-body">{block.content}</p>
        </div>
      );

    case 'list':
      const ListTag = block.ordered ? 'ol' : 'ul';
      return (
        <ListTag className="book-list">
          {block.items.map((item, i) => <li key={i}>{item}</li>)}
        </ListTag>
      );

    case 'figure_caption':
      return <p className="book-caption">{block.content}</p>;

    default:
      return null;
  }
}

// Parse **inline_code** markers in paragraph text → <code> tags
// LLM wraps inline code in backticks: "use `CIL` to..." → "use <code>CIL</code> to..."
function parseInlineCode(text: string): string {
  // Security: escape HTML first, then render backtick code
  const escaped = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped.replace(/`([^`]+)`/g, '<code class="book-inline-code">$1</code>');
}
```

### Code block component (exactly like a code editor)

```tsx
// renderer/src/components/translator/CodeBlock.tsx

export function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const highlighted = hljs.highlight(code, { language, ignoreIllegals: true }).value;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="book-code-block">
      <div className="code-editor-header">
        <div className="code-editor-dots" aria-hidden>
          {/* macOS-style window dots — purely decorative */}
          <span className="dot dot-red" />
          <span className="dot dot-yellow" />
          <span className="dot dot-green" />
        </div>
        <span className="code-editor-lang">{language}</span>
        <button className="code-editor-copy" onClick={handleCopy}>
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <pre className="code-editor-body">
        <code
          className={`hljs language-${language}`}
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      </pre>
    </div>
  );
}
```

```css
/* Book typography styles */

.book-h1 {
  font-family: var(--font-serif);
  font-size: 28px;
  font-weight: 600;
  margin: 48px 0 20px;
  padding-bottom: 12px;
  border-bottom: 0.5px solid var(--border);
  color: var(--text-primary);
  letter-spacing: -0.5px;
  line-height: 1.2;
}

.book-h2 {
  font-family: var(--font-serif);
  font-size: 21px;
  font-weight: 600;
  margin: 36px 0 14px;
  color: var(--text-primary);
  letter-spacing: -0.2px;
}

.book-h3 {
  font-family: var(--font-sans);
  font-size: 16px;
  font-weight: 600;
  margin: 28px 0 10px;
  color: var(--text-primary);
}

.book-p {
  margin: 0 0 16px;
  font-size: 16px;
  line-height: 1.75;
  color: var(--text-primary);
}

/* Inline code — styled like a code badge, not colored text */
.book-inline-code {
  font-family: var(--code-font, 'JetBrains Mono', monospace);
  font-size: 13.5px;
  background: var(--bg-sidebar);
  border: 0.5px solid var(--border-strong);
  border-radius: 4px;
  padding: 1px 5px;
  color: var(--accent);
}

/* Code block — full code-editor treatment */
.book-code-block {
  margin: 24px 0;
  border-radius: var(--radius-md);
  border: 0.5px solid var(--border-strong);
  overflow: hidden;
  /* Intentionally LTR even in RTL articles — code is always LTR */
  direction: ltr;
  text-align: left;
}

.code-editor-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: #1E1E2E;    /* dark editor header — always dark regardless of app theme */
  border-bottom: 0.5px solid rgba(255,255,255,0.08);
}

.code-editor-dots {
  display: flex;
  gap: 5px;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.dot-red    { background: #FF5F57; }
.dot-yellow { background: #FFBD2E; }
.dot-green  { background: #28C840; }

.code-editor-lang {
  font-size: 11px;
  color: rgba(255,255,255,0.4);
  font-family: var(--font-sans);
  margin-left: 4px;
}

.code-editor-copy {
  margin-left: auto;
  font-size: 11px;
  color: rgba(255,255,255,0.5);
  background: none;
  border: none;
  cursor: pointer;
}

.code-editor-copy:hover {
  color: rgba(255,255,255,0.9);
}

.code-editor-body {
  margin: 0;
  padding: 16px 18px;
  background: #1E1E2E;    /* VS Code dark theme base */
  overflow-x: auto;
  max-height: 480px;
}

.code-editor-body code {
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
  tab-size: 4;
}

/* Callout boxes */
.book-callout {
  margin: 20px 0;
  padding: 14px 18px;
  border-radius: var(--radius-md);
  border-left: 3px solid;
}

.callout-info    { background: #EFF6FF; border-color: #3B82F6; }
.callout-warning { background: #FFFBEB; border-color: #F59E0B; }
.callout-tip     { background: #F0FDF4; border-color: #22C55E; }

/* Dark mode callout overrides */
@media (prefers-color-scheme: dark) {
  .callout-info    { background: rgba(59,130,246,0.1); }
  .callout-warning { background: rgba(245,158,11,0.1); }
  .callout-tip     { background: rgba(34,197,94,0.1);  }
}

.callout-label {
  display: block;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  margin-bottom: 6px;
  color: var(--text-muted);
}

.callout-body {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
}

/* Book list */
.book-list {
  margin: 12px 0 16px 24px;
  padding: 0;
}

.book-list li {
  margin-bottom: 6px;
  font-size: 16px;
  line-height: 1.7;
}

/* Figure caption */
.book-caption {
  font-size: 13px;
  color: var(--text-hint);
  text-align: center;
  font-style: italic;
  margin: 8px 0 24px;
}
```

---

## M13.8 — In-Panel Navigation Arrows

Floating prev/next arrows fixed to the left and right edges of the translation panel. Users can turn pages without scrolling back to the top pagination bar.

```tsx
// renderer/src/components/translator/InPanelNavArrows.tsx

export function InPanelNavArrows({
  currentPage,
  totalPages,
  onPrev,
  onNext,
}: Props) {
  return (
    <>
      {/* Left arrow — previous page */}
      {currentPage > 1 && (
        <button
          className="panel-nav-arrow panel-nav-left"
          onClick={onPrev}
          aria-label="Previous page"
        >
          ◀
        </button>
      )}

      {/* Right arrow — next page */}
      {currentPage < totalPages && (
        <button
          className="panel-nav-arrow panel-nav-right"
          onClick={onNext}
          aria-label="Next page"
        >
          ▶
        </button>
      )}
    </>
  );
}
```

```css
.panel-nav-arrow {
  position: sticky;     /* sticks within the scroll container — no iframe/fixed issues */
  top: 50vh;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 0.5px solid var(--border-strong);
  background: var(--bg-surface);
  color: var(--text-hint);
  cursor: pointer;
  opacity: 0.35;
  transition: opacity 0.2s, background 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  z-index: 10;
  pointer-events: auto;
}

.panel-nav-arrow:hover {
  opacity: 1;
  background: var(--bg-sidebar);
  color: var(--text-primary);
}

.panel-nav-left  { float: left;  margin-left: -50px; }
.panel-nav-right { float: right; margin-right: -50px; }
```

---

## M13.9 — Logo Fix (Global)

This is a global fix that applies to ALL screens, not just the Translator. The broken `[Smartiz]` image placeholder must be replaced everywhere.

**Root cause:** The `<img src="/assets/logo.png">` is failing to load — either the asset path is wrong, the file doesn't exist, or the asset isn't bundled in the Electron build.

**Fix strategy:** Replace the `<img>` entirely with an inline SVG that has zero external dependencies and can never fail to render. This was already specified in M12.1. Apply it globally.

```tsx
// renderer/src/components/shared/LogoMark.tsx
// This component is used in: Sidebar, Translator header, Setup flow, any screen with branding.
// It NEVER uses an <img> tag.

export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 26 26"
      fill="none"
      aria-label="Smartiz"
      role="img"
    >
      <rect width="26" height="26" rx="6" fill="#1A1814" />
      <path
        d="M17 9.5C17 9.5 15.5 8 13 8C10.5 8 9 9.5 9 11C9 12.5 10 13.2 13 14C16 14.8 17 15.5 17 17C17 18.5 15.5 19 13 19C10.5 19 9 17.5 9 17.5"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
```

Apply `<LogoMark />` in every location where `<img src="...logo..." />` currently appears.

---

## M13.10 — Backend: Chapter Detection Service Rewrite

Summary of backend changes required (full implementation in M13.3):

```python
# New/changed endpoints in sidecar/routers/translator.py

# Upload document and detect chapters
POST /api/translator/documents
     body: multipart file
     → { id, filename, total_pages, chapters: Chapter[], toc_page_indices: int[] }

# Re-run chapter detection with custom settings
POST /api/translator/documents/{id}/redetect-chapters
     body: { strategy: 'metadata' | 'content_scan' | 'manual', manual_breaks?: int[] }
     → { chapters: Chapter[] }

# Translate a single page — returns structured JSON blocks (not plain text)
POST /api/translator/documents/{id}/pages/{page_index}/translate
     body: { target_language: string, chapter_index: int }
     → SSE stream of: { type: 'token', content: string } events,
       ending with: { type: 'done', blocks: ContentBlock[] }

# New field: structured_content (JSON ContentBlock[]) stored alongside raw translation
# Migrations: add column to translation cache / Redis value format
```

### Redis cache key format update

Old format stored plain text. New format stores structured JSON:

```python
# OLD
cache_key = f"trans:{doc_id}:{chapter_idx}:{page_idx}:{lang}"
cache_value = "plain translated text string"

# NEW
cache_key = f"trans:v2:{doc_id}:{chapter_idx}:{page_idx}:{lang}"
cache_value = json.dumps({
    "blocks": [...],       # ContentBlock[]
    "raw_text": "...",     # kept for export/search
    "model": "...",
    "translated_at": "...",
})
```

Note: The `v2:` prefix ensures old cached plain-text values are never used by the new renderer.

---

## M13.11 — State Management

```typescript
// renderer/src/store/translatorStore.ts  (Zustand)

interface TranslatorStore {
  // Document
  documentId: string | null;
  filename: string;
  totalPages: number;
  targetLanguage: string;
  isRTL: boolean;

  // Chapters
  chapters: Chapter[];
  activeChapterIndex: number;
  translationProgress: Record<number, 'none' | 'partial' | 'complete'>;

  // Current page
  currentPageInChapter: number;  // 1-based within the active chapter
  currentPageContent: ContentBlock[] | null;
  isTranslating: boolean;
  translationError: string | null;

  // Layout
  isSidebarOpen: boolean;

  // Actions
  loadDocument: (file: File) => Promise<void>;
  selectChapter: (index: number) => void;
  goToPage: (pageInChapter: number) => void;
  goToPreviousPage: () => void;
  goToNextPage: () => void;
  retryCurrentPage: () => void;
  toggleSidebar: () => void;
  exportChapter: (chapterIndex: number) => Promise<void>;
}
```

---

## M13.12 — Database Changes

Add a `structured_content` column to store parsed ContentBlock arrays:

```sql
-- Alembic migration: add_structured_content_to_translation_cache

-- If using SQLite for translation cache (instead of Redis):
ALTER TABLE translator_page_cache
  ADD COLUMN structured_content TEXT;  -- JSON: ContentBlock[]

-- Update translator_documents to track TOC page indices
ALTER TABLE translator_documents
  ADD COLUMN toc_page_indices TEXT;   -- JSON: int[]

-- Update translator_chapters to track detection method
ALTER TABLE translator_chapters
  ADD COLUMN detection_method TEXT DEFAULT 'metadata'; -- 'metadata'|'content_scan'|'manual'
```

---

## M13.13 — Testing Checklist

### Chapter detection tests

```python
# sidecar/tests/test_chapter_detector.py

def test_toc_pages_are_excluded():
    """Pages with >40% numeric-ending lines are not returned as chapters."""

def test_cs_book_produces_more_than_15_chapters():
    """The C# book should detect 10+ chapters, not 15 TOC entries."""

def test_no_single_page_chapters_in_real_book():
    """No chapter should have page_count == 1 unless the book genuinely has 1-page chapters."""

def test_last_chapter_not_entire_book():
    """The last chapter must not contain >70% of total book pages."""

def test_clean_title_removes_artifacts():
    """'( CIL' → 'CIL', ' )Methods' → 'Methods'"""

def test_fallback_when_no_metadata():
    """PDF with no bookmark metadata still produces chapters via content scan."""

def test_full_book_without_toc():
    """Document with no TOC at all is treated as one chapter, not crash."""
```

### Translation rendering tests

```
E2E: Upload C# book PDF
  → Expect: chapters panel shows 10+ entries, no 1-page chapters
  → Expect: "C# Delegates" chapter covers pages 561–615 (not 14–615)
  → Expect: first ~8 pages are NOT shown as chapters (TOC pages excluded)

E2E: Translate page with code sample
  → Expect: code block rendered in dark editor style, not as plain text
  → Expect: code content not translated (language keywords preserved)
  → Expect: copy button works on code block

E2E: Sidebar toggle
  → Expect: ⌘\ collapses sidebar
  → Expect: chapter panel and translation panel expand to fill space
  → Expect: ⌘\ again restores sidebar
  → Expect: sidebar state persists across page navigation

E2E: Header filename
  → Expect: long filename is truncated with middle ellipsis, not overflowing
  → Expect: hovering shows full filename in tooltip

E2E: Pagination jump
  → Expect: typing "50" in page input and pressing Enter jumps to page 50
  → Expect: invalid values are rejected and reset to current page
```

---

## Build Order & Estimates

| Step | Task | Hours |
|---|---|---|
| M13.1 | Collapsible sidebar — toggle rail, CSS animation, keyboard shortcut, persistence | 3h |
| M13.2 | Header bar — smart truncation, clean meta display, lang badge | 2h |
| M13.3 | Chapter detector rewrite — two-pass algorithm, TOC stripping, fallback scan | 6h |
| M13.4 | Chapter panel — hierarchy, progress indicators, active state | 3h |
| M13.5 | Pagination bar — windowed pills, jump input, keyboard nav | 3h |
| M13.6 | Translation panel — book layout, max-width, RTL support | 2h |
| M13.7 | Content formatter — structured prompt, ContentBlock renderer, all block types | 8h |
| M13.8 | In-panel nav arrows — sticky float, opacity, mobile fallback | 1h |
| M13.9 | Logo fix — replace all `<img>` with `<LogoMark />` globally | 1h |
| M13.10 | Backend endpoint updates — structured JSON response, cache v2 | 4h |
| M13.11 | State management — translatorStore additions | 2h |
| M13.12 | DB migrations — structured_content, toc_page_indices columns | 1h |
| M13.13 | Tests — chapter detector unit tests + 5 E2E tests | 4h |
| **Total** | | **~40h / ~5 developer days** |

---

## Deliverable Checklist

Before M13 is considered complete, every item below must pass:

**Sidebar**
- [ ] App sidebar can be collapsed via click on toggle rail
- [ ] App sidebar can be collapsed via `⌘\` keyboard shortcut
- [ ] Collapsed state persists across page navigations
- [ ] When collapsed, chapter panel and translation panel expand to fill the space
- [ ] Sidebar slides in/out with a smooth 220ms animation, no layout flicker

**Header**
- [ ] Long filenames are middle-truncated and never overflow the header
- [ ] Full filename appears on hover as a native tooltip
- [ ] Debug `(Absolute: N)` text is removed from header
- [ ] Language is displayed as a styled badge, not plain text
- [ ] Chapter count reflects actual detected chapters (not TOC entries)

**Chapter Detection**
- [ ] TOC listing pages are excluded from chapter navigation
- [ ] The C# book produces at least 10 distinct chapters
- [ ] No chapter has `page_count == 1` in any real-world multi-hundred-page book
- [ ] The last chapter does not contain more than 70% of total book pages
- [ ] Chapter titles are clean — no leading/trailing parentheses or artifacts
- [ ] Books with no PDF metadata TOC still produce a usable chapter structure

**Translation Layout**
- [ ] Translation text never exceeds `max-width: 720px` — always readable
- [ ] Chapter headings render as `h1/h2/h3` with proper size hierarchy
- [ ] Code samples render in a dark code-editor style with syntax highlighting
- [ ] Code content is never translated — programming identifiers are preserved
- [ ] Inline code references render as `<code>` badges, not colored text
- [ ] Callout boxes (Note / Warning / Tip) render with appropriate border and background
- [ ] Lists render as proper `<ul>/<ol>`, not paragraph text
- [ ] RTL text (Persian/Arabic) uses Vazirmatn font with correct `direction: rtl`

**Navigation**
- [ ] Pagination shows max 15 page numbers with ellipsis, not all pages
- [ ] Jump-to-page input accepts a number, validates it, and jumps correctly
- [ ] Left/right floating arrows appear within the translation panel
- [ ] Floating arrows are semi-transparent at rest and fully visible on hover
- [ ] Keyboard `←`/`→` navigate pages when translation panel is focused

**Logo**
- [ ] The Smartiz logo renders correctly in all screens — no broken image placeholder
- [ ] Logo is an inline SVG — never an external `<img>` reference

---

*M13 — Translator Page. From a broken page viewer to a professional book reader.*
