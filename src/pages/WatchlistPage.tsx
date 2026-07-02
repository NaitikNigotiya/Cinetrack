import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  SlidersHorizontal,
  LayoutGrid,
  Heart,
  Film,
  Plus,
  Sparkles,
  Star,
} from 'lucide-react'

import { useWatchlist } from '@/features/watchlist/hooks/useWatchlist'
import { getImageUrl } from '@/lib/tmdb'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { PosterCard } from '@/components/ui/PosterCard'

import type { WatchlistEntry, WatchStatus } from '@/types/app'
import './WatchlistPage.css'

// ─── Constants & Option Mappings ──────────────────────────────────────────────

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

type SortKey = 'addedAt' | 'title' | 'rating' | 'year' | 'runtime'

// ─── Component ────────────────────────────────────────────────────────────────

export default function WatchlistPage() {
  const navigate = useNavigate()
  const { entries, isLoading, updateEntry } = useWatchlist()

  // View settings
  const [viewType, setViewType] = useState<'smart' | 'status'>('smart')
  const [activeStatusTab, setActiveStatusTab] = useState<'all' | WatchStatus>('all')
  const [activeSmartTab, setActiveSmartTab] = useState<'watchSoon' | 'thisWeekend' | 'waitingForRelease' | 'maybeLater'>('watchSoon')

  // Filter Bottom Sheet states
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [sortBy, setSortBy] = useState<SortKey>('addedAt')
  const [filterType, setFilterType] = useState<'all' | 'movie' | 'tv'>('all')
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])

  // Temporary filter states inside sheet
  const [tempSortBy, setTempSortBy] = useState<SortKey>(sortBy)
  const [tempFilterType, setTempFilterType] = useState<'all' | 'movie' | 'tv'>(filterType)
  const [tempGenres, setTempGenres] = useState<string[]>(selectedGenres)

  // ── All unique genres from current watchlist ──
  const availableGenres = useMemo(() => {
    const genres = new Set<string>()
    entries.forEach((e) => {
      e.genres?.forEach((g) => genres.add(g))
    })
    return Array.from(genres).sort()
  }, [entries])

  // ── Apply filters to general list ──
  const filteredAndSortedList = useMemo(() => {
    let list = [...entries]

    // Media type filter
    if (filterType !== 'all') {
      list = list.filter((e) => e.type === filterType)
    }

    // Genres filter
    if (selectedGenres.length > 0) {
      list = list.filter((e) => e.genres?.some((g) => selectedGenres.includes(g)))
    }

    // Status tab filter (only in status view)
    if (viewType === 'status' && activeStatusTab !== 'all') {
      list = list.filter((e) => e.status === activeStatusTab)
    }

    // Sort logic
    return list.sort((a, b) => {
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title)
      }
      if (sortBy === 'rating') {
        return (b.rating ?? 0) - (a.rating ?? 0)
      }
      if (sortBy === 'year') {
        return b.year - a.year
      }
      if (sortBy === 'runtime') {
        return (b.totalRuntime ?? 0) - (a.totalRuntime ?? 0)
      }
      // addedAt (default)
      const dateA = a.addedAt?.seconds ?? 0
      const dateB = b.addedAt?.seconds ?? 0
      return dateB - dateA // newest first
    })
  }, [entries, filterType, selectedGenres, viewType, activeStatusTab, sortBy])

  // ── Smart View Categorizations (Plan to Watch titles only) ──
  const smartCategories = useMemo(() => {
    // Base plan_to_watch entries after general filters are applied (but ignoring activeStatusTab)
    let planToWatchBase = entries.filter((e) => e.status === 'plan_to_watch')

    if (filterType !== 'all') {
      planToWatchBase = planToWatchBase.filter((e) => e.type === filterType)
    }
    if (selectedGenres.length > 0) {
      planToWatchBase = planToWatchBase.filter((e) => e.genres?.some((g) => selectedGenres.includes(g)))
    }

    // Category 1: Waiting for Release (release year is in the future)
    const waitingForRelease = planToWatchBase.filter((e) => e.year > new Date().getFullYear())

    // Category 2: This Weekend (added in the last 7 days, excluding future titles)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const thisWeekend = planToWatchBase.filter((e) => {
      if (e.year > new Date().getFullYear()) return false
      const addedDate = e.addedAt?.toDate ? e.addedAt.toDate() : new Date()
      return addedDate >= sevenDaysAgo
    })

    // Category 3: Watch Soon (highest user ratings, excluding recent/future)
    const watchSoon = planToWatchBase
      .filter((e) => {
        if (e.year > new Date().getFullYear()) return false
        const addedDate = e.addedAt?.toDate ? e.addedAt.toDate() : new Date()
        if (addedDate >= sevenDaysAgo) return false
        return e.rating !== null && e.rating >= 7
      })
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))

    // Category 4: Maybe Later (all remaining plan_to_watch)
    const takenIds = new Set([
      ...waitingForRelease.map((e) => e.titleId),
      ...thisWeekend.map((e) => e.titleId),
      ...watchSoon.map((e) => e.titleId),
    ])

    const maybeLater = planToWatchBase
      .filter((e) => !takenIds.has(e.titleId))
      .sort((a, b) => {
        const dateA = a.addedAt?.seconds ?? 0
        const dateB = b.addedAt?.seconds ?? 0
        return dateA - dateB // oldest first
      })

    return {
      watchSoon,
      thisWeekend,
      waitingForRelease,
      maybeLater,
    }
  }, [entries, filterType, selectedGenres])

  // ── Actions ──
  const handleToggleFavorite = async (entry: WatchlistEntry) => {
    await updateEntry(entry.titleId, { isFavorite: !entry.isFavorite })
  }

  const handleOpenFilters = () => {
    setTempSortBy(sortBy)
    setTempFilterType(filterType)
    setTempGenres(selectedGenres)
    setIsFilterOpen(true)
  }

  const handleApplyFilters = () => {
    setSortBy(tempSortBy)
    setFilterType(tempFilterType)
    setSelectedGenres(tempGenres)
    setIsFilterOpen(false)
  }

  const handleResetFilters = () => {
    setTempSortBy('addedAt')
    setTempFilterType('all')
    setTempGenres([])
  }

  const toggleTempGenre = (genre: string) => {
    setTempGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    )
  }

  // ── Render ──

  if (isLoading) {
    return (
      <div className="page-wrapper watchlist-page page-scroll">
        <div className="skeleton" style={{ height: 40, width: '40%', marginBottom: 20 }} />
        <div className="media-card-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ aspectRatio: '2/3', borderRadius: 'var(--radius-lg)' }} />
          ))}
        </div>
      </div>
    )
  }

  const isWatchlistEmpty = entries.length === 0

  return (
    <div className="unified-page-container">
      <header className="unified-page-header">
        <div>
          <h1 className="page-title">My Watchlist</h1>
          <p className="page-subtitle">{entries.length} items logged</p>
        </div>
        <div className="wl-header-actions" style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <button className="wl-btn-add-movie" onClick={() => navigate('/search')} type="button">
            <Plus size={16} /> Add Movie
          </button>
          <button
            className={`wl-filter-icon-btn ${selectedGenres.length > 0 || filterType !== 'all' || sortBy !== 'addedAt' ? 'wl-filter-icon-btn--active' : ''}`}
            onClick={handleOpenFilters}
            aria-label="Filter watchlist"
            type="button"
          >
            <SlidersHorizontal size={18} />
          </button>
        </div>
      </header>

      {/* ── EMPTY STATE ── */}
      {isWatchlistEmpty ? (
        <div className="state-display-container">
          <div className="state-display-icon">🎬</div>
          <h3 className="state-display-title">Nothing tracked yet</h3>
          <p className="state-display-msg">Your added items will organize themselves nicely right here.</p>
        </div>
      ) : (
        <>
          {/* View Toggles & Status tab row */}
          <div className="wl-control-row">
            <div className="wl-mode-toggle-group">
              <button
                className={`wl-mode-btn ${viewType === 'smart' ? 'wl-mode-btn--active' : ''}`}
                onClick={() => setViewType('smart')}
                type="button"
              >
                <Sparkles size={13} /> Smart View
              </button>
              <button
                className={`wl-mode-btn ${viewType === 'status' ? 'wl-mode-btn--active' : ''}`}
                onClick={() => setViewType('status')}
                type="button"
              >
                <LayoutGrid size={13} /> Status View
              </button>
            </div>
          </div>

          {/* ── SMART SECTIONS VIEW ── */}
          {viewType === 'smart' && (
            <div className="wl-smart-container">
              {/* Horizontal Tabs for Mobile Smart View */}
              <div className="wl-smart-tabs-row mobile-only-flex" role="tablist">
                {[
                  { key: 'watchSoon', label: 'Watch Soon', count: smartCategories.watchSoon.length },
                  { key: 'thisWeekend', label: 'This Weekend', count: smartCategories.thisWeekend.length },
                  { key: 'waitingForRelease', label: 'Waiting for Release', count: smartCategories.waitingForRelease.length },
                  { key: 'maybeLater', label: 'Maybe Later', count: smartCategories.maybeLater.length },
                ].map((tabItem) => (
                  <button
                    key={tabItem.key}
                    className={`wl-status-tab-btn ${activeSmartTab === tabItem.key ? 'wl-status-tab-btn--active' : ''}`}
                    onClick={() => setActiveSmartTab(tabItem.key as any)}
                    role="tab"
                    aria-selected={activeSmartTab === tabItem.key}
                    type="button"
                  >
                    {tabItem.label}
                    <span className="wl-status-tab-count">{tabItem.count}</span>
                  </button>
                ))}
              </div>

              {/* Watch Soon Column */}
              <div className={`wl-smart-column ${activeSmartTab === 'watchSoon' ? 'wl-smart-column--active' : 'wl-smart-column--hidden-mobile'}`}>
                <h3 className="wl-column-title desktop-only-block">Watch Soon</h3>
                <span className="wl-column-badge desktop-only-inline">{smartCategories.watchSoon.length}</span>
                <div className="wl-column-cards-list">
                  {smartCategories.watchSoon.map((e) => (
                    <SmartCard key={e.titleId} entry={e} onNavigate={() => navigate(`/title/${e.titleId}`)} onToggleFavorite={() => handleToggleFavorite(e)} />
                  ))}
                  {smartCategories.watchSoon.length === 0 && <p className="wl-column-empty">No matching titles</p>}
                </div>
              </div>

              {/* This Weekend Column */}
              <div className={`wl-smart-column ${activeSmartTab === 'thisWeekend' ? 'wl-smart-column--active' : 'wl-smart-column--hidden-mobile'}`}>
                <h3 className="wl-column-title desktop-only-block">This Weekend</h3>
                <span className="wl-column-badge desktop-only-inline">{smartCategories.thisWeekend.length}</span>
                <div className="wl-column-cards-list">
                  {smartCategories.thisWeekend.map((e) => (
                    <SmartCard key={e.titleId} entry={e} onNavigate={() => navigate(`/title/${e.titleId}`)} onToggleFavorite={() => handleToggleFavorite(e)} />
                  ))}
                  {smartCategories.thisWeekend.length === 0 && <p className="wl-column-empty">No matching titles</p>}
                </div>
              </div>

              {/* Waiting for Release Column */}
              <div className={`wl-smart-column ${activeSmartTab === 'waitingForRelease' ? 'wl-smart-column--active' : 'wl-smart-column--hidden-mobile'}`}>
                <h3 className="wl-column-title desktop-only-block">Waiting for Release</h3>
                <span className="wl-column-badge desktop-only-inline">{smartCategories.waitingForRelease.length}</span>
                <div className="wl-column-cards-list">
                  {smartCategories.waitingForRelease.map((e) => (
                    <SmartCard key={e.titleId} entry={e} onNavigate={() => navigate(`/title/${e.titleId}`)} onToggleFavorite={() => handleToggleFavorite(e)} />
                  ))}
                  {smartCategories.waitingForRelease.length === 0 && <p className="wl-column-empty">No matching titles</p>}
                </div>
              </div>

              {/* Maybe Later Column */}
              <div className={`wl-smart-column ${activeSmartTab === 'maybeLater' ? 'wl-smart-column--active' : 'wl-smart-column--hidden-mobile'}`}>
                <h3 className="wl-column-title desktop-only-block">Maybe Later</h3>
                <span className="wl-column-badge desktop-only-inline">{smartCategories.maybeLater.length}</span>
                <div className="wl-column-cards-list">
                  {smartCategories.maybeLater.map((e) => (
                    <SmartCard key={e.titleId} entry={e} onNavigate={() => navigate(`/title/${e.titleId}`)} onToggleFavorite={() => handleToggleFavorite(e)} />
                  ))}
                  {smartCategories.maybeLater.length === 0 && <p className="wl-column-empty">No matching titles</p>}
                </div>
              </div>
            </div>
          )}

          {/* ── STATUS TABS VIEW ── */}
          {viewType === 'status' && (
            <div className="wl-status-container">
              {/* Horizontal scroll tabs for statuses */}
              <div className="wl-status-tabs-row" role="tablist">
                {(['all', 'watching', 'completed', 'plan_to_watch', 'dropped'] as const).map((tab) => {
                  const count = tab === 'all'
                    ? entries.length
                    : entries.filter((e) => e.status === tab).length
                  const label = tab === 'all' ? 'All' : STATUS_LABELS[tab]
                  return (
                    <button
                      key={tab}
                      className={`wl-status-tab-btn ${activeStatusTab === tab ? 'wl-status-tab-btn--active' : ''}`}
                      onClick={() => setActiveStatusTab(tab)}
                      role="tab"
                      aria-selected={activeStatusTab === tab}
                      type="button"
                    >
                      {label}
                      <span className="wl-status-tab-count">{count}</span>
                    </button>
                  )
                })}
              </div>

              {/* Grid block */}
              {filteredAndSortedList.length > 0 ? (
                <div className="media-card-grid">
                  {filteredAndSortedList.map((entry) => (
                    <PosterCard
                      key={entry.titleId}
                      title={entry.title}
                      year={entry.year}
                      posterPath={entry.posterPath}
                      rating={entry.rating}
                      type={entry.type}
                      status={entry.status}
                      isFavorite={entry.isFavorite}
                      onClick={() => navigate(`/title/${entry.titleId}`)}
                    />
                  ))}
                </div>
              ) : (
                <p className="wl-tab-empty-msg">No titles match this watch status filter.</p>
              )}
            </div>
          )}
        </>
      )}

      {/* ── MOBILE ADD FAB BUTTON ── */}
      <button
        className="wl-mobile-add-fab mobile-only"
        onClick={() => navigate('/search')}
        aria-label="Add movie"
        type="button"
      >
        <Plus size={24} />
      </button>

      {/* ── FILTER BOTTOM SHEET ── */}
      <BottomSheet
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        label="Filter and Sort"
      >
        <div className="wl-filter-sheet-body">
          {/* Sort selection */}
          <section className="wl-filter-section">
            <h4 className="wl-filter-heading">Sort by</h4>
            <div className="wl-filter-radio-group">
              {[
                { key: 'addedAt', label: 'Date Added' },
                { key: 'title', label: 'Title A-Z' },
                { key: 'rating', label: 'Rating' },
                { key: 'year', label: 'Year' },
                { key: 'runtime', label: 'Runtime' },
              ].map((opt) => (
                <label key={opt.key} className="wl-filter-radio-lbl">
                  <input
                    type="radio"
                    name="sortBy"
                    checked={tempSortBy === opt.key}
                    onChange={() => setTempSortBy(opt.key as SortKey)}
                    className="wl-filter-radio-input"
                  />
                  <span className="wl-filter-radio-custom" />
                  <span className="wl-filter-radio-text">{opt.label}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Type filter */}
          <section className="wl-filter-section">
            <h4 className="wl-filter-heading">Filter Type</h4>
            <div className="wl-filter-pills-row">
              {[
                { value: 'all', label: 'All' },
                { value: 'movie', label: 'Movies' },
                { value: 'tv', label: 'TV Shows' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  className={`wl-filter-pill-btn ${tempFilterType === opt.value ? 'wl-filter-pill-btn--active' : ''}`}
                  onClick={() => setTempFilterType(opt.value as any)}
                  type="button"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </section>

          {/* Genres filter */}
          {availableGenres.length > 0 && (
            <section className="wl-filter-section">
              <h4 className="wl-filter-heading">Filter Genre</h4>
              <div className="wl-filter-genre-grid">
                {availableGenres.map((genre) => {
                  const isActive = tempGenres.includes(genre)
                  return (
                    <button
                      key={genre}
                      className={`wl-filter-genre-chip ${isActive ? 'wl-filter-genre-chip--active' : ''}`}
                      onClick={() => toggleTempGenre(genre)}
                      type="button"
                    >
                      {genre}
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          {/* Actions */}
          <div className="wl-filter-actions">
            <button className="wl-filter-apply-btn" onClick={handleApplyFilters} type="button">
              Apply Filters
            </button>
            <button className="wl-filter-reset-btn" onClick={handleResetFilters} type="button">
              Reset Filters
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  )
}

// ─── Smart View Column Card ──────────────────────────────────────────────────

function SmartCard({
  entry,
  onNavigate,
  onToggleFavorite,
}: {
  entry: WatchlistEntry
  onNavigate: () => void
  onToggleFavorite: () => void
}) {
  const backdrop = entry.backdropPath
    ? getImageUrl(entry.backdropPath, 'w780')
    : getImageUrl(entry.posterPath, 'w500')

  const dateAddedStr = useMemo(() => {
    if (!entry.addedAt) return ''
    const date = entry.addedAt.toDate()
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  }, [entry.addedAt])

  return (
    <article className="wl-smart-card" onClick={onNavigate}>
      {/* Top visual block */}
      <div className="wl-smart-card-top">
        {backdrop ? (
          <img src={backdrop} alt={entry.title} className="wl-smart-card-img" loading="lazy" />
        ) : (
          <div className="wl-smart-card-img-ph"><Film size={20} /></div>
        )}
        <div className="wl-smart-card-overlay" />
        <span
          className="wl-smart-card-status-badge"
          style={{ background: STATUS_COLORS[entry.status] }}
        >
          {STATUS_LABELS[entry.status]}
        </span>
        {entry.rating && <span className="wl-smart-card-rating-badge">⭐ {entry.rating}</span>}

        {/* Favorite Heart */}
        <button
          className={`wl-smart-card-heart ${entry.isFavorite ? 'wl-smart-card-heart--active' : ''}`}
          onClick={(e) => { e.stopPropagation(); onToggleFavorite() }}
          aria-label="Toggle favorite"
          type="button"
        >
          <Heart size={14} fill={entry.isFavorite ? 'currentColor' : 'none'} />
        </button>

        {/* Overlay Title block */}
        <div className="wl-smart-card-title-block">
          <h4 className="wl-smart-card-title">{entry.title}</h4>
          <span className="wl-smart-card-year">{entry.year > 0 ? entry.year : '—'}</span>
        </div>
      </div>

      {/* Bottom info block */}
      <div className="wl-smart-card-bottom">
        {entry.genres && entry.genres.length > 0 && (
          <div className="wl-smart-card-genres">
            {entry.genres.slice(0, 2).map((g) => (
              <span key={g} className="wl-smart-genre-chip">{g}</span>
            ))}
          </div>
        )}

        <div className="wl-smart-card-footer">
          {entry.rating && (
            <div className="wl-smart-stars" aria-label={`Rating ${entry.rating}`}>
              {Array.from({ length: 5 }).map((_, i) => {
                const val = (i + 1) * 2
                const isHalf = entry.rating! >= val - 1 && entry.rating! < val
                const isFull = entry.rating! >= val
                return (
                  <Star
                    key={i}
                    size={11}
                    fill={isFull ? 'var(--star-filled)' : 'none'}
                    color={isFull || isHalf ? 'var(--star-filled)' : 'var(--text-muted)'}
                  />
                )
              })}
            </div>
          )}
          <span className="wl-smart-added-date">Added {dateAddedStr}</span>
        </div>
      </div>
    </article>
  )
}
