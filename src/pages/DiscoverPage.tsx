import { useRef, useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Check, Film, Play } from 'lucide-react'

import { useAuth } from '@/features/auth/useAuth'
import { useWatchlist } from '@/features/watchlist/hooks/useWatchlist'
import { useWatchlistStore } from '@/features/watchlist/watchlistStore'
import { getTrending, getTopRated, discoverByGenre, getImageUrl } from '@/lib/tmdb'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { ContentCarousel } from '@/components/ui/ContentCarousel'

import type { CarouselItem } from '@/components/ui/ContentCarousel'
import type { WatchStatus, MediaType } from '@/types/app'

import './DiscoverPage.css'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { emoji: string; label: string; value: WatchStatus }[] = [
  { emoji: '👁',  label: 'Watching',      value: 'watching'      },
  { emoji: '✓',  label: 'Completed',     value: 'completed'     },
  { emoji: '🕐', label: 'Plan to Watch', value: 'plan_to_watch' },
  { emoji: '✗',  label: 'Dropped',       value: 'dropped'       },
]

// Top 10 IMDb classics as fallback data
const IMDB_TOP_FALLBACK = [
  { id: 278,   title: 'The Shawshank Redemption', year: 1994, rating: 9.3, genres: 'Drama' },
  { id: 238,   title: 'The Godfather',             year: 1972, rating: 9.2, genres: 'Crime, Drama' },
  { id: 424,   title: "Schindler's List",           year: 1993, rating: 9.0, genres: 'Drama, History' },
  { id: 389,   title: '12 Angry Men',               year: 1957, rating: 9.0, genres: 'Drama, Crime' },
  { id: 129,   title: 'Spirited Away',              year: 2001, rating: 8.6, genres: 'Animation, Family' },
  { id: 680,   title: 'Pulp Fiction',               year: 1994, rating: 8.9, genres: 'Crime, Drama' },
  { id: 497,   title: 'The Green Mile',             year: 1999, rating: 8.6, genres: 'Crime, Drama' },
  { id: 155,   title: 'The Dark Knight',            year: 2008, rating: 9.0, genres: 'Action, Crime' },
  { id: 496243,title: 'Parasite',                   year: 2019, rating: 8.5, genres: 'Drama, Thriller' },
  { id: 550,   title: 'Fight Club',                 year: 1999, rating: 8.8, genres: 'Drama, Thriller' },
]

// Genre sections
const GENRE_SECTIONS = [
  { id: 28,    label: 'Action',    color: '#E53E3E', emoji: '💥' },
  { id: 35,    label: 'Comedy',    color: '#D69E2E', emoji: '😂' },
  { id: 27,    label: 'Horror',    color: '#6B46C1', emoji: '👻' },
  { id: 53,    label: 'Thriller',  color: '#2D3748', emoji: '🔪' },
  { id: 18,    label: 'Drama',     color: '#3182CE', emoji: '🎭' },
  { id: 16,    label: 'Animation', color: '#38A169', emoji: '🎨' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tmdbToCarousel(item: any): CarouselItem {
  return {
    id: item.id,
    media_type: item.media_type ?? 'movie',
    title: item.title ?? item.name,
    name: item.name,
    poster_path: item.poster_path,
    backdrop_path: item.backdrop_path,
    release_date: item.release_date,
    first_air_date: item.first_air_date,
    vote_average: item.vote_average,
    overview: item.overview,
    genre_ids: item.genre_ids,
  }
}

function getItemTitle(item: CarouselItem) {
  return item.title ?? item.name ?? 'Untitled'
}

function getItemYear(item: CarouselItem) {
  return (item.release_date ?? item.first_air_date)?.slice(0, 4) ?? '—'
}

// ─── Genre Section with IntersectionObserver lazy loading ─────────────────────

interface GenreSectionProps {
  genreId: number
  label: string
  color: string
  emoji: string
  onAdd: (item: CarouselItem) => void
  onClick: (item: CarouselItem) => void
}

function GenreSection({ genreId, label, color, emoji, onAdd, onClick }: GenreSectionProps) {
  const sectionRef = useRef<HTMLElement>(null)
  const [shouldFetch, setShouldFetch] = useState(false)

  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry?.isIntersecting) { setShouldFetch(true); observer.disconnect() } },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const { data } = useQuery({
    queryKey: ['discover-genre', genreId],
    queryFn: () => discoverByGenre(genreId),
    enabled: shouldFetch,
    staleTime: 15 * 60 * 1000,
  })

  const items = (data?.results ?? []).slice(0, 15).map(tmdbToCarousel)

  return (
    <section ref={sectionRef} className="dp-section">
      <div className="dp-section-header">
        <h2 className="dp-section-title">
          <span className="dp-genre-dot" style={{ background: color }} />
          <span>{emoji} {label} Movies</span>
        </h2>
      </div>
      {items.length > 0
        ? <ContentCarousel items={items} onAdd={onAdd} onClick={onClick} />
        : <div className="dp-carousel-skeleton">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="dp-skel-card skeleton" />)}</div>}
    </section>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DiscoverPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { addEntry } = useWatchlist()
  const titleIds = useWatchlistStore((s) => s.titleIds)

  const [trendingWindow, setTrendingWindow] = useState<'day' | 'week'>('day')
  const [selectedItem, setSelectedItem] = useState<CarouselItem | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<WatchStatus>('plan_to_watch')
  const [isAdding, setIsAdding] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }, [])

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: trendingData, isLoading: trendingLoading } = useQuery({
    queryKey: ['trending', 'all', trendingWindow],
    queryFn: () => getTrending('all', trendingWindow),
    staleTime: 10 * 60 * 1000,
  })

  const { data: topRatedData } = useQuery({
    queryKey: ['top-rated'],
    queryFn: () => getTopRated(1),
    staleTime: 30 * 60 * 1000,
  })

  const { data: oscarData } = useQuery({
    queryKey: ['oscar-winners'],
    queryFn: () => discoverByGenre(18, 'vote_average.desc'),
    staleTime: 60 * 60 * 1000,
  })

  const { data: scifiData } = useQuery({
    queryKey: ['discover-scifi'],
    queryFn: () => discoverByGenre(878, 'vote_average.desc'),
    staleTime: 30 * 60 * 1000,
  })

  // ── Derived data ───────────────────────────────────────────────────────────
  const trendingAll = (trendingData?.results ?? [])
    .filter((r) => r.media_type !== 'person')
    .slice(0, 20)

  const heroItem = trendingAll[0] ?? null
  const carouselItems = trendingAll.slice(1, 15).map(tmdbToCarousel)

  const topRatedItems = topRatedData?.results?.slice(0, 10) ?? []

  const oscarItems = (oscarData?.results ?? []).slice(0, 12).map(tmdbToCarousel)
  const scifiItems = (scifiData?.results ?? []).slice(0, 15).map(tmdbToCarousel)

  // ── Open add sheet ─────────────────────────────────────────────────────────
  const handleOpenAdd = useCallback((item: CarouselItem) => {
    setSelectedItem(item)
    setSelectedStatus('plan_to_watch')
  }, [])

  // ── Confirm add ────────────────────────────────────────────────────────────
  const handleConfirmAdd = async () => {
    if (!selectedItem || !user) return
    setIsAdding(true)
    try {
      const mediaType: MediaType = selectedItem.media_type === 'tv' ? 'tv' : 'movie'
      const compositeId = `${mediaType}:${selectedItem.id}`
      const yr = parseInt(getItemYear(selectedItem)) || 0
      await addEntry({
        titleId: compositeId,
        type: mediaType,
        title: getItemTitle(selectedItem),
        posterPath: selectedItem.poster_path,
        backdropPath: selectedItem.backdrop_path ?? null,
        year: yr,
        genres: [],
        status: selectedStatus,
      })
      setSelectedItem(null)
      showToast(`"${getItemTitle(selectedItem)}" added ✓`)
    } catch {
      showToast('Failed to add. Please try again.')
    } finally {
      setIsAdding(false)
    }
  }

  // ── Hero add ───────────────────────────────────────────────────────────────
  const heroCompositeId = heroItem
    ? `${heroItem.media_type === 'tv' ? 'tv' : 'movie'}:${heroItem.id}`
    : null
  const heroInList = heroCompositeId ? titleIds.includes(heroCompositeId) : false

  const handleHeroAdd = () => {
    if (!heroItem) return
    handleOpenAdd(tmdbToCarousel(heroItem))
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="dp-page page-scroll">
      <div className="dp-inner">

        {/* ── Page Header ─────────────────────────────────────────────────── */}
        <header className="dp-page-header mobile-header-padding">
          <div>
            <h1 className="dp-page-title page-title">Discover</h1>
            <p className="dp-page-subtitle page-subtitle">Explore trending and top-rated titles</p>
          </div>
        </header>

        {/* ── TRENDING NOW ─────────────────────────────────────────────────── */}
        <section className="dp-section">
          <div className="dp-section-header">
            <h2 className="dp-section-title">Trending Now 🔥</h2>
            <div className="dp-header-right">
              {/* Tab switcher */}
              <div className="dp-tab-row" role="group" aria-label="Trending window">
                <button
                  className={`dp-tab ${trendingWindow === 'day' ? 'dp-tab--active' : ''}`}
                  onClick={() => setTrendingWindow('day')}
                  type="button"
                >
                  Today
                </button>
                <button
                  className={`dp-tab ${trendingWindow === 'week' ? 'dp-tab--active' : ''}`}
                  onClick={() => setTrendingWindow('week')}
                  type="button"
                >
                  This Week
                </button>
              </div>
            </div>
          </div>

          {/* Featured Hero */}
          {trendingLoading && <div className="dp-hero-skeleton skeleton" />}
          {!trendingLoading && heroItem && (
            <div
              className="dp-hero"
              style={{
                ...(heroItem.backdrop_path ? { backgroundImage: `url(${getImageUrl(heroItem.backdrop_path, 'w780')})` } : {}),
                cursor: 'pointer',
              }}
              onClick={() => navigate(`/title/${heroItem.media_type || 'movie'}:${heroItem.id}`)}
            >
              <div className="dp-hero-overlay" />

              {/* Left content */}
              <div className="dp-hero-left">
                <span className="dp-hero-rank-badge">TRENDING #1</span>
                <h2 className="dp-hero-title">
                  {heroItem.title ?? heroItem.name ?? 'Untitled'}
                </h2>
                {heroItem.overview && (
                  <p className="dp-hero-overview">{heroItem.overview}</p>
                )}
                <div className="dp-hero-actions">
                  {heroInList ? (
                    <div className="dp-hero-btn dp-hero-btn--in-list" onClick={(e) => e.stopPropagation()}>
                      <Check size={14} /> In Watchlist
                    </div>
                  ) : (
                    <button className="dp-hero-btn dp-hero-btn--add" onClick={(e) => { e.stopPropagation(); handleHeroAdd(); }} type="button">
                      <Plus size={14} /> Add to Watchlist
                    </button>
                  )}
                  <button className="dp-hero-btn dp-hero-btn--trailer" onClick={(e) => e.stopPropagation()} type="button" aria-label="Watch trailer">
                    <Play size={14} fill="currentColor" /> Trailer
                  </button>
                </div>
              </div>

              {/* Floating poster */}
              {heroItem.poster_path && (
                <div className="dp-hero-poster-wrap desktop-only">
                  <img
                    src={getImageUrl(heroItem.poster_path, 'w500')!}
                    alt={heroItem.title ?? heroItem.name}
                    className="dp-hero-poster"
                  />
                </div>
              )}
            </div>
          )}

          {/* Rest of trending carousel */}
          {carouselItems.length > 0 && (
            <div className="dp-section-mt">
              <ContentCarousel items={carouselItems} onAdd={handleOpenAdd} onClick={(item) => navigate(`/title/${item.media_type || 'movie'}:${item.id}`)} />
            </div>
          )}
        </section>

        {/* ── TOP IMDB ─────────────────────────────────────────────────────── */}
        <section className="dp-section">
          <div className="dp-section-header">
            <h2 className="dp-section-title">Top IMDb ⭐</h2>
            <span className="dp-view-all">Top 10 All Time</span>
          </div>

          <div className="dp-ranked-grid">
            {(topRatedItems.length > 0 ? topRatedItems : IMDB_TOP_FALLBACK).map((item: any, idx) => {
              const title = item.title ?? 'Untitled'
              const year = item.year ?? item.release_date?.slice(0, 4) ?? '—'
              const rating = item.rating ?? (item.vote_average > 0 ? item.vote_average.toFixed(1) : '—')
              const genres = item.genres ?? item.genre_ids?.join(', ') ?? ''
              const poster = getImageUrl(item.poster_path ?? null, 'w200')
              const mediaType = 'movie'
              const compositeId = `${mediaType}:${item.id}`
              const inList = titleIds.includes(compositeId)

              return (
                <div key={item.id} className={`dp-ranked-row ${idx % 2 === 0 ? 'dp-ranked-row--even' : ''}`} onClick={() => navigate(`/title/movie:${item.id}`)} style={{ cursor: 'pointer' }}>
                  <span className="dp-rank-num">#{String(idx + 1).padStart(2, '0')}</span>
                  <div className="dp-rank-poster-wrap">
                    {poster
                      ? <img src={poster} alt={title} className="dp-rank-poster" loading="lazy" />
                      : <div className="dp-rank-poster dp-rank-no-poster"><Film size={16} /></div>}
                  </div>
                  <div className="dp-rank-info">
                    <p className="dp-rank-title">{title}</p>
                    <p className="dp-rank-meta">{year} · ⭐ {rating}</p>
                    {genres && <p className="dp-rank-genres">{typeof genres === 'string' ? genres : ''}</p>}
                  </div>
                  {inList ? (
                    <div className="dp-rank-in-list" onClick={(e) => e.stopPropagation()}>✓</div>
                  ) : (
                    <button
                      className="dp-rank-add-btn"
                      onClick={(e) => { e.stopPropagation(); handleOpenAdd({ id: item.id, media_type: 'movie', title: item.title, poster_path: item.poster_path ?? null, release_date: item.release_date ?? String(item.year), vote_average: item.vote_average ?? item.rating }) }}
                      type="button"
                    >
                      + Add
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* ── AWARD WINNERS ────────────────────────────────────────────────── */}
        <section className="dp-section">
          <div className="dp-section-header">
            <h2 className="dp-section-title">Award Winners 🏆</h2>
          </div>
          {oscarItems.length > 0
            ? <ContentCarousel items={oscarItems} onAdd={handleOpenAdd} onClick={(item) => navigate(`/title/movie:${item.id}`)} cardWidth={110} />
            : <div className="dp-carousel-skeleton">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="dp-skel-card skeleton" />)}</div>}
        </section>

        {/* ── MIND-BENDING MOVIES ──────────────────────────────────────────── */}
        <section className="dp-section">
          <div className="dp-section-header">
            <h2 className="dp-section-title">Mind-Bending Movies 🌀</h2>
          </div>
          {scifiItems.length > 0
            ? <ContentCarousel items={scifiItems} onAdd={handleOpenAdd} onClick={(item) => navigate(`/title/movie:${item.id}`)} cardWidth={110} />
            : <div className="dp-carousel-skeleton">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="dp-skel-card skeleton" />)}</div>}
        </section>

        {/* ── GENRE ROWS (lazy loaded) ─────────────────────────────────────── */}
        {GENRE_SECTIONS.map((genre) => (
          <GenreSection
            key={genre.id}
            genreId={genre.id}
            label={genre.label}
            color={genre.color}
            emoji={genre.emoji}
            onAdd={handleOpenAdd}
            onClick={(item) => navigate(`/title/movie:${item.id}`)}
          />
        ))}
      </div>

      {/* ── Add to Watchlist Bottom Sheet ─────────────────────────────────── */}
      <BottomSheet
        isOpen={selectedItem !== null}
        onClose={() => setSelectedItem(null)}
        label="Add to watchlist"
      >
        {selectedItem && (
          <div className="dp-add-sheet">
            <div className="dp-add-header">
              {getImageUrl(selectedItem.poster_path, 'w200') ? (
                <img
                  src={getImageUrl(selectedItem.poster_path, 'w200')!}
                  alt={getItemTitle(selectedItem)}
                  className="dp-add-thumb"
                />
              ) : (
                <div className="dp-add-thumb-ph"><Film size={22} color="var(--text-muted)" /></div>
              )}
              <div className="dp-add-meta">
                <p className="dp-add-title">{getItemTitle(selectedItem)}</p>
                <p className="dp-add-year">{getItemYear(selectedItem)}</p>
                {(selectedItem.vote_average ?? 0) > 0 && (
                  <p className="dp-add-rating">⭐ {(selectedItem.vote_average!).toFixed(1)}</p>
                )}
              </div>
            </div>

            <div className="dp-status-grid" role="radiogroup" aria-label="Watch status">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`dp-status-btn ${selectedStatus === opt.value ? 'dp-status-btn--active' : ''}`}
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
              className="dp-confirm-btn"
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
        <div className="dp-toast" role="status" aria-live="polite">{toast}</div>
      )}
    </div>
  )
}
