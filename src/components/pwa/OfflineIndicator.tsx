import { useEffect, useState } from 'react'
import { WifiOff, Wifi } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import './pwa-components.css'

// ─── Component ────────────────────────────────────────────────────────────────

export default function OfflineIndicator() {
  const { isOnline } = useOnlineStatus()
  const [shouldShow, setShouldShow] = useState(false)

  useEffect(() => {
    if (!isOnline) {
      setShouldShow(true)
    } else {
      // Hide after 3 seconds on restore
      const timer = setTimeout(() => {
        setShouldShow(false)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [isOnline])

  if (!shouldShow) return null

  const bannerClass = `pwa-offline-indicator${
    isOnline ? ' pwa-offline-indicator--online' : ' pwa-offline-indicator--offline'
  }`

  return (
    <div className={bannerClass} role="status" aria-live="polite">
      {isOnline ? (
        <div className="pwa-offline-row">
          <Wifi size={14} className="pwa-offline-icon" />
          <span>Back online — Syncing changes...</span>
        </div>
      ) : (
        <div className="pwa-offline-row">
          <WifiOff size={14} className="pwa-offline-icon" />
          <span>You're offline — changes will sync when reconnected</span>
        </div>
      )}
    </div>
  )
}
