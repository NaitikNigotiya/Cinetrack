import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, X, Clock, Film, Star } from 'lucide-react'

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

type Filter = 'all' | 'movie' | 'tv'

const FILTER_OPTIONS: { label: string; value: Filter }[] = [
  { label: 'All',      value: 'all' },
  { label: 'Movies',   value: 'movie' },
  { label: 'TV Shows', value: 'tv' },
]

const STATUS_OPTIONS: { emoji: string; label: string; value: WatchStatus }[] = [
  { emoji: '👁',  label: 'Watching',      value: 'watching' },
  { emoji: '✓',  label: 'Completed',     value: 'completed' },
  { emoji: '🕐', label: 'Plan to Watch', value: 'plan_to_watch' },
  { emoji: '✗',  label: 'Dropped',       value: 'dropped' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTitleId(result: TMDbSearchResult): string {
  return `${result.media_type === 'movie' ? 'movie' : 'tv'}:${result.id}`
}

function getYear(result: TMDbSearchResult): string {
  return (
    result.release_date?.slice(0, 4) ??
    result.first_air_date?.slice(0, 4) ??
    '—'
  )
}

function getTitle(result: TMDbSearchResult): string {
  return result.title ?? result.name ?? 'Untitled'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Individual result card — subscribes to its own watchlist slice */
function ResultCard({
  result,
  onAdd,
}: {
  result: TMDbSearchResult
  onAdd: (result: TMDbSearchResult) => void
}) {
  const titleId = makeTitleId(result)
  const inList = useWatchlistStore((s) => s.titleIds.includes(titleId))

  const title   = getTitle(result)
  const year    = getYear(result)
  const rating  = result.vote_average > 0 ? result.vote_average.toFixed(1) : null
  const poster  = getImageUrl(result.poster_path, 'w500')
  const badge   = result.media_type === 'movie' ? 'MOVIE' : 'TV'

  return (
    <article className="result-card">
      <div className="result-card-poster-wrapper">
        {poster ? (
          <img
            src={poster}
            alt={title}
            className="result-card-poster"
            loading="lazy"
          />
        ) : (
          <div className="result-card-no-poster">
            <Film size={32} color="var(--text-muted)" aria-hidden="true" />
          </div>
        )}
        <span className="result-card-badge" aria-label={badge}>{badge}</span>
      </div>

      <div className="result-card-info">
        <p className="result-card-title">{title}</p>
        <p className="result-card-meta">
          <span>{year}</span>
          {rating && (
            <>
              <span aria-hidden="true">·</span>
              <Star size={10} aria-hidden="true" />
              <span>{rating}</span>
            </>
          )}
        </p>
      </div>

      {inList ? (
        <div className="result-card-in-list-btn" aria-label="Already in watchlist">
          ✓ In List
        </div>
      ) : (
        <button
          className="result-card-add-btn"
          onClick={() => onAdd(result)}
          aria-label={`Add ${title} to watchlist`}
          type="button"
        >
          + Add
        </button>
      )}
    </article>
  )
}

/** 2-column skeleton loading grid */
function SkeletonGrid() {
  return (
    <div className="results-grid" aria-label="Loading results…">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="skeleton-card">
          <div className="skeleton skeleton-poster" />
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line skeleton-line--short" />
        </div>
      ))}
    </div>
  )
}

/** No results state */
function EmptyState({ query }: { query: string }) {
  return (
    <div className="empty-state animate-fade-in">
      <span className="empty-state-emoji" aria-hidden="true">🎞️</span>
      <p className="empty-state-title">No results for "{query}"</p>
      <p className="empty-state-subtitle">
        Try a different title or check the spelling.
      </p>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SearchPage() {
  const { user } = useAuth()

  // ── Local state ────────────────────────────────────────────────────────────
  const [query,          setQuery]          = useState('')
  const [filter,         setFilter]         = useState<Filter>('all')
  const [selectedResult, setSelectedResult] = useState<TMDbSearchResult | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<WatchStatus>('plan_to_watch')
  const [isAdding,       setIsAdding]       = useState(false)
  const [toast,          setToast]          = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)

  // ── Hooks ──────────────────────────────────────────────────────────────────
  const { results, isLoading, isError, isEmpty } = useSearch(query)
  const { recent, addSearch, clearSearch, clearAll } = useRecentSearches()

  const { data: trendingData } = useQuery({
    queryKey: ['trending', 'week'] as const,
    queryFn: () => getTrending('all', 'week'),
    staleTime: 30 * 60 * 1000,
  })

  // ── Auto-focus ─────────────────────────────────────────────────────────────
  useEffect(() => { inputRef.current?.focus() }, [])

  // ── Toast helper ───────────────────────────────────────────────────────────
  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  // ── Filter client-side by media type ──────────────────────────────────────
  const filteredResults =
    filter === 'all'
      ? results
      : results.filter((r) => r.media_type === filter)

  // ── Query submit: add to recent ────────────────────────────────────────────
  const handleQueryChange = (val: string) => {
    setQuery(val)
    if (val.trim().length >= 2) addSearch(val.trim())
  }

  // ── Open add sheet ─────────────────────────────────────────────────────────
  const handleOpenAdd = (result: TMDbSearchResult) => {
    setSelectedResult(result)
    setSelectedStatus('plan_to_watch')
  }

  // ── Confirm add to watchlist ───────────────────────────────────────────────
  const handleConfirmAdd = async () => {
    if (!selectedResult || !user) return
    setIsAdding(true)
    try {
      const titleId = makeTitleId(selectedResult)
      const type: MediaType = selectedResult.media_type === 'movie' ? 'movie' : 'tv'
      const year = parseInt(getYear(selectedResult)) || 0

      await addToWatchlist({
        userId: user.uid,
        titleId,
        type,
        title: getTitle(selectedResult),
        posterPath: selectedResult.poster_path,
        backdropPath: selectedResult.backdrop_path,
        year,
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

  // ── Trending films for default state ───────────────────────────────────────
  const trendingItems = (trendingData?.results ?? [])
    .filter((r) => r.media_type !== 'person')
    .slice(0, 20)

  // ── Determine which content area to show ───────────────────────────────────
  const hasQuery = query.trim().length >= 2

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="search-page">

      {/* ── Sticky header ── */}
      <div className="search-header">
        {/* Search input */}
        <div className="search-input-wrapper">
          <span className="search-icon" aria-hidden="true">
            <Search size={20} />
          </span>
          <input
            ref={inputRef}
            id="search-input"
            className="search-input"
            type="search"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search movies, TV shows…"
            aria-label="Search movies and TV shows"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {query && (
            <button
              className="search-clear-btn"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              type="button"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Filter pills */}
        <div className="filter-pills-row" role="group" aria-label="Filter by type">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`filter-pill${filter === opt.value ? ' filter-pill--active' : ''}`}
              onClick={() => setFilter(opt.value)}
              aria-pressed={filter === opt.value}
              type="button"
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="search-content">

        {/* Default state: recent + trending */}
        {!hasQuery && (
          <>
            {/* Recent searches */}
            {recent.length > 0 && (
              <section aria-label="Recent searches">
                <div className="section-header">
                  <span className="section-title">
                    <Clock size={14} aria-hidden="true" />
                    Recent searches
                  </span>
                  <button
                    className="section-clear-btn"
                    onClick={clearAll}
                    type="button"
                  >
                    Clear all
                  </button>
                </div>
                <ul className="recent-list" role="list">
                  {recent.map((q) => (
                    <li key={q} className="recent-item">
                      <span
                        className="recent-item-text"
                        role="button"
                        tabIndex={0}
                        onClick={() => setQuery(q)}
                        onKeyDown={(e) => e.key === 'Enter' && setQuery(q)}
                      >
                        {q}
                      </span>
                      <button
                        className="recent-item-remove"
                        onClick={() => clearSearch(q)}
                        aria-label={`Remove "${q}" from recent searches`}
                        type="button"
                      >
                        <X size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Trending this week */}
            {trendingItems.length > 0 && (
              <section aria-label="Trending this week">
                <div className="section-header">
                  <span className="section-title">Trending this week</span>
                </div>
                <div className="trending-rail">
                  {trendingItems.map((item) => {
                    const poster = getImageUrl(item.poster_path, 'w200')
                    return (
                      <div
                        key={item.id}
                        className="trending-card"
                        role="button"
                        tabIndex={0}
                        onClick={() => handleOpenAdd(item)}
                        onKeyDown={(e) => e.key === 'Enter' && handleOpenAdd(item)}
                        aria-label={getTitle(item)}
                      >
                        {poster ? (
                          <img
                            src={poster}
                            alt={getTitle(item)}
                            className="trending-poster"
                            loading="lazy"
                          />
                        ) : (
                          <div className="trending-no-poster">
                            <Film size={20} color="var(--text-muted)" aria-hidden="true" />
                          </div>
                        )}
                        <p className="trending-title">{getTitle(item)}</p>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}
          </>
        )}

        {/* Loading skeletons */}
        {hasQuery && isLoading && <SkeletonGrid />}

        {/* Error state */}
        {hasQuery && isError && (
          <div className="empty-state animate-fade-in">
            <span className="empty-state-emoji">⚠️</span>
            <p className="empty-state-title">Something went wrong</p>
            <p className="empty-state-subtitle">Check your connection and try again.</p>
          </div>
        )}

        {/* Results grid */}
        {hasQuery && !isLoading && !isError && filteredResults.length > 0 && (
          <div
            className="results-grid animate-fade-in"
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
        {hasQuery && isEmpty && <EmptyState query={query} />}
      </div>

      {/* ── Add to watchlist bottom sheet ── */}
      <BottomSheet
        isOpen={selectedResult !== null}
        onClose={() => setSelectedResult(null)}
        label="Add to watchlist"
      >
        {selectedResult && (
          <div className="add-sheet">
            {/* Title header */}
            <div className="add-sheet-header">
              {getImageUrl(selectedResult.poster_path, 'w200') ? (
                <img
                  src={getImageUrl(selectedResult.poster_path, 'w200')!}
                  alt={getTitle(selectedResult)}
                  className="add-sheet-thumb"
                />
              ) : (
                <div className="add-sheet-thumb-placeholder">
                  <Film size={20} color="var(--text-muted)" aria-hidden="true" />
                </div>
              )}
              <div className="add-sheet-meta">
                <p className="add-sheet-title">{getTitle(selectedResult)}</p>
                <p className="add-sheet-year">{getYear(selectedResult)}</p>
              </div>
            </div>

            {/* Status selector */}
            <div
              className="status-selector"
              role="radiogroup"
              aria-label="Watch status"
            >
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`status-option${selectedStatus === opt.value ? ' status-option--active' : ''}`}
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

            {/* Confirm button */}
            <button
              className="add-sheet-confirm-btn"
              onClick={handleConfirmAdd}
              disabled={isAdding}
              type="button"
            >
              {isAdding ? 'Adding…' : 'Add to Watchlist'}
            </button>
          </div>
        )}
      </BottomSheet>

      {/* ── Toast notification ── */}
      {toast && (
        <div className="toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </div>
  )
}
