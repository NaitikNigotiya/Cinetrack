import { useState, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Settings, Film, Plus, Check } from 'lucide-react'

import { useAuth } from '@/features/auth/useAuth'
import { useWatchlist } from '@/features/watchlist/hooks/useWatchlist'
import { useAnalytics } from '@/features/analytics/hooks/useAnalytics'
import { getTrending, getNewReleases, getImageUrl } from '@/lib/tmdb'

import './HomePage.css'

export default function HomePage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // Firestore Watchlist
  const { entries, addEntry, isLoading: isWatchlistLoading } = useWatchlist()

  // Real-time calculated Streak stats
  const { data: stats } = useAnalytics()

  // ── Pull-to-refresh gesture states ──
  const [startY, setStartY] = useState(0)
  const [currentY, setCurrentY] = useState(0)
  const [isPulling, setIsPulling] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // ── TMDb Queries ──
  const { data: trendingData, refetch: refetchTrending } = useQuery({
    queryKey: ['trending', 'week'] as const,
    queryFn: () => getTrending('all', 'week'),
    staleTime: 30 * 60 * 1000,
  })

  // Calculate this week's date strings for New Releases discover
  const dateWindow = useMemo(() => {
    const today = new Date()
    const lastWeek = new Date()
    lastWeek.setDate(today.getDate() - 7)

    const format = (d: Date) => d.toISOString().slice(0, 10)
    return { start: format(lastWeek), end: format(today) }
  }, [])

  const { data: newReleasesData, refetch: refetchNewReleases } = useQuery({
    queryKey: ['new-releases', dateWindow.start, dateWindow.end] as const,
    queryFn: () => getNewReleases(dateWindow.start, dateWindow.end),
    staleTime: 12 * 60 * 60 * 1000, // Cached 12 hours
  })

  // ── Greetings ──
  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }, [])

  // ── List Computations ──
  const continueWatching = useMemo(() => {
    return entries.filter((e) => e.status === 'watching')
  }, [entries])

  const recentlyAdded = useMemo(() => {
    return [...entries]
      .sort((a, b) => {
        const aSecs = a.addedAt?.seconds ?? 0
        const bSecs = b.addedAt?.seconds ?? 0
        return bSecs - aSecs
      })
      .slice(0, 8)
  }, [entries])

  const favorites = useMemo(() => {
    return entries.filter((e) => e.isFavorite).slice(0, 6)
  }, [entries])

  const trendingItems = useMemo(() => {
    return (trendingData?.results ?? [])
      .filter((r) => r.media_type !== 'person')
      .slice(0, 10)
  }, [trendingData])

  const newReleasesItems = useMemo(() => {
    return (newReleasesData?.results ?? []).slice(0, 4)
  }, [newReleasesData])

  const userName = user?.displayName ? user.displayName.split(' ')[0] : 'Explorer'
  const userPhoto = user?.photoURL || null

  // ── Pull-to-refresh handlers ──
  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0 && !isRefreshing) {
      setStartY(e.touches[0]!.clientY)
      setIsPulling(true)
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling) return
    const diff = e.touches[0]!.clientY - startY
    if (diff > 0) {
      // Apply rubberbanding tension scale
      const pullDist = Math.min(diff * 0.4, 80)
      setCurrentY(pullDist)
    }
  }

  const handleTouchEnd = async () => {
    if (!isPulling) return
    setIsPulling(false)
    if (currentY >= 60) {
      setIsRefreshing(true)
      setCurrentY(60)
      try {
        await Promise.all([
          refetchTrending(),
          refetchNewReleases(),
        ])
      } catch (err) {
        console.error(err)
      } finally {
        setIsRefreshing(false)
        setCurrentY(0)
      }
    } else {
      setCurrentY(0)
    }
  }

  // ── Quick Add Handler ──
  const handleQuickAdd = async (e: React.MouseEvent, item: any) => {
    e.stopPropagation()
    const mediaType = item.media_type === 'movie' ? 'movie' : 'tv'
    const compositeId = `${mediaType}:${item.id}`

    // Avoid duplicate watchlist inserts
    const exists = entries.some((w) => w.titleId === compositeId)
    if (exists) return

    const year = parseInt(
      (item.release_date ?? item.first_air_date)?.slice(0, 4) || '0',
      10
    )

    try {
      await addEntry({
        titleId: compositeId,
        type: mediaType,
        title: item.title ?? item.name ?? 'Untitled',
        posterPath: item.poster_path,
        backdropPath: item.backdrop_path,
        year,
        genres: [], // Rich genres fetched during detail retrieval
        status: 'plan_to_watch',
      })
    } catch (err) {
      console.error('[CineTrack] Quick add failed:', err)
    }
  }

  return (
    <div
      className="ptr-container"
      style={{ transform: `translateY(${currentY}px)` }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* PTR Indicator */}
      <div className={`ptr-indicator${currentY > 0 || isRefreshing ? ' ptr-indicator--visible' : ''}`}>
        <div className="ptr-spinner" />
      </div>

      {/* Header bar */}
      <header className="home-header">
        <div className="home-top-nav-row">
          <div className="home-logo-wordmark">
            <span>Cine</span>
            <span className="home-logo-highlight">Track</span>
          </div>

          <div className="home-profile-row">
            {userPhoto ? (
              <img src={userPhoto} alt={userName} className="home-user-avatar" />
            ) : (
              <div className="home-user-avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
                👤
              </div>
            )}
            <button
              className="home-settings-btn"
              onClick={() => navigate('/settings')}
              aria-label="Settings"
              type="button"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>

        <p className="home-greeting-title">
          {greeting}, {userName} 👋
        </p>
      </header>

      {/* Quick Stats Strip */}
      <section className="stats-strip-container">
        <div
          className="stats-strip"
          onClick={() => navigate('/analytics')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && navigate('/analytics')}
          aria-label="View full statistics"
        >
          <div className="stats-strip-item">
            <span className="stats-strip-val">{stats?.totalTitles ?? 0}</span>
            <span className="stats-strip-lbl">Titles</span>
          </div>

          <div className="stats-strip-divider" />

          <div className="stats-strip-item">
            <span className="stats-strip-val">
              {stats ? Math.round(stats.totalRuntimeMinutes / 60) : 0}
            </span>
            <span className="stats-strip-lbl">hrs</span>
          </div>

          <div className="stats-strip-divider" />

          <div className="stats-strip-item">
            <span className="stats-strip-val">{stats?.currentStreakDays ?? 0}</span>
            <span className="stats-strip-lbl">day streak</span>
          </div>
        </div>
      </section>

      {/* Body sections */}
      <main className="home-body" style={{ marginTop: 16 }}>

        {/* 1. Continue Watching */}
        {isWatchlistLoading ? (
          <section aria-label="Loading Continue Watching">
            <div className="home-section-header-row">
              <h2 className="home-section-title" style={{ margin: 0 }}>Continue Watching</h2>
            </div>
            <div className="home-rail">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="skeleton" style={{ width: 140, height: 200, borderRadius: 'var(--radius-md)' }} />
              ))}
            </div>
          </section>
        ) : continueWatching.length > 0 ? (
          <section aria-label="Continue Watching">
            <div className="home-section-header-row">
              <h2 className="home-section-title" style={{ margin: 0 }}>Continue Watching</h2>
            </div>
            <div className="home-rail">
              {continueWatching.map((item) => {
                const poster = getImageUrl(item.posterPath, 'w500')
                const isTv = item.type === 'tv'
                const progressPercent =
                  isTv && item.totalEpisodes > 0
                    ? Math.round((item.episodesWatched / item.totalEpisodes) * 100)
                    : 100

                return (
                  <article
                    key={item.titleId}
                    className="continue-card-v2 animate-fade-in"
                    onClick={() => navigate(`/watchlist/${encodeURIComponent(item.titleId)}`)}
                  >
                    {poster ? (
                      <img src={poster} alt={item.title} className="continue-poster-img" loading="lazy" />
                    ) : (
                      <div className="continue-no-poster-v2">
                        <Film size={20} />
                      </div>
                    )}
                    <div className="continue-gradient-overlay" />
                    <p className="continue-absolute-title">{item.title}</p>

                    {isTv && (
                      <span className="continue-episode-badge">
                        EP {item.episodesWatched}
                      </span>
                    )}

                    {/* Progress indicator */}
                    <div className="continue-bottom-bar-bg">
                      <div className="continue-bottom-bar-fg" style={{ width: `${progressPercent}%` }} />
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        ) : null}

        {/* 2. Recently Added */}
        <section aria-label="Recently Added">
          <div className="home-section-header-row">
            <h2 className="home-section-title" style={{ margin: 0 }}>Recently Added</h2>
          </div>
          {isWatchlistLoading ? (
            <div className="home-rail">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton" style={{ width: 100, height: 150, borderRadius: 'var(--radius-md)' }} />
              ))}
            </div>
          ) : recentlyAdded.length > 0 ? (
            <div className="home-rail">
              {recentlyAdded.map((item) => {
                const poster = getImageUrl(item.posterPath, 'w200')
                return (
                  <article
                    key={item.titleId}
                    className="recent-card animate-fade-in"
                    onClick={() => navigate(`/watchlist/${encodeURIComponent(item.titleId)}`)}
                  >
                    {poster ? (
                      <img src={poster} alt={item.title} className="recent-poster" loading="lazy" />
                    ) : (
                      <div className="recent-poster" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-elevated)' }}>
                        <Film size={20} color="var(--text-muted)" style={{ margin: 'auto' }} />
                      </div>
                    )}
                    <p className="recent-title">{item.title}</p>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="home-empty-state">
              <span className="home-empty-emoji" aria-hidden="true">🍿</span>
              <p className="home-empty-text">No titles added yet. Start searching to customize your list!</p>
              <button className="home-empty-btn" onClick={() => navigate('/search')}>
                Find Titles
              </button>
            </div>
          )}
        </section>

        {/* 3. Favorites Section */}
        <section aria-label="Favorites List">
          <div className="home-section-header-row">
            <h2 className="home-section-title" style={{ margin: 0 }}>My Favorites</h2>
            <Link to="/favorites" className="home-see-all-link">
              See all →
            </Link>
          </div>
          {favorites.length > 0 ? (
            <div className="home-rail">
              {favorites.map((item) => {
                const poster = getImageUrl(item.posterPath, 'w200')
                return (
                  <article
                    key={item.titleId}
                    className="recent-card animate-fade-in"
                    onClick={() => navigate(`/watchlist/${encodeURIComponent(item.titleId)}`)}
                  >
                    {poster ? (
                      <img src={poster} alt={item.title} className="recent-poster" loading="lazy" />
                    ) : (
                      <div className="recent-poster" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-elevated)' }}>
                        <Film size={20} color="var(--text-muted)" style={{ margin: 'auto' }} />
                      </div>
                    )}
                    <p className="recent-title">{item.title}</p>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="home-empty-state" style={{ padding: '20px 16px', background: 'var(--bg-overlay)' }}>
              <p className="home-empty-text" style={{ fontSize: 12, margin: 0 }}>
                Start hearting titles to see them here
              </p>
            </div>
          )}
        </section>

        {/* 4. Trending Recommendations */}
        {trendingItems.length > 0 && (
          <section aria-label="Trending recommendations">
            <div className="home-section-header-row">
              <h2 className="home-section-title" style={{ margin: 0 }}>Trending This Week</h2>
            </div>
            <div className="home-rail">
              {trendingItems.map((item) => {
                const poster = getImageUrl(item.poster_path, 'w200')
                const title = item.title ?? item.name ?? 'Untitled'
                const compositeId = `${item.media_type === 'movie' ? 'movie' : 'tv'}:${item.id}`
                const isAlreadyAdded = entries.some((w) => w.titleId === compositeId)

                return (
                  <article
                    key={item.id}
                    className="recent-card animate-fade-in"
                    onClick={() => navigate(`/watchlist/${encodeURIComponent(compositeId)}`)}
                  >
                    <div className="trending-poster-wrapper">
                      {poster ? (
                        <img src={poster} alt={title} className="trending-poster-img" loading="lazy" />
                      ) : (
                        <div className="trending-poster-img" style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-elevated)' }}>
                          <Film size={20} color="var(--text-muted)" style={{ margin: 'auto' }} />
                        </div>
                      )}

                      {/* Quick Add Plus button */}
                      <button
                        className={`trending-quick-add-btn${isAlreadyAdded ? ' trending-quick-add-btn--added' : ''}`}
                        onClick={(e) => handleQuickAdd(e, item)}
                        disabled={isAlreadyAdded}
                        aria-label={isAlreadyAdded ? 'Added to watchlist' : 'Add to watchlist'}
                        type="button"
                      >
                        {isAlreadyAdded ? <Check size={12} /> : <Plus size={12} />}
                      </button>
                    </div>
                    <p className="recent-title">{title}</p>
                  </article>
                )
              })}
            </div>
          </section>
        )}

        {/* 5. New Releases Grid */}
        {newReleasesItems.length > 0 && (
          <section aria-label="New Releases Grid">
            <div className="home-section-header-row">
              <h2 className="home-section-title" style={{ margin: 0 }}>New Releases</h2>
            </div>
            <div className="releases-grid-2col">
              {newReleasesItems.map((item) => {
                const poster = getImageUrl(item.poster_path, 'w200')
                const title = item.title ?? 'Untitled'
                const releaseDate = item.release_date ? new Date(item.release_date).toLocaleDateString() : 'Recent'
                const compositeId = `movie:${item.id}`

                return (
                  <article
                    key={item.id}
                    className="release-grid-card animate-fade-in"
                    onClick={() => navigate(`/watchlist/${encodeURIComponent(compositeId)}`)}
                  >
                    <div className="release-poster-box">
                      {poster ? (
                        <img src={poster} alt={title} className="release-poster-img" loading="lazy" />
                      ) : (
                        <div className="release-poster-img" style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-elevated)' }}>
                          <Film size={20} color="var(--text-muted)" style={{ margin: 'auto' }} />
                        </div>
                      )}
                      <span className="release-badge-overlay">{releaseDate}</span>
                    </div>
                    <div className="release-card-details">
                      <p className="release-card-title">{title}</p>
                      <p className="release-card-subtitle">Movie Discover</p>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        )}

        {/* Padding offset for bottom nav bar overlays */}
        <div className="home-bottom-spacing" />
      </main>
    </div>
  )
}
