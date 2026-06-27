import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, Film, ArrowLeft } from 'lucide-react'

import { useWatchlist } from '@/features/watchlist/hooks/useWatchlist'
import { getImageUrl } from '@/lib/tmdb'

import './WatchlistPage.css' // Reuse premium watchlist card styles
import './FavoritesPage.css'

type MediaTypeFilter = 'all' | 'movie' | 'tv'
type SortOption = 'rating' | 'dateAdded' | 'title'

export default function FavoritesPage() {
  const navigate = useNavigate()
  const { entries, isLoading } = useWatchlist()

  // ── Local Filter/Sort States ──
  const [mediaFilter, setMediaFilter] = useState<MediaTypeFilter>('all')
  const [sortOption, setSortOption] = useState<SortOption>('rating')

  // Filter only favorites and apply All/Movie/TV rules
  const filteredFavorites = useMemo(() => {
    return entries.filter((e) => {
      const matchesFav = e.isFavorite
      const matchesType = mediaFilter === 'all' || e.type === mediaFilter
      return matchesFav && matchesType
    })
  }, [entries, mediaFilter])

  // Sort list based on selected option
  const sortedFavorites = useMemo(() => {
    return [...filteredFavorites].sort((a, b) => {
      if (sortOption === 'rating') {
        const ratingA = a.rating ?? 0
        const ratingB = b.rating ?? 0
        if (ratingB !== ratingA) {
          return ratingB - ratingA // Highest first
        }
        return a.title.localeCompare(b.title)
      }

      if (sortOption === 'dateAdded') {
        const timeA = a.addedAt?.seconds ?? 0
        const timeB = b.addedAt?.seconds ?? 0
        return timeB - timeA // Newest first
      }

      if (sortOption === 'title') {
        return a.title.localeCompare(b.title) // Alphabetical
      }

      return 0
    })
  }, [filteredFavorites, sortOption])

  const countLabel = `${filteredFavorites.length} title${filteredFavorites.length !== 1 ? 's' : ''}`

  return (
    <div className="favorites-page animate-fade-in">
      {/* Header */}
      <header className="favorites-header">
        <button className="favorites-back-btn" onClick={() => navigate(-1)} aria-label="Go back" type="button">
          <ArrowLeft size={20} />
        </button>
        <div className="favorites-header-row">
          <h1 className="favorites-title" style={{ margin: 0 }}>Favorites</h1>
          <span className="favorites-count-badge">{countLabel}</span>
        </div>
      </header>

      {/* Filter and Sort bar */}
      <section className="favs-controls-bar" aria-label="Filter and Sort options">
        {/* Pills row */}
        <div className="favs-pills-list" role="tablist" aria-label="Filter Media Type">
          <button
            className={`favs-pill-btn${mediaFilter === 'all' ? ' favs-pill-btn--active' : ''}`}
            onClick={() => setMediaFilter('all')}
            role="tab"
            aria-selected={mediaFilter === 'all'}
            type="button"
          >
            All
          </button>
          <button
            className={`favs-pill-btn${mediaFilter === 'movie' ? ' favs-pill-btn--active' : ''}`}
            onClick={() => setMediaFilter('movie')}
            role="tab"
            aria-selected={mediaFilter === 'movie'}
            type="button"
          >
            Movies
          </button>
          <button
            className={`favs-pill-btn${mediaFilter === 'tv' ? ' favs-pill-btn--active' : ''}`}
            onClick={() => setMediaFilter('tv')}
            role="tab"
            aria-selected={mediaFilter === 'tv'}
            type="button"
          >
            TV Shows
          </button>
        </div>

        {/* Sort Select */}
        <select
          className="favs-sort-select"
          value={sortOption}
          onChange={(e) => setSortOption(e.target.value as SortOption)}
          aria-label="Sort options"
        >
          <option value="rating">Sort: Rating</option>
          <option value="dateAdded">Sort: Date Added</option>
          <option value="title">Sort: Title</option>
        </select>
      </section>

      {/* Grid Content */}
      <main className="favorites-content" style={{ paddingBottom: 'calc(var(--bottom-nav-height) + var(--safe-bottom) + 24px)' }}>
        {isLoading ? (
          <div className="watchlist-grid-skeleton" style={{ padding: 16 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton-poster-card">
                <div className="skeleton" style={{ aspectRatio: '2/3', borderRadius: 'var(--radius-md)' }} />
                <div className="skeleton" style={{ height: 13, borderRadius: 'var(--radius-sm)' }} />
              </div>
            ))}
          </div>
        ) : sortedFavorites.length > 0 ? (
          <div className="watchlist-grid animate-fade-in" style={{ padding: 16 }}>
            {sortedFavorites.map((entry) => {
              const poster = entry.posterPath ? getImageUrl(entry.posterPath, 'w500') : null

              return (
                <article
                  key={entry.titleId}
                  className="poster-card"
                  onClick={() => navigate(`/watchlist/${encodeURIComponent(entry.titleId)}`)}
                >
                  <div className="poster-card-image-wrapper">
                    {poster ? (
                      <img src={poster} alt={entry.title} className="poster-card-image" loading="lazy" />
                    ) : (
                      <div className="poster-card-no-image">
                        <Film size={28} color="var(--text-muted)" aria-hidden="true" />
                      </div>
                    )}

                    <div className="poster-card-gradient" aria-hidden="true" />

                    {/* Rating overlay badge */}
                    {entry.rating !== null && (
                      <span className="poster-card-rating">⭐ {entry.rating}</span>
                    )}

                    {/* Heart badge top corner */}
                    <div className="favs-heart-badge" aria-hidden="true">
                      <Heart size={12} fill="#ff4757" stroke="#ff4757" />
                    </div>
                  </div>

                  <div className="poster-card-info">
                    <p className="poster-card-title">{entry.title}</p>
                    <p className="poster-card-meta">
                      {entry.year > 0 ? entry.year : '—'} · {entry.type === 'movie' ? 'Movie' : 'TV'}
                    </p>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="favorites-empty animate-fade-in">
            <Heart size={48} className="favorites-empty-emoji" color="var(--color-error)" fill="var(--color-error)" />
            <p className="favorites-empty-title">No favorites yet</p>
            <p className="favorites-empty-subtitle">
              Tap the ❤️ icon on any title page or watchlist card to see them presented here.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
