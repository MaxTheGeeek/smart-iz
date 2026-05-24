import React, { useEffect, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { Icon, ModelPill } from '../components/SharedUI'

export default function GeneratingScreen() {
  const {
    positionData,
    selectedResumeId,
    selectedTemplateId,
    selectedStyleType,
    language,
    setGeneratedText,
    generatedText,
    setQaResult,
    setScreen
  } = useAppStore()

  const [currentStep, setCurrentStep] = useState(3) // Step 3 is "Writing your letter"
  const [stepStatus, setStepStatus] = useState<string>('Writing your letter — ~310 words')
  const [activeModel, setActiveModel] = useState('google/gemini-2.0-flash-exp:free')
  const [modelWarning, setModelWarning] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!positionData || !selectedResumeId || !selectedTemplateId) {
      setErrorMsg('Missing configuration details. Please restart.')
      return
    }

    setGeneratedText('')

    // Initialize Server Sent Events
    const query = new URLSearchParams({
      session_id: positionData.session_id,
      resume_id: selectedResumeId,
      template_id: selectedTemplateId,
      style_type: selectedStyleType,
      language: language
    }).toString()

    const eventSource = new EventSource(`http://127.0.0.1:8765/api/generate/stream?${query}`)

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        if (data.type === 'progress') {
          setStepStatus(data.step)
          if (data.pct < 30) {
            setCurrentStep(2)
          } else if (data.pct < 75) {
            setCurrentStep(3)
          } else if (data.pct < 90) {
            setCurrentStep(4)
          } else {
            setCurrentStep(5)
          }
        } 
        
        else if (data.type === 'token') {
          setGeneratedText((prev) => prev + data.text)
        } 
        
        else if (data.type === 'model_switch') {
          setActiveModel(data.model)
          setModelWarning(`✦ Switched to ${data.model} · primary rate-limit or failover`)
        } 
        
        else if (data.type === 'qa_done') {
          setQaResult({
            has_errors: data.issues.length > 0,
            corrected_text: '',
            issues_found: data.issues,
            qa_score: data.qa_score
          })
        } 
        
        else if (data.type === 'done') {
          eventSource.close()
          if (data.final_text) {
            setGeneratedText(data.final_text)
          }
          // Brief pause for quality transition
          setTimeout(() => {
            setScreen('review')
          }, 800)
        } 
        
        else if (data.type === 'error') {
          setErrorMsg(data.message)
          eventSource.close()
        }
      } catch (err) {
        console.error('SSE JSON error', err)
      }
    }

    eventSource.onerror = (err) => {
      console.error('EventSource connection error', err)
      setErrorMsg('Lost connection to backend sidecar process.')
      eventSource.close()
    }

    return () => {
      eventSource.close()
    }
  }, [positionData, selectedResumeId, selectedTemplateId, selectedStyleType, language, setGeneratedText, setQaResult, setScreen])

  // Split lines to preview in letter sheet
  const paragraphs = generatedText.split('\n\n').filter(p => p.trim())

  return (
    <div className="convo flex-1 flex flex-col justify-between" style={{ minHeight: 'calc(100vh - 100px)' }}>
      {/* Head */}
      <div className="convo-head">
        <h2>
          Generating cover letter for <em>{positionData?.company_name || 'Hiring Company'}.</em>
        </h2>
        <div className="meta">
          <span>Style: <strong>{selectedStyleType.toUpperCase()}</strong></span>
          <span>· Template: <strong>{selectedTemplateId}</strong></span>
        </div>
      </div>

      {/* Generation dashboard */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 py-6 overflow-hidden">
        
        {/* Left Column: Progress Stepper */}
        <div className="lg:col-span-5 space-y-4">
          <div className="stepper p-4 bg-surface-2 border border-line-soft rounded-2xl space-y-3 select-none">
            {/* Step 1 */}
            <div className={`step ${currentStep >= 1 ? 'done' : ''}`}>
              <span className="ind">
                {currentStep > 1 ? <Icon.Tick s={10} /> : '1'}
              </span>
              <span>
                <span className="lab">Position analyzed</span>
                <span className="sub">— requirements mapped successfully</span>
              </span>
            </div>

            {/* Step 2 */}
            <div className={`step ${currentStep >= 2 ? 'done' : ''}`}>
              <span className="ind">
                {currentStep > 2 ? <Icon.Tick s={10} /> : '2'}
              </span>
              <span>
                <span className="lab">Extracting resume achievements</span>
                <span className="sub">— pinpointing specific technology matches</span>
              </span>
            </div>

            {/* Step 3 */}
            <div className={`step ${currentStep === 3 ? 'active' : currentStep > 3 ? 'done' : ''}`}>
              <span className="ind">
                {currentStep > 3 ? <Icon.Tick s={10} /> : '3'}
              </span>
              <span>
                <span className="lab">Drafting cover letter body</span>
                <span className="sub">— streaming candidate voice persona</span>
              </span>
            </div>

            {/* Step 4 */}
            <div className={`step ${currentStep === 4 ? 'active' : currentStep > 4 ? 'done' : ''}`}>
              <span className="ind">
                {currentStep > 4 ? <Icon.Tick s={10} /> : '4'}
              </span>
              <span>
                <span className="lab">Quality assurance audit</span>
                <span className="sub">— fact checking & proofreading</span>
              </span>
            </div>

            {/* Step 5 */}
            <div className={`step ${currentStep === 5 ? 'active' : ''}`}>
              <span className="ind">5</span>
              <span>
                <span className="lab">Finalizing visual compile</span>
                <span className="sub">— building layout overlay PDF</span>
              </span>
            </div>
          </div>

          {modelWarning && (
            <div className="p-3 bg-amber-soft border border-badge-amber-border text-amber text-xs rounded-xl flex items-start gap-2">
              <Icon.Sparkle s={12} className="mt-0.5" />
              <div>
                <div className="font-semibold">Model Pipeline Shift</div>
                <div className="opacity-85 mt-0.5">{modelWarning}</div>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-burgundy-soft border border-badge-burgundy-border text-burgundy text-xs rounded-xl flex items-start gap-2">
              <Icon.Stop s={12} className="mt-0.5" />
              <div>
                <div className="font-semibold">Pipeline Execution Interrupted</div>
                <div className="opacity-85 mt-0.5">{errorMsg}</div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Streaming text sheet preview */}
        <div className="lg:col-span-7 flex flex-col overflow-hidden bg-surface border border-line rounded-2xl">
          <div className="p-3 border-b border-line flex items-center justify-between bg-paper-warm select-none">
            <span className="text-xs text-muted font-mono uppercase tracking-wider">Live stream feed</span>
            <span className="text-xs text-muted">{generatedText.split(/\s+/).filter(Boolean).length} words</span>
          </div>

          <div className="flex-1 p-6 overflow-y-auto font-serif text-sm leading-relaxed text-ink bg-surface border-t border-line space-y-4">
            {paragraphs.length > 0 ? (
              paragraphs.map((p, idx) => (
                <p key={idx} className="relative">
                  {p}
                  {idx === paragraphs.length - 1 && (
                    <span className="inline-block w-1.5 h-4 ml-0.5 bg-burgundy animate-pulse align-middle" />
                  )}
                </p>
              ))
            ) : (
              <p className="text-muted font-sans text-xs italic select-none">
                Waiting for streaming content...
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Foot */}
      <div className="convo-foot border-t border-line-soft pt-4 flex items-center justify-between">
        <ModelPill name={activeModel} latency="streaming completion" />
        <button
          className="btn flex items-center gap-1.5 border-line text-xs"
          onClick={() => setScreen('setup')}
        >
          <Icon.Stop s={11} />
          <span>Stop and edit parameters</span>
        </button>
      </div>
    </div>
  )
}
