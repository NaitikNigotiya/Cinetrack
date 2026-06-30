import { useState, Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { useWatchlistSync } from '@/features/watchlist/useWatchlistSync'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { PageLoadingFallback } from './PageLoadingFallback'

// ── PWA Indicators ───────────────────────────────────────────────────────────
import OfflineIndicator from '@/components/pwa/OfflineIndicator'
import InstallPrompt from '@/components/pwa/InstallPrompt'
import UpdatePrompt from '@/components/pwa/UpdatePrompt'

import './AppShell.css'

/**
 * Layout shell for all authenticated pages.
 * Sidebar handles all navigation. On mobile a floating ☰ FAB opens the drawer.
 * No header bar exists at any screen size.
 */
export function AppShell() {
  useWatchlistSync()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  return (
    <div className="app-shell-container">
      <OfflineIndicator />
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Floating hamburger — mobile only, hidden when sidebar is open */}
      {!isSidebarOpen && (
        <button
          className="app-shell-fab"
          onClick={() => setIsSidebarOpen(true)}
          aria-label="Open navigation menu"
          type="button"
        >
          <Menu size={20} />
        </button>
      )}

      <main className="app-shell-main">
        <ErrorBoundary fallbackTitle="Application error">
          <Suspense fallback={<PageLoadingFallback />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>

      <InstallPrompt />
      <UpdatePrompt />
    </div>
  )
}
