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
    <div className="unified-page-container">
      <header className="unified-page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 className="page-title">Favorites</h1>
            <span style={{
              background: 'var(--color-brand)', color: 'var(--text-on-brand)',
              fontSize: '12px', fontWeight: 700, padding: '2px 10px',
              borderRadius: '999px',
            }}>{favorites.length} titles</span>
          </div>
          <p className="page-subtitle">Your most loved movies and shows</p>
        </div>

        {/* Sort dropdown */}
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          className="cinetrack-select"
          style={{
            width: 'auto',
            flexShrink: 0,
          }}
        >
          <option value="date">Date Added</option>
          <option value="rating">Rating</option>
          <option value="title">Title A-Z</option>
          <option value="year">Year</option>
        </select>
      </header>

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
        <div className="state-display-container">
          <div className="state-display-icon">🎬</div>
          <h3 className="state-display-title">Nothing tracked yet</h3>
          <p className="state-display-msg">Your added items will organize themselves nicely right here.</p>
        </div>
      ) : (
        /* Poster grid */
        <div className="media-card-grid">
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
