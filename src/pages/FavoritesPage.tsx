import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWatchlist } from '@/features/watchlist/hooks/useWatchlist'
import './FavoritesPage.css'

import { PosterCard } from '@/components/ui/PosterCard'

export default function FavoritesPage() {
  const navigate = useNavigate()
  const { entries } = useWatchlist()
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
            <PosterCard
              key={entry.titleId}
              title={entry.title}
              year={entry.year}
              posterPath={entry.posterPath}
              rating={entry.rating}
              type={entry.type}
              isFavorite={entry.isFavorite}
              status={entry.status}
              onClick={() => navigate(`/title/${entry.titleId}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
