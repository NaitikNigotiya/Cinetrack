import { useEffect } from 'react'

interface TrailerModalProps {
  isOpen: boolean
  onClose: () => void
  videoKey: string | null
  title: string
}

export function TrailerModal({ isOpen, onClose, videoKey, title }: TrailerModalProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKey)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.92)',
          zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            width: '90vw', maxWidth: '960px',
            background: '#000', borderRadius: 'var(--radius-xl)',
            overflow: 'hidden', position: 'relative',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            background: '#111',
            borderBottom: '1px solid #222',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '16px' }}>▶️</span>
              <span style={{ fontSize: '15px', fontWeight: 700,
                color: 'white' }}>{title} — Trailer</span>
            </div>
            <button
              onClick={onClose}
              style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: 'white', fontSize: '16px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >✕</button>
          </div>

          {/* Video */}
          {videoKey ? (
            <div style={{ position: 'relative', paddingTop: '56.25%' }}>
              <iframe
                src={`https://www.youtube.com/embed/${videoKey}?autoplay=1&rel=0`}
                title={`${title} Trailer`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{
                  position: 'absolute', top: 0, left: 0,
                  width: '100%', height: '100%', border: 'none',
                }}
              />
            </div>
          ) : (
            <div style={{
              padding: '60px 24px', textAlign: 'center',
              color: '#888', fontSize: '15px',
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎬</div>
              <div style={{ fontWeight: 600, color: 'white',
                marginBottom: '8px' }}>No trailer available</div>
              <div>No official trailer found for this title</div>
              <a
                href={`https://www.youtube.com/results?search_query=${encodeURIComponent(title + ' official trailer')}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block', marginTop: '16px',
                  padding: '10px 20px', background: '#E50914',
                  color: 'white', borderRadius: '8px',
                  fontWeight: 600, fontSize: '14px',
                  textDecoration: 'none',
                }}
              >
                Search on YouTube →
              </a>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
