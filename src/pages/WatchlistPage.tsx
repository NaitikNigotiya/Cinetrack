import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  SlidersHorizontal,
  LayoutGrid,
  List,
  Heart,
  ChevronRight,
  Film,
  Check,
  Trash2,
} from 'lucide-react'

import { useWatchlist } from '@/features/watchlist/hooks/useWatchlist'
import { BottomSheet } from '@/components/ui/BottomSheet'

import type { WatchlistEntry, WatchStatus } from '@/types/app'
import './WatchlistPage.css'

// ─── Types & constants ────────────────────────────────────────────────────────

type TabKey = 'all' | WatchStatus | 'favorites'
type ViewMode = 'grid' | 'list'
type SortKey = 'addedAt' | 'title' | 'rating' | 'year' | 'runtime'

const STATUS_LABELS: Record<WatchStatus, string> = {
  watching:      'Watching',
  completed:     'Completed',
  plan_to_watch: 'Plan to Watch',
  dropped:       'Dropped',
}

const STATUS_COLORS: Record<WatchStatus, string> = {
  watching:      'var(--status-watching)',
  completed:     'var(--status-completed)',
  plan_to_watch: 'var(--status-plan)',
  dropped:       'var(--status-dropped)',
}

const STATUS_EMOJIS: Record<WatchStatus, string> = {
  watching:      '👁',
  completed:     '✓',
  plan_to_watch: '🕐',
  dropped:       '✗',
}

const ALL_STATUSES: WatchStatus[] = ['watching', 'completed', 'plan_to_watch', 'dropped']

const SORT_OPTIONS: { label: string; value: SortKey }[] = [
  { label: 'Date Added',  value: 'addedAt' },
  { label: 'Title A–Z',  value: 'title' },
  { label: 'Rating',     value: 'rating' },
  { label: 'Year',       value: 'year' },
  { label: 'Runtime',    value: 'runtime' },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

// Poster card (grid view)
function PosterCard({
  entry,
  onNavigate,
  onLongPress,
  onToggleFavorite,
}: {
  entry: WatchlistEntry
  onNavigate: () => void
  onLongPress: () => void
  onToggleFavorite: () => void
}) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleTouchStart = () => {
    longPressTimer.current = setTimeout(onLongPress, 500)
  }
  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current)
  }

  const poster = entry.posterPath
    ? `${import.meta.env.VITE_TMDB_IMAGE_W500}${entry.posterPath}`
    : null

  return (
    <article
      className="poster-card"
      onClick={onNavigate}
      onContextMenu={(e) => { e.preventDefault(); onLongPress() }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
      aria-label={entry.title}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onNavigate()}
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

        {/* Status badge */}
        <span
          className="poster-card-status"
          style={{ background: STATUS_COLORS[entry.status] }}
          aria-label={STATUS_LABELS[entry.status]}
        >
          {STATUS_LABELS[entry.status]}
        </span>

        {/* Rating badge */}
        {entry.rating !== null && (
          <span className="poster-card-rating">⭐ {entry.rating}</span>
        )}

        {/* Heart button */}
        <button
          className={`poster-card-heart ${entry.isFavorite ? 'poster-card-heart--filled' : 'poster-card-heart--empty'}`}
          onClick={(e) => { e.stopPropagation(); onToggleFavorite() }}
          aria-label={entry.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          type="button"
        >
          <Heart
            size={14}
            fill={entry.isFavorite ? '#ff4757' : 'none'}
            stroke={entry.isFavorite ? '#ff4757' : 'currentColor'}
          />
        </button>
      </div>

      <div className="poster-card-info">
        <p className="poster-card-title">{entry.title}</p>
        <p className="poster-card-meta">
          {entry.year > 0 ? entry.year : '—'} · {entry.type === 'movie' ? 'Movie' : 'TV'}
        </p>
      </div>
    </article>
  )
}

// List card (list view) with swipe-to-delete
function ListCard({
  entry,
  onNavigate,
  onRemove,
}: {
  entry: WatchlistEntry
  onNavigate: () => void
  onRemove: () => void
}) {
  const [swipeX, setSwipeX] = useState(0)
  const [swiping, setSwiping] = useState(false)
  const startX = useRef(0)

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0]?.clientX ?? 0
    setSwiping(true)
  }
  const handleTouchMove = (e: React.TouchEvent) => {
    const dx = (e.touches[0]?.clientX ?? 0) - startX.current
    if (dx < 0) setSwipeX(Math.max(dx, -80))
  }
  const handleTouchEnd = () => {
    setSwiping(false)
    setSwipeX(swipeX < -40 ? -80 : 0)
  }

  const poster = entry.posterPath
    ? `${import.meta.env.VITE_TMDB_IMAGE_W200}${entry.posterPath}`
    : null

  const genres = entry.genres.slice(0, 2).join(' · ')

  return (
    <div className="list-card-wrapper">
      {/* Revealed delete action */}
      <button
        className="list-card-delete-action"
        onClick={onRemove}
        aria-label={`Remove ${entry.title}`}
        type="button"
      >
        <Trash2 size={18} />
        <span>Remove</span>
      </button>

      {/* Swipeable card */}
      <div
        className="list-card"
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: swiping ? 'none' : 'transform 200ms ease',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => swipeX === 0 && onNavigate()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onNavigate()}
        aria-label={entry.title}
      >
        {poster ? (
          <img src={poster} alt={entry.title} className="list-card-poster" loading="lazy" />
        ) : (
          <div className="list-card-no-poster">
            <Film size={20} color="var(--text-muted)" aria-hidden="true" />
          </div>
        )}

        <div className="list-card-content">
          <p className="list-card-title">{entry.title}</p>
          <p className="list-card-meta">
            {entry.year > 0 ? entry.year : '—'}
            {' · '}
            {entry.type === 'movie' ? 'Movie' : 'TV'}
            {genres ? ` · ${genres}` : ''}
          </p>
          <span
            className="list-card-status-badge"
            style={{ background: STATUS_COLORS[entry.status] }}
          >
            {STATUS_LABELS[entry.status]}
          </span>
          {entry.rating !== null && (
            <span className="list-card-rating">⭐ {entry.rating}</span>
          )}
        </div>

        <ChevronRight size={18} className="list-card-chevron" aria-hidden="true" />
      </div>
    </div>
  )
}

// Skeleton loading grid
function LoadingGrid() {
  return (
    <div className="watchlist-grid-skeleton">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="skeleton-poster-card">
          <div className="skeleton" style={{ aspectRatio: '2/3', borderRadius: 'var(--radius-md)' }} />
          <div className="skeleton" style={{ height: 13, borderRadius: 'var(--radius-sm)' }} />
          <div className="skeleton" style={{ height: 11, width: '55%', borderRadius: 'var(--radius-sm)' }} />
        </div>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function WatchlistPage() {
  const navigate = useNavigate()
  const { entries, isLoading, total, totalRuntime, updateEntry, removeEntry } = useWatchlist()

  if (isLoading) {
    return (
      <div style={{ padding: '16px' }}>
        <div className="skeleton" style={{ height: 24, width: '60%', marginBottom: 16 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ aspectRatio: '2/3', borderRadius: 'var(--radius-md)' }} />
          ))}
        </div>
      </div>
    )
  }

  // ── Local UI state ─────────────────────────────────────────────────────────
  const [activeTab,         setActiveTab]         = useState<TabKey>('all')
  const [viewMode,          setViewMode]          = useState<ViewMode>('grid')
  const [isFilterOpen,      setIsFilterOpen]      = useState(false)
  const [quickEntry,        setQuickEntry]        = useState<WatchlistEntry | null>(null)
  const [isRemoveConfirming, setIsRemoveConfirming] = useState(false)

  // Pending filter state (applied when sheet closes)
  const [sortBy,       setSortBy]       = useState<SortKey>('addedAt')
  const [filterType,   setFilterType]   = useState<'all' | 'movie' | 'tv'>('all')
  const [filterGenres, setFilterGenres] = useState<string[]>([])

  // Pending state inside filter sheet (separate so user can cancel)
  const [pendingSort,         setPendingSort]         = useState<SortKey>(sortBy)
  const [pendingType,         setPendingType]         = useState<typeof filterType>(filterType)
  const [pendingGenres,       setPendingGenres]       = useState<string[]>(filterGenres)

  // ── Computed stats ─────────────────────────────────────────────────────────
  const favorites        = entries.filter((e) => e.isFavorite)
  const totalHours       = Math.round(totalRuntime / 60)
  const favoritesCount   = favorites.length

  // ── All unique genres from the watchlist ───────────────────────────────────
  const allGenres = useMemo(
    () => [...new Set(entries.flatMap((e) => e.genres))].sort(),
    [entries],
  )

  // ── Tab counts ─────────────────────────────────────────────────────────────
  const countByStatus = useMemo(() => {
    const counts: Record<WatchStatus, number> = {
      watching: 0, completed: 0, plan_to_watch: 0, dropped: 0,
    }
    entries.forEach((e) => { counts[e.status]++ })
    return counts
  }, [entries])

  const TABS: { key: TabKey; label: string; count: number }[] = [
    { key: 'all',          label: 'All',           count: total },
    { key: 'watching',     label: 'Watching',      count: countByStatus.watching },
    { key: 'completed',    label: 'Completed',     count: countByStatus.completed },
    { key: 'plan_to_watch',label: 'Plan to Watch', count: countByStatus.plan_to_watch },
    { key: 'dropped',      label: 'Dropped',       count: countByStatus.dropped },
    { key: 'favorites',    label: 'Favorites',     count: favoritesCount },
  ]

  // ── Filtered + sorted entries ──────────────────────────────────────────────
  const displayedEntries = useMemo(() => {
    let filtered = entries

    // Tab filter
    if (activeTab === 'favorites') {
      filtered = filtered.filter((e) => e.isFavorite)
    } else if (activeTab !== 'all') {
      filtered = filtered.filter((e) => e.status === activeTab)
    }

    // Type filter
    if (filterType !== 'all') {
      filtered = filtered.filter((e) => e.type === filterType)
    }

    // Genre filter
    if (filterGenres.length > 0) {
      filtered = filtered.filter((e) =>
        filterGenres.some((g) => e.genres.includes(g)),
      )
    }

    // Sort
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'title':   return a.title.localeCompare(b.title)
        case 'rating':  return (b.rating ?? -1) - (a.rating ?? -1)
        case 'year':    return b.year - a.year
        case 'runtime': return b.totalRuntime - a.totalRuntime
        default:        return b.updatedAt.seconds - a.updatedAt.seconds
      }
    })
  }, [entries, activeTab, filterType, filterGenres, sortBy])

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleNavigate = (entry: WatchlistEntry) => {
    navigate(`/watchlist/${encodeURIComponent(entry.titleId)}`)
  }

  const handleToggleFavorite = (entry: WatchlistEntry) => {
    void updateEntry(entry.titleId, { isFavorite: !entry.isFavorite })
  }

  const handleChangeStatus = (titleId: string, status: WatchStatus) => {
    void updateEntry(titleId, { status })
    setQuickEntry(null)
  }

  const handleRemove = (titleId: string) => {
    void removeEntry(titleId)
    setQuickEntry(null)
  }

  // Filter sheet open/close
  const openFilter = () => {
    setPendingSort(sortBy)
    setPendingType(filterType)
    setPendingGenres(filterGenres)
    setIsFilterOpen(true)
  }

  const closeFilter = () => {
    // Apply pending changes when sheet closes (any method)
    setSortBy(pendingSort)
    setFilterType(pendingType)
    setFilterGenres(pendingGenres)
    setIsFilterOpen(false)
  }

  const resetFilter = () => {
    setPendingSort('addedAt')
    setPendingType('all')
    setPendingGenres([])
  }

  const togglePendingGenre = (genre: string) => {
    setPendingGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre],
    )
  }

  const hasActiveFilters =
    sortBy !== 'addedAt' || filterType !== 'all' || filterGenres.length > 0

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="watchlist-page">

      {/* ── Header ── */}
      <div className="watchlist-header">
        <div className="watchlist-header-row">
          <h1 className="watchlist-title">My Watchlist</h1>
          <button
            className={`watchlist-filter-btn${hasActiveFilters ? ' watchlist-filter-btn--active' : ''}`}
            onClick={openFilter}
            aria-label="Sort and filter"
            type="button"
          >
            <SlidersHorizontal size={18} />
          </button>
        </div>

        {/* Stats strip */}
        <p className="watchlist-stats" aria-label="Watchlist statistics">
          <span>{total} Titles</span>
          <span className="watchlist-stats-sep" aria-hidden="true">•</span>
          <span>{totalHours} hrs watched</span>
          <span className="watchlist-stats-sep" aria-hidden="true">•</span>
          <span>{favoritesCount} Favorites</span>
        </p>
      </div>

      {/* ── Status tabs (sticky) ── */}
      <div className="status-tabs-container" role="tablist" aria-label="Filter by status">
        <div className="status-tabs-row">
          {TABS.map(({ key, label, count }) => (
            <button
              key={key}
              className={`status-tab${activeTab === key ? ' status-tab--active' : ''}`}
              onClick={() => setActiveTab(key)}
              role="tab"
              aria-selected={activeTab === key}
              type="button"
            >
              {label}
              <span className="status-tab-badge">{count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── View toggle ── */}
      <div className="view-controls-row" role="group" aria-label="View mode">
        <button
          className={`view-toggle-btn${viewMode === 'grid' ? ' view-toggle-btn--active' : ''}`}
          onClick={() => setViewMode('grid')}
          aria-label="Grid view"
          aria-pressed={viewMode === 'grid'}
          type="button"
        >
          <LayoutGrid size={18} />
        </button>
        <button
          className={`view-toggle-btn${viewMode === 'list' ? ' view-toggle-btn--active' : ''}`}
          onClick={() => setViewMode('list')}
          aria-label="List view"
          aria-pressed={viewMode === 'list'}
          type="button"
        >
          <List size={18} />
        </button>
      </div>

      {/* ── Content ── */}
      <div className="watchlist-content">
        {/* Loading */}
        {isLoading && <LoadingGrid />}

        {/* Empty state */}
        {!isLoading && displayedEntries.length === 0 && (
          <div className="watchlist-empty animate-fade-in">
            <span className="watchlist-empty-emoji" aria-hidden="true">
              {activeTab === 'all' ? '🎬' : activeTab === 'favorites' ? '❤️' : '📋'}
            </span>
            <p className="watchlist-empty-title">
              {activeTab === 'all'
                ? 'Your watchlist is empty'
                : activeTab === 'favorites'
                  ? 'No favorites yet'
                  : `${TABS.find((t) => t.key === activeTab)?.label ?? ''} list is empty`}
            </p>
            <p className="watchlist-empty-sub">
              {activeTab === 'all'
                ? 'Search for movies and TV shows to start tracking what you watch.'
                : activeTab === 'favorites'
                  ? 'Tap the ❤️ on any title to mark it as a favorite.'
                  : `Titles you mark as "${TABS.find((t) => t.key === activeTab)?.label ?? ''}" will appear here.`}
            </p>
            {activeTab === 'all' && (
              <button
                className="watchlist-empty-cta"
                onClick={() => navigate('/search')}
                type="button"
              >
                Search to add titles
              </button>
            )}
          </div>
        )}

        {/* Grid view */}
        {!isLoading && displayedEntries.length > 0 && viewMode === 'grid' && (
          <div
            className="watchlist-grid animate-fade-in"
            role="list"
            aria-label={`${displayedEntries.length} titles`}
          >
            {displayedEntries.map((entry) => (
              <div key={entry.titleId} role="listitem">
                <PosterCard
                  entry={entry}
                  onNavigate={() => handleNavigate(entry)}
                  onLongPress={() => setQuickEntry(entry)}
                  onToggleFavorite={() => handleToggleFavorite(entry)}
                />
              </div>
            ))}
          </div>
        )}

        {/* List view */}
        {!isLoading && displayedEntries.length > 0 && viewMode === 'list' && (
          <div
            className="watchlist-list animate-fade-in"
            role="list"
            aria-label={`${displayedEntries.length} titles`}
          >
            {displayedEntries.map((entry) => (
              <div key={entry.titleId} role="listitem">
                <ListCard
                  entry={entry}
                  onNavigate={() => handleNavigate(entry)}
                  onRemove={() => handleRemove(entry.titleId)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Quick action bottom sheet (long press) ── */}
      <BottomSheet
        isOpen={quickEntry !== null}
        onClose={() => setQuickEntry(null)}
        label="Quick actions"
      >
        {quickEntry && (
          <div className="quick-action-sheet">
            <p className="quick-action-title">{quickEntry.title}</p>

            <p className="quick-action-section-label">Change status</p>
            <div className="quick-status-grid">
              {ALL_STATUSES.map((status) => (
                <button
                  key={status}
                  className={`quick-status-btn${quickEntry.status === status ? ' quick-status-btn--active' : ''}`}
                  onClick={() => handleChangeStatus(quickEntry.titleId, status)}
                  type="button"
                >
                  <span>{STATUS_EMOJIS[status]}</span>
                  <span>{STATUS_LABELS[status]}</span>
                  {quickEntry.status === status && <Check size={14} aria-hidden="true" />}
                </button>
              ))}
            </div>

            <div className="quick-action-row">
              <button
                className="quick-action-btn"
                onClick={() => { handleToggleFavorite(quickEntry); setQuickEntry(null) }}
                type="button"
              >
                <Heart
                  size={18}
                  fill={quickEntry.isFavorite ? '#ff4757' : 'none'}
                  stroke={quickEntry.isFavorite ? '#ff4757' : 'currentColor'}
                />
                {quickEntry.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              </button>

              {!isRemoveConfirming ? (
                <button
                  className="quick-action-btn quick-action-btn--danger"
                  onClick={() => setIsRemoveConfirming(true)}
                  type="button"
                >
                  <Trash2 size={18} />
                  Remove from watchlist
                </button>
              ) : (
                <button
                  className="quick-action-btn quick-action-btn--danger"
                  onClick={() => { handleRemove(quickEntry.titleId); setIsRemoveConfirming(false) }}
                  type="button"
                >
                  <Trash2 size={18} />
                  Tap again to confirm removal
                </button>
              )}
            </div>
          </div>
        )}
      </BottomSheet>

      {/* ── Filter / Sort bottom sheet ── */}
      <BottomSheet
        isOpen={isFilterOpen}
        onClose={closeFilter}
        label="Sort and filter"
      >
        <div className="filter-sheet">
          <p className="filter-sheet-title">Sort &amp; Filter</p>

          {/* Sort */}
          <div className="filter-section">
            <p className="filter-section-label">Sort by</p>
            <div className="sort-options">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`sort-option${pendingSort === opt.value ? ' sort-option--active' : ''}`}
                  onClick={() => setPendingSort(opt.value)}
                  type="button"
                >
                  {opt.label}
                  {pendingSort === opt.value && (
                    <Check size={16} className="sort-option-check" aria-hidden="true" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Type filter */}
          <div className="filter-section">
            <p className="filter-section-label">Type</p>
            <div className="type-pills">
              {(['all', 'movie', 'tv'] as const).map((t) => (
                <button
                  key={t}
                  className={`type-pill${pendingType === t ? ' type-pill--active' : ''}`}
                  onClick={() => setPendingType(t)}
                  type="button"
                >
                  {t === 'all' ? 'All' : t === 'movie' ? 'Movies' : 'TV Shows'}
                </button>
              ))}
            </div>
          </div>

          {/* Genre filter */}
          {allGenres.length > 0 && (
            <div className="filter-section">
              <p className="filter-section-label">Genre</p>
              <div className="genre-chips">
                {allGenres.map((genre) => (
                  <button
                    key={genre}
                    className={`genre-chip${pendingGenres.includes(genre) ? ' genre-chip--active' : ''}`}
                    onClick={() => togglePendingGenre(genre)}
                    aria-pressed={pendingGenres.includes(genre)}
                    type="button"
                  >
                    {genre}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="filter-actions">
            <button className="filter-apply-btn" onClick={closeFilter} type="button">
              Apply
            </button>
            <button className="filter-reset-btn" onClick={resetFilter} type="button">
              Reset
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  )
}
