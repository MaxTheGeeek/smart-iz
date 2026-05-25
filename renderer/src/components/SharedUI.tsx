import React, { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { useTranslatorStore } from '../store/useTranslatorStore'

// ── Tiny icon set (inline SVG) ──
interface IconProps {
  s?: number
  className?: string
}

export const Icon = {
  Plus: ({ s = 14, className }: IconProps) => (
    <svg viewBox="0 0 16 16" width={s} height={s} className={`ic-stroke ${className || ''}`} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3v10M3 8h10" />
    </svg>
  ),
  Chat: ({ s = 14, className }: IconProps) => (
    <svg viewBox="0 0 16 16" width={s} height={s} className={`ic-stroke ${className || ''}`} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 3.5h11v8h-5l-3 2.5v-2.5h-3z" />
    </svg>
  ),
  Docs: ({ s = 14, className }: IconProps) => (
    <svg viewBox="0 0 16 16" width={s} height={s} className={`ic-stroke ${className || ''}`} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2.5h6l2.5 2.5v8.5h-8.5z" />
      <path d="M10 2.5v3h2.5" />
    </svg>
  ),
  Layers: ({ s = 14, className }: IconProps) => (
    <svg viewBox="0 0 16 16" width={s} height={s} className={`ic-stroke ${className || ''}`} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2.5 2.5 5.5 8 8.5l5.5-3z" />
      <path d="m2.5 8 5.5 3 5.5-3M2.5 10.5l5.5 3 5.5-3" />
    </svg>
  ),
  Merge: ({ s = 14, className }: IconProps) => (
    <svg viewBox="0 0 16 16" width={s} height={s} className={`ic-stroke ${className || ''}`} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 3.5h4v9h-4z" />
      <path d="M9.5 5.5h3v5h-3z" />
    </svg>
  ),
  History: ({ s = 14, className }: IconProps) => (
    <svg viewBox="0 0 16 16" width={s} height={s} className={`ic-stroke ${className || ''}`} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 5v3l2 1.5" />
    </svg>
  ),
  Settings: ({ s = 14, className }: IconProps) => (
    <svg viewBox="0 0 16 16" width={s} height={s} className={`ic-stroke ${className || ''}`} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="2" />
      <path d="M8 1.5v2M8 12.5v2M14.5 8h-2M3.5 8h-2M12.6 3.4 11.2 4.8M4.8 11.2l-1.4 1.4M12.6 12.6l-1.4-1.4M4.8 4.8 3.4 3.4" />
    </svg>
  ),
  Send: ({ s = 14, className }: IconProps) => (
    <svg viewBox="0 0 16 16" width={s} height={s} className={`ic-stroke ${className || ''}`} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 8 13.5 2.5 11 13.5 8.5 9.5z" />
    </svg>
  ),
  Attach: ({ s = 14, className }: IconProps) => (
    <svg viewBox="0 0 16 16" width={s} height={s} className={`ic-stroke ${className || ''}`} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="m9.5 4-4.7 4.7a2.1 2.1 0 0 0 3 3l4.7-4.7a3.5 3.5 0 0 0-5-5L3 6.5" />
    </svg>
  ),
  Sparkle: ({ s = 14, className }: IconProps) => (
    <svg viewBox="0 0 16 16" width={s} height={s} className={className} fill="currentColor">
      <path d="M8 1.5 9 6l4.5 1L9 8l-1 4.5L7 8 2.5 7 7 6z" />
    </svg>
  ),
  Tick: ({ s = 14, className }: IconProps) => (
    <svg viewBox="0 0 16 16" width={s} height={s} className={`ic-stroke ${className || ''}`} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="m3.5 8 3 3 6-6" />
    </svg>
  ),
  Edit: ({ s = 14, className }: IconProps) => (
    <svg viewBox="0 0 16 16" width={s} height={s} className={`ic-stroke ${className || ''}`} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 13.5v-2.7L10.3 3l2.7 2.7-7.8 7.8z" />
      <path d="M9 4.3 11.7 7" />
    </svg>
  ),
  Download: ({ s = 14, className }: IconProps) => (
    <svg viewBox="0 0 16 16" width={s} height={s} className={`ic-stroke ${className || ''}`} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2.5v8M5 7.5l3 3 3-3M2.5 13.5h11" />
    </svg>
  ),
  Refresh: ({ s = 14, className }: IconProps) => (
    <svg viewBox="0 0 16 16" width={s} height={s} className={`ic-stroke ${className || ''}`} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 8a5.5 5.5 0 0 1 9.4-3.9" />
      <path d="M12 2v3h-3" />
      <path d="M13.5 8a5.5 5.5 0 0 1-9.4 3.9" />
      <path d="M4 14v-3h3" />
    </svg>
  ),
  Globe: ({ s = 14, className }: IconProps) => (
    <svg viewBox="0 0 16 16" width={s} height={s} className={`ic-stroke ${className || ''}`} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="5.5" />
      <path d="M2.5 8h11M8 2.5c1.7 2 2.5 3.7 2.5 5.5S9.7 13.5 8 13.5 5.5 9.8 5.5 8 6.3 4.5 8 2.5z" />
    </svg>
  ),
  Translate: ({ s = 14, className }: IconProps) => (
    <svg viewBox="0 0 16 16" width={s} height={s} className={`ic-stroke ${className || ''}`} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4h5M4.5 3v1c0 2.5-1.5 4.5-2.5 5M3 7c.8 1.3 2.2 2.3 3.5 2.7" />
      <path d="M9 14l2.5-6 2.5 6M9.7 12.4h3.6" />
    </svg>
  ),
  Stop: ({ s = 14, className }: IconProps) => (
    <svg viewBox="0 0 16 16" width={s} height={s} className={className} fill="currentColor">
      <rect x="4" y="4" width="8" height="8" rx="1.5" />
    </svg>
  ),
  Drag: ({ s = 14, className }: IconProps) => (
    <svg viewBox="0 0 16 16" width={s} height={s} className={className} fill="currentColor">
      <circle cx="6" cy="4" r="1" />
      <circle cx="10" cy="4" r="1" />
      <circle cx="6" cy="8" r="1" />
      <circle cx="10" cy="8" r="1" />
      <circle cx="6" cy="12" r="1" />
      <circle cx="10" cy="12" r="1" />
    </svg>
  ),
  Trash: ({ s = 14, className }: IconProps) => (
    <svg viewBox="0 0 16 16" width={s} height={s} className={`ic-stroke ${className || ''}`} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4.5h10M6 4.5V3h4v1.5M5 4.5l.7 8.5h4.6l.7-8.5" />
    </svg>
  ),
  Eye: ({ s = 14, className }: IconProps) => (
    <svg viewBox="0 0 16 16" width={s} height={s} className={`ic-stroke ${className || ''}`} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" />
      <circle cx="8" cy="8" r="2" />
    </svg>
  ),
  Arrow: ({ s = 14, className }: IconProps) => (
    <svg viewBox="0 0 16 16" width={s} height={s} className={`ic-stroke ${className || ''}`} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  ),
}

export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 26 26"
      fill="none"
      aria-label="Smartiz"
      role="img"
    >
      <rect width="26" height="26" rx="6" fill="#6B1F1F" />
      <path
        d="M17 9.5C17 9.5 15.5 8 13 8C10.5 8 9 9.5 9 11C9 12.5 10 13.2 13 14C16 14.8 17 15.5 17 17C17 18.5 15.5 19 13 19C10.5 19 9 17.5 9 17.5"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
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
  const [isToolsExpanded, setIsToolsExpanded] = useState(true)

  const handleNewChat = () => {
    resetStore()
  }

  // Active mapping helper
  const isSelected = (id: string) => {
    if (id === 'landing') {
      return ['landing', 'setup', 'generating', 'review', 'analyzing'].includes(activeScreen)
    }
    if (id === 'settings') {
      return activeScreen === 'settings'
    }
    return activeScreen === id
  }

  return (
    <aside className="sidebar select-none">
      <div className="brand cursor-pointer" onClick={handleNewChat} style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px dashed var(--line)', paddingBottom: '14px', paddingTop: '4px', width: '100%' }}>
        <LogoMark size={28} />
        <div>
          <div className="brand-name" style={{ fontSize: '16px', fontWeight: 'bold', fontFamily: 'var(--serif)', fontStyle: 'italic', display: 'flex', alignItems: 'center' }}>
            Smartiz
          </div>
          <div className="brand-sub" style={{ fontSize: '10px', opacity: 0.7, margin: 0 }}>v1.1.2 · local</div>
        </div>
      </div>

      <button className="new-btn" onClick={handleNewChat}>
        <span className="plus">+</span>
        <span>New chat</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.6 }} className="kbd">
          ⌘N
        </span>
      </button>

      <div className="sidebar-divider" />

      {/* Main Sections */}
      <div className="nav-section">
        <div
          className={`nav-item ${isSelected('landing') ? 'active' : ''}`}
          onClick={() => setScreen('landing')}
        >
          <span className="ic"><Icon.Chat /></span>
          <span>Writing room</span>
        </div>
        <div
          className={`nav-item ${isSelected('settings') ? 'active' : ''}`}
          onClick={() => setScreen('settings')}
        >
          <span className="ic"><Icon.Docs /></span>
          <span>Settings & profiles</span>
        </div>
      </div>

      <div className="sidebar-divider" />

      {/* Tools Collapsible */}
      <div className="nav-section">
        <div 
          className="sidebar-collapsible-label"
          onClick={() => setIsToolsExpanded(!isToolsExpanded)}
        >
          <span>Tools</span>
          <span style={{ fontSize: '9px', opacity: 0.8, transition: 'transform 0.2s', transform: isToolsExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▼</span>
        </div>
        {isToolsExpanded && (
          <div className="flex flex-col gap-0.5" style={{ paddingLeft: '4px' }}>
            <div
              className={`nav-item ${isSelected('translator') ? 'active' : ''}`}
              onClick={() => setScreen('translator')}
            >
              <span className="ic"><Icon.Translate /></span>
              <span>Translator</span>
            </div>
            <div
              className={`nav-item ${isSelected('merge') ? 'active' : ''}`}
              onClick={() => setScreen('merge')}
            >
              <span className="ic"><Icon.Merge /></span>
              <span>Merge PDFs</span>
            </div>
          </div>
        )}
      </div>

      <div className="sidebar-divider" />

      {/* Recent Section */}
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

      {/* Footer Profile */}
      <div className="sidebar-foot">
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

interface SidebarToggleRailProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function SidebarToggleRail({ isOpen, onToggle }: SidebarToggleRailProps) {
  return (
    <div
      className="sidebar-toggle-rail select-none"
      onClick={onToggle}
      title={isOpen ? 'Hide sidebar (⌘\\)' : 'Show sidebar (⌘\\)'}
      role="button"
      aria-label={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        style={{
          transition: 'transform 0.2s ease',
          transform: isOpen ? 'rotate(0deg)' : 'rotate(180deg)'
        }}
      >
        <path
          d="M9 2L4 7L9 12"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
