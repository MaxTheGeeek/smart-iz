import React, { useState, useEffect, useRef } from 'react'
import { useTranslatorStore, TranslatorChapter } from '../store/useTranslatorStore'
import { Icon, ModelPill } from '../components/SharedUI'

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
  const [readerMode, setReaderMode] = useState(true)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  const getCleanedTranslationText = (text: string) => {
    if (!text) return ''
    return text
      .replace(/\\u2066/g, '\u2066')
      .replace(/\\u2069/g, '\u2069')
      .replace(/u2066/g, '\u2066')
      .replace(/u2069/g, '\u2069')
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

            {/* Language Selector */}
            <div className="flex items-center justify-between p-4 bg-surface border border-line rounded-xl select-none">
              <span className="text-xs font-mono uppercase tracking-wider text-muted">Target Translation Language</span>
              <div className="flex gap-2">
                <button
                  className={`btn text-xs py-1 px-3 border rounded-lg ${selectedLanguage === 'fa' ? 'bg-burgundy text-white border-burgundy' : 'border-line text-ink hover:bg-surface-2'}`}
                  onClick={() => setSelectedLanguage('fa')}
                >
                  Persian (RTL)
                </button>
                <button
                  className={`btn text-xs py-1 px-3 border rounded-lg ${selectedLanguage === 'ar' ? 'bg-burgundy text-white border-burgundy' : 'border-line text-ink hover:bg-surface-2'}`}
                  onClick={() => setSelectedLanguage('ar')}
                >
                  Arabic (RTL)
                </button>
                <button
                  className={`btn text-xs py-1 px-3 border rounded-lg ${selectedLanguage === 'de' ? 'bg-burgundy text-white border-burgundy' : 'border-line text-ink hover:bg-surface-2'}`}
                  onClick={() => setSelectedLanguage('de')}
                >
                  German (LTR)
                </button>
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
              <span>Target: <strong>{targetLanguage.toUpperCase()}</strong></span>
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
                  className={`w-full text-left p-2.5 rounded-xl text-xs transition-all duration-150 ${
                    isChActive
                      ? 'bg-burgundy-soft/20 text-burgundy border border-badge-burgundy-border'
                      : 'hover:bg-surface-2 text-ink-2 border border-transparent'
                  }`}
                  onClick={() => setCurrentChapterIdx(idx)}
                >
                  <div className="font-semibold truncate text-ink">{ch.title}</div>
                  <div className="text-[10px] text-muted mt-0.5 flex justify-between">
                    <span>pages {ch.page_start + 1}–{ch.page_end + 1}</span>
                    <span>{ch.page_count} sheets</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Center Split Screen: Original + Streamed translation */}
        <div className="lg:col-span-9 flex flex-col gap-4 overflow-hidden h-full">
          
          {/* Top page indicator bar */}
          <div className="flex items-center justify-between bg-surface border border-line rounded-xl px-4 py-2 select-none">
            {/* Nav Arrows */}
            <div className="flex items-center gap-2">
              <button
                className="icon-btn w-6 h-6 rounded border border-line hover:bg-surface-2 flex items-center justify-center text-xs"
                disabled={currentPageIdx === 0}
                onClick={() => setCurrentPageIdx(currentPageIdx - 1)}
              >
                ◀
              </button>
              <span className="text-xs text-ink font-semibold">
                Sheet {currentPageIdx + 1} / {totalPagesInChapter}
              </span>
              <button
                className="icon-btn w-6 h-6 rounded border border-line hover:bg-surface-2 flex items-center justify-center text-xs"
                disabled={currentPageIdx === totalPagesInChapter - 1}
                onClick={() => setCurrentPageIdx(currentPageIdx + 1)}
              >
                ▶
              </button>
            </div>

            {/* View Mode Segmented Toggle Control */}
            <div className="flex items-center gap-1 bg-surface-2 p-0.5 rounded-lg border border-line text-[10px]">
              <button
                className={`uppercase font-mono font-bold tracking-wider px-2.5 py-1 rounded-md transition-all duration-150 ${
                  readerMode 
                    ? 'bg-burgundy text-white shadow-sm' 
                    : 'text-muted hover:text-ink'
                }`}
                onClick={() => setReaderMode(true)}
              >
                📖 Reader Mode
              </button>
              <button
                className={`uppercase font-mono font-bold tracking-wider px-2.5 py-1 rounded-md transition-all duration-150 ${
                  !readerMode 
                    ? 'bg-burgundy text-white shadow-sm' 
                    : 'text-muted hover:text-ink'
                }`}
                onClick={() => setReaderMode(false)}
              >
                🪟 Split View
              </button>
            </div>

            {/* Page Cache Hits Tracker Dots */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono text-muted uppercase tracking-wider mr-1">Chapter Cache Hits:</span>
              <div className="flex gap-1">
                {Array.from({ length: totalPagesInChapter }).map((_, pIdx) => {
                  const isCached = cacheStatus[pIdx]
                  const isCur = pIdx === currentPageIdx
                  return (
                    <span
                      key={pIdx}
                      className={`w-2 h-2 rounded-full border transition-all duration-150 ${
                        isCur
                          ? 'border-burgundy scale-110'
                          : 'border-transparent'
                      }`}
                      style={{
                        background: isCached ? 'var(--forest)' : 'var(--line-soft)'
                      }}
                      title={`Page ${pIdx + 1} status`}
                    />
                  )
                })}
              </div>
            </div>
          </div>

          {/* Split Text Container */}
          <div className="flex-1 flex gap-4 overflow-hidden h-full">
            {/* Left Pane: Original Text (Hidden in Reader Mode) */}
            {!readerMode && (
              <div className="flex-1 flex flex-col bg-surface border border-line rounded-2xl overflow-hidden relative shadow-sm h-full">
                <div className="p-3 border-b border-line bg-paper-warm flex items-center justify-between text-xs text-muted select-none">
                  <span className="font-mono uppercase tracking-wider font-semibold">Original PDF Plaintext</span>
                  <span>Latin glyphs</span>
                </div>
                <div
                  className="flex-1 p-5 overflow-y-auto text-xs leading-relaxed text-ink bg-surface border-t border-line whitespace-pre-wrap select-text"
                  style={{ fontFamily: 'monospace' }}
                >
                  {originalText || (
                    <span className="text-muted italic">Reading document characters...</span>
                  )}
                </div>
              </div>
            )}

            {/* Right Pane: RTL Streamed Translation */}
            <div className={`flex flex-col bg-surface border border-line rounded-2xl overflow-hidden relative shadow-sm h-full ${readerMode ? 'flex-1 max-w-3xl mx-auto w-full' : 'flex-1'}`}>
              <div className="p-3 border-b border-line bg-paper-warm flex items-center justify-between text-xs text-muted select-none">
                <span className="font-mono uppercase tracking-wider font-semibold">LLM Translation</span>
                <span className="flex items-center gap-1 text-[10px]">
                  <span className="star">✦</span>
                  {isRtl ? 'RTL Vazirmatn font' : 'Standard font'}
                </span>
              </div>
              
              <div
                className="flex-1 p-8 overflow-y-auto text-base leading-loose text-ink bg-surface border-t border-line space-y-4 select-text"
                style={{
                  fontFamily: isRtl ? 'Vazirmatn, system-ui, sans-serif' : 'inherit',
                  direction: isRtl ? 'rtl' : 'ltr',
                  textAlign: isRtl ? 'right' : 'left'
                }}
              >
                {translatedText ? (
                  getCleanedTranslationText(translatedText).split('\n\n').map((p, idx) => (
                    <p key={idx} className="relative">
                      {p}
                      {idx === translatedText.split('\n\n').length - 1 && isTranslating && (
                        <span className="inline-block w-1.5 h-4 bg-burgundy animate-pulse align-middle ml-0.5 mr-0.5" />
                      )}
                    </p>
                  ))
                ) : (
                  <span className="text-muted italic font-sans text-xs">
                    {isTranslating ? 'Streaming literary translation...' : 'Waiting for translation trigger...'}
                  </span>
                )}
              </div>
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
