import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/features/auth/useAuth'

// ─── Google "G" Logo SVG ──────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const { signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Error from AuthGuard redirect (?error=unauthorized) OR local state
  const urlUnauthorized = searchParams.get('error') === 'unauthorized'
  const showError = urlUnauthorized || error !== null

  const errorMessage = error
    ?? 'This app is private. Your account is not authorized.'

  const handleSignIn = async () => {
    setError(null)
    setLoading(true)
    try {
      await signInWithGoogle()
      navigate('/', { replace: true })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : ''
      if (message === 'ACCESS_DENIED') {
        setError('This app is private. Your account is not authorized.')
      } else if (
        // User intentionally closed the popup — not an error worth showing
        (err as { code?: string }).code !== 'auth/popup-closed-by-user' &&
        (err as { code?: string }).code !== 'auth/cancelled-popup-request'
      ) {
        setError('Sign-in failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)',
        padding: '24px',
      }}
    >
      <div
        className="animate-slide-up"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '24px',
          width: '100%',
          maxWidth: '320px',
          textAlign: 'center',
        }}
      >
        {/* Error banner */}
        {showError && (
          <div
            role="alert"
            aria-live="assertive"
            style={{
              width: '100%',
              padding: '12px 16px',
              background: 'rgba(192, 57, 43, 0.10)',
              border: '1px solid var(--color-error)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-error)',
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span aria-hidden="true">🔒</span>
            {errorMessage}
          </div>
        )}

        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 18, background: '#E50914',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40,
          }}>🎬</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: 1, color: 'var(--text-primary)' }}>
              CINE<span style={{ color: '#E50914' }}>TRACK</span>
            </div>
            <div style={{ fontSize: 11, letterSpacing: 3, color: 'var(--text-muted)', marginTop: 4, textTransform: 'uppercase' }}>
              Track · Rate · Remember
            </div>
          </div>
        </div>

        {/* Tagline */}
        <p
          style={{
            fontSize: 'var(--text-base)',
            color: 'var(--text-muted)',
            fontWeight: 400,
            lineHeight: 1.5,
            marginTop: '-12px',
          }}
        >
          Your private movie &amp; TV journal
        </p>

        {/* Google Sign-In Button */}
        <button
          id="google-sign-in-btn"
          type="button"
          onClick={handleSignIn}
          disabled={loading}
          aria-busy={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            width: '100%',
            padding: '14px 24px',
            background: 'var(--card-bg)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--card-shadow)',
            fontSize: 'var(--text-base)',
            fontWeight: 600,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-family)',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
            transition: 'box-shadow 200ms ease, transform 120ms ease',
          }}
          onMouseEnter={(e) => {
            if (!loading) {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.14)'
              ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow = 'var(--card-shadow)'
            ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'
          }}
        >
          <GoogleIcon />
          <span>{loading ? 'Signing in…' : 'Continue with Google'}</span>
        </button>

        {/* Footer note */}
        <p
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
            lineHeight: 1.6,
          }}
        >
          Private app — only the owner can access this.
        </p>
      </div>
    </div>
  )
}
