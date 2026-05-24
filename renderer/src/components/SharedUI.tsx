import React from 'react'
import { useAppStore } from '../store/useAppStore'
import { useTranslatorStore } from '../store/useTranslatorStore'

// ── Tiny icon set (inline SVG) ──
export const Icon = {
  Plus: ({ s = 14 }: { s?: number }) => (
    <svg viewBox="0 0 16 16" width={s} height={s} className="ic-stroke" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3v10M3 8h10" />
    </svg>
  ),
  Chat: ({ s = 14 }: { s?: number }) => (
    <svg viewBox="0 0 16 16" width={s} height={s} className="ic-stroke" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 3.5h11v8h-5l-3 2.5v-2.5h-3z" />
    </svg>
  ),
  Docs: ({ s = 14 }: { s?: number }) => (
    <svg viewBox="0 0 16 16" width={s} height={s} className="ic-stroke" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2.5h6l2.5 2.5v8.5h-8.5z" />
      <path d="M10 2.5v3h2.5" />
    </svg>
  ),
  Layers: ({ s = 14 }: { s?: number }) => (
    <svg viewBox="0 0 16 16" width={s} height={s} className="ic-stroke" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2.5 2.5 5.5 8 8.5l5.5-3z" />
      <path d="m2.5 8 5.5 3 5.5-3M2.5 10.5l5.5 3 5.5-3" />
    </svg>
  ),
  Merge: ({ s = 14 }: { s?: number }) => (
    <svg viewBox="0 0 16 16" width={s} height={s} className="ic-stroke" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 3.5h4v9h-4z" />
      <path d="M9.5 5.5h3v5h-3z" />
    </svg>
  ),
  History: ({ s = 14 }: { s?: number }) => (
    <svg viewBox="0 0 16 16" width={s} height={s} className="ic-stroke" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 5v3l2 1.5" />
    </svg>
  ),
  Settings: ({ s = 14 }: { s?: number }) => (
    <svg viewBox="0 0 16 16" width={s} height={s} className="ic-stroke" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="2" />
      <path d="M8 1.5v2M8 12.5v2M14.5 8h-2M3.5 8h-2M12.6 3.4 11.2 4.8M4.8 11.2l-1.4 1.4M12.6 12.6l-1.4-1.4M4.8 4.8 3.4 3.4" />
    </svg>
  ),
  Send: ({ s = 14 }: { s?: number }) => (
    <svg viewBox="0 0 16 16" width={s} height={s} className="ic-stroke" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 8 13.5 2.5 11 13.5 8.5 9.5z" />
    </svg>
  ),
  Attach: ({ s = 14 }: { s?: number }) => (
    <svg viewBox="0 0 16 16" width={s} height={s} className="ic-stroke" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="m9.5 4-4.7 4.7a2.1 2.1 0 0 0 3 3l4.7-4.7a3.5 3.5 0 0 0-5-5L3 6.5" />
    </svg>
  ),
  Sparkle: ({ s = 14 }: { s?: number }) => (
    <svg viewBox="0 0 16 16" width={s} height={s} fill="currentColor">
      <path d="M8 1.5 9 6l4.5 1L9 8l-1 4.5L7 8 2.5 7 7 6z" />
    </svg>
  ),
  Tick: ({ s = 14 }: { s?: number }) => (
    <svg viewBox="0 0 16 16" width={s} height={s} className="ic-stroke" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="m3.5 8 3 3 6-6" />
    </svg>
  ),
  Edit: ({ s = 14 }: { s?: number }) => (
    <svg viewBox="0 0 16 16" width={s} height={s} className="ic-stroke" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 13.5v-2.7L10.3 3l2.7 2.7-7.8 7.8z" />
      <path d="M9 4.3 11.7 7" />
    </svg>
  ),
  Download: ({ s = 14 }: { s?: number }) => (
    <svg viewBox="0 0 16 16" width={s} height={s} className="ic-stroke" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2.5v8M5 7.5l3 3 3-3M2.5 13.5h11" />
    </svg>
  ),
  Refresh: ({ s = 14 }: { s?: number }) => (
    <svg viewBox="0 0 16 16" width={s} height={s} className="ic-stroke" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 8a5.5 5.5 0 0 1 9.4-3.9" />
      <path d="M12 2v3h-3" />
      <path d="M13.5 8a5.5 5.5 0 0 1-9.4 3.9" />
      <path d="M4 14v-3h3" />
    </svg>
  ),
  Globe: ({ s = 14 }: { s?: number }) => (
    <svg viewBox="0 0 16 16" width={s} height={s} className="ic-stroke" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="5.5" />
      <path d="M2.5 8h11M8 2.5c1.7 2 2.5 3.7 2.5 5.5S9.7 13.5 8 13.5 5.5 9.8 5.5 8 6.3 4.5 8 2.5z" />
    </svg>
  ),
  Translate: ({ s = 14 }: { s?: number }) => (
    <svg viewBox="0 0 16 16" width={s} height={s} className="ic-stroke" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4h5M4.5 3v1c0 2.5-1.5 4.5-2.5 5M3 7c.8 1.3 2.2 2.3 3.5 2.7" />
      <path d="M9 14l2.5-6 2.5 6M9.7 12.4h3.6" />
    </svg>
  ),
  Stop: ({ s = 14 }: { s?: number }) => (
    <svg viewBox="0 0 16 16" width={s} height={s} fill="currentColor">
      <rect x="4" y="4" width="8" height="8" rx="1.5" />
    </svg>
  ),
  Drag: ({ s = 14 }: { s?: number }) => (
    <svg viewBox="0 0 16 16" width={s} height={s} fill="currentColor">
      <circle cx="6" cy="4" r="1" />
      <circle cx="10" cy="4" r="1" />
      <circle cx="6" cy="8" r="1" />
      <circle cx="10" cy="8" r="1" />
      <circle cx="6" cy="12" r="1" />
      <circle cx="10" cy="12" r="1" />
    </svg>
  ),
  Trash: ({ s = 14 }: { s?: number }) => (
    <svg viewBox="0 0 16 16" width={s} height={s} className="ic-stroke" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4.5h10M6 4.5V3h4v1.5M5 4.5l.7 8.5h4.6l.7-8.5" />
    </svg>
  ),
  Eye: ({ s = 14 }: { s?: number }) => (
    <svg viewBox="0 0 16 16" width={s} height={s} className="ic-stroke" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" />
      <circle cx="8" cy="8" r="2" />
    </svg>
  ),
  Arrow: ({ s = 14 }: { s?: number }) => (
    <svg viewBox="0 0 16 16" width={s} height={s} className="ic-stroke" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  ),
}

// ── Window chrome ──
interface WindowChromeProps {
  title?: React.ReactNode
  right?: React.ReactNode
}

export function WindowChrome({ title, right }: WindowChromeProps) {
  const { sidecarHealthy } = useAppStore()

  return (
    <div className="titlebar select-none">
      <div className="traffic">
        <span className="r" />
        <span className="y" />
        <span className="g" />
      </div>
      <div className="title-mid">
        {title || (
          <>
            Smartiz — <em>a writing room</em>
          </>
        )}
      </div>
      <div className="title-right">
        <span className="flex items-center gap-1.5">
          <span className={`pill-dot ${sidecarHealthy ? 'bg-forest' : 'bg-burgundy animate-pulse'}`} />
          {sidecarHealthy ? 'Sidecar healthy' : 'Sidecar offline'}
        </span>
        {right}
      </div>
    </div>
  )
}

// ── Sidebar ──
export function Sidebar() {
  const { activeScreen, setScreen, resetStore } = useAppStore()

  const items = [
    { id: 'landing', ic: <Icon.Chat />, label: 'Writing room' },
    { id: 'resumes', ic: <Icon.Docs />, label: 'Settings & profiles' },
    { id: 'translator', ic: <Icon.Translate />, label: 'Translator' },
    { id: 'merge', ic: <Icon.Merge />, label: 'Merge PDFs' },
  ]

  const handleItemClick = (id: string) => {
    if (id === 'landing') {
      resetStore() // Back to clean landing
    } else if (id === 'resumes') {
      setScreen('settings') // maps resumes settings tab
    } else {
      setScreen(id as any)
    }
  }

  // Active mapping helper
  const isSelected = (id: string) => {
    if (id === 'landing') {
      return ['landing', 'setup', 'generating', 'review', 'analyzing'].includes(activeScreen)
    }
    if (id === 'resumes') {
      return activeScreen === 'settings'
    }
    return activeScreen === id
  }

  return (
    <aside className="sidebar select-none">
      <div className="brand cursor-pointer" onClick={() => resetStore()}>
        <div className="brand-mark">S</div>
        <div>
          <div className="brand-name">
            Smart<em>iz</em>
          </div>
          <div className="brand-sub">v 1.0 · local</div>
        </div>
      </div>

      <button className="new-btn" onClick={() => resetStore()}>
        <span className="plus">+</span>
        <span>New cover letter</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.6 }} className="kbd">
          ⌘N
        </span>
      </button>

      <div className="nav-section">
        {items.map((it) => (
          <div
            key={it.id}
            className={`nav-item ${isSelected(it.id) ? 'active' : ''}`}
            onClick={() => handleItemClick(it.id)}
          >
            <span className="ic">{it.ic}</span>
            <span>{it.label}</span>
          </div>
        ))}
      </div>

      <div className="nav-section">
        <div className="nav-label">Recent</div>
        <div className="history-list">
          <div className="hist active" onClick={() => setScreen('review')}>
            <div className="hist-title">
              Senior Backend at <em>Anthropic</em>
            </div>
            <div className="hist-sub">
              <span>Anthropic · SF</span>
              <span className="dot" />
              <span>12m</span>
            </div>
          </div>
        </div>
      </div>

      <div className="sidebar-foot">
        <div className={`nav-item ${activeScreen === 'settings' ? 'active' : ''}`} onClick={() => setScreen('settings')}>
          <span className="ic">
            <Icon.Settings />
          </span>
          <span>Settings</span>
        </div>
        <div style={{ padding: '8px 9px 0', fontSize: 10.5, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 7 }}>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: 'var(--burgundy)',
              color: 'var(--paper)',
              display: 'grid',
              placeItems: 'center',
              fontSize: 10,
              fontWeight: 600,
            }}
          >
            MS
          </div>
          <div>
            <div style={{ color: 'var(--ink-2)', fontSize: 11.5 }}>Maxwell Schmidt</div>
            <div>max@schmidt.dev</div>
          </div>
        </div>
      </div>
    </aside>
  )
}

// ── Model pill ──
interface ModelPillProps {
  name: string
  latency?: string
  switching?: boolean
}

export function ModelPill({ name, latency, switching }: ModelPillProps) {
  return (
    <span className="model-pill" style={switching ? { borderColor: 'var(--amber)', background: 'var(--amber-soft)' } : undefined}>
      <span className="star">✦</span>
      <span>{name}</span>
      {latency && <span className="latency">· {latency}</span>}
    </span>
  )
}
