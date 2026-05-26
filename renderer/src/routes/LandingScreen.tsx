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

interface ParsedLetter {
  company_name: string
  contact_person: string
  company_address: string
  position: string
  salutation: string
  body_paragraphs: string[]
  sign_off: string
}

function parsePastedCoverLetter(text: string): ParsedLetter {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  
  let company_name = ""
  let contact_person = ""
  let company_address = ""
  let position = ""
  let salutation = ""
  let body_paragraphs: string[] = []
  let sign_off = "Mit freundlichen Grüßen,"
  
  // 1. Identify the salutation line
  let salutationIndex = -1
  const salutationKeywords = [
    'sehr geehrte', 'sehr geehrter', 'liebe', 'lieber', 'dear', 
    'hello', 'hi', 'to whom', 'wertvolle', 'hallo', 'achtung'
  ]
  for (let i = 0; i < lines.length; i++) {
    const lowerLine = lines[i].toLowerCase()
    if (salutationKeywords.some(kw => lowerLine.startsWith(kw))) {
      salutationIndex = i
      salutation = lines[i]
      break
    }
  }

  // 2. Identify the sign-off line (checking from the bottom up)
  let signOffIndex = -1
  const signOffKeywords = [
    'mit freundlichen', 'mit freundlichem', 'freundliche', 'viele grüße', 
    'herzliche', 'best regards', 'kind regards', 'sincerely', 
    'yours sincerely', 'respectfully', 'gruss', 'grüße', 'grüsse', 'cheers'
  ]
  for (let i = lines.length - 1; i >= 0; i--) {
    const lowerLine = lines[i].toLowerCase()
    if (signOffKeywords.some(kw => lowerLine.startsWith(kw))) {
      signOffIndex = i
      sign_off = lines[i]
      break
    }
  }

  // 3. Extract metadata from lines BEFORE the salutation
  const headerLimit = salutationIndex !== -1 ? salutationIndex : Math.min(5, lines.length)
  const headerLines = lines.slice(0, headerLimit)
  
  for (let line of headerLines) {
    const lowerLine = line.toLowerCase()

    // Skip date lines (e.g. "Wien, 26. Mai 2026")
    if (lowerLine.includes('2026') || lowerLine.includes('2025') || lowerLine.includes('mai') || lowerLine.includes('may') || /\d{1,2}\./.test(line)) {
      if (line.includes(',') || line.includes('.')) {
        continue
      }
    }

    // Identify position / subject
    if (lowerLine.startsWith('bewerbung') || lowerLine.startsWith('betreff') || lowerLine.startsWith('subject') || lowerLine.startsWith('application')) {
      position = line.replace(/^(bewerbung als|bewerbung auf|bewerbung|application for|application|subject:|betreff:)\s*/i, '').trim()
      // Capitalize first letter
      position = position.charAt(0).toUpperCase() + position.slice(1)
      continue
    }

    // Check for "z. Hd." or "z.Hd." or "Attention"
    if (line.includes('z. Hd.') || line.includes('z.Hd.') || lowerLine.includes('z.hd') || lowerLine.includes('attention')) {
      const zhMark = line.includes('z. Hd.') ? 'z. Hd.' : (line.includes('z.Hd.') ? 'z.Hd.' : 'z. Hd.')
      const parts = line.split(zhMark)
      
      const comp = parts[0].trim()
      const afterZh = parts[1].trim()
      
      // Look for a city or country address at the end
      const addressKeywords = ['wien', 'österreich', 'austria', 'vienna', 'germany', 'deutschland', 'münchen', 'berlin', 'hamburg', 'frankfurt']
      let addressFoundIdx = -1
      for (const kw of addressKeywords) {
        const idx = afterZh.toLowerCase().indexOf(kw)
        if (idx !== -1 && (addressFoundIdx === -1 || idx < addressFoundIdx)) {
          addressFoundIdx = idx
        }
      }

      if (addressFoundIdx !== -1) {
        contact_person = zhMark + " " + afterZh.substring(0, addressFoundIdx).trim().replace(/,$/, '').trim()
        company_address = afterZh.substring(addressFoundIdx).trim()
      } else {
        if (afterZh.includes(',')) {
          const commaParts = afterZh.split(',')
          contact_person = zhMark + " " + commaParts[0].trim()
          company_address = commaParts.slice(1).join(',').trim()
        } else {
          contact_person = zhMark + " " + afterZh
        }
      }
      
      if (comp) {
        company_name = comp
      }
      continue
    }

    // Default headers
    if (!company_name) {
      company_name = line
    } else if (!company_address) {
      company_address = line
    }
  }

  // 4. Extract body paragraphs (between salutation and sign-off)
  const bodyStart = salutationIndex !== -1 ? salutationIndex + 1 : 0
  const bodyEnd = signOffIndex !== -1 ? signOffIndex : lines.length
  
  const rawBody = lines.slice(bodyStart, bodyEnd)
  for (let line of rawBody) {
    if (line.length > 5) {
      body_paragraphs.push(line)
    }
  }

  return {
    company_name: company_name.trim(),
    contact_person: contact_person.trim(),
    company_address: company_address.trim(),
    position: position.trim(),
    salutation: salutation.trim(),
    body_paragraphs,
    sign_off: sign_off.trim()
  }
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
  const [showAdvanced, setShowAdvanced] = useState(false)
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

  // --- Extract Fields and Generate PDF in Single Click ---
  const handleExtractAndCompose = async (customText?: string) => {
    const textToParse = customText !== undefined ? customText : pasteText
    if (!textToParse.trim()) {
      setErrorMessage('Bitte fügen Sie zuerst einen Anschreiben-Text ein.')
      return
    }

    setIsExtracting(true)
    setErrorMessage('')
    setSuccessMessage('')

    // 1. Parse client-side
    const parsed = parsePastedCoverLetter(textToParse)

    // 2. Set fields in UI state
    setCompanyName(parsed.company_name)
    setContactPerson(parsed.contact_person)
    setCompanyAddress(parsed.company_address)
    setPosition(parsed.position)
    setSalutation(parsed.salutation)
    setParagraphs(parsed.body_paragraphs)
    setSignOff(parsed.sign_off)

    // 3. Immediately compile PDF
    setIsComposing(true)
    const payload = {
      company_name: parsed.company_name,
      contact_person: parsed.contact_person,
      company_address: parsed.company_address,
      position: parsed.position,
      salutation: parsed.salutation,
      body_paragraphs: parsed.body_paragraphs.filter(p => p.trim().length > 0),
      sign_off: parsed.sign_off,
      template_version: templateVersion,
    }

    try {
      const res = await fetch('http://127.0.0.1:8765/api/composer/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error('Rendern des PDFs fehlgeschlagen')

      const data = await res.json()
      setActiveLetterId(data.cover_letter_id)
      
      const stamp = Date.now()
      setPreviewUrl(`http://127.0.0.1:8765${data.preview_url}?t=${stamp}`)
      setExportUrl(`http://127.0.0.1:8765${data.export_url}`)
      
      setSuccessMessage('Anschreiben erfolgreich eingelesen und PDF generiert!')
      setTimeout(() => setSuccessMessage(''), 3000)
      fetchHistory()
    } catch (err: any) {
      setErrorMessage(err.message || 'Verbindung zum Rendering-Server fehlgeschlagen.')
    } finally {
      setIsExtracting(false)
      setIsComposing(false)
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

            {/* SECTION 1: PRIMARY TEXT INGESTION */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center space-x-1.5">
                  <Icon name="text" size={12} className="text-[#006CA5]" />
                  <span>Anschreiben-Text einfügen (Vollständiger Brief)</span>
                </label>
              </div>
              <div className="glass-card p-4 space-y-4">
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder="Fügen Sie hier Ihr vollständiges Anschreiben ein (z. B. mit Anschrift, Betreff, Begrüßung, allen Absätzen und der Grußformel)..."
                  rows={10}
                  className="w-full text-xs bg-[var(--bg-card)] border border-[var(--line)] rounded-md p-3 focus:outline-none focus:border-[#006CA5] transition-all font-sans"
                  style={{ lineHeight: 1.6, minHeight: '220px' }}
                />
                
                <div className="flex space-x-3">
                  <button
                    onClick={() => handleExtractAndCompose()}
                    disabled={isExtracting || isComposing || !pasteText.trim()}
                    className="flex-1 btn btn-primary py-3 flex items-center justify-center space-x-2 text-xs font-bold tracking-wide"
                    style={{
                      borderRadius: 6,
                      background: 'linear-gradient(135deg, #006CA5 0%, #005684 100%)',
                      boxShadow: '0 4px 12px rgba(0, 108, 165, 0.25)',
                    }}
                  >
                    {isExtracting || isComposing ? (
                      <>
                        <div className="spinner size-3.5" />
                        <span>Analysiere & Generiere PDF...</span>
                      </>
                    ) : (
                      <>
                        <Icon name="magic" size={12} />
                        <span>PDF Anschreiben Generieren</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setPasteText('')
                      setCompanyName('')
                      setContactPerson('')
                      setCompanyAddress('')
                      setPosition('')
                      setSalutation('')
                      setParagraphs([''])
                    }}
                    disabled={!pasteText.trim() && !companyName.trim()}
                    className="btn btn-secondary px-4 text-xs font-bold"
                    style={{ borderRadius: 6 }}
                  >
                    Leeren
                  </button>
                </div>
              </div>
            </div>

            {/* COLLAPSIBLE ADVANCED OVERRIDES & MANUAL EDITOR */}
            <div className="border border-[var(--line)] rounded-lg overflow-hidden bg-[var(--bg-glass)]">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between p-3.5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:bg-[var(--surface-2)] transition-all focus:outline-none"
              >
                <div className="flex items-center space-x-2">
                  <Icon name="settings" size={14} className="text-[#006CA5]" />
                  <span>⚙️ Metadaten & Absatz-Editor (Manueller Override)</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{showAdvanced ? 'Ausblenden ▲' : 'Einblenden ▼'}</span>
              </button>

              {showAdvanced && (
                <div className="p-4 border-t border-[var(--line)] space-y-6 bg-[var(--bg-deep)] animate-fadeIn">
                  
                  {/* SECTION 2: METADATA & RECIPIENT */}
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground">Firmenname *</span>
                        <input
                          type="text"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          placeholder="z.B. Voxtronic Austria"
                          className="w-full text-xs bg-[var(--bg-card)] border border-[var(--line)] rounded-md p-2.5 focus:outline-none focus:border-[#006CA5] transition-all"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground">Position *</span>
                        <input
                          type="text"
                          value={position}
                          onChange={(e) => setPosition(e.target.value)}
                          placeholder="z.B. Fullstack Web Developer"
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
                          placeholder="z.B. z. Hd. Recruiting Team"
                          className="w-full text-xs bg-[var(--bg-card)] border border-[var(--line)] rounded-md p-2.5 focus:outline-none focus:border-[#006CA5] transition-all"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground">Adresse der Firma</span>
                        <input
                          type="text"
                          value={companyAddress}
                          onChange={(e) => setCompanyAddress(e.target.value)}
                          placeholder="z.B. Wien, Österreich"
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
                          placeholder="z.B. Sehr geehrte Damen und Herren,"
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

                  {/* SECTION 3: BODY PARAGRAPHS */}
                  <div className="space-y-3 border-t border-[var(--line)] pt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">3. Hauptteil (Absätze)</span>
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

                  {/* UPDATE PDF BUTTON FOR OVERRIDES */}
                  <div className="pt-2 border-t border-[var(--line)]">
                    <button
                      onClick={handleComposePdf}
                      disabled={isComposing || !companyName.trim() || !position.trim()}
                      className="btn btn-primary w-full py-2.5 flex items-center justify-center space-x-2 text-xs font-bold"
                      style={{
                        borderRadius: 6,
                        background: '#006CA5',
                      }}
                    >
                      {isComposing ? (
                        <>
                          <div className="spinner size-3" />
                          <span>PDF wird aktualisiert...</span>
                        </>
                      ) : (
                        <>
                          <Icon name="check" size={12} />
                          <span>Manuelle Änderungen übernehmen & PDF aktualisieren</span>
                        </>
                      )}
                    </button>
                  </div>

                </div>
              )}
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
