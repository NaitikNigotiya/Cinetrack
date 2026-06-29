import { useEffect, useRef, useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  X,
  Clock,
  TrendingUp,
  Film,
  ChevronDown,
} from 'lucide-react'

import { useAuth } from '@/features/auth/useAuth'
import { useSearch } from '@/features/search/hooks/useSearch'
import { useRecentSearches } from '@/features/search/hooks/useRecentSearches'
import { useWatchlistStore } from '@/features/watchlist/watchlistStore'
import { addToWatchlist } from '@/features/watchlist/addToWatchlist'
import { getTrending, getImageUrl } from '@/lib/tmdb'
import { BottomSheet } from '@/components/ui/BottomSheet'

import type { TMDbSearchResult } from '@/types/tmdb'
import type { MediaType, WatchStatus } from '@/types/app'

import './SearchPage.css'

// ─── Constants ────────────────────────────────────────────────────────────────

type FilterType = 'all' | 'movie' | 'tv'

const FILTER_OPTIONS: { label: string; value: FilterType }[] = [
  { label: 'All',      value: 'all'   },
  { label: 'Movies',  value: 'movie' },
  { label: 'TV Shows', value: 'tv'   },
]

const STATUS_OPTIONS: { emoji: string; label: string; value: WatchStatus }[] = [
  { emoji: '👁',  label: 'Watching',      value: 'watching'      },
  { emoji: '✓',  label: 'Completed',     value: 'completed'     },
  { emoji: '🕐', label: 'Plan to Watch', value: 'plan_to_watch' },
  { emoji: '✗',  label: 'Dropped',       value: 'dropped'       },
]

const POPULAR_SEARCHES = [
  'Oppenheimer',
  'True Detective',
  'Spirited Away',
  'The Dark Knight',
  'Parasite',
]

const BROWSE_CATEGORIES = [
  { id: 'movie',    icon: '🎬', label: 'Movies'    },
  { id: 'tv',       icon: '📺', label: 'TV Shows'  },
  { id: 'actor',    icon: '🎭', label: 'Actors'    },
  { id: 'director', icon: '🎥', label: 'Directors' },
]

const GENRE_OPTIONS = [
  'All', 'Action', 'Comedy', 'Drama', 'Horror',
  'Sci-Fi', 'Thriller', 'Romance', 'Animation', 'Documentary',
]
const YEAR_OPTIONS   = ['All', '2024', '2023', '2022', '2021', '2020', '2010s', '2000s', '1990s']
const RATING_OPTIONS = ['All', '9+', '8+', '7+', '6+']
const SORT_OPTIONS   = ['Popular', 'Latest', 'Rating', 'Title A-Z']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTitleId(r: TMDbSearchResult) {
  return `${r.media_type === 'movie' ? 'movie' : 'tv'}:${r.id}`
}

function getYear(r: TMDbSearchResult) {
  return r.release_date?.slice(0, 4) ?? r.first_air_date?.slice(0, 4) ?? '—'
}

function getTitle(r: TMDbSearchResult) {
  return r.title ?? r.name ?? 'Untitled'
}

// ─── Result Card ─────────────────────────────────────────────────────────────

function ResultCard({ result, onAdd }: { result: TMDbSearchResult; onAdd: (r: TMDbSearchResult) => void }) {
  const navigate = useNavigate()
  const titleId = makeTitleId(result)
  const inList  = useWatchlistStore((s) => s.titleIds.includes(titleId))
  const title   = getTitle(result)
  const year    = getYear(result)
  const rating  = result.vote_average > 0 ? result.vote_average.toFixed(1) : null
  const poster  = getImageUrl(result.poster_path, 'w500')
  const isMovie = result.media_type === 'movie'

  return (
    <article className="sp-card" onClick={() => navigate(`/title/${result.media_type}:${result.id}`)} style={{ cursor: 'pointer' }}>
      <div className="sp-card-poster-wrap">
        {poster
          ? <img src={poster} alt={title} className="sp-card-poster" loading="lazy" />
          : <div className="sp-card-no-poster"><Film size={32} color="var(--text-muted)" /></div>}

        {/* Bottom gradient + title overlay */}
        <div className="sp-card-gradient" />
        <div className="sp-card-overlay-text">
          <p className="sp-card-overlay-title">{title}</p>
          <p className="sp-card-overlay-year">{year}</p>
        </div>

        {/* Type badge top-left */}
        <span className={`sp-card-type-badge ${isMovie ? 'sp-card-type-badge--movie' : 'sp-card-type-badge--tv'}`}>
          {isMovie ? 'MOVIE' : 'TV'}
        </span>

        {/* Rating badge top-right */}
        {rating && (
          <span className="sp-card-rating-badge">⭐ {rating}</span>
        )}
      </div>

      {inList ? (
        <div className="sp-card-in-list">✓ In Watchlist</div>
      ) : (
        <button className="sp-card-add-btn" onClick={(e) => { e.stopPropagation(); onAdd(result) }} type="button">
          + Add
        </button>
      )}
    </article>
  )
}

// ─── Skeleton Grid ────────────────────────────────────────────────────────────

function SkeletonGrid() {
  return (
    <div className="sp-results-grid" aria-label="Loading results…">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="sp-skeleton-card">
          <div className="skeleton sp-skeleton-poster" />
          <div className="skeleton sp-skeleton-line" />
          <div className="skeleton sp-skeleton-line sp-skeleton-line--short" />
        </div>
      ))}
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ query }: { query: string }) {
  return (
    <div className="sp-empty animate-fade-in">
      <span className="sp-empty-icon" aria-hidden="true">🔍</span>
      <p className="sp-empty-title">No results for "{query}"</p>
      <p className="sp-empty-desc">Try different keywords or check the spelling</p>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SearchPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  // State
  const [query,          setQuery]          = useState('')
  const [filter,         setFilter]         = useState<FilterType>('all')
  const [selectedResult, setSelectedResult] = useState<TMDbSearchResult | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<WatchStatus>('plan_to_watch')
  const [isAdding,       setIsAdding]       = useState(false)
  const [toast,          setToast]          = useState<string | null>(null)
  const [showFilters,    setShowFilters]    = useState(false)
  const [genre,          setGenre]          = useState('All')
  const [year,           setYear]           = useState('All')
  const [rating,         setRating]         = useState('All')
  const [sortBy,         setSortBy]         = useState('Popular')

  const inputRef = useRef<HTMLInputElement>(null)

  // Hooks
  const { results, isLoading, isError, isEmpty } = useSearch(query)
  const { recent, addSearch, clearSearch, clearAll } = useRecentSearches()

  const { data: trendingData } = useQuery({
    queryKey: ['trending', 'week'] as const,
    queryFn: () => getTrending('all', 'week'),
    staleTime: 30 * 60 * 1000,
  })

  // Auto-focus
  useEffect(() => { inputRef.current?.focus() }, [])

  // Keyboard shortcut ⌘K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }, [])

  // Filter
  const filteredResults = filter === 'all' ? results : results.filter((r) => r.media_type === filter)

  // Query change — adds to recent after 2 chars
  const handleQueryChange = (val: string) => {
    setQuery(val)
    if (val.trim().length >= 2) addSearch(val.trim())
  }

  const handlePillClick = (term: string) => {
    setQuery(term)
    addSearch(term)
    inputRef.current?.focus()
  }

  const handleOpenAdd = (result: TMDbSearchResult) => {
    setSelectedResult(result)
    setSelectedStatus('plan_to_watch')
  }

  const handleConfirmAdd = async () => {
    if (!selectedResult || !user) return
    setIsAdding(true)
    try {
      const titleId = makeTitleId(selectedResult)
      const type: MediaType = selectedResult.media_type === 'movie' ? 'movie' : 'tv'
      const yr = parseInt(getYear(selectedResult)) || 0
      await addToWatchlist({
        userId: user.uid,
        titleId,
        type,
        title: getTitle(selectedResult),
        posterPath: selectedResult.poster_path,
        backdropPath: selectedResult.backdrop_path,
        year: yr,
        genres: [],
        status: selectedStatus,
      })
      setSelectedResult(null)
      showToast('Added to watchlist ✓')
    } catch {
      showToast('Failed to add. Please try again.')
    } finally {
      setIsAdding(false)
    }
  }

  const handleBrowseCategory = (id: string) => {
    if (id === 'movie') { setFilter('movie'); inputRef.current?.focus() }
    else if (id === 'tv') { setFilter('tv'); inputRef.current?.focus() }
    else { inputRef.current?.focus() }
  }

  const trendingItems = (trendingData?.results ?? []).filter((r) => r.media_type !== 'person').slice(0, 20)
  const hasQuery = query.trim().length >= 2

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="sp-page">
      <div className="sp-inner">

        {/* ── Sticky Search Bar ─────────────────────────────────────────────── */}
        <div className="sp-sticky-header">
          <div className="sp-input-wrap">
            <span className="sp-input-icon" aria-hidden="true">
              <Search size={20} />
            </span>

            <input
              ref={inputRef}
              id="search-input"
              className="sp-input"
              type="search"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Search movies, shows, people..."
              aria-label="Search movies, shows, and people"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />

            {query && (
              <div className="sp-input-right">
                <button
                  className="sp-clear-btn"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  type="button"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {!query && (
              <div className="sp-kbd-hint" aria-hidden="true">⌘K</div>
            )}
          </div>
        </div>

        {/* ── Default State (no query) ──────────────────────────────────────── */}
        {!hasQuery && (
          <div className="sp-default-state animate-fade-in">

            {/* Recent Searches */}
            {recent.length > 0 && (
              <section className="sp-section" aria-label="Recent searches">
                <div className="sp-section-header">
                  <h2 className="sp-section-title">Recent Searches</h2>
                  <button className="sp-section-clear" onClick={clearAll} type="button">Clear all</button>
                </div>
                <div className="sp-pills-row">
                  {recent.slice(0, 6).map((q) => (
                    <button
                      key={q}
                      className="sp-pill sp-pill--recent"
                      onClick={() => handlePillClick(q)}
                      type="button"
                    >
                      <Clock size={12} aria-hidden="true" />
                      <span>{q}</span>
                      <span
                        className="sp-pill-remove"
                        role="button"
                        aria-label={`Remove ${q}`}
                        onClick={(e) => { e.stopPropagation(); clearSearch(q) }}
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && (e.stopPropagation(), clearSearch(q))}
                      >
                        <X size={11} />
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Popular Searches */}
            <section className="sp-section" aria-label="Popular searches">
              <div className="sp-section-header">
                <h2 className="sp-section-title">Popular Searches</h2>
              </div>
              <div className="sp-pills-row">
                {POPULAR_SEARCHES.map((term) => (
                  <button
                    key={term}
                    className="sp-pill sp-pill--popular"
                    onClick={() => handlePillClick(term)}
                    type="button"
                  >
                    <TrendingUp size={12} aria-hidden="true" />
                    <span>{term}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Browse By */}
            <section className="sp-section" aria-label="Browse by category">
              <div className="sp-section-header">
                <h2 className="sp-section-title">Browse by</h2>
              </div>
              <div className="sp-browse-grid">
                {BROWSE_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    className="sp-browse-card"
                    onClick={() => handleBrowseCategory(cat.id)}
                    type="button"
                  >
                    <span className="sp-browse-icon">{cat.icon}</span>
                    <span className="sp-browse-label">{cat.label}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Filters */}
            <section className="sp-section" aria-label="Filters">
              <div className="sp-section-header">
                <h2 className="sp-section-title">Filters</h2>
                <button
                  className="sp-advanced-toggle"
                  onClick={() => setShowFilters((v) => !v)}
                  type="button"
                >
                  Advanced <ChevronDown size={12} className={showFilters ? 'sp-chevron-up' : ''} />
                </button>
              </div>
              <div className={`sp-filters-row ${showFilters ? 'sp-filters-row--visible' : ''}`}>
                <div className="sp-filter-group">
                  <label className="sp-filter-label" htmlFor="sp-genre">Genre</label>
                  <select id="sp-genre" className="sp-filter-select" value={genre} onChange={(e) => setGenre(e.target.value)}>
                    {GENRE_OPTIONS.map((g) => <option key={g}>{g}</option>)}
                  </select>
                </div>
                <div className="sp-filter-group">
                  <label className="sp-filter-label" htmlFor="sp-year">Year</label>
                  <select id="sp-year" className="sp-filter-select" value={year} onChange={(e) => setYear(e.target.value)}>
                    {YEAR_OPTIONS.map((y) => <option key={y}>{y}</option>)}
                  </select>
                </div>
                <div className="sp-filter-group">
                  <label className="sp-filter-label" htmlFor="sp-rating">Rating</label>
                  <select id="sp-rating" className="sp-filter-select" value={rating} onChange={(e) => setRating(e.target.value)}>
                    {RATING_OPTIONS.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div className="sp-filter-group">
                  <label className="sp-filter-label" htmlFor="sp-sort">Sort By</label>
                  <select id="sp-sort" className="sp-filter-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                    {SORT_OPTIONS.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </section>

            {/* Trending this week */}
            {trendingItems.length > 0 && (
              <section className="sp-section" aria-label="Trending this week">
                <div className="sp-section-header">
                  <h2 className="sp-section-title">Trending This Week</h2>
                </div>
                <div className="sp-trending-rail">
                  {trendingItems.map((item) => {
                    const poster = getImageUrl(item.poster_path, 'w200')
                    return (
                      <div
                        key={item.id}
                        className="sp-trending-card"
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate(`/title/${item.media_type || 'movie'}:${item.id}`)}
                        onKeyDown={(e) => e.key === 'Enter' && navigate(`/title/${item.media_type || 'movie'}:${item.id}`)}
                        aria-label={getTitle(item)}
                      >
                        {poster
                          ? <img src={poster} alt={getTitle(item)} className="sp-trending-poster" loading="lazy" />
                          : <div className="sp-trending-no-poster"><Film size={20} color="var(--text-muted)" /></div>}
                        <p className="sp-trending-title">{getTitle(item)}</p>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}
          </div>
        )}

        {/* ── Results State ─────────────────────────────────────────────────── */}
        {hasQuery && (
          <div className="sp-results-state">

            {/* Filter pills row */}
            <div className="sp-filter-pills" role="group" aria-label="Filter results by type">
              {FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`sp-filter-pill ${filter === opt.value ? 'sp-filter-pill--active' : ''}`}
                  onClick={() => setFilter(opt.value)}
                  aria-pressed={filter === opt.value}
                  type="button"
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Loading */}
            {isLoading && <SkeletonGrid />}

            {/* Error */}
            {isError && !isLoading && (
              <div className="sp-empty animate-fade-in">
                <span className="sp-empty-icon">⚠️</span>
                <p className="sp-empty-title">Something went wrong</p>
                <p className="sp-empty-desc">Check your connection and try again.</p>
              </div>
            )}

            {/* Results grid */}
            {!isLoading && !isError && filteredResults.length > 0 && (
              <div
                className="sp-results-grid animate-fade-in"
                role="list"
                aria-label={`${filteredResults.length} results`}
              >
                {filteredResults.map((result) => (
                  <div key={result.id} role="listitem">
                    <ResultCard result={result} onAdd={handleOpenAdd} />
                  </div>
                ))}
              </div>
            )}

            {/* No results */}
            {isEmpty && <EmptyState query={query} />}
          </div>
        )}
      </div>

      {/* ── Add to Watchlist Bottom Sheet ─────────────────────────────────── */}
      <BottomSheet
        isOpen={selectedResult !== null}
        onClose={() => setSelectedResult(null)}
        label="Add to watchlist"
      >
        {selectedResult && (
          <div className="sp-add-sheet">
            <div className="sp-add-header">
              {getImageUrl(selectedResult.poster_path, 'w200') ? (
                <img
                  src={getImageUrl(selectedResult.poster_path, 'w200')!}
                  alt={getTitle(selectedResult)}
                  className="sp-add-thumb"
                />
              ) : (
                <div className="sp-add-thumb-placeholder">
                  <Film size={20} color="var(--text-muted)" />
                </div>
              )}
              <div className="sp-add-meta">
                <p className="sp-add-title">{getTitle(selectedResult)}</p>
                <p className="sp-add-year">{getYear(selectedResult)}</p>
                <span className={`sp-add-type-badge ${selectedResult.media_type === 'movie' ? 'sp-add-type-badge--movie' : 'sp-add-type-badge--tv'}`}>
                  {selectedResult.media_type === 'movie' ? 'Movie' : 'TV Show'}
                </span>
              </div>
            </div>

            <div className="sp-status-grid" role="radiogroup" aria-label="Watch status">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`sp-status-btn ${selectedStatus === opt.value ? 'sp-status-btn--active' : ''}`}
                  onClick={() => setSelectedStatus(opt.value)}
                  role="radio"
                  aria-checked={selectedStatus === opt.value}
                  type="button"
                >
                  <span aria-hidden="true">{opt.emoji}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>

            <button
              className="sp-confirm-btn"
              onClick={handleConfirmAdd}
              disabled={isAdding}
              type="button"
            >
              {isAdding ? 'Adding…' : 'Add to Watchlist'}
            </button>
          </div>
        )}
      </BottomSheet>

      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      {toast && (
        <div className="sp-toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </div>
  )
}
