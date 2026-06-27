import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'

interface AuthGuardProps {
  children: ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading, isOwner } = useAuth()
  const location = useLocation()

  // ── Loading state: centered skeleton circle ──────────────────────────────
  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-primary)',
        }}
        aria-label="Loading…"
      >
        <div
          className="skeleton"
          role="status"
          style={{ width: 48, height: 48, borderRadius: '50%' }}
        />
      </div>
    )
  }

  // ── Not authenticated → /login, preserving intended destination ──────────
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // ── Authenticated but wrong account ─────────────────────────────────────
  if (!isOwner) {
    return <Navigate to="/login?error=unauthorized" replace />
  }

  // ── Authorized ───────────────────────────────────────────────────────────
  return <>{children}</>
}
