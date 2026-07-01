import { useState, Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { useWatchlistSync } from '@/features/watchlist/useWatchlistSync'
import { useAuth } from '@/features/auth/useAuth'
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
  const { user } = useAuth()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  return (
    <div className="app-shell-container">
      <OfflineIndicator />
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Mobile Header — fixed top bar */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '56px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-default)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        zIndex: 200,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
      className="mobile-header"
      >
        {/* Hamburger */}
        <button
          onClick={() => setIsSidebarOpen(true)}
          style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
          }}
          type="button"
        >
          <Menu size={20} color="var(--text-primary)" />
        </button>

        {/* CineTrack branding — center */}
        <div style={{
          position: 'absolute', left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: 8,
          pointerEvents: 'none',
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7,
            background: 'var(--color-brand)',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 16,
          }}>🎬</div>
          <span style={{
            fontSize: 18, fontWeight: 900, letterSpacing: '0.3px',
            color: 'var(--text-primary)',
          }}>
            CINE<span style={{ color: 'var(--color-brand)' }}>TRACK</span>
          </span>
        </div>

        {/* Right: user avatar */}
        <img
          src={user?.photoURL || ''}
          alt="Profile"
          style={{
            width: 34, height: 34, borderRadius: '50%',
            objectFit: 'cover', border: '2px solid var(--border-default)',
            cursor: 'pointer',
          }}
          onClick={() => setIsSidebarOpen(true)}
          onError={e => {
            e.currentTarget.style.display = 'none'
          }}
        />
      </div>

      <main className="app-shell-main main-content-area">
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
