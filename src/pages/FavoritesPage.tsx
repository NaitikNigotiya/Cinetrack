import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWatchlist } from '@/features/watchlist/hooks/useWatchlist'
import { getImageUrl } from '@/lib/tmdb'
import './FavoritesPage.css'

export default function FavoritesPage() {
  const navigate = useNavigate()
  const { entries, updateEntry } = useWatchlist()
  const [activeFilter, setActiveFilter] = useState('All')
  const [sortBy, setSortBy] = useState('date')
  
  const favorites = entries.filter(e => e.isFavorite)
  
  const filteredFavorites = favorites
    .filter(e => {
      if (activeFilter === 'Movies') return e.type === 'movie'
      if (activeFilter === 'TV Shows') return e.type === 'tv'
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0)
      if (sortBy === 'title') return a.title.localeCompare(b.title)
      if (sortBy === 'year') return b.year - a.year
      
      const getMs = (val: any) => {
        if (!val) return 0
        if (typeof val.toDate === 'function') return val.toDate().getTime()
        if (val.seconds) return val.seconds * 1000
        return new Date(val).getTime() || 0
      }
      return getMs(b.addedAt) - getMs(a.addedAt)
    })

  const toggleFavorite = (titleId: string) => {
    updateEntry(titleId, { isFavorite: false })
  }

  return (
    <div style={{
      height: '100vh', overflowY: 'auto', overflowX: 'hidden',
      padding: '24px 32px', boxSizing: 'border-box',
    }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 style={{ fontSize: '28px', fontWeight: 800,
              color: 'var(--text-primary)', margin: 0 }}>Favorites</h1>
            <span style={{
              background: 'var(--color-brand)', color: 'var(--text-on-brand)',
              fontSize: '12px', fontWeight: 700, padding: '2px 10px',
              borderRadius: '999px',
            }}>{favorites.length} titles</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Your most loved movies and shows
          </p>
        </div>

        {/* Sort dropdown */}
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          style={{
            background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)', padding: '8px 12px',
            color: 'var(--text-primary)', fontSize: '13px', cursor: 'pointer',
          }}
        >
          <option value="date">Date Added</option>
          <option value="rating">Rating</option>
          <option value="title">Title A-Z</option>
          <option value="year">Year</option>
        </select>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {['All', 'Movies', 'TV Shows'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveFilter(tab)}
            style={{
              padding: '7px 18px', borderRadius: '999px', border: 'none',
              fontWeight: 600, fontSize: '13px', cursor: 'pointer',
              background: activeFilter === tab ? 'var(--color-brand)' : 'var(--bg-elevated)',
              color: activeFilter === tab ? 'var(--text-on-brand)' : 'var(--text-secondary)',
            }}
          >{tab}</button>
        ))}
      </div>

      {/* Empty state */}
      {filteredFavorites.length === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '80px 24px',
        }}>
          <div style={{ fontSize: '56px', marginBottom: '16px' }}>❤️</div>
          <h3 style={{ fontSize: '20px', fontWeight: 700,
            color: 'var(--text-primary)', marginBottom: '8px' }}>
            No favorites yet
          </h3>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)',
            textAlign: 'center', maxWidth: '300px', marginBottom: '20px' }}>
            Tap the ❤️ on any title or watchlist card to add it here
          </p>
          <button
            onClick={() => navigate('/search')}
            style={{
              padding: '10px 24px', background: 'var(--color-brand)',
              color: 'var(--text-on-brand)', border: 'none',
              borderRadius: 'var(--radius-md)', fontWeight: 600, cursor: 'pointer',
            }}
          >Browse Titles</button>
        </div>
      ) : (
        /* Poster grid */
        <div className="poster-grid">
          {filteredFavorites.map(entry => (
            <div
              key={entry.titleId}
              onClick={() => navigate(`/title/${entry.titleId}`)}
              style={{ cursor: 'pointer', position: 'relative' }}
            >
              {/* Poster */}
              <div style={{ position: 'relative', borderRadius: 'var(--radius-md)',
                overflow: 'hidden', aspectRatio: '2/3' }}>
                <img
                  src={getImageUrl(entry.posterPath, 'w500') || ''}
                  alt={entry.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                {/* Gradient overlay */}
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%',
                  background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                }} />
                {/* Heart badge */}
                <div style={{
                  position: 'absolute', top: 8, right: 8,
                  background: 'rgba(0,0,0,0.6)', borderRadius: '50%',
                  width: 32, height: 32, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: '14px',
                }}>❤️</div>
                {/* Rating badge */}
                {entry.rating && (
                  <div style={{
                    position: 'absolute', top: 8, left: 8,
                    background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
                    borderRadius: 'var(--radius-sm)', padding: '2px 6px',
                    fontSize: '11px', fontWeight: 700, color: '#F5C518',
                  }}>⭐ {entry.rating}</div>
                )}
                {/* Title over gradient */}
                <div style={{
                  position: 'absolute', bottom: 8, left: 8, right: 8,
                }}>
                  <div style={{ fontSize: '12px', fontWeight: 700,
                    color: 'white', lineHeight: 1.3,
                    display: '-webkit-box', WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>{entry.title}</div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)',
                    marginTop: '2px' }}>{entry.year}</div>
                </div>
              </div>

              {/* Unfavorite button below card */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  toggleFavorite(entry.titleId)
                }}
                style={{
                  width: '100%', marginTop: '6px', padding: '6px',
                  background: 'rgba(229,9,20,0.1)',
                  border: '1px solid rgba(229,9,20,0.3)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-error)', fontSize: '12px',
                  fontWeight: 600, cursor: 'pointer',
                }}
              >♥ Remove from Favorites</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
