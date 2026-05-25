import React, { useState, useRef, useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import { Icon, LogoMark } from '../components/SharedUI'

export default function LandingScreen() {
  const { 
    setScreen, 
    setPositionText, 
    setPositionData, 
    setLanguage, 
    language, 
    selectedSkill, 
    setSelectedSkill 
  } = useAppStore()

  // Input & state
  const [inputText, setInputText] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  
  // Chat state
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant', text: string, model?: string }>>([])
  const [isSending, setIsSending] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom of chat when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value)
    setErrorMsg('')
  }

  // Handle parsing pasted/entered text (Cover Letter Mode)
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

  // Handle general AI chat message send
  const handleSendChat = async (promptOverride?: string) => {
    const promptText = (promptOverride || inputText).trim()
    if (!promptText || isSending) return

    setInputText('')
    setErrorMsg('')
    setIsSending(true)

    // Add user message
    setMessages(prev => [...prev, { role: 'user', text: promptText }])
    
    // Add blank placeholder for streaming assistant response
    setMessages(prev => [...prev, { role: 'assistant', text: '' }])

    try {
      const response = await fetch('http://127.0.0.1:8765/api/generate/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText })
      })

      if (!response.body) {
        throw new Error("No response body available from backend sidecar.")
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let assistantText = ""
      let activeModel = ""
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ""

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue

          try {
            const data = JSON.parse(trimmed.slice(6))
            if (data.type === 'content' && data.text) {
              assistantText += data.text
              setMessages(prev => {
                const updated = [...prev]
                if (updated[updated.length - 1]) {
                  updated[updated.length - 1].text = assistantText
                }
                return updated
              })
            } else if (data.type === 'start' && data.model) {
              activeModel = data.model
              setMessages(prev => {
                const updated = [...prev]
                if (updated[updated.length - 1]) {
                  updated[updated.length - 1].model = activeModel
                }
                return updated
              })
            } else if (data.type === 'fallback' && data.to_model) {
              activeModel = data.to_model
              setMessages(prev => {
                const updated = [...prev]
                if (updated[updated.length - 1]) {
                  updated[updated.length - 1].model = activeModel
                }
                return updated
              })
            }
          } catch (err) {
            // Partial JSON chunk
          }
        }
      }
    } catch (err: any) {
      console.error(err)
      setMessages(prev => {
        const updated = [...prev]
        if (updated[updated.length - 1]) {
          updated[updated.length - 1].text = `Error: ${err.message || 'Failed to connect to local sidecar.'}`
        }
        return updated
      })
    } finally {
      setIsSending(false)
    }
  }

  // Handle file uploads (Cover Letter Mode)
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

  const skillTabs = [
    { id: 'chat', label: '💬 Free Chat' },
    { id: 'cover_letter', label: '📝 Cover Letter' },
    { id: 'translate', label: '🌐 PDF Translator' },
    { id: 'merge', label: '📂 Merge PDFs' },
  ]

  return (
    <div className="convo flex-1 flex flex-col justify-between" style={{ minHeight: 'calc(100vh - 40px)' }}>
      {/* Head */}
      <div className="convo-head" style={{ display: 'flex', justifyContent: 'between', alignItems: 'center', width: '100%', padding: '14px 20px', borderBottom: '1px solid var(--line)' }}>
        <div>
          <h2>Writing <em>room.</em></h2>
          <div className="meta">
            <span>Fallback chain: Gemini 2.0 → Llama 3.3 → DeepSeek</span>
          </div>
        </div>
      </div>

      {/* Main Workspace (Displays either Chat history or Cover Letter Form) */}
      <div className="flex-1 flex flex-col justify-between overflow-hidden">
        
        {selectedSkill === 'chat' ? (
          /* GENERAL CHAT ASSISTANT WORKSPACE */
          messages.length > 0 ? (
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6" style={{ maxHeight: 'calc(100vh - 280px)' }}>
              {messages.map((msg, i) => (
                <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-2 mb-1 text-[11px] text-muted">
                    {msg.role === 'user' ? (
                      <span>You</span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px]">
                        <span className="star text-burgundy">✦</span>
                        {msg.model ? msg.model.replace('openrouter/', '') : 'Local Intelligence'}
                      </span>
                    )}
                  </div>
                  <div
                    className={`p-3.5 px-4 rounded-2xl max-w-2xl text-[13.5px] leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-burgundy text-paper rounded-tr-none'
                        : 'bg-surface border border-line rounded-tl-none font-serif text-ink'
                    }`}
                    style={{ whiteSpace: 'pre-wrap' }}
                  >
                    {msg.text || (
                      <span className="opacity-50 animate-pulse">Thinking...</span>
                    )}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          ) : (
            /* CHAT WELCOME STATE */
            <div className="flex-1 flex flex-col justify-center max-w-3xl w-full mx-auto py-8 px-6">
              <div className="flex justify-center mb-5">
                <LogoMark size={56} />
              </div>
              <h1 className="text-3xl font-serif italic text-ink text-center mb-2 leading-tight">
                How can I help you today?
              </h1>
              <p className="text-xs text-muted text-center max-w-md mx-auto mb-8">
                Your private writing assistant. Powered by local pipeline fallbacks.
              </p>

              {/* Suggested prompts grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-xl mx-auto w-full">
                {[
                  { title: "Draft a follow-up email", subtitle: "to a hiring manager after an interview" },
                  { title: "Review my resume profile", subtitle: "and suggest high-impact action verbs" },
                  { title: "Explain async/await in JS", subtitle: "simply with a real-world analogy" },
                  { title: "Suggest networking messages", subtitle: "for reaching out on LinkedIn" },
                ].map((prompt, index) => (
                  <button
                    key={index}
                    className="p-3.5 text-left bg-surface border border-line rounded-xl hover:border-burgundy hover:bg-surface-2 transition-all group"
                    onClick={() => handleSendChat(prompt.title)}
                  >
                    <div className="font-medium text-xs text-ink group-hover:text-burgundy transition-colors">{prompt.title}</div>
                    <div className="text-[10px] text-muted">{prompt.subtitle}</div>
                  </button>
                ))}
              </div>
            </div>
          )
        ) : (
          /* COVER LETTER GENERATOR WORKSPACE */
          <div className="flex-1 flex flex-col justify-center max-w-3xl w-full mx-auto py-8 px-6">
            <div className="hero text-center mb-6" style={{ padding: 0, justifycontent: 'center' }}>
              <div className="hero-pre">Writing room for cover letters</div>
              <h1 className="text-3xl font-serif italic text-ink my-3 leading-tight">
                Tell me about the role.<br />
                I'll draft the rest, <em>in your voice.</em>
              </h1>
              <p className="hero-sub text-xs max-w-xl mx-auto text-muted">
                Paste a job posting or drop the PDF. We will parse the requirements, analyze it against your resume, and write an authentic letter.
              </p>
            </div>
          </div>
        )}

        {/* Input box deck (Pinned at the bottom) */}
        <div className="max-w-3xl w-full mx-auto px-6 pb-6">
          
          {/* Dynamic Tabs Above Chat Box */}
          <div className="flex items-center gap-1.5 mb-2.5">
            {skillTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.id === 'translate') {
                    setScreen('translator')
                  } else if (tab.id === 'merge') {
                    setScreen('merge')
                  } else {
                    setSelectedSkill(tab.id as any)
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedSkill === tab.id
                    ? 'bg-burgundy text-paper shadow-sm'
                    : 'text-muted hover:text-ink hover:bg-surface-2'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Interactive Chat Box Container */}
          <div className="space-y-3">
            <div
              className={`relative border border-dashed rounded-2xl p-4 transition-all duration-300 ${
                isDragging ? 'border-burgundy bg-burgundy-soft/20 scale-[1.01]' : 'border-line hover:border-ink-2 bg-surface-2'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <textarea
                className="w-full h-32 bg-transparent outline-none text-ink text-sm placeholder:text-muted resize-none leading-relaxed"
                placeholder={
                  selectedSkill === 'chat'
                    ? "Type your message to chat safely with local intelligence..."
                    : "Paste job posting description here, or drop a document to parse requirements..."
                }
                value={inputText}
                onChange={handleTextChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && selectedSkill === 'chat') {
                    e.preventDefault()
                    handleSendChat()
                  }
                }}
              />

              {isUploading && (
                <div className="absolute inset-0 bg-paper/85 flex items-center justify-center rounded-2xl">
                  <div className="text-center space-y-2">
                    <div style={{
                      width: 24,
                      height: 24,
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

            {/* Actions deck */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <button
                  className="suggestion flex items-center gap-2 text-xs"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Icon.Attach s={11} />
                  <span>Upload Document</span>
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept=".pdf,.docx,.txt"
                  onChange={handleFileChange}
                />

                {selectedSkill === 'cover_letter' && (
                  <button
                    className="suggestion flex items-center gap-1.5 text-xs"
                    onClick={() => setInputText(`Senior Backend Engineer at Anthropic\n\nWe are looking for someone to own our request routing layer...`)}
                  >
                    <Icon.Sparkle s={10} />
                    <span>Load Sample Posting</span>
                  </button>
                )}
              </div>

              {/* Language Selector & CTA Trigger */}
              <div className="flex items-center gap-4">
                {selectedSkill === 'cover_letter' && (
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
                )}

                {selectedSkill === 'chat' ? (
                  <button
                    className={`btn primary flex items-center gap-2 text-xs ${isSending ? 'opacity-50' : ''}`}
                    onClick={() => handleSendChat()}
                    disabled={isSending}
                  >
                    <span>Send Message</span>
                    <Icon.Send s={11} />
                  </button>
                ) : (
                  <button
                    className="btn primary flex items-center gap-2 text-xs"
                    onClick={handleProceed}
                  >
                    <span>Analyze & Continue</span>
                    <Icon.Arrow s={11} />
                  </button>
                )}
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 bg-burgundy-soft border border-badge-burgundy-border rounded-xl text-xs text-burgundy text-center">
                {errorMsg}
              </div>
            )}
          </div>

          {/* Bottom stats footer */}
          <div className="flex justify-center gap-8 mt-6 text-[10px] text-muted border-t border-line-soft pt-4 select-none">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-forest" />
              All data kept local
            </span>
            <span className="flex items-center gap-1.5">
              <Icon.Sparkle s={11} />
              Cascading fallback keys configured
            </span>
            <span className="flex items-center gap-1.5">
              <Icon.Docs s={11} />
              Resume templates ready
            </span>
          </div>
        </div>

      </div>
      
      <style dangerouslySetInnerHTML={{ __html: '@keyframes spin { to { transform: rotate(360deg); } }' }} />
    </div>
  )
}
