import { useState, useEffect, useMemo, useCallback } from 'react'
import { useQueries } from '@tanstack/react-query'
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  increment,
  arrayUnion,
  serverTimestamp,
  Timestamp,
  query as firestoreQuery,
  orderBy,
  onSnapshot,
} from 'firebase/firestore'
import {
  Calendar as CalendarIcon,
  Clock,
  Film,
  Plus,
  Trash2,
  X,
  Search,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
} from 'lucide-react'

import { useAuth } from '@/features/auth/useAuth'
import { useWatchlist } from '@/features/watchlist/hooks/useWatchlist'
import { db, COLLECTIONS } from '@/lib/firebase'
import { getMovieDetails, getTVDetails, getImageUrl } from '@/lib/tmdb'
import { useSearch } from '@/features/search/hooks/useSearch'
import { deleteHistoryEvent } from '@/features/history/history'

import { BottomSheet } from '@/components/ui/BottomSheet'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { useToast } from '@/components/ui/Toast'

import type { WatchHistoryEntry, MediaType } from '@/types/app'
import type { TMDbMovie, TMDbTV } from '@/types/tmdb'

import './CalendarPage.css'

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface WatchGoal {
  id: string
  text: string
  completed: boolean
}

interface UpcomingReleaseItem {
  titleId: string
  title: string
  type: 'movie' | 'tv'
  posterPath: string | null
  releaseDate: string | null // YYYY-MM-DD
  daysUntil: number
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Normalizes Firestore timestamp / date to a YYYY-MM-DD local date string.
 */
function getLocalDateString(dateInput: any): string {
  if (!dateInput) return ''
  const date = dateInput instanceof Date
    ? dateInput
    : (dateInput as any).toDate
    ? dateInput.toDate()
    : new Date(dateInput)

  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/**
 * Returns helper dates for Calendar.
 */
function getMonthYearLabel(date: Date): string {
  return date.toLocaleString('default', { month: 'long', year: 'numeric' })
}

/**
 * Extracts upcoming release date from TMDB Movie or TV Show details.
 */
function getNextReleaseDate(details: TMDbMovie | TMDbTV | undefined): string | null {
  if (!details) return null
  if ('release_date' in details) {
    return details.release_date || null
  } else {
    // TV show logic
    const firstAir = details.first_air_date
    if (firstAir && new Date(firstAir) >= new Date()) {
      return firstAir
    }
    // Check future seasons
    if (details.seasons && Array.isArray(details.seasons)) {
      const futureSeasons = details.seasons
        .filter((s) => s.air_date && new Date(s.air_date) >= new Date())
        .sort((a, b) => new Date(a.air_date!).getTime() - new Date(b.air_date!).getTime())
      if (futureSeasons.length > 0) {
        return futureSeasons[0]?.air_date || null
      }
    }
    return firstAir || null
  }
}

// ─── UpcomingReleases Reusable Mini-Widget ────────────────────────────────────

export function UpcomingReleases({ limit = 10, showHeader = true }: { limit?: number; showHeader?: boolean }) {
  const { entries: watchlist } = useWatchlist()

  // Filter watchlist for plan_to_watch entries
  const ptw = useMemo(() => {
    return watchlist.filter((e) => e.status === 'plan_to_watch')
  }, [watchlist])

  // Fetch details for all plan_to_watch entries
  const queries = useQueries({
    queries: ptw.map((e) => {
      const [type, idStr] = e.titleId.split(':')
      const tmdbId = parseInt(idStr || '0', 10)
      return {
        queryKey: ['titleDetails', type, tmdbId] as const,
        queryFn: () => (type === 'movie' ? getMovieDetails(tmdbId) : getTVDetails(tmdbId)),
        staleTime: 24 * 60 * 60 * 1000, // 24 Hours
        enabled: !!e.titleId,
      }
    }),
  })

  // Map to sorted future releases
  const upcomingList = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const list: UpcomingReleaseItem[] = []

    ptw.forEach((item, index) => {
      const queryResult = queries[index]
      if (!queryResult || !queryResult.data) return

      const details = queryResult.data
      const releaseDateStr = getNextReleaseDate(details)

      if (releaseDateStr) {
        const releaseDate = new Date(releaseDateStr + 'T00:00:00')
        const diffTime = releaseDate.getTime() - today.getTime()
        const daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

        // Only include today or future releases
        if (daysUntil >= 0) {
          list.push({
            titleId: item.titleId,
            title: item.title,
            type: item.type,
            posterPath: item.posterPath,
            releaseDate: releaseDateStr,
            daysUntil,
          })
        }
      }
    })

    return list.sort((a, b) => {
      const timeA = a.releaseDate ? new Date(a.releaseDate + 'T00:00:00').getTime() : 0
      const timeB = b.releaseDate ? new Date(b.releaseDate + 'T00:00:00').getTime() : 0
      return timeA - timeB
    })
  }, [ptw, queries])

  const nextTen = useMemo(() => {
    return upcomingList.slice(0, limit)
  }, [upcomingList, limit])

  const getUrgencyClass = (days: number) => {
    if (days <= 7) return 'urgency-badge--this-week'
    if (days <= 30) return 'urgency-badge--this-month'
    return 'urgency-badge--later'
  }

  const getUrgencyText = (days: number) => {
    if (days === 0) return 'Today'
    if (days === 1) return 'Tomorrow'
    if (days <= 7) return 'This Week'
    if (days <= 30) return 'This Month'
    return 'Later'
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return ''
    return new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const isLoading = queries.some((q) => q.isLoading)

  return (
    <div className="upcoming-widget-items">
      {showHeader && (
        <h2 className="sidebar-section-title">
          <CalendarIcon size={18} color="var(--text-muted)" />
          Upcoming
        </h2>
      )}

      {isLoading && ptw.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 48, borderRadius: 'var(--radius-sm)' }} />
          ))}
        </div>
      ) : nextTen.length > 0 ? (
        <div className="upcoming-list">
          {nextTen.map((item) => {
            const poster = getImageUrl(item.posterPath, 'w200')
            return (
              <article key={item.titleId} className="upcoming-item">
                {poster ? (
                  <img src={poster} alt={item.title} className="upcoming-poster" loading="lazy" />
                ) : (
                  <div className="upcoming-poster" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Film size={14} color="var(--text-muted)" />
                  </div>
                )}
                <div className="upcoming-details">
                  <span className="upcoming-item-title">{item.title}</span>
                  <span className="upcoming-item-release">Releases {formatDate(item.releaseDate)}</span>
                </div>
                <span className={`urgency-badge ${getUrgencyClass(item.daysUntil)}`}>
                  {getUrgencyText(item.daysUntil)}
                </span>
              </article>
            )
          })}
        </div>
      ) : (
        <div style={{ padding: '12px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
          No upcoming releases in watchlist
        </div>
      )}
    </div>
  )
}

// ─── MAIN CALENDAR PAGE ───────────────────────────────────────────────────────

export default function CalendarPage() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const { entries: watchlist, addEntry } = useWatchlist()

  // Views & Reference dates
  const [selectedView, setSelectedView] = useState<'month' | 'week'>('month')
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => new Date())
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  // Search/Add watch dialog state
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const { results: searchResults, isLoading: isSearchLoading } = useSearch(searchQuery)

  // Firestore Watch History Sync
  const [historyList, setHistoryList] = useState<WatchHistoryEntry[]>([])

  useEffect(() => {
    if (!user) return

    const q = firestoreQuery(
      collection(db, `users/${user.uid}/${COLLECTIONS.HISTORY}`),
      orderBy('watchedAt', 'desc'),
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as WatchHistoryEntry[]
        setHistoryList(items)
      },
      (err) => {
        console.error('[CineTrack] Calendar history sync error:', err)
      },
    )

    return unsubscribe
  }, [user])

  // Watch Goals State (localStorage)
  const [goals, setGoals] = useState<WatchGoal[]>(() => {
    const saved = localStorage.getItem('cinetrack-calendar-goals')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (e) {
        console.error('[CineTrack] Load goals error:', e)
      }
    }
    return [
      { id: '1', text: 'Finish Breaking Bad', completed: false },
      { id: '2', text: 'Watch Dune Series', completed: false },
      { id: '3', text: 'Christopher Nolan Marathon', completed: false },
    ]
  })

  const [isAddingGoal, setIsAddingGoal] = useState(false)
  const [newGoalText, setNewGoalText] = useState('')

  useEffect(() => {
    localStorage.setItem('cinetrack-calendar-goals', JSON.stringify(goals))
  }, [goals])

  // TMDB Queries for upcoming release cells inside Calendar Grid
  const ptw = useMemo(() => {
    return watchlist.filter((e) => e.status === 'plan_to_watch')
  }, [watchlist])

  const ptwQueries = useQueries({
    queries: ptw.map((e) => {
      const [type, idStr] = e.titleId.split(':')
      const tmdbId = parseInt(idStr || '0', 10)
      return {
        queryKey: ['titleDetails', type, tmdbId] as const,
        queryFn: () => (type === 'movie' ? getMovieDetails(tmdbId) : getTVDetails(tmdbId)),
        staleTime: 24 * 60 * 60 * 1000,
        enabled: !!e.titleId,
      }
    }),
  })

  // Map of releaseDate (YYYY-MM-DD) -> UpcomingReleaseItem[]
  const releasesByDateMap = useMemo(() => {
    const map = new Map<string, UpcomingReleaseItem[]>()

    ptw.forEach((item, index) => {
      const queryResult = ptwQueries[index]
      if (!queryResult || !queryResult.data) return

      const details = queryResult.data
      const releaseDateStr = getNextReleaseDate(details)

      if (releaseDateStr) {
        let list = map.get(releaseDateStr)
        if (!list) {
          list = []
          map.set(releaseDateStr, list)
        }
        list.push({
          titleId: item.titleId,
          title: item.title,
          type: item.type,
          posterPath: item.posterPath,
          releaseDate: releaseDateStr,
          daysUntil: 0, // Placeholder
        })
      }
    })

    return map
  }, [ptw, ptwQueries])

  // Map of watchedDate (YYYY-MM-DD) -> WatchHistoryEntry[]
  const watchesByDateMap = useMemo(() => {
    const map = new Map<string, WatchHistoryEntry[]>()

    historyList.forEach((log) => {
      const dateStr = getLocalDateString(log.watchedAt)
      if (dateStr) {
        let list = map.get(dateStr)
        if (!list) {
          list = []
          map.set(dateStr, list)
        }
        list.push(log)
      }
    })

    return map
  }, [historyList])

  // Watchlist poster map for thumbnails
  const watchlistPosterMap = useMemo(() => {
    const map = new Map<string, string | null>()
    watchlist.forEach((w) => {
      map.set(w.titleId, w.posterPath)
    })
    return map
  }, [watchlist])

  // Navigation handlers
  const handlePrev = () => {
    setCurrentDate((prev) => {
      const next = new Date(prev)
      if (selectedView === 'month') {
        next.setMonth(next.getMonth() - 1)
      } else {
        next.setDate(next.getDate() - 7)
      }
      return next
    })
  }

  const handleNext = () => {
    setCurrentDate((prev) => {
      const next = new Date(prev)
      if (selectedView === 'month') {
        next.setMonth(next.getMonth() + 1)
      } else {
        next.setDate(next.getDate() + 7)
      }
      return next
    })
  }

  const handleToday = () => {
    const today = new Date()
    setCurrentDate(today)
    setSelectedDate(today)
  }

  // Month days generation
  const monthDaysGrid = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    const firstDayIndex = new Date(year, month, 1).getDay() // 0 = Sunday
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate()
    const daysInPrevMonth = new Date(year, month, 0).getDate()

    const grid: { date: Date; isCurrentMonth: boolean }[] = []

    // Previous month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      grid.push({
        date: new Date(year, month - 1, daysInPrevMonth - i),
        isCurrentMonth: false,
      })
    }

    // Current month
    for (let i = 1; i <= daysInCurrentMonth; i++) {
      grid.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      })
    }

    // Next month padding
    let nextMonthDay = 1
    while (grid.length % 7 !== 0) {
      grid.push({
        date: new Date(year, month + 1, nextMonthDay++),
        isCurrentMonth: false,
      })
    }

    return grid
  }, [currentDate])

  // Week days generation
  const weekDaysGrid = useMemo(() => {
    // Find Sunday of current active week
    const currentDay = currentDate.getDay() // 0 = Sun
    const sun = new Date(currentDate)
    sun.setDate(currentDate.getDate() - currentDay)

    const grid: Date[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(sun)
      d.setDate(sun.getDate() + i)
      grid.push(d)
    }
    return grid
  }, [currentDate])

  // Selected date details
  const selectedDateLabel = useMemo(() => {
    if (!selectedDate) return ''
    return selectedDate.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }, [selectedDate])

  const selectedDateWatches = useMemo(() => {
    if (!selectedDate) return []
    const key = getLocalDateString(selectedDate)
    return watchesByDateMap.get(key) || []
  }, [selectedDate, watchesByDateMap])

  // Watch Goal Actions
  const handleToggleGoal = (id: string) => {
    setGoals((prev) =>
      prev.map((g) => (g.id === id ? { ...g, completed: !g.completed } : g))
    )
  }

  const handleAddGoalSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newGoalText.trim()) return

    const newGoal: WatchGoal = {
      id: Math.random().toString(36).substring(2, 9),
      text: newGoalText.trim(),
      completed: false,
    }
    setGoals((prev) => [...prev, newGoal])
    setNewGoalText('')
    setIsAddingGoal(false)
    showToast('Goal added!', 'success')
  }

  // Automatic Goal progress calculator
  const getGoalProgress = useCallback(
    (goalText: string, completed: boolean) => {
      if (completed) return 100

      // Match goal substring in watchlist
      const cleanGoal = goalText.toLowerCase()
      const match = watchlist.find((w) => {
        const cleanTitle = w.title.toLowerCase()
        return cleanGoal.includes(cleanTitle) || cleanTitle.includes(cleanGoal)
      })

      if (!match) return 0

      if (match.type === 'tv') {
        if (match.totalEpisodes > 0) {
          return Math.round((match.episodesWatched / match.totalEpisodes) * 100)
        }
        return match.status === 'completed' ? 100 : 0
      } else {
        if (match.status === 'completed') return 100
        if (match.status === 'watching') return 50
        return 0
      }
    },
    [watchlist],
  )

  const getGoalProgressMeta = useCallback(
    (goalText: string, completed: boolean) => {
      if (completed) return '100% (Completed)'

      const cleanGoal = goalText.toLowerCase()
      const match = watchlist.find((w) => {
        const cleanTitle = w.title.toLowerCase()
        return cleanGoal.includes(cleanTitle) || cleanTitle.includes(cleanGoal)
      })

      if (!match) return '0% (Manual)'

      if (match.type === 'tv') {
        const pct = match.totalEpisodes > 0
          ? Math.round((match.episodesWatched / match.totalEpisodes) * 100)
          : (match.status === 'completed' ? 100 : 0)
        return `${match.episodesWatched}/${match.totalEpisodes || '?'} episodes (${pct}%)`
      } else {
        if (match.status === 'completed') return '100% (Completed)'
        if (match.status === 'watching') return '50% (Watching)'
        return '0% (Plan to Watch)'
      }
    },
    [watchlist],
  )

  // Firestore Add/Log watch integration
  const handleAddWatch = async (title: string, titleId: string, type: MediaType, posterPath: string | null) => {
    if (!user || !selectedDate) return
    setIsSearchOpen(false)

    try {
      // 1. Add to watchlist if not present
      const inWatchlist = watchlist.some((w) => w.titleId === titleId)
      if (!inWatchlist) {
        // Fetch details to find actual release year
        let year = new Date().getFullYear()
        try {
          const [mediaType, tmdbIdStr] = titleId.split(':')
          const id = parseInt(tmdbIdStr || '0', 10)
          if (mediaType === 'movie') {
            const details = await getMovieDetails(id)
            year = details.release_date ? new Date(details.release_date).getFullYear() : year
          } else {
            const details = await getTVDetails(id)
            year = details.first_air_date ? new Date(details.first_air_date).getFullYear() : year
          }
        } catch (e) {
          console.error('[CineTrack] Fetch search details error:', e)
        }

        await addEntry({
          titleId,
          type,
          title,
          posterPath,
          backdropPath: null,
          year,
          genres: [],
          status: 'completed',
        })
      }

      // 2. Fetch runtime
      let runtime = 120
      try {
        const [mediaType, tmdbIdStr] = titleId.split(':')
        const id = parseInt(tmdbIdStr || '0', 10)
        if (mediaType === 'movie') {
          const details = await getMovieDetails(id)
          runtime = details.runtime ?? 120
        } else {
          runtime = 30
        }
      } catch (e) {
        console.error('[CineTrack] Fetch runtime error:', e)
      }

      // 3. Log into watchHistory at midday local on selectedDate to prevent timezone wraps
      const logDate = new Date(selectedDate)
      const now = new Date()
      logDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds())
      const watchedAtTimestamp = Timestamp.fromDate(logDate)

      const historyRef = collection(db, `users/${user.uid}/${COLLECTIONS.HISTORY}`)
      await addDoc(historyRef, {
        titleId,
        title,
        type: type === 'movie' ? 'movie' : 'tv_episode',
        episodeLabel: type === 'movie' ? null : 'Logged',
        watchedAt: watchedAtTimestamp,
        runtimeMinutes: runtime,
      })

      // 4. Increment stats on parent watchlist entry
      const watchlistDocRef = doc(db, `users/${user.uid}/${COLLECTIONS.WATCHLIST}`, titleId)
      await updateDoc(watchlistDocRef, {
        totalRuntime: increment(runtime),
        watchDates: arrayUnion(watchedAtTimestamp),
        updatedAt: serverTimestamp(),
        ...(type === 'tv' ? { episodesWatched: increment(1) } : {}),
      })

      showToast(`Logged "${title}" watch!`, 'success')
    } catch (err) {
      console.error('[CineTrack] Log watch error:', err)
      showToast('Failed to log watch date.', 'error')
    }
  }

  const handleDeleteLog = async (item: WatchHistoryEntry) => {
    if (!user) return
    try {
      await deleteHistoryEvent(
        user.uid,
        item.id,
        item.titleId,
        item.type,
        item.runtimeMinutes,
        item.watchedAt,
      )
      showToast('Watch log removed.', 'success')
    } catch (err) {
      console.error(err)
      showToast('Failed to delete watch log.', 'error')
    }
  }

  // Format runtime Helper
  const formatRuntime = (mins: number) => {
    const hrs = Math.floor(mins / 60)
    const remaining = mins % 60
    return hrs > 0 ? `${hrs}h ${remaining}m` : `${remaining}m`
  }

  return (
    <div className="calendar-page animate-fade-in">
      <header className="calendar-header">
        <div className="calendar-nav-group">
          <button className="calendar-btn-nav" onClick={handlePrev} aria-label="Previous">
            <ChevronLeft size={16} />
          </button>
          <h1 className="calendar-month-title">
            {selectedView === 'month'
              ? getMonthYearLabel(currentDate)
              : `Week of ${weekDaysGrid[0]?.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) || ''}`}
          </h1>
          <button className="calendar-btn-nav" onClick={handleNext} aria-label="Next">
            <ChevronRight size={16} />
          </button>
          <button className="calendar-btn-today" onClick={handleToday}>
            Today
          </button>
        </div>

        <div className="calendar-toggle-group">
          <button
            className={`calendar-btn-toggle ${selectedView === 'month' ? 'calendar-btn-toggle--active' : ''}`}
            onClick={() => setSelectedView('month')}
          >
            Month
          </button>
          <button
            className={`calendar-btn-toggle ${selectedView === 'week' ? 'calendar-btn-toggle--active' : ''}`}
            onClick={() => setSelectedView('week')}
          >
            Week
          </button>
        </div>
      </header>

      <div className="calendar-layout">
        {/* Main Calendar View */}
        <main className="calendar-main-col">
          {selectedView === 'month' ? (
            <div className="calendar-grid-container">
              <div className="calendar-weekdays-header">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <span key={d} className="weekday-lbl">
                    {d}
                  </span>
                ))}
              </div>

              <div className="calendar-days-grid">
                {monthDaysGrid.map(({ date, isCurrentMonth }, idx) => {
                  const key = getLocalDateString(date)
                  const dayWatches = watchesByDateMap.get(key) || []
                  const dayReleases = releasesByDateMap.get(key) || []
                  const totalItems = dayWatches.length + dayReleases.length

                  // Merge indicators
                  const visiblePills = [
                    ...dayWatches.map((w) => ({ type: 'watch' as const, title: w.title, id: w.id })),
                    ...dayReleases.map((r) => ({ type: 'release' as const, title: r.title, id: r.titleId })),
                  ].slice(0, 3)

                  const moreCount = totalItems - 3
                  const isToday = getLocalDateString(new Date()) === key

                  return (
                    <div
                      key={idx}
                      className={`calendar-day-cell ${!isCurrentMonth ? 'calendar-day-cell--other-month' : ''} ${
                        isToday ? 'calendar-day-cell--today' : ''
                      }`}
                      onClick={() => {
                        setSelectedDate(date)
                        setIsDetailOpen(true)
                      }}
                    >
                      <div className="day-header">
                        <span className="day-number">{date.getDate()}</span>
                      </div>
                      <div className="day-pills-list">
                        {visiblePills.map((pill, pIdx) => (
                          <div
                            key={pIdx}
                            className={`day-pill ${pill.type === 'watch' ? 'day-pill--watch' : 'day-pill--release'}`}
                            title={pill.title}
                          >
                            {pill.title}
                          </div>
                        ))}
                        {moreCount > 0 && <span className="day-pill-more">+{moreCount} more</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            // Week View Layout
            <div className="calendar-week-grid">
              {weekDaysGrid.map((date, idx) => {
                const key = getLocalDateString(date)
                const dayWatches = watchesByDateMap.get(key) || []
                const dayReleases = releasesByDateMap.get(key) || []
                const isToday = getLocalDateString(new Date()) === key

                const dayName = date.toLocaleDateString(undefined, { weekday: 'short' })

                return (
                  <div
                    key={idx}
                    className={`week-column ${isToday ? 'week-column--today' : ''}`}
                    onClick={() => {
                      setSelectedDate(date)
                      setIsDetailOpen(true)
                    }}
                  >
                    <div className="week-column-header">
                      <span className="week-day-name">{dayName}</span>
                      <span className="week-date">{date.getDate()}</span>
                    </div>

                    <div className="week-cards-list">
                      {/* Watches */}
                      {dayWatches.map((w) => (
                        <div key={w.id} className="week-item-card week-item-card--watch">
                          <span className="week-item-title" title={w.title}>
                            {w.title}
                          </span>
                          <div className="week-item-meta">
                            <span>
                              {w.watchedAt instanceof Date
                                ? w.watchedAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
                                : (w.watchedAt as any)?.toDate
                                ? w.watchedAt.toDate().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
                                : ''}
                            </span>
                            <span>{formatRuntime(w.runtimeMinutes)}</span>
                          </div>
                        </div>
                      ))}

                      {/* Releases */}
                      {dayReleases.map((r) => (
                        <div key={r.titleId} className="week-item-card week-item-card--release">
                          <span className="week-item-title" title={r.title}>
                            {r.title}
                          </span>
                          <div className="week-item-meta">
                            <span style={{ color: 'var(--color-info)' }}>Upcoming Release</span>
                          </div>
                        </div>
                      ))}

                      {dayWatches.length === 0 && dayReleases.length === 0 && (
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '12px' }}>
                          No activity
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </main>

        {/* Sidebar */}
        <aside className="calendar-sidebar-col">
          {/* Upcoming releases list */}
          <section className="sidebar-section">
            <UpcomingReleases limit={10} showHeader={true} />
          </section>

          {/* Goals section */}
          <section className="sidebar-section">
            <h2 className="sidebar-section-title">
              <TrendingUp size={18} color="var(--text-muted)" />
              Watch Goals
            </h2>

            <div className="goals-list">
              {goals.map((g) => {
                const prog = getGoalProgress(g.text, g.completed)
                const meta = getGoalProgressMeta(g.text, g.completed)

                return (
                  <div key={g.id} className="goal-item">
                    <div className="goal-row">
                      <input
                        type="checkbox"
                        checked={g.completed}
                        className="goal-checkbox"
                        onChange={() => handleToggleGoal(g.id)}
                        id={`goal-chk-${g.id}`}
                      />
                      <div className="goal-text-wrapper">
                        <label
                          htmlFor={`goal-chk-${g.id}`}
                          className={`goal-text ${g.completed ? 'goal-text--completed' : ''}`}
                        >
                          {g.text}
                        </label>
                      </div>
                      <button
                        onClick={() => setGoals((prev) => prev.filter((item) => item.id !== g.id))}
                        className="btn-delete-log"
                        style={{ padding: '2px' }}
                        aria-label="Delete Goal"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    <div className="goal-progress-bar">
                      <ProgressBar value={prog} height={6} color={g.completed ? 'var(--color-success)' : 'var(--color-brand)'} />
                      <div className="goal-progress-meta">
                        <span>Progress</span>
                        <span>{meta}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {isAddingGoal ? (
              <form onSubmit={handleAddGoalSubmit} className="add-goal-form">
                <input
                  type="text"
                  placeholder="New goal text..."
                  value={newGoalText}
                  onChange={(e) => setNewGoalText(e.target.value)}
                  className="add-goal-input"
                  autoFocus
                />
                <button type="submit" className="add-goal-submit">
                  Add
                </button>
                <button type="button" className="add-goal-cancel" onClick={() => setIsAddingGoal(false)}>
                  Cancel
                </button>
              </form>
            ) : (
              <button className="add-goal-btn" onClick={() => setIsAddingGoal(true)}>
                <Plus size={16} />
                Add Goal
              </button>
            )}
          </section>
        </aside>
      </div>

      {/* Day Detail drawer for desktop / bottom sheet for mobile */}
      {selectedDate && (
        <>
          {/* Desktop Drawer (render only if viewport width matches desktop and is open) */}
          {isDetailOpen && (
            <div className="detail-drawer-overlay" onClick={() => setIsDetailOpen(false)}>
              <div className="detail-drawer" onClick={(e) => e.stopPropagation()}>
                <div className="drawer-header">
                  <h3 className="drawer-title">{selectedDateLabel}</h3>
                  <button className="btn-close-drawer" onClick={() => setIsDetailOpen(false)}>
                    <X size={20} />
                  </button>
                </div>
                <div className="drawer-body">
                  <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Watch Logs
                  </h4>
                  <div className="drawer-watches-list">
                    {selectedDateWatches.length > 0 ? (
                      selectedDateWatches.map((log) => {
                        const posterPath = watchlistPosterMap.get(log.titleId) || null
                        const poster = getImageUrl(posterPath, 'w200')
                        const timeLabel = log.watchedAt instanceof Date
                          ? log.watchedAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
                          : (log.watchedAt as any)?.toDate
                          ? log.watchedAt.toDate().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
                          : ''

                        return (
                          <div key={log.id} className="watch-row-item">
                            {poster ? (
                              <img src={poster} alt={log.title} className="watch-row-poster" />
                            ) : (
                              <div className="watch-row-poster" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Film size={14} color="var(--text-muted)" />
                              </div>
                            )}
                            <div className="watch-row-details">
                              <div className="watch-row-title-box">
                                <span className="watch-row-title">{log.title}</span>
                                {log.episodeLabel && <span className="watch-row-lbl">{log.episodeLabel}</span>}
                              </div>
                              <div className="watch-row-meta">
                                <Clock size={12} />
                                <span>{timeLabel}</span>
                                <span>•</span>
                                <span>{formatRuntime(log.runtimeMinutes)}</span>
                              </div>
                            </div>
                            <button className="btn-delete-log" onClick={() => handleDeleteLog(log)} aria-label="Delete watch log">
                              <Trash2 size={15} />
                            </button>
                          </div>
                        )
                      })
                    ) : (
                      <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
                        No watch logs for this day
                      </div>
                    )}
                  </div>

                  <button className="btn-add-watch" onClick={() => setIsSearchOpen(true)}>
                    <Plus size={16} />
                    Add watch for this day
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Mobile BottomSheet version using existing component */}
          <BottomSheet isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} label="Day Details">
            <div style={{ padding: '0 var(--space-4) var(--space-6) var(--space-4)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-default)', paddingBottom: '12px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 800 }}>{selectedDateLabel}</h3>
                <button onClick={() => setIsDetailOpen(false)} style={{ color: 'var(--text-muted)', padding: '4px' }}>
                  <X size={20} />
                </button>
              </div>

              <div>
                <h4 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Watch Logs
                </h4>
                <div className="drawer-watches-list">
                  {selectedDateWatches.length > 0 ? (
                    selectedDateWatches.map((log) => {
                      const posterPath = watchlistPosterMap.get(log.titleId) || null
                      const poster = getImageUrl(posterPath, 'w200')
                      const timeLabel = log.watchedAt instanceof Date
                        ? log.watchedAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
                        : (log.watchedAt as any)?.toDate
                        ? log.watchedAt.toDate().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
                        : ''

                      return (
                        <div key={log.id} className="watch-row-item">
                          {poster ? (
                            <img src={poster} alt={log.title} className="watch-row-poster" />
                          ) : (
                            <div className="watch-row-poster" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Film size={14} color="var(--text-muted)" />
                            </div>
                          )}
                          <div className="watch-row-details">
                            <div className="watch-row-title-box">
                              <span className="watch-row-title">{log.title}</span>
                              {log.episodeLabel && <span className="watch-row-lbl">{log.episodeLabel}</span>}
                            </div>
                            <div className="watch-row-meta">
                              <Clock size={12} />
                              <span>{timeLabel}</span>
                              <span>•</span>
                              <span>{formatRuntime(log.runtimeMinutes)}</span>
                            </div>
                          </div>
                          <button className="btn-delete-log" onClick={() => handleDeleteLog(log)} aria-label="Delete watch log">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )
                    })
                  ) : (
                    <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                      No watch logs for this day
                    </div>
                  )}
                </div>
              </div>

              <button className="btn-add-watch" onClick={() => setIsSearchOpen(true)}>
                <Plus size={16} />
                Add watch for this day
              </button>
            </div>
          </BottomSheet>
        </>
      )}

      {/* Search Overlay / Modal */}
      {isSearchOpen && (
        <div className="search-modal-overlay" onClick={() => setIsSearchOpen(false)}>
          <div className="search-modal" onClick={(e) => e.stopPropagation()}>
            <div className="search-modal-header">
              <div className="search-modal-input-wrapper">
                <Search size={16} className="search-icon-inside" />
                <input
                  type="text"
                  placeholder="Search movies or TV shows to log..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-modal-input"
                  autoFocus
                />
              </div>
              <button onClick={() => setIsSearchOpen(false)} style={{ color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            <div className="search-results-list">
              {isSearchLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px' }}>
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="skeleton" style={{ height: 48, borderRadius: 'var(--radius-sm)' }} />
                  ))}
                </div>
              ) : searchResults.length > 0 ? (
                searchResults.map((result) => {
                  const title = result.title ?? result.name ?? 'Untitled'
                  const year = result.release_date
                    ? new Date(result.release_date).getFullYear()
                    : result.first_air_date
                    ? new Date(result.first_air_date).getFullYear()
                    : null
                  const poster = getImageUrl(result.poster_path, 'w200')
                  const typeLabel = result.media_type === 'movie' ? 'Movie' : 'TV Show'

                  const compositeId = `${result.media_type}:${result.id}`

                  return (
                    <div
                      key={compositeId}
                      className="search-result-row"
                      onClick={() => handleAddWatch(title, compositeId, result.media_type as MediaType, result.poster_path)}
                    >
                      {poster ? (
                        <img src={poster} alt={title} className="search-result-poster" />
                      ) : (
                        <div className="search-result-poster" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Film size={14} color="var(--text-muted)" />
                        </div>
                      )}
                      <div className="search-result-info">
                        <div className="search-result-title">{title}</div>
                        <div className="search-result-meta">
                          {typeLabel} {year ? `(${year})` : ''}
                        </div>
                      </div>
                    </div>
                  )
                })
              ) : searchQuery.length >= 2 ? (
                <div className="search-empty-state">No matches found</div>
              ) : (
                <div className="search-empty-state">Type at least 2 characters to search...</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
