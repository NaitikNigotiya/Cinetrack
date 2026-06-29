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
    <div style={{
      height: '100vh',
      overflowY: 'auto',
      overflowX: 'hidden',
      padding: '24px 32px',
      boxSizing: 'border-box',
    }}>
      
      {/* Page Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, 
          color: 'var(--text-primary)', margin: 0 }}>
          Watching
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
          Titles currently in progress
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <button
          onClick={() => setActiveTab('movies')}
          style={{
            padding: '8px 20px',
            borderRadius: '999px',
            border: 'none',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
            background: activeTab === 'movies' ? 'var(--color-brand)' : 'var(--bg-elevated)',
            color: activeTab === 'movies' ? 'var(--text-on-brand)' : 'var(--text-secondary)',
          }}
        >
          Movies {movieEntries.length > 0 && `${movieEntries.length}`}
        </button>
        <button
          onClick={() => setActiveTab('tv')}
          style={{
            padding: '8px 20px',
            borderRadius: '999px',
            border: 'none',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
            background: activeTab === 'tv' ? 'var(--color-brand)' : 'var(--bg-elevated)',
            color: activeTab === 'tv' ? 'var(--text-on-brand)' : 'var(--text-secondary)',
          }}
        >
          TV Shows {tvEntries.length > 0 && `${tvEntries.length}`}
        </button>
      </div>

      {/* Content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
        {currentEntries.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '80px 24px',
            color: 'var(--text-muted)', width: '100%',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎬</div>
            <h3 style={{ fontSize: '20px', fontWeight: 700, 
              color: 'var(--text-primary)', marginBottom: '8px' }}>
              Nothing in progress
            </h3>
            <p style={{ fontSize: '14px', marginBottom: '20px' }}>
              Add something to start watching
            </p>
            <button
              onClick={() => navigate('/search')}
              style={{
                padding: '10px 24px', background: 'var(--color-brand)',
                color: 'var(--text-on-brand)', border: 'none',
                borderRadius: 'var(--radius-md)', fontWeight: 600,
                fontSize: '14px', cursor: 'pointer',
              }}
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
              style={{
                display: 'flex', alignItems: 'center', gap: '16px',
                background: 'var(--card-bg)', border: '1px solid var(--card-border)',
                borderRadius: 'var(--radius-lg)', padding: '16px',
                width: '100%', boxSizing: 'border-box', cursor: 'pointer',
              }}
            >
              {/* Poster */}
              <img
                src={getImageUrl(entry.posterPath, 'w200') || ''}
                alt={entry.title}
                style={{ width: 60, height: 90, borderRadius: 'var(--radius-md)',
                  objectFit: 'cover', flexShrink: 0 }}
              />
              
              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '15px', 
                  color: 'var(--text-primary)', marginBottom: '4px' }}>
                  {entry.title}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  {entry.type === 'tv' 
                    ? (entry.totalEpisodes > 0
                      ? `${entry.episodesWatched} of ${entry.totalEpisodes} episodes`
                      : `${entry.episodesWatched} episodes watched`)
                    : `${entry.totalRuntime} min`}
                </div>
                {/* Progress bar */}
                <div style={{ width: '100%', height: '4px', 
                  background: 'var(--skeleton-base)', borderRadius: '999px' }}>
                  <div style={{
                    height: '100%', borderRadius: '999px',
                    background: 'var(--color-brand)',
                    width: entry.type === 'tv'
                      ? (entry.totalEpisodes > 0
                        ? `${Math.round((entry.episodesWatched / entry.totalEpisodes) * 100)}%`
                        : '0%')
                      : '0%',
                  }} />
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {entry.type === 'tv' && entry.totalEpisodes > 0 && (
                    `Next: Episode ${(entry.episodesWatched || 0) + 1}`
                  )}
                </div>
              </div>

              {/* Continue button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  if (entry.type === 'tv') {
                    navigate(`/title/${entry.titleId}/episodes`)
                  } else {
                    navigate(`/title/${entry.titleId}`)
                  }
                }}
                style={{
                  padding: '8px 16px', background: 'var(--color-brand)',
                  color: 'var(--text-on-brand)', border: 'none',
                  borderRadius: 'var(--radius-md)', fontWeight: 600,
                  fontSize: '13px', cursor: 'pointer', flexShrink: 0,
                }}
              >
                Continue
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
