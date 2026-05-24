import React from 'react'

export default function AnalyzingScreen() {
  return (
    <div className="convo flex-1 flex flex-col justify-center items-center" style={{ minHeight: 'calc(100vh - 100px)' }}>
      <div className="text-center space-y-6 max-w-md mx-auto">
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
          <h2 className="font-serif italic text-3xl text-ink">Analyzing job details...</h2>
          <p className="text-sm text-muted">
            The local LLM is decomposing the job description, extracting key requirements, and mapping optimal resume match parameters.
          </p>
        </div>

        <div className="p-3 bg-surface border border-line rounded-2xl flex items-center justify-between text-xs text-muted select-none">
          <span>Targeting matching schema</span>
          <span>● parsing JSON</span>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: '@keyframes spin { to { transform: rotate(360deg); } }' }} />
    </div>
  )
}
