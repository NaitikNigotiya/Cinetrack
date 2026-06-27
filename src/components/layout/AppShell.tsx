import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { useWatchlistSync } from '@/features/watchlist/useWatchlistSync'

// ── PWA Indicators ───────────────────────────────────────────────────────────
import OfflineIndicator from '@/components/pwa/OfflineIndicator'
import InstallPrompt from '@/components/pwa/InstallPrompt'
import UpdatePrompt from '@/components/pwa/UpdatePrompt'

import './AppShell.css'

/**
 * Layout shell for all authenticated pages.
 * Also boots the Firestore watchlist real-time listener via useWatchlistSync,
 * so the Zustand store stays current for the entire authenticated session.
 */
export function AppShell() {
  useWatchlistSync()

  return (
    <>
      <OfflineIndicator />
      <main className="app-shell-main">
        <Outlet />
      </main>
      <InstallPrompt />
      <UpdatePrompt />
      <BottomNav />
    </>
  )
}
