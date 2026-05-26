import React, { useEffect } from 'react'
import { useAppStore } from './store/useAppStore'
import { WindowChrome, Sidebar, SidebarToggleRail } from './components/SharedUI'

// Import Screens
import LandingScreen from './routes/LandingScreen'
import SettingsScreen from './routes/SettingsScreen'
import MergeScreen from './routes/MergeScreen'
import TranslatorScreen from './routes/TranslatorScreen'

export default function App() {
  const {
    activeScreen,
    sidecarHealthy,
    setSidecarHealthy,
    checkingHealth,
    setCheckingHealth,
    sidebarOpen,
    setSidebarOpen,
  } = useAppStore()

  // Poll sidecar health on mount
  useEffect(() => {
    let active = true
    const checkHealth = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8765/health')
        if (res.ok) {
          const data = await res.json()
          if (data.status === 'ok') {
            if (active) {
              setSidecarHealthy(true)
              setCheckingHealth(false)
            }
            return true
          }
        }
      } catch (e) {
        // Ignored
      }
      return false
    }

    const startPolling = async () => {
      // Try immediately
      const ok = await checkHealth()
      if (ok) return

      // Poll every 500ms
      const interval = setInterval(async () => {
        const okNow = await checkHealth()
        if (okNow) {
          clearInterval(interval)
        }
      }, 500)

      // Timeout after 15 seconds
      setTimeout(() => {
        clearInterval(interval)
        if (active) {
          setCheckingHealth(false)
        }
      }, 15000)
    }

    startPolling()

    return () => {
      active = false
    }
  }, [setSidecarHealthy, setCheckingHealth])

  // Listen for ⌘\ or Ctrl+\ shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault()
        setSidebarOpen(!sidebarOpen)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [sidebarOpen, setSidebarOpen])

  const renderActiveScreen = () => {
    switch (activeScreen) {
      case 'landing':
        return <LandingScreen />
      case 'settings':
        return <SettingsScreen />
      case 'merge':
        return <MergeScreen />
      case 'translator':
        return <TranslatorScreen />
      default:
        return <LandingScreen />
    }
  }

  // Loading boot state
  if (checkingHealth && !sidecarHealthy) {
    return (
      <div className="window">
        <WindowChrome />
        <div className="shell flex items-center justify-center" style={{ minHeight: 'calc(100vh - 38px)' }}>
          <div className="text-center space-y-5">
            <div style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              border: '2.5px solid var(--line)',
              borderTopColor: 'var(--burgundy)',
              animation: 'spin 1.2s linear infinite',
              margin: '0 auto'
            }} />
            <img 
              src="logos/lockups/smartiz-lockup.svg" 
              alt="Smartiz" 
              style={{ height: '36px', width: 'auto', display: 'block', margin: '0 auto' }} 
            />
            <p className="text-xs text-muted">Booting local intelligence pipeline...</p>
          </div>
        </div>
        <style dangerouslySetInnerHTML={{ __html: '@keyframes spin { to { transform: rotate(360deg); } }' }} />
      </div>
    )
  }

  return (
    <div className="window select-none">
      <WindowChrome />
      <div className={`shell ${sidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}`}>
        <Sidebar />
        <SidebarToggleRail isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
        {renderActiveScreen()}
      </div>
    </div>
  )
}
