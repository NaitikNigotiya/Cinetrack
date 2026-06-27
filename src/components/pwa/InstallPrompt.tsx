import { useEffect, useState } from 'react'
import { X, Download } from 'lucide-react'
import './pwa-components.css'

// ─── Component ────────────────────────────────────────────────────────────────

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // 1. Mobile browser check
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    )
    if (!isMobile) return

    // 2. 7-days dismissed check
    const lastDismissed = localStorage.getItem('cinetrack-install-dismissed')
    if (lastDismissed) {
      const diff = Date.now() - parseInt(lastDismissed, 10)
      const oneWeekMs = 7 * 24 * 60 * 60 * 1000
      if (diff < oneWeekMs) {
        return
      }
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setIsVisible(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return
    setIsVisible(false)
    deferredPrompt.prompt()

    const choiceResult = await deferredPrompt.userChoice
    if (choiceResult.outcome === 'accepted') {
      console.log('[CineTrack PWA] User accepted install prompt.')
    }
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setIsVisible(false)
    localStorage.setItem('cinetrack-install-dismissed', String(Date.now()))
  }

  if (!isVisible) return null

  return (
    <div className="pwa-install-banner animate-slide-up" role="alert">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <p className="pwa-install-title">Install CineTrack</p>
        <p className="pwa-install-desc">Install for the best offline journaling experience</p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button className="pwa-install-btn" onClick={handleInstallClick} type="button">
          <Download size={14} />
          <span>Install</span>
        </button>
        <button
          className="pwa-install-dismiss-btn"
          onClick={handleDismiss}
          aria-label="Dismiss install banner"
          type="button"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
