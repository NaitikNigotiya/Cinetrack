import { useState } from 'react'
import { getImageUrl } from '@/lib/tmdb'

interface PosterCardProps {
  title: string
  year?: number | null
  posterPath: string | null
  rating?: number | null
  type?: 'movie' | 'tv'
  status?: string
  isFavorite?: boolean
  onClick?: () => void
  onAddClick?: (e: React.MouseEvent) => void
  showAddButton?: boolean
  isInWatchlist?: boolean
}

export function PosterCard({
  title, year, posterPath, rating, type,
  status, isFavorite, onClick, onAddClick,
  showAddButton = false, isInWatchlist = false,
}: PosterCardProps) {
  const [imgLoaded, setImgLoaded] = useState(false)
  const imageUrl = getImageUrl(posterPath, 'w500')

  return (
    <div
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex', flexDirection: 'column',
        width: '100%',
      }}
    >
      {/* Poster wrapper */}
      <div style={{
        position: 'relative', width: '100%', aspectRatio: '2/3',
        borderRadius: 'var(--radius-md)', overflow: 'hidden',
        background: 'var(--bg-elevated)',
      }}>
        {/* Skeleton shimmer while loading */}
        {!imgLoaded && (
          <div className="skeleton" style={{
            position: 'absolute', inset: 0, borderRadius: 0,
          }} />
        )}

        {/* Poster image */}
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            style={{
              width: '100%', height: '100%', objectFit: 'cover',
              display: 'block',
              opacity: imgLoaded ? 1 : 0,
              transition: 'opacity 200ms ease, transform 200ms ease',
            }}
            onMouseEnter={e => {
              if (onClick) e.currentTarget.style.transform = 'scale(1.03)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'scale(1)'
            }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '32px',
            color: 'var(--text-muted)',
          }}>🎬</div>
        )}

        {/* Bottom gradient */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: '50%',
          background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
          pointerEvents: 'none',
        }} />

        {/* Top badges row */}
        <div style={{
          position: 'absolute', top: 6, left: 6, right: 6,
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'flex-start', pointerEvents: 'none',
        }}>
          {/* Type badge */}
          {type && (
            <span style={{
              fontSize: '9px', fontWeight: 800,
              textTransform: 'uppercase', letterSpacing: '0.5px',
              padding: '2px 6px', borderRadius: 'var(--radius-sm)',
              background: type === 'movie' ? 'var(--color-brand)' : '#00B4D8',
              color: 'white',
            }}>
              {type === 'movie' ? 'Movie' : 'TV'}
            </span>
          )}

          {/* Rating badge */}
          {rating != null && rating > 0 && (
            <span style={{
              fontSize: '10px', fontWeight: 700,
              padding: '2px 6px', borderRadius: 'var(--radius-sm)',
              background: 'rgba(0,0,0,0.75)',
              backdropFilter: 'blur(4px)',
              color: '#F5C518',
              display: 'flex', alignItems: 'center', gap: 2,
            }}>
              ⭐ {rating.toFixed(1)}
            </span>
          )}
        </div>

        {/* Status badge if present */}
        {status && (
          <div style={{
            position: 'absolute', top: 28, left: 6,
            fontSize: '9px', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.5px', padding: '2px 6px',
            borderRadius: 'var(--radius-sm)',
            background: status === 'watching' ? 'var(--status-watching)'
              : status === 'completed' ? 'var(--status-completed)'
              : status === 'plan_to_watch' ? 'var(--status-plan)'
              : 'var(--status-dropped)',
            color: 'white',
          }}>
            {status === 'watching' ? 'Watching'
              : status === 'completed' ? 'Done'
              : status === 'plan_to_watch' ? 'Plan'
              : 'Dropped'}
          </div>
        )}

        {/* Favorite heart */}
        {isFavorite && (
          <div style={{
            position: 'absolute', top: 6, right: 36,
            fontSize: '14px', pointerEvents: 'none',
          }}>❤️</div>
        )}

        {/* Title + year over bottom gradient */}
        <div style={{
          position: 'absolute', bottom: showAddButton ? 36 : 6,
          left: 8, right: 8, pointerEvents: 'none',
        }}>
          <div style={{
            fontSize: '11px', fontWeight: 700, color: 'white',
            lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis',
            display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical' as const,
          }}>{title}</div>
          {year && (
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)',
              marginTop: '2px' }}>{year}</div>
          )}
        </div>

        {/* Add button inside poster */}
        {showAddButton && (
          <button
            onClick={onAddClick}
            style={{
              position: 'absolute', bottom: 6, left: 6, right: 6,
              padding: '6px', border: 'none', cursor: 'pointer',
              borderRadius: 'var(--radius-sm)',
              background: isInWatchlist
                ? 'rgba(46,204,113,0.85)' : 'rgba(229,9,20,0.85)',
              color: 'white', fontSize: '11px', fontWeight: 700,
              backdropFilter: 'blur(4px)',
              transition: 'background 150ms ease',
            }}
          >
            {isInWatchlist ? '✓ In Watchlist' : '+ Add'}
          </button>
        )}
      </div>
    </div>
  )
}
