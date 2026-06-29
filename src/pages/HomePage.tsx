import { useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { collection, query, orderBy, limit, onSnapshot, Timestamp } from 'firebase/firestore'
import {
  Film,
  Plus,
  Check,
  Play,
  MoreVertical,
  Clock,
  Star,
  Flame,
  Tv,
  Clapperboard,
  PenLine,
  Shuffle,
  Search,
} from 'lucide-react'

import { useAuth } from '@/features/auth/useAuth'
import { useWatchlist } from '@/features/watchlist/hooks/useWatchlist'
import { useAnalytics } from '@/features/analytics/hooks/useAnalytics'
import { getTrending, getImageUrl, getMovieDetails, getTVDetails } from '@/lib/tmdb'
import { db, COLLECTIONS } from '@/lib/firebase'
import type { WatchHistoryEntry } from '@/types/app'

import './HomePage.css'

// ─── Daily Quotes ─────────────────────────────────────────────────────────────
const MOVIE_QUOTES = [
  { quote: 'Get busy living, or get busy dying.', film: 'The Shawshank Redemption' },
  { quote: "I'm going to make him an offer he can't refuse.", film: 'The Godfather' },
  { quote: 'Why so serious?', film: 'The Dark Knight' },
  { quote: "You can't handle the truth!", film: 'A Few Good Men' },
  { quote: 'I see dead people.', film: 'The Sixth Sense' },
  { quote: 'To infinity and beyond!', film: 'Toy Story' },
  { quote: 'My precious.', film: 'The Lord of the Rings' },
  { quote: 'Just keep swimming.', film: 'Finding Nemo' },
  { quote: 'You is kind, you is smart, you is important.', film: 'The Help' },
  { quote: 'Life is like a box of chocolates.', film: 'Forrest Gump' },
  { quote: "Here's looking at you, kid.", film: 'Casablanca' },
  { quote: 'May the Force be with you.', film: 'Star Wars' },
  { quote: "I'll be back.", film: 'The Terminator' },
  { quote: "You're a wizard, Harry.", film: 'Harry Potter' },
  { quote: 'We accept the love we think we deserve.', film: 'The Perks of Being a Wallflower' },
  { quote: 'Do not go gentle into that good night.', film: 'Interstellar' },
  { quote: 'Every passing minute is another chance to turn it all around.', film: 'Vanilla Sky' },
  { quote: 'Pain is temporary. Film is forever.', film: 'Unknown' },
  { quote: 'All those moments will be lost in time, like tears in rain.', film: 'Blade Runner' },
  { quote: 'The stuff that dreams are made of.', film: 'The Maltese Falcon' },
]

// ─── Mood Map ─────────────────────────────────────────────────────────────────
const MOODS = [
  { name: 'Happy', emoji: '😊' },
  { name: 'Dark', emoji: '🌑' },
  { name: 'Mind Bend', emoji: '🌀' },
  { name: 'Chill', emoji: '☕' },
  { name: 'Excited', emoji: '🚀' },
]

const MOOD_GENRES: Record<string, number[]> = {
  Happy: [35, 16],
  Dark: [53, 80, 27],
  'Mind Bend': [878, 9648],
  Chill: [18, 10749],
  Excited: [28, 12],
}

// ─── Relative time ────────────────────────────────────────────────────────────
function getRelativeTime(d: Date): string {
  const diffMs = Date.now() - d.getTime()
  if (diffMs < 0) return 'just now'
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function HomePage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const { entries, addEntry, isLoading: isWatchlistLoading } = useWatchlist()
  const { data: analytics } = useAnalytics()

  const [historyList, setHistoryList] = useState<WatchHistoryEntry[]>([])
  const [currentTime, setCurrentTime] = useState(new Date())
  const [goal, setGoal] = useState<number>(() => {
    const saved = localStorage.getItem('cinetrack-watch-goal-2025')
    return saved ? parseInt(saved, 10) : 200
  })
  const [isEditingGoal, setIsEditingGoal] = useState(false)
  const [tempGoal, setTempGoal] = useState(String(goal))
  const [mood, setMood] = useState<string | null>(() => localStorage.getItem('cinetrack-mood'))

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const formattedDate = useMemo(() =>
    currentTime.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
    [currentTime])

  const formattedTime = useMemo(() =>
    currentTime.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' }),
    [currentTime])

  // History listener
  useEffect(() => {
    if (!user) return
    const q = query(
      collection(db, `users/${user.uid}/${COLLECTIONS.HISTORY}`),
      orderBy('watchedAt', 'desc'),
      limit(20)
    )
    return onSnapshot(q, (snap) => {
      setHistoryList(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as WatchHistoryEntry[])
    }, (err) => console.error('[CineTrack] History sync failed:', err))
  }, [user])

  // TMDb trending
  const { data: trendingData } = useQuery({
    queryKey: ['trending', 'week'] as const,
    queryFn: () => getTrending('all', 'week'),
    staleTime: 30 * 60 * 1000,
  })

  const trendingItems = useMemo(() =>
    (trendingData?.results ?? []).filter((r) => r.media_type !== 'person').slice(0, 15),
    [trendingData])

  const filteredTrending = useMemo(() => {
    if (!mood || !MOOD_GENRES[mood]) return trendingItems
    const targetIds = MOOD_GENRES[mood]!
    const matches = trendingItems.filter((item) => item.genre_ids?.some((g) => targetIds.includes(g)))
    return matches.length > 0 ? matches : trendingItems
  }, [trendingItems, mood])

  // Active watching
  const activeWatching = useMemo(() => {
    const watching = entries.filter((e) => e.status === 'watching')
    if (!watching.length) return null
    return [...watching].sort((a, b) => (b.updatedAt?.seconds ?? 0) - (a.updatedAt?.seconds ?? 0))[0]!
  }, [entries])

  const { data: activeDetails } = useQuery({
    queryKey: ['active-watching-details', activeWatching?.type, activeWatching?.titleId] as const,
    queryFn: async () => {
      if (!activeWatching) return null
      const [, idStr] = activeWatching.titleId.split(':')
      const id = parseInt(idStr || '0', 10)
      return activeWatching.type === 'movie' ? getMovieDetails(id) : getTVDetails(id)
    },
    enabled: !!activeWatching,
    staleTime: 10 * 60 * 1000,
  })

  const continueWatchingProgress = useMemo(() => {
    if (!activeWatching) return null
    const rating = activeDetails?.vote_average ? activeDetails.vote_average.toFixed(1) : null
    const backdrop = activeDetails?.backdrop_path
      ? getImageUrl(activeDetails.backdrop_path, 'w780')
      : getImageUrl(activeWatching.backdropPath, 'w780')
    const poster = getImageUrl(activeWatching.posterPath, 'w200')

    let progressPercent = 68
    let progressText = ''
    let runtimeString = ''

    if (activeWatching.type === 'movie') {
      const totalMins = (activeDetails as any)?.runtime || 120
      const saved = localStorage.getItem(`cinetrack-progress-${activeWatching.titleId}`)
      progressPercent = saved ? parseInt(saved, 10) : 68
      const watchedMins = Math.round(totalMins * (progressPercent / 100))
      const fmt = (m: number) => { const h = Math.floor(m / 60); const min = m % 60; return h > 0 ? `${h}h ${min}m` : `${min}m` }
      runtimeString = fmt(totalMins)
      progressText = `${fmt(watchedMins)} of ${fmt(totalMins)} · ${progressPercent}%`
    } else {
      const watched = activeWatching.episodesWatched || 0
      const total = activeWatching.totalEpisodes || (activeDetails as any)?.number_of_episodes || 10
      progressPercent = total > 0 ? Math.round((watched / total) * 100) : 0
      runtimeString = `${total} Episodes`
      progressText = `${watched} of ${total} episodes · ${progressPercent}%`
    }

    return {
      titleId: activeWatching.titleId,
      type: activeWatching.type,
      title: activeWatching.title,
      year: activeWatching.year,
      rating,
      backdrop,
      poster,
      progressPercent,
      progressText,
      runtimeString,
    }
  }, [activeWatching, activeDetails])

  const recentlyAdded = useMemo(() =>
    [...entries].sort((a, b) => (b.addedAt?.seconds ?? 0) - (a.addedAt?.seconds ?? 0)).slice(0, 8),
    [entries])

  const completedMoviesCount = useMemo(() => entries.filter((e) => e.type === 'movie' && e.status === 'completed').length, [entries])
  const completedTVCount = useMemo(() => entries.filter((e) => e.type === 'tv' && e.status === 'completed').length, [entries])

  const quickStats = useMemo(() => [
    { id: 'movies', icon: <Clapperboard size={24} />, val: completedMoviesCount, label: 'Movies' },
    { id: 'tv', icon: <Tv size={24} />, val: completedTVCount, label: 'TV Shows' },
    { id: 'hours', icon: <Clock size={24} />, val: analytics ? Math.round(analytics.totalRuntimeMinutes / 60) : 0, label: 'Hours Watched' },
    { id: 'streak', icon: <Flame size={24} />, val: analytics?.currentStreakDays ?? 0, label: 'Day Streak' },
    { id: 'rating', icon: <Star size={24} />, val: analytics?.averageRating ? analytics.averageRating.toFixed(1) : '—', label: 'Avg. Rating' },
  ], [completedMoviesCount, completedTVCount, analytics])

  const recentActivities = useMemo(() => {
    const list: { id: string; type: string; title: string; rating?: number; date: Date; timeAgo: string }[] = []
    entries.forEach((e) => {
      if (e.rating !== null && e.updatedAt) {
        const d = e.updatedAt.toDate()
        list.push({ id: `rating-${e.titleId}`, type: 'rating', title: e.title, rating: e.rating!, date: d, timeAgo: getRelativeTime(d) })
      }
      if (e.status === 'completed' && e.updatedAt) {
        const d = e.updatedAt.toDate()
        list.push({ id: `completed-${e.titleId}`, type: 'completed', title: e.title, date: d, timeAgo: getRelativeTime(d) })
      }
      if (e.review && e.review.trim() && e.updatedAt) {
        const d = e.updatedAt.toDate()
        list.push({ id: `review-${e.titleId}`, type: 'review', title: e.title, date: d, timeAgo: getRelativeTime(d) })
      }
      if (e.addedAt) {
        const d = e.addedAt.toDate()
        list.push({ id: `added-${e.titleId}`, type: 'added', title: e.title, date: d, timeAgo: getRelativeTime(d) })
      }
    })
    historyList.forEach((h) => {
      const d = h.watchedAt instanceof Date ? h.watchedAt : (h.watchedAt as unknown as Timestamp).toDate()
      list.push({ id: `history-${h.id}`, type: 'watched', title: h.title + (h.episodeLabel ? ` (${h.episodeLabel})` : ''), date: d, timeAgo: getRelativeTime(d) })
    })
    const seen = new Set<string>()
    return list
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .filter((item) => { if (seen.has(item.id)) return false; seen.add(item.id); return true })
      .slice(0, 5)
  }, [entries, historyList])

  const dailyQuote = useMemo(() => {
    const now = new Date()
    const start = new Date(now.getFullYear(), 0, 0)
    const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000)
    return MOVIE_QUOTES[dayOfYear % MOVIE_QUOTES.length]!
  }, [])

  // Goal ring
  const RING_R = 54
  const RING_C = 2 * Math.PI * RING_R
  const goalPct = goal > 0 ? Math.min(100, Math.round((completedMoviesCount / goal) * 100)) : 0
  const ringOffset = RING_C * (1 - goalPct / 100)

  const handleSaveGoal = useCallback(() => {
    const val = parseInt(tempGoal, 10)
    if (!isNaN(val) && val > 0) {
      setGoal(val)
      localStorage.setItem('cinetrack-watch-goal-2025', String(val))
    }
    setIsEditingGoal(false)
  }, [tempGoal])

  const handleMoodSelect = (name: string) => {
    const next = mood === name ? null : name
    setMood(next)
    if (next) localStorage.setItem('cinetrack-mood', next)
    else localStorage.removeItem('cinetrack-mood')
  }

  const handleQuickAdd = async (e: React.MouseEvent, item: any) => {
    e.stopPropagation()
    const type = item.media_type === 'movie' ? 'movie' : 'tv'
    const compositeId = `${type}:${item.id}`
    if (entries.some((w) => w.titleId === compositeId)) return
    const year = parseInt((item.release_date ?? item.first_air_date)?.slice(0, 4) || '0', 10)
    try {
      await addEntry({ titleId: compositeId, type, title: item.title ?? item.name ?? 'Untitled', posterPath: item.poster_path, backdropPath: item.backdrop_path, year, genres: [], status: 'plan_to_watch' })
    } catch (err) {
      console.error('[CineTrack] Quick Add failed:', err)
    }
  }

  const handleRandomPick = () => {
    const ptw = entries.filter((e) => e.status === 'plan_to_watch')
    if (!ptw.length) { alert('No titles in your "Plan to Watch" list yet!'); return }
    const picked = ptw[Math.floor(Math.random() * ptw.length)]!
    navigate(`/watchlist/${encodeURIComponent(picked.titleId)}`)
  }

  const getActivityIcon = (type: string) => ({ rating: '⭐', completed: '✅', added: '🔖', review: '💬' }[type] ?? '🎬')
  const getActivityText = (item: any) => {
    if (item.type === 'rating') return `You rated ${item.title} ⭐ ${item.rating?.toFixed(1)}`
    if (item.type === 'completed') return `You completed ${item.title} ✅`
    if (item.type === 'added') return `You added ${item.title} 🔖`
    if (item.type === 'review') return `You reviewed ${item.title} 💬`
    return `You watched ${item.title}`
  }

  const firstName = user?.displayName ? user.displayName.split(' ')[0] : 'Explorer'

  return (
    <div className="hp-wrapper animate-fade-in">
      <div className="hp-grid">

        {/* ── LEFT COLUMN ─────────────────────────────────────────────────── */}
        <div className="hp-main" style={{ padding: '20px 28px' }}>

          {/* 1. PAGE HEADER */}
          <header className="hp-header" style={{ marginBottom: '20px', marginTop: 0 }}>
            <div className="hp-header-left">
              <h1 className="hp-greeting">Welcome back, {firstName} 👋</h1>
              <p className="hp-subtitle">What are we watching today?</p>
            </div>
            <div className="hp-header-right">
              <div className="hp-clock desktop-only">
                <span className="hp-clock-date">{formattedDate}</span>
                <span className="hp-clock-sep">·</span>
                <span className="hp-clock-time">{formattedTime}</span>
              </div>
              <button className="hp-more-btn" aria-label="More options">
                <MoreVertical size={18} />
              </button>
            </div>
          </header>

          {/* 2. CONTINUE WATCHING HERO CARD */}
          <div style={{ marginBottom: '24px' }}>
            <section className="hp-hero-section">
              <p className="hp-section-label" style={{ marginTop: 0, marginBottom: '8px' }}>Continue Watching</p>
              {continueWatchingProgress ? (
                <div
                  className="hp-hero-card"
                  style={{
                    ...(continueWatchingProgress.backdrop ? { backgroundImage: `url(${continueWatchingProgress.backdrop})` } : {}),
                    marginBottom: '20px',
                    marginTop: 0,
                  }}
                >
                  <div className="hp-hero-overlay" />
                <div className="hp-hero-inner">
                  {continueWatchingProgress.poster && (
                    <img
                      src={continueWatchingProgress.poster}
                      alt={continueWatchingProgress.title}
                      className="hp-hero-poster desktop-only"
                    />
                  )}
                  <div className="hp-hero-info">
                    <h2 className="hp-hero-title">{continueWatchingProgress.title}</h2>
                    <div className="hp-hero-meta">
                      <span>{continueWatchingProgress.year}</span>
                      <span>·</span>
                      <span>{continueWatchingProgress.runtimeString}</span>
                      {continueWatchingProgress.rating && (
                        <><span>·</span><span>⭐ {continueWatchingProgress.rating} TMDb</span></>
                      )}
                    </div>
                    <div className="hp-hero-progress-wrap">
                      <div className="hp-hero-track">
                        <div className="hp-hero-fill" style={{ width: `${continueWatchingProgress.progressPercent}%` }} />
                      </div>
                      <p className="hp-hero-progress-text">{continueWatchingProgress.progressText}</p>
                    </div>
                    <div className="hp-hero-actions">
                      <button
                        className="hp-btn-resume"
                        onClick={() =>
                          navigate(continueWatchingProgress.type === 'tv'
                            ? `/watchlist/${encodeURIComponent(continueWatchingProgress.titleId)}/episodes`
                            : `/watchlist/${encodeURIComponent(continueWatchingProgress.titleId)}`)
                        }
                      >
                        <Play size={12} fill="currentColor" /> Resume
                      </button>
                      <button
                        className="hp-btn-details"
                        onClick={() => navigate(`/watchlist/${encodeURIComponent(continueWatchingProgress.titleId)}`)}
                      >
                        Details
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="hp-hero-empty">
                <span className="hp-hero-empty-icon">🍿</span>
                <h3 className="hp-hero-empty-title">Nothing in progress</h3>
                <p className="hp-hero-empty-desc">Search for something to watch</p>
                <button className="hp-btn-search" onClick={() => navigate('/search')}>
                  <Search size={13} /> Search
                </button>
              </div>
            )}
          </section>
        </div>

          {/* 3. QUICK STATS STRIP */}
          <div style={{ marginBottom: '24px' }}>
            <section className="hp-stats-section" style={{ marginTop: 0, marginBottom: '20px' }}>
              <div className="hp-stats-grid" style={{ gap: '10px' }}>
                {quickStats.map((s) => (
                  <div key={s.id} className="hp-stat-card">
                    <div className="hp-stat-icon">{s.icon}</div>
                    <div className="hp-stat-number">{s.val}</div>
                    <div className="hp-stat-label">{s.label}</div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* 4. RECENTLY ADDED CAROUSEL */}
          <div style={{ marginBottom: '24px' }}>
            <section className="hp-rail-section">
              <div className="hp-rail-header" style={{ marginTop: 0, marginBottom: '10px' }}>
                <h2 className="hp-rail-title">Recently Added</h2>
                <Link to="/watchlist" className="hp-rail-view-all">View all →</Link>
              </div>
            {isWatchlistLoading ? (
              <div className="hp-rail-scroll">
                {Array.from({ length: 6 }).map((_, i) => <div key={i} className="hp-rail-skeleton" />)}
              </div>
            ) : recentlyAdded.length > 0 ? (
              <div className="hp-rail-scroll">
                {recentlyAdded.map((item) => {
                  const poster = getImageUrl(item.posterPath, 'w200')
                  return (
                    <article
                      key={item.titleId}
                      className="hp-poster-card"
                      onClick={() => navigate(`/title/${item.titleId}`)}
                    >
                      <div className="hp-poster-wrap">
                        {poster
                          ? <img src={poster} alt={item.title} className="hp-poster-img" loading="lazy" />
                          : <div className="hp-poster-fallback"><Film size={20} /></div>}
                        {item.rating !== null && (
                          <span className="hp-rating-badge">⭐ {(item.rating as number).toFixed(1)}</span>
                        )}
                      </div>
                      <p className="hp-card-title">{item.title}</p>
                      <p className="hp-card-year">{item.year}</p>
                    </article>
                  )
                })}
              </div>
            ) : (
              <div className="hp-rail-empty">No titles added yet.</div>
            )}
          </section>
        </div>

          {/* 5. YOU MIGHT LIKE CAROUSEL */}
          <div style={{ marginBottom: '24px' }}>
            <section className="hp-rail-section">
              <div className="hp-rail-header" style={{ marginTop: 0, marginBottom: '10px' }}>
                <h2 className="hp-rail-title">
                  You Might Like
                  {mood && <span className="hp-mood-pill">· {mood}</span>}
                </h2>
              </div>
            {filteredTrending.length > 0 ? (
              <div className="hp-rail-scroll">
                {filteredTrending.map((item) => {
                  const poster = getImageUrl(item.poster_path, 'w200')
                  const title = item.title ?? item.name ?? 'Untitled'
                  const compositeId = `${item.media_type === 'movie' ? 'movie' : 'tv'}:${item.id}`
                  const isAdded = entries.some((w) => w.titleId === compositeId)
                  const year = (item.release_date ?? item.first_air_date)?.slice(0, 4) ?? ''
                  const rating = item.vote_average ? item.vote_average.toFixed(1) : null
                  return (
                    <article
                      key={item.id}
                      className="hp-poster-card"
                      onClick={() => navigate(`/watchlist/${encodeURIComponent(compositeId)}`)}
                    >
                      <div className="hp-poster-wrap">
                        {poster
                          ? <img src={poster} alt={title} className="hp-poster-img" loading="lazy" />
                          : <div className="hp-poster-fallback"><Film size={20} /></div>}
                        {rating && <span className="hp-rating-badge">⭐ {rating}</span>}
                        <button
                          className={`hp-add-badge ${isAdded ? 'hp-add-badge--added' : ''}`}
                          onClick={(e) => handleQuickAdd(e, item)}
                          disabled={isAdded}
                          aria-label={isAdded ? 'Already added' : 'Add to watchlist'}
                        >
                          {isAdded ? <Check size={10} /> : <Plus size={10} />}
                        </button>
                      </div>
                      <p className="hp-card-title">{title}</p>
                      <p className="hp-card-year">{year}</p>
                    </article>
                  )
                })}
              </div>
            ) : (
              <div className="hp-rail-empty">Loading suggestions…</div>
            )}
          </section>
        </div>
      </div>

        {/* ── RIGHT COLUMN (WIDGETS) ─────────────────────────────────────────── */}
        <aside className="dashboard-right">

          {/* WIDGET 1 — WATCH GOAL 2025 */}
          <section className="hp-widget">
            <div className="hp-widget-header">
              <h3 className="hp-widget-title">Watch Goal 2025</h3>
              {isEditingGoal
                ? <button className="hp-widget-action" onClick={handleSaveGoal}>Save</button>
                : <button className="hp-widget-action" onClick={() => { setTempGoal(String(goal)); setIsEditingGoal(true) }}>Edit Goal</button>}
            </div>
            <div className="hp-goal-content">
              <div className="hp-ring-wrap">
                <svg width="140" height="140" viewBox="0 0 140 140" className="hp-ring-svg">
                  <circle cx="70" cy="70" r={RING_R} fill="none" stroke="var(--border-default)" strokeWidth="10" />
                  <circle
                    cx="70" cy="70" r={RING_R}
                    fill="none"
                    stroke="var(--color-brand)"
                    strokeWidth="10"
                    strokeDasharray={RING_C}
                    strokeDashoffset={ringOffset}
                    strokeLinecap="round"
                    transform="rotate(-90 70 70)"
                    style={{ transition: 'stroke-dashoffset 800ms ease' }}
                  />
                </svg>
                <div className="hp-ring-center">
                  <span className="hp-ring-pct">{goalPct}%</span>
                </div>
              </div>
              {isEditingGoal ? (
                <div className="hp-goal-edit">
                  <input
                    type="number" min={1} max={999}
                    value={tempGoal}
                    onChange={(e) => setTempGoal(e.target.value)}
                    onBlur={handleSaveGoal}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveGoal()}
                    className="hp-goal-input"
                    autoFocus
                  />
                  <span className="hp-goal-input-label">Movies Goal</span>
                </div>
              ) : (
                <div className="hp-goal-stats">
                  <div className="hp-goal-row">
                    <strong className="hp-goal-num">{goal} Movies</strong>
                    <span className="hp-goal-lbl">Goal</span>
                  </div>
                  <div className="hp-goal-row">
                    <strong className="hp-goal-num hp-goal-num--brand">{completedMoviesCount} Movies</strong>
                    <span className="hp-goal-lbl">Watched</span>
                  </div>
                  <div className="hp-goal-row">
                    <strong className="hp-goal-num hp-goal-num--muted">{Math.max(0, goal - completedMoviesCount)} to go!</strong>
                    <span className="hp-goal-lbl" />
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* WIDGET 2 — MOOD FOR TODAY */}
          <section className="hp-widget">
            <div className="hp-widget-header">
              <h3 className="hp-widget-title">Mood for today?</h3>
            </div>
            <div className="hp-mood-row">
              {MOODS.map((m) => (
                <button
                  key={m.name}
                  className={`hp-mood-btn ${mood === m.name ? 'hp-mood-btn--active' : ''}`}
                  onClick={() => handleMoodSelect(m.name)}
                >
                  <span className="hp-mood-emoji">{m.emoji}</span>
                  <span className="hp-mood-label">{m.name}</span>
                </button>
              ))}
            </div>
          </section>

          {/* WIDGET 3 — RECENT ACTIVITY */}
          <section className="hp-widget">
            <div className="hp-widget-header">
              <h3 className="hp-widget-title">Recent Activity</h3>
            </div>
            {recentActivities.length > 0 ? (
              <ul className="hp-activity-list">
                {recentActivities.map((act, idx) => (
                  <li
                    key={act.id}
                    className={`hp-activity-item ${idx === recentActivities.length - 1 ? 'hp-activity-item--last' : ''}`}
                  >
                    <span className="hp-activity-icon">{getActivityIcon(act.type)}</span>
                    <div className="hp-activity-body">
                      <p className="hp-activity-text">{getActivityText(act)}</p>
                    </div>
                    <span className="hp-activity-time">{act.timeAgo}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="hp-activity-empty">No activity yet. Start watching!</p>
            )}
          </section>

          {/* WIDGET 4 — QUICK ACTIONS */}
          <section className="hp-widget">
            <div className="hp-widget-header">
              <h3 className="hp-widget-title">Quick Actions</h3>
            </div>
            <div className="hp-actions-grid">
              <button className="hp-action-btn" onClick={() => navigate('/search')}>
                <Film size={14} className="hp-action-icon" />
                + Add Movie
              </button>
              <button className="hp-action-btn" onClick={() => navigate('/search')}>
                <Tv size={14} className="hp-action-icon" />
                Add Show
              </button>
              <button className="hp-action-btn" onClick={() => navigate('/reviews')}>
                <PenLine size={14} className="hp-action-icon" />
                Write Review
              </button>
              <button className="hp-action-btn" onClick={handleRandomPick}>
                <Shuffle size={14} className="hp-action-icon" />
                Random Pick
              </button>
            </div>
          </section>

          {/* WIDGET 5 — DAILY QUOTE */}
          <section className="hp-widget">
            <div className="hp-widget-header">
              <h3 className="hp-widget-title">Daily Quote</h3>
            </div>
            <blockquote className="hp-quote">
              <p className="hp-quote-text">"{dailyQuote.quote}"</p>
              <cite className="hp-quote-film">— {dailyQuote.film}</cite>
            </blockquote>
          </section>

        </aside>
      </div>
    </div>
  )
}
