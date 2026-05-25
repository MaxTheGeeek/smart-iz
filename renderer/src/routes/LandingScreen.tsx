import React, { useState, useRef } from 'react'
import { useAppStore } from '../store/useAppStore'
import { Icon } from '../components/SharedUI'

export default function LandingScreen() {
  const { setScreen, setPositionText, setPositionData, setLanguage, language, selectedSkill, setSelectedSkill } = useAppStore()
  const [inputText, setInputText] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value)
    setErrorMsg('')
  }

  // Handle parsing pasted/entered text
  const handleProceed = async () => {
    const text = inputText.trim()
    if (!text) {
      setErrorMsg('Please paste a job description or drop a file to continue.')
      return
    }

    setPositionText(text)
    setScreen('analyzing')

    try {
      const res = await fetch('http://127.0.0.1:8765/api/position/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language }),
      })

      if (!res.ok) {
        throw new Error(await res.text())
      }

      const data = await res.json()
      setPositionData(data)
      setLanguage(data.language_detected)
      setScreen('setup')
    } catch (e: any) {
      console.error(e)
      setScreen('landing')
      setErrorMsg(e.message || 'Failed to parse position. Please verify the sidecar is active.')
    }
  }

  // Handle file uploads
  const uploadFile = async (file: File) => {
    setIsUploading(true)
    setErrorMsg('')

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('http://127.0.0.1:8765/api/position/upload', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        throw new Error(await res.text())
      }

      const data = await res.json()
      setInputText(data.text)
      if (data.language_detected) {
        setLanguage(data.language_detected)
      }
    } catch (e: any) {
      console.error(e)
      setErrorMsg(e.message || 'Failed to upload document. Only PDF, DOCX, and TXT are supported.')
    } finally {
      setIsUploading(false)
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
      uploadFile(e.dataTransfer.files[0])
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFile(e.target.files[0])
    }
  }

  return (
    <div className="convo flex-1 flex flex-col justify-between" style={{ minHeight: 'calc(100vh - 100px)' }}>
      {/* Head */}
      <div className="convo-head" style={{ display: 'flex', justifyContent: 'between', alignItems: 'center', width: '100%' }}>
        <div>
          <h2>A blank <em>page.</em></h2>
          <div className="meta">
            <span>Fallback chain: Gemini 2.0 → Llama 3.3 → DeepSeek</span>
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select 
            value={selectedSkill}
            onChange={(e) => setSelectedSkill(e.target.value as any)}
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--line)',
              color: 'var(--ink)',
              fontSize: '11px',
              fontWeight: 500,
              padding: '5px 10px',
              borderRadius: '6px',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="chat">💬 Free Chat Mode</option>
            <option value="cover_letter">📝 Cover Letter Mode</option>
            <option value="translate">🌐 Translator Mode</option>
            <option value="analyze">📂 File Analyzer Mode</option>
          </select>
        </div>
      </div>

      {/* Main hero & text area */}
      <div className="flex-1 flex flex-col justify-center max-w-3xl w-full mx-auto py-8">
        <div className="hero text-center mb-6" style={{ padding: 0, justifyContent: 'center' }}>
          <div className="hero-pre">A writing room for cover letters</div>
          <h1 className="text-3xl md:text-4xl font-serif italic text-ink my-3 leading-tight">
            Tell me about the role.<br />
            I'll draft the rest, <em>in your voice.</em>
          </h1>
          <p className="hero-sub text-sm max-w-xl mx-auto">
            Paste a job posting, drop the PDF, or just describe the position. I'll pull what matters, line it up against your resume, and write a letter that doesn't sound like everyone else's.
          </p>
        </div>

        {/* Empty state mode picker */}
        {inputText === '' && (
          <div style={{ marginBottom: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', fontWeight: 'bold', marginBottom: '10px' }}>
              What would you like to do?
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={() => setSelectedSkill('chat')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid ' + (selectedSkill === 'chat' ? 'var(--burgundy)' : 'var(--line)'),
                  background: selectedSkill === 'chat' ? 'var(--burgundy-soft)' : 'var(--surface)',
                  color: 'var(--ink)',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>💬</span>
                <span>Chat freely</span>
              </button>
              <button
                onClick={() => setSelectedSkill('cover_letter')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid ' + (selectedSkill === 'cover_letter' ? 'var(--burgundy)' : 'var(--line)'),
                  background: selectedSkill === 'cover_letter' ? 'var(--burgundy-soft)' : 'var(--surface)',
                  color: 'var(--ink)',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>📝</span>
                <span>Cover letter</span>
              </button>
              <button
                onClick={() => setSelectedSkill('translate')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid ' + (selectedSkill === 'translate' ? 'var(--burgundy)' : 'var(--line)'),
                  background: selectedSkill === 'translate' ? 'var(--burgundy-soft)' : 'var(--surface)',
                  color: 'var(--ink)',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>🌐</span>
                <span>Translate</span>
              </button>
              <button
                onClick={() => setSelectedSkill('analyze')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid ' + (selectedSkill === 'analyze' ? 'var(--burgundy)' : 'var(--line)'),
                  background: selectedSkill === 'analyze' ? 'var(--burgundy-soft)' : 'var(--surface)',
                  color: 'var(--ink)',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>📂</span>
                <span>Analyze file</span>
              </button>
            </div>
          </div>
        )}

        {/* Input container */}
        <div className="space-y-4">
          {/* Dropzone / text input */}
          <div
            className={`relative border border-dashed rounded-2xl p-4 transition-all duration-300 ${
              isDragging ? 'border-burgundy bg-burgundy-soft/20 scale-[1.01]' : 'border-line hover:border-ink-2 bg-surface-2'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <textarea
              className="w-full h-44 bg-transparent outline-none text-ink text-sm placeholder:text-muted resize-none leading-relaxed"
              placeholder="Paste the job posting description here, or drop a document to extract..."
              value={inputText}
              onChange={handleTextChange}
            />

            {isUploading && (
              <div className="absolute inset-0 bg-paper/85 flex items-center justify-center rounded-2xl">
                <div className="text-center space-y-2">
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    border: '2px solid var(--line)',
                    borderTopColor: 'var(--burgundy)',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto'
                  }} />
                  <span className="text-xs text-muted">Reading document content...</span>
                </div>
              </div>
            )}
          </div>

          {/* Actions line */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                className="suggestion flex items-center gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <Icon.Attach s={12} />
                <span>Upload PDF · DOCX</span>
              </button>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".pdf,.docx,.txt"
                onChange={handleFileChange}
              />

              {/* Suggestions */}
              <button
                className="suggestion flex items-center gap-1.5"
                onClick={() => setInputText(`Senior Backend Engineer at Anthropic\n\nWe are looking for someone to own our request routing layer...`)}
              >
                <Icon.Sparkle s={11} />
                <span>Linear PM Example</span>
              </button>
            </div>

            {/* Language Selector & Continue */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">Target:</span>
                <div className="lang">
                  <button
                    className={language === 'en' ? 'on' : ''}
                    onClick={() => setLanguage('en')}
                  >
                    EN
                  </button>
                  <button
                    className={language === 'de' ? 'on' : ''}
                    onClick={() => setLanguage('de')}
                  >
                    DE
                  </button>
                </div>
              </div>

              <button
                className="btn primary flex items-center gap-2"
                onClick={handleProceed}
              >
                <span>Continue</span>
                <Icon.Arrow s={12} />
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-burgundy-soft border border-badge-burgundy-border rounded-xl text-xs text-burgundy text-center">
              {errorMsg}
            </div>
          )}
        </div>

        {/* Feature stats */}
        <div className="flex justify-center gap-8 mt-12 text-xs text-muted border-t border-line-soft pt-6 select-none">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-forest" />
            All processing local
          </span>
          <span className="flex items-center gap-1.5">
            <Icon.Sparkle s={12} />
            LLM Fallbacks configured
          </span>
          <span className="flex items-center gap-1.5">
            <Icon.Docs s={12} />
            Templates ready
          </span>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: '@keyframes spin { to { transform: rotate(360deg); } }' }} />
    </div>
  )
}
