import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

import { useWatchlist } from '@/features/watchlist/hooks/useWatchlist'

import './WatchingPage.css'

export default function WatchingPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'movies' | 'tv'>('movies')
  const [sortBy, setSortBy] = useState<'newest' | 'updated' | 'title'>('newest')
  
  const { entries } = useWatchlist()
  
  const movieEntries = entries.filter(e => e.status === 'watching' && e.type === 'movie')
  const tvEntries = entries.filter(e => e.status === 'watching' && e.type === 'tv')
  const currentEntries = activeTab === 'movies' ? movieEntries : tvEntries

  // Memoized sorting
  const sortedEntries = useMemo(() => {
    return [...currentEntries].sort((a, b) => {
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title)
      }
      if (sortBy === 'updated') {
        const secondsA = a.updatedAt?.seconds ?? 0
        const secondsB = b.updatedAt?.seconds ?? 0
        return secondsB - secondsA
      }
      // 'newest' (addedAt default)
      const secondsA = a.addedAt?.seconds ?? 0
      const secondsB = b.addedAt?.seconds ?? 0
      return secondsB - secondsA
    })
  }, [currentEntries, sortBy])

  return (
    <div className="unified-page-container">
      <header className="unified-page-header">
        <div>
          <h1 className="page-title">Watching</h1>
          <p className="page-subtitle">Titles currently in progress</p>
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="wt-sort-select"
          style={{ width: 'auto', flexShrink: 0 }}
        >
          <option value="newest">Newest</option>
          <option value="updated">Recently Updated</option>
          <option value="title">A-Z</option>
        </select>
      </header>

      {/* Tabs V2 */}
      <div className="wt-tabs-row-v2">
        <button
          onClick={() => setActiveTab('movies')}
          className={`wt-tab-btn-v2 ${activeTab === 'movies' ? 'wt-tab-btn-v2--active' : ''}`}
          type="button"
        >
          Movies 
          <span className="wt-tab-badge-v2">{movieEntries.length}</span>
        </button>
        <button
          onClick={() => setActiveTab('tv')}
          className={`wt-tab-btn-v2 ${activeTab === 'tv' ? 'wt-tab-btn-v2--active' : ''}`}
          type="button"
        >
          TV Shows 
          <span className="wt-tab-badge-v2">{tvEntries.length}</span>
        </button>
      </div>

      {/* Content Grid V2 */}
      <div className="watching-grid-layout">
        {sortedEntries.length === 0 ? (
          <div className="wt-empty-state-v2">
            <div className="wt-empty-emoji-v2">🎬</div>
            <h3 className="wt-empty-title-v2">Nothing currently in progress.</h3>
            <button
              onClick={() => navigate('/search')}
              className="wt-empty-cta-v2"
              type="button"
            >
              Browse Movies
            </button>
          </div>
        ) : (
          sortedEntries.map(entry => {
            const progressPercent = entry.type === 'tv' && entry.totalEpisodes > 0 
              ? Math.round((entry.episodesWatched / entry.totalEpisodes) * 100) 
              : 0;

            return (
              <div key={entry.titleId} className="watching-card-compact">
                {/* Poster Wrapper with Overlay Progress Bar */}
                <div className="watching-poster-box">
                  <img 
                    className="watching-poster-img"
                    src={entry.posterPath ? `https://image.tmdb.org/t/p/w400${entry.posterPath}` : 'https://via.placeholder.com/200x300?text=No+Poster'} 
                    alt={entry.title} 
                  />
                  {entry.type === 'tv' && (
                    <div className="watching-progress-bar-fixed">
                      <div className="watching-progress-fill" style={{ width: `${progressPercent}%` }} />
                    </div>
                  )}
                </div>

                {/* Info Block Area */}
                <div className="watching-info-block">
                  <h3 className="watching-card-title">{entry.title}</h3>
                  
                  <div className="watching-card-meta">
                    <span>{entry.year}</span>
                    {entry.type === 'tv' && (
                      <span className="watching-pill-stat">{progressPercent}% done</span>
                    )}
                  </div>

                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    {entry.type === 'tv' 
                      ? `${entry.episodesWatched} / ${entry.totalEpisodes || 0} eps` 
                      : 'In progress'}
                  </div>

                  {/* Action Row */}
                  <div className="watching-action-row">
                    <button 
                      className="watching-btn-main"
                      onClick={() => navigate(entry.type === 'tv' ? `/title/${entry.titleId}/episodes` : `/title/${entry.titleId}`)}
                    >
                      ▶ Track
                    </button>
                    <button 
                      className="watching-btn-sub"
                      onClick={() => navigate(`/title/${entry.titleId}`)}
                    >
                      Details
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  )
}
