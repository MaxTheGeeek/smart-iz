import React, { useState, useEffect } from 'react'
import { LogoMark } from '../components/SharedUI'
import { 
  History, AlertTriangle, CheckCircle2, FileText, Sparkles, User, 
  Plus, ArrowUp, ArrowDown, Trash2, Download, X 
} from 'lucide-react'

interface IconProps {
  name: string
  size?: number
  className?: string
}

function Icon({ name, size = 14, className }: IconProps) {
  const props = { size, className }
  switch (name) {
    case 'history':
      return <History {...props} />
    case 'error':
      return <AlertTriangle {...props} />
    case 'check':
      return <CheckCircle2 {...props} />
    case 'text':
      return <FileText {...props} />
    case 'magic':
      return <Sparkles {...props} />
    case 'profile':
      return <User {...props} />
    case 'document':
      return <FileText {...props} />
    case 'add':
      return <Plus {...props} />
    case 'arrow-up':
      return <ArrowUp {...props} />
    case 'arrow-down':
      return <ArrowDown {...props} />
    case 'trash':
      return <Trash2 {...props} />
    case 'download':
      return <Download {...props} />
    case 'close':
      return <X {...props} />
    default:
      return <FileText {...props} />
  }
}

interface ExtractedFields {
  company_name?: string
  contact_person?: string
  company_address?: string
  position?: string
  salutation?: string
}

interface HistoryItem {
  id: string
  company_name: string
  position: string
  letter_date: string
  status: string
  created_at: string
}

export default function LandingScreen() {
  // --- Form Fields ---
  const [pasteText, setPasteText] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [companyAddress, setCompanyAddress] = useState('')
  const [position, setPosition] = useState('')
  const [salutation, setSalutation] = useState('')
  const [signOff, setSignOff] = useState('Mit freundlichen Grüßen,')
  const [templateVersion, setTemplateVersion] = useState<'v1' | 'v2'>('v1')
  const [paragraphs, setParagraphs] = useState<string[]>([''])

  // --- UI/UX States ---
  const [isExtracting, setIsExtracting] = useState(false)
  const [isComposing, setIsComposing] = useState(false)
  const [activeLetterId, setActiveLetterId] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [exportUrl, setExportUrl] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // --- History Drawer States ---
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [showHistory, setShowHistory] = useState(false)

  // --- Load history on mount ---
  useEffect(() => {
    fetchHistory()
  }, [])

  const fetchHistory = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8765/api/composer/history')
      if (res.ok) {
        const data = await res.json()
        setHistory(data)
      }
    } catch (err) {
      console.error('Failed to fetch history', err)
    }
  }

  // --- Extract Fields from Paste Text ---
  const handleExtractFields = async () => {
    if (!pasteText.trim()) {
      setErrorMessage('Bitte fügen Sie zuerst einen Anschreiben-Text ein.')
      return
    }
    setIsExtracting(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const res = await fetch('http://127.0.0.1:8765/api/composer/extract-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pasteText }),
      })

      if (!res.ok) throw new Error('Extraktion fehlgeschlagen')
      
      const data: ExtractedFields = await res.json()
      if (data.company_name) setCompanyName(data.company_name)
      if (data.contact_person) setContactPerson(data.contact_person)
      if (data.company_address) setCompanyAddress(data.company_address)
      if (data.position) setPosition(data.position)
      if (data.salutation) setSalutation(data.salutation)

      // Split pasted text into paragraphs if paragraphs are currently empty/single
      if (paragraphs.length <= 1 && !paragraphs[0]) {
        // Simple heuristic: split by double newlines or single newlines with spacing
        const lines = pasteText
          .split(/\n\s*\n/)
          .map(p => p.trim())
          .filter(p => p.length > 0)
        
        // Try to filter out top address/subject/salutation elements if already extracted
        const bodyLines = lines.filter(p => {
          const lower = p.toLowerCase()
          if (data.company_name && lower.includes(data.company_name.toLowerCase())) return false
          if (data.position && lower.includes(data.position.toLowerCase())) return false
          if (data.salutation && lower.includes(data.salutation.toLowerCase())) return false
          if (lower.startsWith('mit freundlichen') || lower.startsWith('sehr geehrte') || lower.startsWith('bewerbung')) return false
          return true
        })

        if (bodyLines.length > 0) {
          setParagraphs(bodyLines)
        }
      }

      setSuccessMessage('Felder wurden erfolgreich extrahiert!')
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (err: any) {
      setErrorMessage(err.message || 'Verbindung zum Extraktions-Server fehlgeschlagen.')
    } finally {
      setIsExtracting(false)
    }
  }

  // --- Paragraph Handlers ---
  const handleAddParagraph = () => {
    setParagraphs([...paragraphs, ''])
  }

  const handleRemoveParagraph = (index: number) => {
    if (paragraphs.length === 1) {
      setParagraphs([''])
    } else {
      setParagraphs(paragraphs.filter((_, i) => i !== index))
    }
  }

  const handleParagraphChange = (index: number, val: string) => {
    const updated = [...paragraphs]
    updated[index] = val
    setParagraphs(updated)
  }

  const handleMoveParagraph = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === paragraphs.length - 1) return

    const updated = [...paragraphs]
    const targetIdx = direction === 'up' ? index - 1 : index + 1
    const temp = updated[index]
    updated[index] = updated[targetIdx]
    updated[targetIdx] = temp
    setParagraphs(updated)
  }

  // --- Compose PDF ---
  const handleComposePdf = async () => {
    if (!companyName.trim() || !position.trim()) {
      setErrorMessage('Firmenname und Position sind Pflichtfelder.')
      return
    }

    setIsComposing(true)
    setErrorMessage('')
    setSuccessMessage('')

    const payload = {
      company_name: companyName,
      contact_person: contactPerson,
      company_address: companyAddress,
      position: position,
      salutation: salutation,
      body_paragraphs: paragraphs.filter(p => p.trim().length > 0),
      sign_off: signOff,
      template_version: templateVersion,
    }

    try {
      const res = await fetch('http://127.0.0.1:8765/api/composer/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error('Rendern fehlgeschlagen')

      const data = await res.json()
      setActiveLetterId(data.cover_letter_id)
      
      // Cache-busting URL parameter
      const stamp = Date.now()
      setPreviewUrl(`http://127.0.0.1:8765${data.preview_url}?t=${stamp}`)
      setExportUrl(`http://127.0.0.1:8765${data.export_url}`)
      
      setSuccessMessage('PDF erfolgreich generiert!')
      setTimeout(() => setSuccessMessage(''), 3000)
      fetchHistory()
    } catch (err: any) {
      setErrorMessage(err.message || 'Verbindung zum Rendering-Server fehlgeschlagen.')
    } finally {
      setIsComposing(false)
    }
  }

  // --- Load Item from History ---
  const handleLoadHistoryItem = async (item: HistoryItem) => {
    setIsComposing(true)
    setShowHistory(false)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const res = await fetch(`http://127.0.0.1:8765/api/composer/${item.id}/preview`)
      if (!res.ok) throw new Error('Eintrag konnte nicht geladen werden')

      // Since we need to populate fields, let's fetch individual record info.
      // Wait, we can fetch all information or just update the preview immediately.
      // Let's populate the preview and let the user view/download it.
      setActiveLetterId(item.id)
      setPreviewUrl(`http://127.0.0.1:8765/api/composer/${item.id}/preview?t=${Date.now()}`)
      setExportUrl(`http://127.0.0.1:8765/api/composer/${item.id}/export`)

      // Fill in form details if available in the history item or record
      // We can also let it load.
      setCompanyName(item.company_name)
      setPosition(item.position)
      
      setSuccessMessage('Anschreiben aus Verlauf geladen!')
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (err: any) {
      setErrorMessage(err.message)
    } finally {
      setIsComposing(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col" style={{ height: 'calc(100vh - 38px)', overflow: 'hidden' }}>
      
      {/* HEADER SECTION */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--line)] bg-[var(--bg-glass)] backdrop-blur-md z-10">
        <div className="flex items-center space-x-3">
          <LogoMark size={28} />
          <div>
            <h1 className="text-sm font-bold tracking-wide text-foreground">PDF COMPOSER</h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Majid Behzadi Template Engine</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button 
            onClick={() => setShowHistory(!showHistory)} 
            className="btn btn-secondary text-xs flex items-center space-x-1.5 py-1 px-3"
            style={{ borderRadius: 6 }}
          >
            <Icon name="history" size={14} />
            <span>Verlauf ({history.length})</span>
          </button>
        </div>
      </div>

      {/* DUAL COLUMN CONTAINER */}
      <div className="flex flex-1" style={{ overflow: 'hidden' }}>
        
        {/* LEFT COLUMN: EDITOR FORM */}
        <div className="w-1/2 flex flex-col border-r border-[var(--line)] bg-[var(--bg-deep)]" style={{ overflowY: 'auto' }}>
          
          <div className="p-6 space-y-6">
            
            {/* ALERT BOXES */}
            {errorMessage && (
              <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-lg text-xs text-red-200 flex items-start space-x-2 animate-fadeIn">
                <Icon name="error" size={16} className="text-red-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
            {successMessage && (
              <div className="p-3 bg-green-950/40 border border-green-800/60 rounded-lg text-xs text-green-200 flex items-start space-x-2 animate-fadeIn">
                <Icon name="check" size={16} className="text-green-400 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* SECTION 1: QUICK INGESTION */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center space-x-1.5">
                  <Icon name="text" size={12} />
                  <span>1. Anschreiben Text Ingestion (Optional)</span>
                </label>
              </div>
              <div className="glass-card p-4 space-y-3">
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder="Fügen Sie hier Ihren Entwurfstext oder Roh-Anschreiben ein, um die Felder automatisch zu befüllen..."
                  rows={4}
                  className="w-full text-xs bg-[var(--bg-card)] border border-[var(--line)] rounded-md p-2.5 focus:outline-none focus:border-[#006CA5] transition-all resize-none font-sans"
                  style={{ lineHeight: 1.5 }}
                />
                <button
                  onClick={handleExtractFields}
                  disabled={isExtracting || !pasteText.trim()}
                  className="btn btn-secondary w-full text-xs flex items-center justify-center space-x-2 py-2"
                  style={{ borderRadius: 6 }}
                >
                  {isExtracting ? (
                    <>
                      <div className="spinner size-3" />
                      <span>Extrahiere strukturierte Daten...</span>
                    </>
                  ) : (
                    <>
                      <Icon name="magic" size={12} className="text-[#006CA5]" />
                      <span>Felder aus Text befüllen</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* SECTION 2: METADATA & RECIPIENT */}
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center space-x-1.5">
                <Icon name="profile" size={12} />
                <span>2. Metadaten & Empfänger</span>
              </label>
              <div className="glass-card p-4 space-y-4">
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Firmenname *</span>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="z.B. Porsche Informatik GmbH"
                      className="w-full text-xs bg-[var(--bg-card)] border border-[var(--line)] rounded-md p-2.5 focus:outline-none focus:border-[#006CA5] transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Position *</span>
                    <input
                      type="text"
                      value={position}
                      onChange={(e) => setPosition(e.target.value)}
                      placeholder="z.B. Senior .NET Developer"
                      className="w-full text-xs bg-[var(--bg-card)] border border-[var(--line)] rounded-md p-2.5 focus:outline-none focus:border-[#006CA5] transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Ansprechpartner / Kontakt</span>
                    <input
                      type="text"
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
                      placeholder="z.B. z. Hd. Frau Regina Danninger"
                      className="w-full text-xs bg-[var(--bg-card)] border border-[var(--line)] rounded-md p-2.5 focus:outline-none focus:border-[#006CA5] transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Adresse der Firma</span>
                    <input
                      type="text"
                      value={companyAddress}
                      onChange={(e) => setCompanyAddress(e.target.value)}
                      placeholder="z.B. Groß-Siegharts, Österreich"
                      className="w-full text-xs bg-[var(--bg-card)] border border-[var(--line)] rounded-md p-2.5 focus:outline-none focus:border-[#006CA5] transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Begrüßung</span>
                    <input
                      type="text"
                      value={salutation}
                      onChange={(e) => setSalutation(e.target.value)}
                      placeholder="z.B. Sehr geehrte Frau Danninger,"
                      className="w-full text-xs bg-[var(--bg-card)] border border-[var(--line)] rounded-md p-2.5 focus:outline-none focus:border-[#006CA5] transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Grußformel</span>
                    <input
                      type="text"
                      value={signOff}
                      onChange={(e) => setSignOff(e.target.value)}
                      placeholder="Mit freundlichen Grüßen,"
                      className="w-full text-xs bg-[var(--bg-card)] border border-[var(--line)] rounded-md p-2.5 focus:outline-none focus:border-[#006CA5] transition-all"
                    />
                  </div>
                </div>

                {/* PDF Template Version Selection */}
                <div className="space-y-2 border-t border-[var(--line)] pt-4 mt-2">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">
                    Absenderadresse / Briefkopf-Vorlage (Auswahl)
                  </span>
                  <div className="flex space-x-3">
                    <label className={`flex-1 flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all ${templateVersion === 'v1' ? 'border-[#006CA5] bg-[#006CA5]/5 text-foreground' : 'border-[var(--line)] bg-[var(--bg-deep)] text-muted-foreground hover:border-[var(--line-active)]'}`}>
                      <input 
                        type="radio" 
                        name="template_version" 
                        value="v1" 
                        checked={templateVersion === 'v1'} 
                        onChange={() => setTemplateVersion('v1')}
                        className="hidden"
                      />
                      <div className="flex flex-col text-left">
                        <span className="text-xs font-bold">Vorlage V1 (Wien)</span>
                        <span className="text-[10px] opacity-80 mt-0.5">Wehlistraße 334, 1020 Wien</span>
                      </div>
                      <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${templateVersion === 'v1' ? 'border-[#006CA5] bg-[#006CA5]' : 'border-[var(--line)]'}`}>
                        {templateVersion === 'v1' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </label>

                    <label className={`flex-1 flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all ${templateVersion === 'v2' ? 'border-[#006CA5] bg-[#006CA5]/5 text-foreground' : 'border-[var(--line)] bg-[var(--bg-deep)] text-muted-foreground hover:border-[var(--line-active)]'}`}>
                      <input 
                        type="radio" 
                        name="template_version" 
                        value="v2" 
                        checked={templateVersion === 'v2'} 
                        onChange={() => setTemplateVersion('v2')}
                        className="hidden"
                      />
                      <div className="flex flex-col text-left">
                        <span className="text-xs font-bold">Vorlage V2 (Unterwaltersdorf)</span>
                        <span className="text-[10px] opacity-80 mt-0.5">Wiener Str. 20/1, Unterwaltersdorf</span>
                      </div>
                      <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${templateVersion === 'v2' ? 'border-[#006CA5] bg-[#006CA5]' : 'border-[var(--line)]'}`}>
                        {templateVersion === 'v2' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </label>
                  </div>
                </div>

              </div>
            </div>

            {/* SECTION 3: BODY PARAGRAPHS */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center space-x-1.5">
                  <Icon name="document" size={12} />
                  <span>3. Hauptteil (Absätze)</span>
                </label>
                <button
                  onClick={handleAddParagraph}
                  className="btn btn-secondary text-[10px] flex items-center space-x-1 py-1 px-2.5"
                  style={{ borderRadius: 4 }}
                >
                  <Icon name="add" size={10} />
                  <span>Absatz hinzufügen</span>
                </button>
              </div>

              <div className="space-y-3">
                {paragraphs.map((pText, idx) => (
                  <div key={idx} className="glass-card p-3 space-y-2 relative group animate-slideIn">
                    <div className="flex items-center justify-between border-b border-[var(--line)] pb-1.5 mb-1.5">
                      <span className="text-[10px] font-bold text-[#006CA5]">Absatz {idx + 1}</span>
                      
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleMoveParagraph(idx, 'up')}
                          disabled={idx === 0}
                          className="p-1 hover:bg-[var(--bg-card)] rounded text-muted-foreground disabled:opacity-30"
                        >
                          <Icon name="arrow-up" size={10} />
                        </button>
                        <button
                          onClick={() => handleMoveParagraph(idx, 'down')}
                          disabled={idx === paragraphs.length - 1}
                          className="p-1 hover:bg-[var(--bg-card)] rounded text-muted-foreground disabled:opacity-30"
                        >
                          <Icon name="arrow-down" size={10} />
                        </button>
                        <button
                          onClick={() => handleRemoveParagraph(idx)}
                          className="p-1 hover:bg-red-950/40 rounded text-red-400/80 hover:text-red-400 ml-2"
                        >
                          <Icon name="trash" size={10} />
                        </button>
                      </div>
                    </div>

                    <textarea
                      value={pText}
                      onChange={(e) => handleParagraphChange(idx, e.target.value)}
                      placeholder={`Geben Sie hier den Inhalt für Absatz ${idx + 1} ein...`}
                      rows={3}
                      className="w-full text-xs bg-[var(--bg-deep)] border border-[var(--line)] rounded p-2 focus:outline-none focus:border-[#006CA5] transition-all resize-none font-sans"
                      style={{ lineHeight: 1.5 }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* COMPOSE SUBMIT ACTION */}
            <div className="pt-2">
              <button
                onClick={handleComposePdf}
                disabled={isComposing || !companyName.trim() || !position.trim()}
                className="btn btn-primary w-full py-3 flex items-center justify-center space-x-2 text-sm font-bold tracking-wide"
                style={{
                  borderRadius: 8,
                  background: 'linear-gradient(135deg, #006CA5 0%, #005684 100%)',
                  boxShadow: '0 4px 12px rgba(0, 108, 165, 0.25)',
                }}
              >
                {isComposing ? (
                  <>
                    <div className="spinner size-4" />
                    <span>Rendern läuft...</span>
                  </>
                ) : (
                  <>
                    <Icon name="document" size={16} />
                    <span>PDF Anschreiben Erstellen</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>

        {/* RIGHT COLUMN: PREVIEW PANEL */}
        <div className="w-1/2 flex flex-col bg-[var(--bg-deep)] relative">
          
          {previewUrl ? (
            <div className="flex flex-col h-full">
              {/* Toolbar */}
              <div className="flex items-center justify-between px-6 py-2.5 border-b border-[var(--line)] bg-[var(--bg-glass)]">
                <span className="text-xs font-semibold text-foreground flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span>Vorschau geladen</span>
                </span>
                
                <div className="flex items-center space-x-2">
                  <a
                    href={exportUrl || '#'}
                    download
                    className="btn btn-primary text-xs flex items-center space-x-1.5 py-1 px-3.5"
                    style={{ borderRadius: 4, background: '#006CA5' }}
                  >
                    <Icon name="download" size={13} />
                    <span>Herunterladen</span>
                  </a>
                </div>
              </div>

              {/* PDF Preview Frame */}
              <div className="flex-1 p-4 bg-[#141414] flex items-center justify-center">
                <iframe
                  src={previewUrl}
                  title="PDF Preview"
                  className="w-full h-full border border-[var(--line)] rounded-lg shadow-xl"
                  style={{ background: '#FFFFFF' }}
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#0F0F0F] relative overflow-hidden">
              
              {/* Background gradient orb */}
              <div 
                className="absolute"
                style={{
                  width: '300px',
                  height: '300px',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(0, 108, 165, 0.08) 0%, rgba(0,0,0,0) 70%)',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  pointerEvents: 'none'
                }}
              />

              <div className="space-y-4 max-w-sm relative z-10">
                <div 
                  className="mx-auto flex items-center justify-center" 
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: '50%',
                    background: 'rgba(0, 108, 165, 0.1)',
                    border: '1px dashed rgba(0, 108, 165, 0.3)',
                    animation: 'pulse 3s infinite'
                  }}
                >
                  <Icon name="document" size={28} className="text-[#006CA5]" />
                </div>
                
                <h3 className="text-sm font-bold text-foreground">Bereit zum Rendern</h3>
                
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Tragen Sie links Firmenname und Position ein oder fügen Sie Text ein und klicken Sie auf 
                  <strong className="text-foreground"> "PDF Anschreiben Erstellen"</strong>, um Ihr hochauflösendes, pixelgenaues Anschreiben anzuzeigen.
                </p>
              </div>

            </div>
          )}

        </div>

      </div>

      {/* HISTORY DRAWER SLIDE-OUT */}
      {showHistory && (
        <div className="absolute inset-y-0 right-0 w-80 bg-[var(--bg-glass)] border-l border-[var(--line)] shadow-2xl backdrop-blur-lg z-50 flex flex-col animate-slideLeft">
          
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--line)]">
            <span className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center space-x-1.5">
              <Icon name="history" size={14} className="text-[#006CA5]" />
              <span>Verlauf</span>
            </span>
            <button 
              onClick={() => setShowHistory(false)}
              className="p-1 hover:bg-[var(--bg-card)] rounded text-muted-foreground"
            >
              <Icon name="close" size={14} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {history.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-xs text-muted-foreground">Bisher noch keine Dokumente generiert.</p>
              </div>
            ) : (
              history.map((item) => (
                <div 
                  key={item.id}
                  onClick={() => handleLoadHistoryItem(item)}
                  className="p-3 bg-[var(--bg-card)] border border-[var(--line)] hover:border-[#006CA5] rounded-lg cursor-pointer transition-all space-y-1.5 text-left group"
                >
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-bold text-[#006CA5] truncate max-w-[120px]">
                      {item.company_name}
                    </span>
                    <span className="text-[8px] text-muted-foreground bg-[var(--bg-deep)] px-1.5 py-0.5 rounded uppercase">
                      {item.status}
                    </span>
                  </div>
                  <h4 className="text-xs font-semibold text-foreground truncate group-hover:text-[#006CA5] transition-colors">
                    {item.position}
                  </h4>
                  <div className="text-[9px] text-muted-foreground">
                    {item.letter_date}
                  </div>
                </div>
              ))
            )}
          </div>

        </div>
      )}

    </div>
  )
}
