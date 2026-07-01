import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { MoreVertical } from 'lucide-react'

import { useWatchlist } from '@/features/watchlist/hooks/useWatchlist'

import './WatchingPage.css'

export default function WatchingPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'movies' | 'tv'>('movies')
  const [sortBy, setSortBy] = useState<'newest' | 'updated' | 'title'>('newest')
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)
  
  const { entries, updateEntry, removeEntry } = useWatchlist()
  
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
    <div className="page-scroll watching-page">
      
      {/* Page Header V2 */}
      <header className="wt-header-v2 mobile-header-padding">
        <div>
          <h1 className="wt-title-v2 page-title">Watching</h1>
          <p className="wt-subtitle-v2 page-subtitle">Titles currently in progress</p>
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="wt-sort-select"
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
      <div className="wt-list-container-v2">
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
            const lastWatchedDate = entry.watchDates && entry.watchDates.length > 0
              ? entry.watchDates[entry.watchDates.length - 1]?.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
              : entry.updatedAt?.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) || 'N/A'

            const percentage = entry.type === 'tv' && entry.totalEpisodes > 0
              ? Math.round((entry.episodesWatched / entry.totalEpisodes) * 100)
              : 0

            return (
              <div
                key={entry.titleId}
                className="wt-card-v2"
                onClick={() => {
                  if (entry.type === 'tv') {
                    navigate(`/title/${entry.titleId}/episodes`)
                  } else {
                    navigate(`/title/${entry.titleId}`)
                  }
                }}
              >
                {/* 1. Poster Area */}
                <div className="wt-poster-wrap-v2">
                  <img
                    src={entry.posterPath
                      ? `https://image.tmdb.org/t/p/w342${entry.posterPath}`
                      : 'https://via.placeholder.com/200x300?text=No+Poster'}
                    alt={entry.title}
                    className="wt-poster-v2"
                  />
                </div>

                {/* 2. Details Area */}
                <div className="wt-details-block-v2">
                  <h3 className="wt-title-v2-card">{entry.title}</h3>
                  
                  <div className="wt-meta-v2">
                    <span>{entry.year}</span>
                    <span className="wt-meta-dot">•</span>
                    <span>
                      {entry.type === 'tv' 
                        ? `${entry.totalEpisodes || 0} Episodes`
                        : entry.totalRuntime 
                          ? `${Math.floor(entry.totalRuntime / 60)}h ${entry.totalRuntime % 60}m` 
                          : 'N/A'}
                    </span>
                    {entry.genres && entry.genres.length > 0 && (
                      <>
                        <span className="wt-meta-dot">•</span>
                        {entry.genres.slice(0, 2).map(g => (
                          <span key={g} className="wt-genre-tag">{g}</span>
                        ))}
                      </>
                    )}
                  </div>

                  <div className="wt-last-watched">
                    📅 Last active: {lastWatchedDate}
                  </div>
                </div>

                {/* 3. Progress Area */}
                <div className="wt-progress-container-v2">
                  <div className="wt-progress-header-v2">
                    <span>
                      {entry.type === 'tv'
                        ? entry.totalEpisodes > 0
                          ? `${entry.episodesWatched} of ${entry.totalEpisodes} episodes`
                          : `${entry.episodesWatched} episodes watched`
                        : 'In progress'}
                    </span>
                    <span>{entry.type === 'tv' && entry.totalEpisodes > 0 ? `${percentage}%` : '100%'}</span>
                  </div>
                  <div className="wt-progress-bar-bg-v2">
                    <div
                      className="wt-progress-bar-fill-v2"
                      style={{
                        width: `${entry.type === 'tv' && entry.totalEpisodes > 0 ? percentage : 100}%`
                      }}
                    />
                  </div>
                </div>

                {/* 4. Actions Area */}
                <div className="wt-actions-row-v2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (entry.type === 'tv') {
                        navigate(`/title/${entry.titleId}/episodes`)
                      } else {
                        navigate(`/title/${entry.titleId}`)
                      }
                    }}
                    className="wt-btn-primary-v2"
                    type="button"
                  >
                    ▶ {entry.type === 'tv' ? 'Track Episodes' : 'Continue Watching'}
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/title/${entry.titleId}`)
                    }}
                    className="wt-btn-secondary-v2"
                    type="button"
                  >
                    Details
                  </button>
                </div>

                {/* Popover Actions Trigger */}
                <div className="wt-menu-container">
                  <button
                    className="wt-menu-trigger"
                    onClick={(e) => {
                      e.stopPropagation()
                      setActiveMenuId(activeMenuId === entry.titleId ? null : entry.titleId)
                    }}
                    aria-label="Toggle actions popover menu"
                    type="button"
                  >
                    <MoreVertical size={20} />
                  </button>

                  {activeMenuId === entry.titleId && (
                    <>
                      <div 
                        style={{ position: 'fixed', inset: 0, zIndex: 90 }} 
                        onClick={(e) => {
                          e.stopPropagation()
                          setActiveMenuId(null)
                        }} 
                      />
                      <div className="wt-menu-dropdown" style={{ zIndex: 100 }} onClick={(e) => e.stopPropagation()}>
                        <button
                          className="wt-menu-item"
                          onClick={() => {
                            updateEntry(entry.titleId, { status: 'completed' })
                            setActiveMenuId(null)
                          }}
                          type="button"
                        >
                          Mark Completed
                        </button>
                        <button
                          className="wt-menu-item"
                          onClick={() => {
                            updateEntry(entry.titleId, { status: 'plan_to_watch' })
                            setActiveMenuId(null)
                          }}
                          type="button"
                        >
                          Move to Watchlist
                        </button>
                        <button
                          className="wt-menu-item"
                          style={{ color: '#E50914' }}
                          onClick={() => {
                            removeEntry(entry.titleId)
                            setActiveMenuId(null)
                          }}
                          type="button"
                        >
                          Remove from Watching
                        </button>
                      </div>
                    </>
                  )}
                </div>

              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
