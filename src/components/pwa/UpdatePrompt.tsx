import { useRegisterSW } from 'virtual:pwa-register/react'
import { Info, X } from 'lucide-react'
import './pwa-components.css'

// ─── Component ────────────────────────────────────────────────────────────────

export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered() {},
    onRegisterError(error: unknown) {
      console.error('[CineTrack PWA] SW registration error:', error)
    },
  })

  const handleUpdate = () => {
    updateServiceWorker(true)
  }

  const handleClose = () => {
    setNeedRefresh(false)
  }

  if (!needRefresh) return null

  return (
    <div className="pwa-update-prompt animate-slide-up" role="alert" aria-live="assertive">
      <div className="pwa-update-left">
        <Info size={16} className="pwa-update-info-icon" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <p className="pwa-update-title">Update Available</p>
          <p className="pwa-update-desc">A new version of CineTrack is ready.</p>
        </div>
      </div>

      <div className="pwa-update-actions">
        <button className="pwa-update-btn" onClick={handleUpdate} type="button">
          Update Now
        </button>
        <button
          className="pwa-update-close-btn"
          onClick={handleClose}
          aria-label="Dismiss update banner"
          type="button"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
