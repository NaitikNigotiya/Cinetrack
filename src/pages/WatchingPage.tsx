import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useWatchlist } from '@/features/watchlist/hooks/useWatchlist'
import { getImageUrl } from '@/lib/tmdb'

import './WatchingPage.css'

export default function WatchingPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'movies' | 'tv'>('movies')
  const { entries } = useWatchlist()
  
  const movieEntries = entries.filter(e => e.status === 'watching' && e.type === 'movie')
  const tvEntries = entries.filter(e => e.status === 'watching' && e.type === 'tv')
  const currentEntries = activeTab === 'movies' ? movieEntries : tvEntries

  return (
    <div className="page-wrapper watching-page">
      
      {/* Page Header */}
      <header className="wt-header">
        <h1 className="wt-title">Watching</h1>
        <p className="wt-card-progress-label" style={{ marginTop: '4px' }}>
          Titles currently in progress
        </p>
      </header>

      {/* Tabs */}
      <div className="wt-tabs-row" style={{ marginBottom: '24px' }}>
        <button
          onClick={() => setActiveTab('movies')}
          className={`wt-tab-btn ${activeTab === 'movies' ? 'wt-tab-btn--active' : ''}`}
          type="button"
        >
          Movies {movieEntries.length > 0 && <span className="wt-tab-badge">{movieEntries.length}</span>}
        </button>
        <button
          onClick={() => setActiveTab('tv')}
          className={`wt-tab-btn ${activeTab === 'tv' ? 'wt-tab-btn--active' : ''}`}
          type="button"
        >
          TV Shows {tvEntries.length > 0 && <span className="wt-tab-badge">{tvEntries.length}</span>}
        </button>
      </div>

      {/* Content */}
      <div className="wt-list-container">
        {currentEntries.length === 0 ? (
          <div className="wt-empty-state">
            <div className="wt-empty-emoji">🎬</div>
            <h3 className="wt-empty-title">Nothing in progress</h3>
            <p className="wt-empty-desc">Add something to start watching</p>
            <button
              onClick={() => navigate('/search')}
              className="wt-empty-cta"
              type="button"
            >
              Browse
            </button>
          </div>
        ) : (
          currentEntries.map(entry => (
            <div
              key={entry.titleId}
              onClick={() => {
                if (entry.type === 'tv') {
                  navigate(`/title/${entry.titleId}/episodes`)
                } else {
                  navigate(`/title/${entry.titleId}`)
                }
              }}
              className="wt-card"
            >
              {/* Poster */}
              <div className="wt-card-poster-wrap">
                {entry.posterPath ? (
                  <img
                    src={getImageUrl(entry.posterPath, 'w200') || ''}
                    alt={entry.title}
                    className="wt-card-poster-img"
                  />
                ) : (
                  <div className="wt-card-no-poster">🎬</div>
                )}
              </div>
              
              {/* Info */}
              <div className="wt-card-middle">
                <h3 className="wt-card-title">{entry.title}</h3>
                <p className="wt-card-meta">
                  {entry.type === 'tv' 
                    ? (entry.totalEpisodes > 0
                      ? `${entry.episodesWatched} of ${entry.totalEpisodes} episodes`
                      : `${entry.episodesWatched} episodes watched`)
                    : `${entry.totalRuntime} min`}
                </p>
                {/* Progress bar */}
                <div className="wt-progress-bar-bg">
                  <div className="wt-progress-bar-fill" style={{
                    width: entry.type === 'tv'
                      ? (entry.totalEpisodes > 0
                        ? `${Math.round((entry.episodesWatched / entry.totalEpisodes) * 100)}%`
                        : '0%')
                      : '0%',
                  }} />
                </div>
                {entry.type === 'tv' && entry.totalEpisodes > 0 && (
                  <p className="wt-card-progress-label" style={{ marginTop: '4px' }}>
                    Next: Episode {(entry.episodesWatched || 0) + 1}
                  </p>
                )}
              </div>

              {/* Continue button */}
              <div className="wt-card-right">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (entry.type === 'tv') {
                      navigate(`/title/${entry.titleId}/episodes`)
                    } else {
                      navigate(`/title/${entry.titleId}`)
                    }
                  }}
                  className="wt-continue-btn"
                  type="button"
                >
                  Continue
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
