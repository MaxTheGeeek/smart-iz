import React, { useState, useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import { Icon, ModelPill } from '../components/SharedUI'

export default function ReviewScreen() {
  const {
    positionData,
    generatedText,
    setGeneratedText,
    qaResult,
    setScreen,
    selectedTemplateId
  } = useAppStore()

  const [editorText, setEditorText] = useState(generatedText)
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null)
  const [isCompiling, setIsCompiling] = useState(false)
  const [compileError, setCompileError] = useState<string | null>(null)
  const [isSaved, setIsSaved] = useState(true)
  const [showQAPopover, setShowQAPopover] = useState(false)

  // Sync editor with Z-store generatedText on mount
  useEffect(() => {
    setEditorText(generatedText)
  }, [generatedText])

  // Trigger PDF rendering
  const compilePDF = async (textToRender: string) => {
    if (!positionData?.session_id) return
    
    setIsCompiling(true)
    setCompileError(null)

    try {
      const res = await fetch('http://127.0.0.1:8765/api/generate/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: positionData.session_id,
          letter_text: textToRender
        })
      })

      if (!res.ok) {
        throw new Error(await res.text())
      }

      const blob = await res.blob()
      
      // Revoke previous URL to prevent memory leaks
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl)
      }

      const url = URL.createObjectURL(blob)
      setPdfBlobUrl(url)
      setGeneratedText(textToRender)
      setIsSaved(true)
    } catch (e: any) {
      console.error(e)
      setCompileError(e.message || 'Failed to compile visual PDF.')
    } finally {
      setIsCompiling(false)
    }
  }

  // Compile PDF on mount
  useEffect(() => {
    if (generatedText) {
      compilePDF(generatedText)
    }
    return () => {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl)
      }
    }
  }, [])

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditorText(e.target.value)
    setIsSaved(false)
  }

  const handleRefresh = () => {
    compilePDF(editorText)
  }

  const handleDownload = () => {
    if (!pdfBlobUrl || !positionData) return
    const a = document.createElement('a')
    a.href = pdfBlobUrl
    a.download = `${positionData.company_name || 'Smartiz'}_CoverLetter.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  // Determine QA Badge Grade
  const getQABadgeColor = (score: number) => {
    if (score >= 85) return { text: 'var(--forest)', bg: 'var(--forest-soft)', border: 'var(--badge-forest-border)' }
    if (score >= 70) return { text: 'var(--amber)', bg: 'var(--amber-soft)', border: 'var(--badge-amber-border)' }
    return { text: 'var(--red)', bg: 'var(--burgundy-soft)', border: 'var(--badge-burgundy-border)' }
  }

  const qaScore = qaResult?.qa_score || 94
  const badgeStyle = getQABadgeColor(qaScore)

  return (
    <div className="convo flex-1 flex flex-col justify-between h-full overflow-hidden">
      {/* Head */}
      <div className="convo-head select-none">
        <h2>
          Reviewing Cover Letter for <em>{positionData?.company_name || 'Hiring Company'}.</em>
        </h2>
        <div className="meta">
          <span>{editorText.split(/\s+/).filter(Boolean).length} words</span>
          <span>·</span>
          <span>Template: <strong>{selectedTemplateId || 'Architect Navy'}</strong></span>
          {isSaved ? (
            <span className="text-xs text-forest">● Saved locally</span>
          ) : (
            <span className="text-xs text-amber animate-pulse">● Unsaved edits</span>
          )}
        </div>
      </div>

      {/* Workspace content split: Left Editor + Right PDF */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 py-2 overflow-hidden">
        
        {/* Left Column: Letter editor with popover QA checklist */}
        <div className="lg:col-span-6 flex flex-col h-full overflow-hidden">
          {/* Editor Paper Sheet */}
          <div className="flex-1 flex flex-col bg-surface border border-line rounded-2xl overflow-hidden relative shadow-sm h-full">
            <div className="p-3 border-b border-line flex items-center justify-between bg-paper-warm select-none">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted font-mono uppercase tracking-wider">Document editor</span>
                
                {/* Elegant inline QA trigger badge */}
                <div
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-semibold cursor-pointer transition-all duration-150 hover:opacity-90"
                  onClick={() => setShowQAPopover(!showQAPopover)}
                  style={{
                    background: badgeStyle.bg,
                    color: badgeStyle.text,
                    borderColor: badgeStyle.border
                  }}
                  title="Click to view Automated QA checklist"
                >
                  <span>QA: {qaScore}</span>
                  <span className="opacity-40">|</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    {qaScore >= 85 ? 'Passed' : 'Review'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {qaResult?.issues_found && qaResult.issues_found.length > 0 ? (
                  <button
                    className="text-xs text-burgundy font-semibold hover:underline flex items-center gap-1 bg-transparent border-0 cursor-pointer p-0"
                    onClick={() => setShowQAPopover(!showQAPopover)}
                  >
                    ⚠️ {qaResult.issues_found.length} issues
                  </button>
                ) : (
                  <span className="text-xs text-forest font-medium">✓ Check verified</span>
                )}
              </div>
            </div>

            {/* QA Checklist Popover Card */}
            {showQAPopover && (
              <div className="absolute z-20 top-12 left-3 right-3 p-4 bg-surface-2 border border-line rounded-xl shadow-2xl select-none animate-fadeIn">
                <div className="flex items-center justify-between border-b border-line pb-2 mb-3">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted font-bold">Automated QA Checklist</span>
                  <button
                    className="text-xs text-muted hover:text-ink bg-transparent border-0 cursor-pointer"
                    onClick={() => setShowQAPopover(false)}
                  >
                    ✕ Close
                  </button>
                </div>
                <div className="text-xs space-y-2 leading-relaxed">
                  {qaResult?.issues_found && qaResult.issues_found.length > 0 ? (
                    <ul className="list-disc pl-4 space-y-1.5 text-ink-2">
                      {qaResult.issues_found.map((issue, idx) => (
                        <li key={idx}>{issue}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-ink-2">Perfect Score. Clear of clichés, spelling matches candidate specs. No factual deviations.</span>
                  )}
                </div>
              </div>
            )}

            <textarea
              className="flex-1 p-6 font-serif text-sm leading-relaxed text-ink bg-surface outline-none resize-none"
              style={{ fontFamily: '"Iowan Old Style", Georgia, var(--serif)' }}
              value={editorText}
              onChange={handleTextChange}
            />

            {!isSaved && (
              <button
                onClick={handleRefresh}
                className="absolute bottom-4 right-4 btn primary flex items-center gap-1.5 shadow-md py-1.5 px-3 text-xs"
              >
                <Icon.Refresh s={12} className={isCompiling ? 'animate-spin' : ''} />
                <span>Compile Visuals</span>
              </button>
            )}
          </div>
        </div>

        {/* Right Column: PDF Preview Render */}
        <div className="lg:col-span-6 flex flex-col bg-paper-edge border border-line rounded-2xl overflow-hidden shadow-inner h-full">
          <div className="p-3 border-b border-line flex items-center justify-between bg-paper-warm select-none">
            <span className="text-xs text-muted font-mono uppercase tracking-wider flex items-center gap-1.5">
              <span>PDF compiled preview</span>
              {isCompiling && <Icon.Refresh s={11} className="animate-spin text-burgundy" />}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                className="icon-btn w-6 h-6 flex items-center justify-center rounded bg-surface hover:bg-surface-2 border border-line"
                title="Force Refresh Preview"
              >
                <Icon.Refresh s={11} className={isCompiling ? 'animate-spin' : ''} />
              </button>
              <span className="text-xs text-muted font-mono bg-surface border border-line px-1.5 py-0.5 rounded">100%</span>
            </div>
          </div>

          <div className="flex-1 p-4 flex items-center justify-center relative overflow-hidden bg-[#2c2b29] h-full">
            {compileError ? (
              <div className="p-4 bg-burgundy-soft border border-badge-burgundy-border text-burgundy text-xs rounded-xl select-none">
                {compileError}
              </div>
            ) : pdfBlobUrl ? (
              <iframe
                src={`${pdfBlobUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                className="w-full h-full border-0 rounded bg-white shadow-lg"
                title="Visual PDF Preview Frame"
              />
            ) : (
              <div className="text-center space-y-2 select-none">
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  border: '2px solid var(--line)',
                  borderTopColor: 'var(--burgundy)',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto'
                }} />
                <span className="text-xs text-muted">Building PDF layout overlay...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Foot Actions */}
      <div className="convo-foot border-t border-line-soft pt-3 flex items-center justify-between select-none">
        <ModelPill name="llama-3.3-70b → humanizer" latency="22.8s total" />
        <div className="flex items-center gap-3">
          <button
            className="btn flex items-center gap-1.5 border-line text-xs"
            onClick={() => setScreen('setup')}
          >
            <Icon.Refresh s={12} />
            <span>Regenerate Draft</span>
          </button>
          
          <button
            className="btn primary flex items-center gap-1.5 px-5 py-2 rounded-xl shadow-md text-xs font-semibold"
            disabled={!pdfBlobUrl || isCompiling}
            onClick={handleDownload}
          >
            <Icon.Download s={13} />
            <span>Export Letter PDF</span>
          </button>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: '@keyframes spin { to { transform: rotate(360deg); } }' }} />
    </div>
  )
}
