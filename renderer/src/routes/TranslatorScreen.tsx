import React, { useState, useEffect, useRef } from 'react'
import { useTranslatorStore, TranslatorChapter } from '../store/useTranslatorStore'
import { Icon, ModelPill } from '../components/SharedUI'

interface MarkdownBlock {
  type: 'heading' | 'code' | 'blockquote' | 'list' | 'paragraph';
  level?: number;
  language?: string;
  code?: string;
  blockquoteType?: 'note' | 'tip' | 'warning' | 'caution' | 'general';
  listOrdered?: boolean;
  listItems?: string[];
  text?: string;
}

const parseMarkdown = (text: string): MarkdownBlock[] => {
  if (!text) return [];
  
  const lines = text.split('\n');
  const blocks: MarkdownBlock[] = [];
  let inCodeBlock = false;
  let codeLanguage = '';
  let codeBuffer: string[] = [];
  
  let inBlockquote = false;
  let blockquoteBuffer: string[] = [];
  
  let inList = false;
  let listOrdered = false;
  let listItemsBuffer: string[] = [];

  const flushList = () => {
    if (inList && listItemsBuffer.length > 0) {
      blocks.push({
        type: 'list',
        listOrdered,
        listItems: [...listItemsBuffer]
      });
      listItemsBuffer = [];
      inList = false;
    }
  };

  const flushBlockquote = () => {
    if (inBlockquote && blockquoteBuffer.length > 0) {
      const fullText = blockquoteBuffer.join('\n');
      let blockquoteType: 'note' | 'tip' | 'warning' | 'caution' | 'general' = 'general';
      let cleanText = fullText;

      if (fullText.includes('[!NOTE]')) {
        blockquoteType = 'note';
        cleanText = fullText.replace(/\[!NOTE\]/gi, '').trim();
      } else if (fullText.includes('[!TIP]')) {
        blockquoteType = 'tip';
        cleanText = fullText.replace(/\[!TIP\]/gi, '').trim();
      } else if (fullText.includes('[!WARNING]')) {
        blockquoteType = 'warning';
        cleanText = fullText.replace(/\[!WARNING\]/gi, '').trim();
      } else if (fullText.includes('[!CAUTION]')) {
        blockquoteType = 'caution';
        cleanText = fullText.replace(/\[!CAUTION\]/gi, '').trim();
      } else if (/warning|هشدار/i.test(fullText)) {
        blockquoteType = 'warning';
      } else if (/tip|نکته/i.test(fullText)) {
        blockquoteType = 'tip';
      }

      blocks.push({
        type: 'blockquote',
        blockquoteType,
        text: cleanText
      });
      blockquoteBuffer = [];
      inBlockquote = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Code Blocks
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        blocks.push({
          type: 'code',
          language: codeLanguage || 'code',
          code: codeBuffer.join('\n')
        });
        codeBuffer = [];
        inCodeBlock = false;
      } else {
        flushList();
        flushBlockquote();
        inCodeBlock = true;
        codeLanguage = trimmed.slice(3).trim().toLowerCase();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    // 2. Blockquotes
    if (trimmed.startsWith('>')) {
      flushList();
      inBlockquote = true;
      blockquoteBuffer.push(trimmed.slice(1).trim());
      continue;
    } else if (inBlockquote && !trimmed.startsWith('>')) {
      if (trimmed === '') {
        flushBlockquote();
      } else {
        blockquoteBuffer.push(trimmed);
        continue;
      }
    }

    // 3. Headings
    if (trimmed.startsWith('#')) {
      flushList();
      flushBlockquote();
      const match = trimmed.match(/^(#{1,6})\s+(.*)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2];
        blocks.push({
          type: 'heading',
          level,
          text
        });
        continue;
      }
    }

    // 4. Lists
    const listMatch = trimmed.match(/^([\-\*]|\d+\.)\s+(.*)$/);
    if (listMatch) {
      flushBlockquote();
      const bullet = listMatch[1];
      const itemText = listMatch[2];
      const isOrdered = /^\d/.test(bullet);

      if (inList && listOrdered !== isOrdered) {
        flushList();
      }

      inList = true;
      listOrdered = isOrdered;
      listItemsBuffer.push(itemText);
      continue;
    } else if (inList && trimmed !== '' && !trimmed.match(/^([\-\*]|\d+\.)\s+/)) {
      if (listItemsBuffer.length > 0) {
        listItemsBuffer[listItemsBuffer.length - 1] += ' ' + trimmed;
      }
      continue;
    } else if (inList && trimmed === '') {
      flushList();
      continue;
    }

    // 5. Standard Paragraphs
    if (trimmed !== '') {
      flushList();
      flushBlockquote();
      blocks.push({
        type: 'paragraph',
        text: trimmed
      });
    }
  }

  flushList();
  flushBlockquote();

  return blocks;
};

const renderInlineText = (text: string) => {
  if (!text) return null;
  
  // Parse inline bidirectional isolates, code highlights, and bold items
  const tokens: { type: 'text' | 'code' | 'bold' | 'bidi'; content: string }[] = [];
  const parts = text.split(/([\u2066\u2069]|\\u2066|\\u2069)/);
  let isBidi = false;
  let processedParts: typeof tokens = [];
  
  for (const part of parts) {
    if (part === '\u2066' || part === '\\u2066') {
      isBidi = true;
      continue;
    }
    if (part === '\u2069' || part === '\\u2069') {
      isBidi = false;
      continue;
    }
    
    if (isBidi) {
      processedParts.push({ type: 'bidi', content: part });
    } else {
      processedParts.push({ type: 'text', content: part });
    }
  }
  
  const finalTokens: typeof tokens = [];
  for (const token of processedParts) {
    if (token.type === 'bidi') {
      finalTokens.push(token);
      continue;
    }
    
    const codeParts = token.content.split('`');
    let isCode = false;
    
    for (const codePart of codeParts) {
      if (isCode) {
        finalTokens.push({ type: 'code', content: codePart });
      } else {
        const boldParts = codePart.split('**');
        let isBold = false;
        for (const boldPart of boldParts) {
          if (isBold) {
            finalTokens.push({ type: 'bold', content: boldPart });
          } else {
            if (boldPart) {
              finalTokens.push({ type: 'text', content: boldPart });
            }
          }
          isBold = !isBold;
        }
      }
      isCode = !isCode;
    }
  }
  
  return (
    <>
      {finalTokens.map((tok, i) => {
        if (tok.type === 'bidi') {
          return (
            <span key={i} className="inline-block font-mono text-[12px] bg-[#8B2635]/5 border border-[#8B2635]/20 px-1.5 py-0.5 rounded text-[#8B2635] font-semibold select-all mx-0.5 align-middle" dir="ltr">
              {tok.content}
            </span>
          );
        }
        if (tok.type === 'code') {
          return (
            <code key={i} className="font-mono text-[12px] bg-surface-2 border border-line px-1.5 py-0.5 rounded text-burgundy font-semibold select-all mx-0.5 align-middle" dir="ltr">
              {tok.content}
            </code>
          );
        }
        if (tok.type === 'bold') {
          return <strong key={i} className="font-bold text-ink">{tok.content}</strong>;
        }
        return <span key={i}>{tok.content}</span>;
      })}
    </>
  );
};

export default function TranslatorScreen() {
  const {
    docId,
    fileName,
    totalPages,
    targetLanguage,
    isRtl,
    chapters,
    currentChapterIdx,
    currentPageIdx,
    cacheStatus,
    originalText,
    translatedText,
    isTranslating,
    isParsing,
    statusMessage,
    setDocContext,
    setChapters,
    setCurrentChapterIdx,
    setCurrentPageIdx,
    setCacheStatus,
    setOriginalText,
    setTranslatedText,
    setIsTranslating,
    setIsParsing,
    setStatusMessage,
    resetTranslator
  } = useTranslatorStore()

  // Local upload state
  const [selectedLanguage, setSelectedLanguage] = useState('fa')
  const [isDragging, setIsDragging] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [extractedImagesCount, setExtractedImagesCount] = useState<number>(0)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  const getCleanedTranslationText = (text: string) => {
    if (!text) return ''
    return text
      .replace(/\\u2066/g, '\u2066')
      .replace(/\\u2069/g, '\u2069')
      .replace(/u2066/g, '\u2066')
      .replace(/u2069/g, '\u2069')
  }

  const getLanguageLabel = (langCode: string) => {
    switch (langCode) {
      case 'fa': return 'Persian (RTL)'
      case 'ar': return 'Arabic (RTL)'
      case 'de': return 'German (LTR)'
      default: return langCode.toUpperCase()
    }
  }

  // ── 1. Upload & Parsing Workflows ──
  const handleUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setUploadError('Only PDF books are supported.')
      return
    }

    setUploadError(null)
    setIsParsing(true)
    setStatusMessage('Uploading document...')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('target_language', selectedLanguage)

    try {
      const res = await fetch('http://127.0.0.1:8765/api/translator/upload', {
        method: 'POST',
        body: formData
      })

      if (!res.ok) {
        throw new Error(await res.text())
      }

      const data = await res.json()
      const doc_rtl = ['fa', 'ar', 'ur', 'he'].includes(selectedLanguage)
      
      setDocContext({
        docId: data.doc_id,
        fileName: file.name,
        totalPages: data.total_pages,
        targetLanguage: selectedLanguage,
        isRtl: doc_rtl
      })

      // Trigger structural chapter/TOC analysis stream
      triggerTOCExtraction(data.doc_id, file.name, data.total_pages, selectedLanguage, doc_rtl)
    } catch (e: any) {
      console.error(e)
      setUploadError(e.message || 'Upload failed. Verify sidecar connection.')
      setIsParsing(false)
    }
  }

  const triggerTOCExtraction = (id: string, name: string, pages: number, lang: string, rtl: boolean) => {
    setStatusMessage('Analyzing structural chapter layouts...')
    const eventSource = new EventSource(`http://127.0.0.1:8765/api/translator/${id}/extract-toc/stream`)

    eventSource.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'progress') {
          setStatusMessage(data.message)
        } else if (data.type === 'done') {
          eventSource.close()
          setStatusMessage('Chapters registered. Synchronizing library...')
          
          // Fetch final chapters
          const chaptersRes = await fetch(`http://127.0.0.1:8765/api/translator/${id}/chapters`)
          if (chaptersRes.ok) {
            const chList = await chaptersRes.json()
            setChapters(chList)
          }
          setIsParsing(false)
        } else if (data.type === 'error') {
          setUploadError(data.message)
          eventSource.close()
          setIsParsing(false)
          resetTranslator()
        }
      } catch (err) {
        console.error(err)
      }
    }

    eventSource.onerror = () => {
      setUploadError('TOC analyzer stream disconnected.')
      eventSource.close()
      setIsParsing(false)
      resetTranslator()
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files[0])
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleUpload(e.target.files[0])
    }
  }

  // ── 2. Reading and Translation Workflows ──
  const activeChapter: TranslatorChapter | undefined = chapters[currentChapterIdx]

  // Synchronize cache status and load page content when chapter or page changes
  useEffect(() => {
    if (!docId || !activeChapter) return

    const loadPage = async () => {
      const absolutePage = activeChapter.page_start + currentPageIdx
      // Clear image count first
      setExtractedImagesCount(0)

      // Fetch images count
      try {
        const imgRes = await fetch(`http://127.0.0.1:8765/api/translator/${docId}/page/${absolutePage}/images`)
        if (imgRes.ok) {
          const imgData = await imgRes.json()
          setExtractedImagesCount(imgData.image_count)
        }
      } catch (e) {
        console.error('Failed to fetch page images count:', e)
      }

      // A. Fetch cache status for chapter pages
      try {
        const cacheRes = await fetch(`http://127.0.0.1:8765/api/translator/${docId}/chapters/${currentChapterIdx}/cache-status`)
        if (cacheRes.ok) {
          const cacheData = await cacheRes.json()
          setCacheStatus(cacheData.pages)
        }
      } catch (e) {
        console.error(e)
      }

      // B. Fetch original text page
      try {
        const textRes = await fetch(`http://127.0.0.1:8765/api/translator/${docId}/page/${absolutePage}`)
        if (textRes.ok) {
          const textData = await textRes.json()
          setOriginalText(textData.text)
        }
      } catch (e) {
        console.error(e)
      }

      // C. Stream Page Translation
      setIsTranslating(true)
      setTranslatedText('')
      
      const query = new URLSearchParams({
        doc_id: docId,
        chapter_idx: currentChapterIdx.toString(),
        page_in_chapter: currentPageIdx.toString()
      }).toString()

      const eventSource = new EventSource(`http://127.0.0.1:8765/api/translator/${docId}/translate/stream?${query}`)

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'token') {
            setTranslatedText((prev) => prev + data.text)
          } else if (data.type === 'cached') {
            setTranslatedText(data.text)
            setIsTranslating(false)
            eventSource.close()
          } else if (data.type === 'done') {
            setIsTranslating(false)
            eventSource.close()
            // Reload cache indicators
            fetchCacheStatusOnly()
          } else if (data.type === 'error') {
            setTranslatedText(`[Translation Error]: ${data.message}`)
            setIsTranslating(false)
            eventSource.close()
          }
        } catch (err) {
          console.error(err)
        }
      }

      eventSource.onerror = () => {
        setIsTranslating(false)
        eventSource.close()
      }
    }

    loadPage()
  }, [docId, currentChapterIdx, currentPageIdx])

  const fetchCacheStatusOnly = async () => {
    if (!docId || !activeChapter) return
    try {
      const cacheRes = await fetch(`http://127.0.0.1:8765/api/translator/${docId}/chapters/${currentChapterIdx}/cache-status`)
      if (cacheRes.ok) {
        const cacheData = await cacheRes.json()
        setCacheStatus(cacheData.pages)
      }
    } catch (e) {}
  }

  // Handle PDF translation compile export
  const handleExportChapter = async () => {
    if (!docId || !activeChapter) return
    
    setIsExporting(true)
    setExportError(null)

    try {
      const res = await fetch(`http://127.0.0.1:8765/api/translator/${docId}/export/chapter/${currentChapterIdx}`, {
        method: 'POST'
      })

      if (!res.ok) {
        throw new Error(await res.text())
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      
      const a = document.createElement('a')
      a.href = url
      a.download = `${activeChapter.title.replace(/\s+/g, '_')}_translated.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e: any) {
      console.error(e)
      setExportError(e.message || 'PDF compilation failed. Ensure at least one page is fully translated.')
    } finally {
      setIsExporting(false)
    }
  }

  // ── 3. VIEWS ──

  // VIEW A: TOC Extraction overlay / parsing
  if (isParsing) {
    return (
      <div className="convo flex-1 flex flex-col justify-center items-center h-full overflow-hidden">
        <div className="text-center space-y-6 max-w-md mx-auto select-none">
          <div style={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            border: '2.5px solid var(--line)',
            borderTopColor: 'var(--burgundy)',
            animation: 'spin 1.2s linear infinite',
            margin: '0 auto'
          }} />
          
          <div className="space-y-2">
            <h2 className="font-serif italic text-2xl text-ink">Analyzing literary structure...</h2>
            <p className="text-sm text-muted">{statusMessage}</p>
          </div>

          <div className="p-3 bg-surface border border-line rounded-2xl flex items-center justify-between text-xs text-muted">
            <span>Table of Contents parsing</span>
            <span>● indexing chapters</span>
          </div>
        </div>
        <style dangerouslySetInnerHTML={{ __html: '@keyframes spin { to { transform: rotate(360deg); } }' }} />
      </div>
    )
  }

  // VIEW B: Book Upload Landing Screen
  if (!docId) {
    return (
      <div className="convo flex-1 flex flex-col justify-between h-full overflow-hidden">
        <div className="convo-head select-none">
          <h2>Book <em>Translator.</em></h2>
          <div className="meta">
            <span>Upload entire PDF literature works, extract chapters, and translate with RTL formatting</span>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center max-w-2xl w-full mx-auto py-4 overflow-y-auto">
          <div className="hero text-center mb-6" style={{ padding: 0, justifyContent: 'center' }}>
            <div className="hero-pre">Bilingual literary matching</div>
            <h1 className="text-3xl font-serif italic text-ink my-3 leading-tight">
              Translate multi-chapter works,<br />
              preserving <em>RTL layout aesthetics.</em>
            </h1>
            <p className="hero-sub text-xs max-w-lg mx-auto">
              Drop a complete PDF book. The pipeline will isolate chapters using layout intelligence, cache page translation records in Redis, and exports ReportLab PDFs leveraging the high-legibility Vazirmatn typeface.
            </p>
          </div>

          <div className="space-y-4">
            {/* Language Selector FIRST */}
            <div className="p-4 bg-surface border border-line rounded-xl select-none shadow-sm flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-mono uppercase tracking-wider text-muted font-bold">1. Select Target Language</span>
                <span className="text-[10px] text-muted opacity-80">Choose target translation before uploading</span>
              </div>
              <div className="flex gap-2">
                <button
                  className={`btn text-xs py-1.5 px-3 border rounded-lg transition-all duration-150 ${selectedLanguage === 'fa' ? 'bg-burgundy text-white border-burgundy shadow-sm font-bold' : 'border-line text-ink hover:bg-surface-2'}`}
                  onClick={() => setSelectedLanguage('fa')}
                >
                  Persian (RTL)
                </button>
                <button
                  className={`btn text-xs py-1.5 px-3 border rounded-lg transition-all duration-150 ${selectedLanguage === 'ar' ? 'bg-burgundy text-white border-burgundy shadow-sm font-bold' : 'border-line text-ink hover:bg-surface-2'}`}
                  onClick={() => setSelectedLanguage('ar')}
                >
                  Arabic (RTL)
                </button>
                <button
                  className={`btn text-xs py-1.5 px-3 border rounded-lg transition-all duration-150 ${selectedLanguage === 'de' ? 'bg-burgundy text-white border-burgundy shadow-sm font-bold' : 'border-line text-ink hover:bg-surface-2'}`}
                  onClick={() => setSelectedLanguage('de')}
                >
                  German (LTR)
                </button>
              </div>
            </div>

            {/* Dropzone SECOND */}
            <div className="flex flex-col gap-1">
              <span className="text-xs font-mono uppercase tracking-wider text-muted font-bold">2. Upload Book PDF</span>
              <div
                className={`border border-dashed rounded-2xl p-8 text-center transition-all duration-300 cursor-pointer ${
                  isDragging ? 'border-burgundy bg-burgundy-soft/20 scale-[1.01]' : 'border-line hover:border-ink-2 bg-surface-2'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="flex justify-center mb-3 text-muted">
                  <Icon.Translate s={32} />
                </div>
                <h4 className="font-serif italic text-lg text-ink font-semibold">Drop PDF book here</h4>
                <span className="suggestion inline-flex items-center gap-1 mt-3 text-xs font-semibold">
                  <Icon.Attach s={11} />
                  <span>Browse computer storage</span>
                </span>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept=".pdf"
                  onChange={handleFileChange}
                />
              </div>
            </div>

            {uploadError && (
              <div className="p-3 bg-burgundy-soft border border-badge-burgundy-border text-burgundy text-xs rounded-xl text-center">
                {uploadError}
              </div>
            )}
          </div>
        </div>

        <div className="convo-foot border-t border-line-soft pt-4 flex items-center justify-between select-none">
          <span className="text-xs text-muted flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-forest" />
            Redis local page-caching enabled
          </span>
          <span className="text-xs text-muted">Supports Vazirmatn embedding</span>
        </div>
      </div>
    )
  }

  // VIEW C: Reader Split Workspace Workspace
  const totalPagesInChapter = activeChapter?.page_count || 1
  const absolutePageNum = activeChapter ? activeChapter.page_start + currentPageIdx : 0

  return (
    <div className="convo flex-1 flex flex-col justify-between h-full overflow-hidden">
      {/* Workspace Header */}
      <div className="convo-head select-none">
        <div className="flex items-center justify-between w-full">
          <div>
            <h2 className="font-serif italic">
              {fileName} — <em>{activeChapter?.title || 'Chapter Workspace'}</em>
            </h2>
            <div className="meta text-xs text-muted flex items-center gap-2 mt-0.5">
              <span>Target: <strong>{getLanguageLabel(targetLanguage)}</strong></span>
              <span>·</span>
              <span>Chapter {currentChapterIdx + 1} of {chapters.length}</span>
              <span>·</span>
              <span>Page {currentPageIdx + 1} of {totalPagesInChapter} (Absolute: {absolutePageNum + 1})</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="btn border-line text-xs py-1.5 px-3 flex items-center gap-1.5"
              onClick={handleExportChapter}
              disabled={isExporting}
            >
              {isExporting ? (
                <>
                  <div style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    border: '1.5px solid var(--line)',
                    borderTopColor: 'var(--burgundy)',
                    animation: 'spin 1s linear infinite'
                  }} />
                  <span>Compiling PDF...</span>
                </>
              ) : (
                <>
                  <Icon.Download s={11} />
                  <span>Export Chapter PDF</span>
                </>
              )}
            </button>
            
            <button
              className="icon-btn w-7 h-7 flex items-center justify-center rounded border border-line text-muted hover:bg-surface-2"
              title="Close Workspace"
              onClick={resetTranslator}
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      {/* Main Workspace split */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 py-2 overflow-hidden">
        
        {/* TOC Sidebar Rail */}
        <div className="lg:col-span-3 flex flex-col bg-surface border border-line rounded-2xl overflow-hidden select-none h-full">
          <div className="p-3 border-b border-line bg-paper-warm text-[10px] font-mono uppercase tracking-wider text-muted font-semibold">
            Extracted Index Rails
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {chapters.map((ch, idx) => {
              const isChActive = idx === currentChapterIdx
              return (
                <button
                  key={ch.id}
                  className={`w-full text-left p-3 rounded-xl text-xs transition-all duration-200 relative ${
                    isChActive
                      ? 'bg-gradient-to-r from-[#8B2635] to-[#701E2A] text-white shadow-md border-0 transform scale-[1.02]'
                      : 'hover:bg-surface-2 text-ink-2 border border-transparent hover:scale-[1.01]'
                  }`}
                  onClick={() => setCurrentChapterIdx(idx)}
                >
                  <div className={`font-semibold truncate ${isChActive ? 'text-white font-bold' : 'text-ink'}`}>{ch.title}</div>
                  <div className={`text-[10px] mt-1 flex justify-between ${isChActive ? 'text-paper-warm/80' : 'text-muted'}`}>
                    <span>pages {ch.page_start + 1}–{ch.page_end + 1}</span>
                    <span>{ch.page_count} sheets</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Center Split Screen: Streamed translation (Always Reader Mode) */}
        <div className="lg:col-span-9 flex flex-col gap-4 overflow-hidden h-full">
          
          {/* Top page indicator bar - Premium Pagination Row */}
          <div className="flex items-center justify-between bg-surface border border-line rounded-2xl px-4 py-2 select-none shadow-sm min-h-[52px]">
            {/* Left Nav Arrow */}
            <button
              className="icon-btn w-8 h-8 rounded-lg border border-line hover:bg-surface-2 flex items-center justify-center text-xs disabled:opacity-30 disabled:pointer-events-none transition-all duration-150 shadow-sm"
              disabled={currentPageIdx === 0}
              onClick={() => setCurrentPageIdx(currentPageIdx - 1)}
              title="Previous Page"
            >
              ◀
            </button>

            {/* Scrollable Page numbers row */}
            <div className="flex-1 flex items-center justify-center gap-1.5 px-4 overflow-x-auto no-scrollbar max-w-full">
              {Array.from({ length: totalPagesInChapter }).map((_, pIdx) => {
                const isCur = pIdx === currentPageIdx
                const isCached = cacheStatus[pIdx]
                return (
                  <button
                    key={pIdx}
                    className={`min-w-[32px] h-8 px-1.5 rounded-lg flex flex-col items-center justify-center text-xs transition-all duration-150 relative ${
                      isCur
                        ? 'bg-burgundy text-white font-bold shadow-sm'
                        : 'bg-surface-2 hover:bg-surface-3 text-ink-2 hover:text-ink border border-line-soft'
                    }`}
                    onClick={() => setCurrentPageIdx(pIdx)}
                  >
                    <span className="font-mono text-[11px] font-bold">{pIdx + 1}</span>
                    {isCached && (
                      <span className={`w-1 h-1 rounded-full absolute bottom-1 ${isCur ? 'bg-white' : 'bg-forest'}`} />
                    )}
                  </button>
                )
              })}
            </div>

            {/* Right Nav Arrow */}
            <button
              className="icon-btn w-8 h-8 rounded-lg border border-line hover:bg-surface-2 flex items-center justify-center text-xs disabled:opacity-30 disabled:pointer-events-none transition-all duration-150 shadow-sm"
              disabled={currentPageIdx === totalPagesInChapter - 1}
              onClick={() => setCurrentPageIdx(currentPageIdx + 1)}
              title="Next Page"
            >
              ▶
            </button>
          </div>

          {/* Text Container (Always Reader Mode) */}
          <div className="flex-1 flex gap-4 overflow-hidden h-full">
            {/* Right Pane: RTL Streamed Translation */}
            <div className="flex flex-col bg-surface border border-line rounded-2xl overflow-hidden relative shadow-sm h-full flex-1 w-full">
              <div className="p-3 border-b border-line bg-paper-warm flex items-center justify-between text-xs text-muted select-none">
                <span className="font-mono uppercase tracking-wider font-semibold">LLM Translation</span>
                <span className="flex items-center gap-1 text-[10px]">
                  <span className="star">✦</span>
                  {isRtl ? 'RTL Vazirmatn font' : 'Standard font'}
                </span>
              </div>
              
              <div
                className="flex-1 p-6 overflow-y-auto text-[14.5px] leading-relaxed text-ink bg-surface border-t border-line space-y-3.5 select-text"
                style={{
                  fontFamily: isRtl ? 'Vazirmatn, system-ui, sans-serif' : 'inherit',
                  direction: isRtl ? 'rtl' : 'ltr',
                  textAlign: isRtl ? 'right' : 'left'
                }}
              >
                {translatedText ? (
                  parseMarkdown(getCleanedTranslationText(translatedText)).map((block, idx) => {
                    if (block.type === 'heading') {
                      if (block.level === 2) {
                        return (
                          <h2 key={idx} className="font-serif italic text-lg text-ink font-bold mt-5 mb-2.5 border-b border-line-soft pb-1 text-right">
                            {renderInlineText(block.text || '')}
                          </h2>
                        );
                      }
                      if (block.level === 3) {
                        return (
                          <h3 key={idx} className="font-serif text-base text-ink font-semibold mt-4 mb-2 text-right">
                            {renderInlineText(block.text || '')}
                          </h3>
                        );
                      }
                      return (
                        <h4 key={idx} className="font-sans text-sm text-ink font-semibold mt-3 mb-1.5 text-right">
                          {renderInlineText(block.text || '')}
                        </h4>
                      );
                    }

                    if (block.type === 'code') {
                      const lines = (block.code || '').split('\n');
                      return (
                        <div key={idx} className="border border-line rounded-2xl overflow-hidden my-4 bg-[#0D1117] text-slate-100 flex flex-col shadow-md select-text" dir="ltr">
                          {/* Header */}
                          <div className="flex items-center justify-between px-4 py-2 bg-[#161B22] border-b border-[#21262D] select-none">
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]" />
                                <span className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
                                <span className="w-2.5 h-2.5 rounded-full bg-[#27C93F]" />
                              </div>
                              <span className="text-[10px] font-mono tracking-wider text-slate-400 uppercase font-bold">
                                {block.language || 'code'}
                              </span>
                            </div>
                            
                            <button
                              className="text-[10px] font-mono text-slate-400 hover:text-white transition-colors duration-150 flex items-center gap-1 bg-slate-800/40 hover:bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700/50"
                              onClick={(e) => {
                                navigator.clipboard.writeText(block.code || '');
                                const btn = e.currentTarget;
                                const span = btn.querySelector('span');
                                if (span) {
                                  span.textContent = 'Copied!';
                                  setTimeout(() => { span.textContent = 'Copy'; }, 2000);
                                }
                              }}
                            >
                              📋 <span>Copy</span>
                            </button>
                          </div>
                          
                          {/* Code Area */}
                          <div className="flex overflow-x-auto p-4 text-[13px] leading-relaxed font-mono bg-[#0D1117] text-left">
                            {/* Line Numbers */}
                            <div className="flex flex-col text-slate-600 text-right pr-4 border-r border-[#21262D] select-none text-[12px] min-w-[24px]">
                              {lines.map((_, iIdx) => (
                                <span key={iIdx}>{iIdx + 1}</span>
                              ))}
                            </div>
                            {/* Code content */}
                            <pre className="pl-4 flex-1 select-text overflow-visible whitespace-pre text-emerald-400 font-mono">
                              <code>{block.code}</code>
                            </pre>
                          </div>
                        </div>
                      );
                    }

                    if (block.type === 'blockquote') {
                      const isWarning = block.blockquoteType === 'warning' || block.blockquoteType === 'caution';
                      const isTip = block.blockquoteType === 'tip';
                      const isNote = block.blockquoteType === 'note';
                      
                      let borderColor = isRtl ? 'border-r-4 border-[#8B2635]' : 'border-l-4 border-[#8B2635]';
                      let bgColor = 'bg-surface-2';
                      let labelText = 'Quote';
                      let icon = '✦';
                      
                      if (isWarning) {
                        borderColor = isRtl ? 'border-r-4 border-[#8B2635]' : 'border-l-4 border-[#8B2635]';
                        bgColor = 'bg-burgundy-soft/10';
                        labelText = isRtl ? 'هشدار / توجه' : 'Warning';
                        icon = '⚠️';
                      } else if (isTip) {
                        borderColor = isRtl ? 'border-r-4 border-forest' : 'border-l-4 border-forest';
                        bgColor = 'bg-forest-soft/15';
                        labelText = isRtl ? 'نکته کاربردی' : 'Tip';
                        icon = '💡';
                      } else if (isNote) {
                        borderColor = isRtl ? 'border-r-4 border-[#1E40AF]' : 'border-l-4 border-[#1E40AF]';
                        bgColor = 'bg-[#EFF6FF]/20';
                        labelText = isRtl ? 'یادداشت' : 'Note';
                        icon = 'ℹ️';
                      } else {
                        borderColor = isRtl ? 'border-r-4 border-line' : 'border-l-4 border-line';
                        bgColor = 'bg-surface-2';
                        labelText = '';
                        icon = '❝';
                      }

                      return (
                        <div key={idx} className={`p-4 rounded-xl ${borderColor} ${bgColor} my-4 flex gap-2.5 flex-col shadow-sm text-[13.5px]`} style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
                          {labelText && (
                            <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-muted select-none">
                              <span>{icon}</span>
                              <span>{labelText}</span>
                            </div>
                          )}
                          <div className="leading-relaxed select-text italic text-ink-2">
                            {renderInlineText(block.text || '')}
                          </div>
                        </div>
                      );
                    }

                    if (block.type === 'list') {
                      if (block.listOrdered) {
                        return (
                          <ol key={idx} className="list-decimal pl-6 pr-6 my-3 space-y-1.5 leading-relaxed text-ink select-text text-[13.5px]" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
                            {block.listItems?.map((item, iIdx) => (
                              <li key={iIdx} className="relative">
                                {renderInlineText(item)}
                              </li>
                            ))}
                          </ol>
                        );
                      } else {
                        return (
                          <ul key={idx} className="list-disc pl-6 pr-6 my-3 space-y-1.5 leading-relaxed text-ink select-text text-[13.5px]" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
                            {block.listItems?.map((item, iIdx) => (
                              <li key={iIdx} className="relative">
                                {renderInlineText(item)}
                              </li>
                            ))}
                          </ul>
                        );
                      }
                    }

                    return (
                      <p key={idx} className="relative leading-relaxed text-ink mb-3 text-justify select-text text-[14.5px]" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
                        {renderInlineText(block.text || '')}
                        {idx === parseMarkdown(getCleanedTranslationText(translatedText)).length - 1 && isTranslating && (
                          <span className="inline-block w-1.5 h-4 bg-burgundy animate-pulse align-middle ml-0.5 mr-0.5" />
                        )}
                      </p>
                    );
                  })
                ) : (
                  <span className="text-muted italic font-sans text-xs">
                    {isTranslating ? 'Streaming literary translation...' : 'Waiting for translation trigger...'}
                  </span>
                )}
              </div>

              {/* Sketches and visual illustrations panel */}
              {extractedImagesCount > 0 && (
                <div className="p-5 border-t border-line bg-paper-warm rounded-b-2xl select-none">
                  <div className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-muted font-bold mb-3">
                    <span>🖼️</span>
                    <span>Extracted Page Sketches &amp; Illustrations ({extractedImagesCount})</span>
                  </div>
                  <div className="flex flex-wrap gap-4 justify-center">
                    {Array.from({ length: extractedImagesCount }).map((_, imgIdx) => (
                      <div key={imgIdx} className="border border-line rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-all duration-200 p-2 max-w-[280px]">
                        <img
                          src={`http://127.0.0.1:8765/api/translator/${docId}/page/${absolutePageNum}/image/${imgIdx}`}
                          alt={`Extracted page illustration ${imgIdx + 1}`}
                          className="w-full h-auto object-contain max-h-[220px] rounded-lg bg-surface-2 filter grayscale hover:grayscale-0 transition-all duration-300"
                        />
                        <div className="text-[10px] text-center text-muted mt-2 font-mono">
                          Figure Asset #{imgIdx + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {exportError && (
            <div className="p-2.5 bg-burgundy-soft border border-badge-burgundy-border text-burgundy text-xs rounded-xl select-none">
              {exportError}
            </div>
          )}
        </div>
      </div>

      {/* Foot Actions */}
      <div className="convo-foot border-t border-line-soft pt-3 flex items-center justify-between select-none">
        <ModelPill name="gemini-2.0-flash-exp" latency={isTranslating ? 'translating page' : 'cached / idle'} />
        <div className="text-[10px] text-muted flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-forest" />
          Silently writing cache to Redis database
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: '@keyframes spin { to { transform: rotate(360deg); } }' }} />
    </div>
  )
}
