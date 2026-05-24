import React, { useState, useEffect } from 'react'
import { useAppStore, StyleType } from '../store/useAppStore'
import { Icon, ModelPill } from '../components/SharedUI'

interface DBResume {
  id: string
  name: string
  file_name: string
  parsed_text: string
  created_at: string
}

interface DBTemplate {
  id: string
  name: string
  variant: string
  created_at: string
}

export default function SetupScreen() {
  const {
    positionData,
    setScreen,
    setSelectedResumeId,
    setSelectedTemplateId,
    setSelectedStyleType,
    selectedResumeId,
    selectedTemplateId,
    selectedStyleType,
    language,
    setLanguage
  } = useAppStore()

  const [resumes, setResumes] = useState<DBResume[]>([])
  const [templates, setTemplates] = useState<DBTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Fetch resumes and templates from the backend on load
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [resRes, tempRes] = await Promise.all([
          fetch('http://127.0.0.1:8765/api/resumes'),
          fetch('http://127.0.0.1:8765/api/templates')
        ])
        
        if (resRes.ok) {
          const resumesData = await resRes.json()
          setResumes(resumesData)
          if (resumesData.length > 0 && !selectedResumeId) {
            setSelectedResumeId(resumesData[0].id)
          }
        }
        
        if (tempRes.ok) {
          const templatesData = await tempRes.json()
          setTemplates(templatesData)
          if (templatesData.length > 0 && !selectedTemplateId) {
            setSelectedTemplateId(templatesData[0].id)
          }
        }
      } catch (e) {
        console.error('Error fetching resumes or templates', e)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [setSelectedResumeId, setSelectedTemplateId, selectedResumeId, selectedTemplateId])

  const handleStartGeneration = () => {
    if (!selectedResumeId || !selectedTemplateId) return
    setScreen('generating')
  }

  // Pre-formatted fallback data if DB is seeding/empty
  const fallbackResumes = [
    { id: 'res-1', name: 'Backend & Infra Resume', file_name: 'schmidt-backend-2025.pdf', tags: ['Python', 'Rust', 'K8s', 'SRE'] },
    { id: 'res-2', name: 'Full-Stack Generalist', file_name: 'schmidt-fullstack-2025.pdf', tags: ['React', 'TypeScript', 'Node'] }
  ]

  const stylesList: { id: StyleType; label: string; desc: string }[] = [
    { id: 'standard', label: 'Standard', desc: 'Classic, balanced formal editorial style' },
    { id: 'confident', label: 'Confident', desc: 'Bold, direct, results-oriented, zero hedging' },
    { id: 'accomplishment', label: 'Accomplishment', desc: 'Quantified outcomes matching requirements' },
    { id: 'motivational', label: 'Motivational', desc: 'Passionate and authentic company mission alignment' },
    { id: 'networking', label: 'Networking', desc: 'Connected industry references and reputation' },
    { id: 'creative', label: 'Creative', desc: 'Brief storytelling and memorable openers' },
    { id: 'analytical', label: 'Analytical', desc: 'Data-driven skill matrices and breakdowns' }
  ]

  const templateThemes = [
    { id: 'temp-classic', name: 'Classic Ink', color: '#14130F', desc: 'Formal black & warm paper cream' },
    { id: 'temp-modern', name: 'Modern Sage', color: '#3F5A2D', desc: 'Clean forest accents for modern roles' },
    { id: 'temp-minimal', name: 'Minimal Mono', color: 'transparent', border: '1px solid var(--line)', desc: 'Editorial typography, zero decorations' },
    { id: 'temp-bold', name: 'Bold Sienna', color: '#6B1F1F', desc: 'Terracotta banner headers' },
    { id: 'temp-architect', name: 'Architect Navy', color: '#1A2745', desc: 'Navy structural block header layout' }
  ]

  if (!positionData) {
    return (
      <div className="p-8 text-center text-muted">
        No parsed position details loaded. Go back and paste a description.
      </div>
    )
  }

  const activeResumeId = selectedResumeId || (resumes.length > 0 ? resumes[0].id : fallbackResumes[0].id)
  const activeTemplateId = selectedTemplateId || (templates.length > 0 ? templates[0].id : templateThemes[0].id)

  return (
    <div className="convo flex-1 flex flex-col justify-between" style={{ minHeight: 'calc(100vh - 100px)' }}>
      {/* Head */}
      <div className="convo-head">
        <h2>
          {positionData.position_title} at <em>{positionData.company_name || 'Hiring Company'}.</em>
        </h2>
        <div className="meta">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-forest" />
            Position parsed
          </span>
          <span>· {positionData.key_skills.length} core skills detected</span>
          <button className="btn ghost py-0.5 px-2 text-xs flex items-center gap-1" onClick={() => setScreen('landing')}>
            <Icon.Edit s={11} />
            <span>Edit posting</span>
          </button>
        </div>
      </div>

      {/* Split layout: Pos details (left) + Setup pickers (right) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 py-6 overflow-y-auto">
        
        {/* Left Column: Pos card */}
        <div className="lg:col-span-5 space-y-4">
          <div className="poscard">
            <div className="poscard-head">
              <div className="poscard-eyebrow flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <span className="tick">
                    <Icon.Tick s={9} />
                  </span>
                  Parsed analysis
                </span>
                <span>local model</span>
              </div>
              <h3 className="font-serif italic text-xl text-ink my-1">
                {positionData.position_title}
              </h3>
              <div className="poscard-meta text-xs text-muted">
                <span>at</span>{' '}
                <strong className="text-ink-2">{positionData.company_name || 'Hiring Company'}</strong>
                {positionData.industry && (
                  <>
                    <span className="mx-1">·</span>
                    <span>{positionData.industry}</span>
                  </>
                )}
              </div>
            </div>
            
            <dl className="poscard-body text-xs space-y-3">
              <div>
                <dt className="text-muted font-mono uppercase tracking-wider mb-0.5">Summary</dt>
                <dd className="text-ink-2 leading-relaxed">{positionData.position_summary}</dd>
              </div>
              
              <div>
                <dt className="text-muted font-mono uppercase tracking-wider mb-1">Key skills identified</dt>
                <dd className="flex flex-wrap gap-1.5">
                  {positionData.key_skills.map((skill, idx) => (
                    <span key={idx} className="skill match flex items-center gap-0.5">
                      ✓ {skill}
                    </span>
                  ))}
                </dd>
              </div>

              {positionData.required_experience && (
                <div>
                  <dt className="text-muted font-mono uppercase tracking-wider mb-0.5">Experience target</dt>
                  <dd className="text-ink-2">{positionData.required_experience}</dd>
                </div>
              )}
            </dl>

            <div className="poscard-foot flex justify-between items-center text-xs">
              <span>Detected Language: <strong>{language.toUpperCase()}</strong></span>
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
          </div>
        </div>

        {/* Right Column: Setup deck */}
        <div className="lg:col-span-7 space-y-6">
          {/* Resume Picker */}
          <div>
            <h4 className="text-xs font-mono uppercase tracking-wider text-muted mb-2.5">
              1. Choose a resume profile
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {resumes.length > 0 ? (
                resumes.map((res) => (
                  <button
                    key={res.id}
                    className={`resume-chip flex text-left p-3 rounded-xl border transition-all duration-200 ${
                      activeResumeId === res.id
                        ? 'selected border-burgundy'
                        : 'border-line hover:border-ink-2 bg-surface'
                    }`}
                    onClick={() => setSelectedResumeId(res.id)}
                  >
                    <div className="doc-ic mr-3 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm text-ink truncate">{res.name}</h4>
                      <div className="text-xs text-muted truncate mt-0.5">{res.file_name}</div>
                    </div>
                    {activeResumeId === res.id && (
                      <span className="match">match 94%</span>
                    )}
                  </button>
                ))
              ) : (
                fallbackResumes.map((res) => (
                  <button
                    key={res.id}
                    className={`resume-chip flex text-left p-3 rounded-xl border transition-all duration-200 ${
                      activeResumeId === res.id
                        ? 'selected border-burgundy'
                        : 'border-line hover:border-ink-2 bg-surface'
                    }`}
                    onClick={() => setSelectedResumeId(res.id)}
                  >
                    <div className="doc-ic mr-3 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm text-ink truncate">{res.name}</h4>
                      <div className="text-xs text-muted truncate mt-0.5">{res.file_name}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Persona Writing Styles */}
          <div>
            <h4 className="text-xs font-mono uppercase tracking-wider text-muted mb-2.5">
              2. Cover letter persona voice
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {stylesList.map((st) => (
                <button
                  key={st.id}
                  className={`text-left p-2.5 rounded-xl border text-xs transition-all duration-150 ${
                    selectedStyleType === st.id
                      ? 'border-burgundy bg-burgundy-soft/20 text-burgundy shadow-sm'
                      : 'border-line hover:border-ink-2 bg-surface text-ink-2'
                  }`}
                  onClick={() => setSelectedStyleType(st.id)}
                >
                  <div className="font-semibold text-ink text-sm flex items-center justify-between">
                    <span>{st.label}</span>
                    {selectedStyleType === st.id && (
                      <span className="w-1.5 h-1.5 rounded-full bg-burgundy" />
                    )}
                  </div>
                  <div className="text-muted mt-1 leading-snug">{st.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Template Styles */}
          <div>
            <h4 className="text-xs font-mono uppercase tracking-wider text-muted mb-2.5">
              3. PDF visual template sheet
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {templateThemes.map((theme) => {
                const isSelectedTheme = activeTemplateId === theme.id || (templates.length > 0 && templates[0].id === activeTemplateId)
                return (
                  <button
                    key={theme.id}
                    className={`flex flex-col items-center text-center p-2 rounded-xl border transition-all duration-200 ${
                      isSelectedTheme
                        ? 'border-burgundy bg-burgundy-soft/10 shadow-md scale-[1.02]'
                        : 'border-line hover:border-ink-2 bg-surface'
                    }`}
                    onClick={() => {
                      const matched = templates.find(t => t.variant === theme.id.replace('temp-', ''))
                      setSelectedTemplateId(matched ? matched.id : theme.id)
                    }}
                  >
                    {/* Tiny visual representation */}
                    <div
                      className="w-12 h-16 rounded border bg-white shadow-sm overflow-hidden mb-2 relative"
                      style={{ borderColor: 'var(--line-soft)' }}
                    >
                      <div style={{ height: 10, background: theme.color, borderBottom: theme.border }} />
                      <div className="p-1 space-y-1">
                        <div className="h-1 bg-ink/40 w-8 rounded-full" />
                        <div className="h-0.5 bg-muted/30 w-10 rounded-full" />
                        <div className="h-0.5 bg-muted/20 w-9 rounded-full" />
                        <div className="h-0.5 bg-muted/20 w-10 rounded-full" />
                      </div>
                    </div>
                    <span className="text-xs font-medium text-ink truncate w-full">{theme.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Foot Actions */}
      <div className="convo-foot border-t border-line-soft pt-4 flex items-center justify-between">
        <ModelPill name="llama-3.3-70b" latency="setup mode" />
        <button
          className="btn primary flex items-center gap-2 px-6 py-2.5 rounded-xl shadow-md text-sm"
          onClick={handleStartGeneration}
        >
          <Icon.Sparkle s={13} />
          <span>Draft cover letter</span>
        </button>
      </div>
    </div>
  )
}
