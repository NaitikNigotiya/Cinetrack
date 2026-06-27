import { useEffect, useState, useMemo } from 'react'
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'
import { db, COLLECTIONS } from '@/lib/firebase'
import { useAuth } from '@/features/auth/useAuth'
import { useWatchlist } from '@/features/watchlist/hooks/useWatchlist'

import type { WatchHistoryEntry } from '@/types/app'
import type { Timestamp } from 'firebase/firestore'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnalyticsObject {
  totalTitles: number
  totalMovies: number
  totalTV: number
  totalRuntimeMinutes: number
  totalEpisodesWatched: number
  averageRating: number | null
  completedCount: number
  favoritesCount: number

  currentStreakDays: number
  longestStreakDays: number
  lastWatchedDate: Date | null

  genreData: { name: string; count: number; percentage: number }[]
  monthlyData: { month: string; movies: number; tv: number; total: number; moviesHours: number; tvHours: number }[]
  ratingData: { label: string; count: number }[]
  typeSplit: { movies: number; tv: number; moviePct: number; tvPct: number }
  yearlyStats: {
    year: number
    titlesWatched: number
    topGenre: string
    mostWatchedShow: string | null
    totalHours: number
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAnalytics() {
  const { user } = useAuth()
  const { entries: watchlist, isLoading: isWatchlistLoading } = useWatchlist()

  const [historyList, setHistoryList] = useState<WatchHistoryEntry[]>([])
  const [isHistoryLoading, setIsHistoryLoading] = useState(true)

  // Sync history list in real-time
  useEffect(() => {
    if (!user) return

    const q = query(
      collection(db, `users/${user.uid}/${COLLECTIONS.HISTORY}`),
      orderBy('watchedAt', 'desc'),
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => {
          const data = doc.data()
          return {
            id: doc.id,
            ...data,
          }
        }) as WatchHistoryEntry[]
        setHistoryList(items)
        setIsHistoryLoading(false)
      },
      (err) => {
        console.error('[CineTrack] Analytics history sync failed:', err)
        setIsHistoryLoading(false)
      },
    )

    return unsubscribe
  }, [user])

  // ── Calculate Streaks ──
  const streakStats = useMemo(() => {
    if (historyList.length === 0) {
      return { current: 0, longest: 0, last: null }
    }

    const uniqueDates = [
      ...new Set(
        historyList.map((h) => {
          const date = h.watchedAt instanceof Date
            ? h.watchedAt
            : (h.watchedAt as unknown as Timestamp).toDate()
          // Use YYYY-MM-DD local format
          const year = date.getFullYear()
          const month = String(date.getMonth() + 1).padStart(2, '0')
          const day = String(date.getDate()).padStart(2, '0')
          return `${year}-${month}-${day}`
        }),
      ),
    ].sort()

    // 1. Last watched date
    const lastDateObj = historyList[0]?.watchedAt instanceof Date
      ? historyList[0].watchedAt
      : (historyList[0]?.watchedAt as unknown as Timestamp).toDate()

    // 2. Current Streak
    let current = 0
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(today.getDate() - 1)

    const formatDate = (d: Date) => {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    const todayStr = formatDate(today)
    const yesterdayStr = formatDate(yesterday)

    const hasToday = uniqueDates.includes(todayStr)
    const hasYesterday = uniqueDates.includes(yesterdayStr)

    if (hasToday || hasYesterday) {
      let check = hasToday ? today : yesterday
      while (true) {
        const checkStr = formatDate(check)
        if (uniqueDates.includes(checkStr)) {
          current++
          check.setDate(check.getDate() - 1)
        } else {
          break
        }
      }
    }

    // 3. Longest Streak
    let longest = 0
    let tempStreak = 0
    let prevTime: number | null = null

    uniqueDates.forEach((dateStr) => {
      const parts = dateStr.split('-').map(Number) as [number, number, number]
      const currTime = new Date(parts[0], parts[1] - 1, parts[2]).getTime()

      if (prevTime === null) {
        tempStreak = 1
      } else {
        const diffDays = Math.round((currTime - prevTime) / (1000 * 60 * 60 * 24))
        if (diffDays === 1) {
          tempStreak++
        } else if (diffDays > 1) {
          tempStreak = 1
        }
      }
      longest = Math.max(longest, tempStreak)
      prevTime = currTime
    })

    return { current, longest, last: lastDateObj }
  }, [historyList])

  // ── Derived Complete Analytics Object ──
  const data = useMemo<AnalyticsObject>(() => {
    // Summary
    const totalTitles = watchlist.length
    const totalMovies = watchlist.filter((e) => e.type === 'movie').length
    const totalTV = watchlist.filter((e) => e.type === 'tv').length
    const totalRuntimeMinutes = watchlist.reduce((sum, e) => sum + (e.totalRuntime || 0), 0)
    const totalEpisodesWatched = watchlist.reduce((sum, e) => sum + (e.episodesWatched || 0), 0)

    const ratedTitles = watchlist.filter((e) => e.rating !== null)
    const averageRating = ratedTitles.length > 0
      ? Number((ratedTitles.reduce((sum, e) => sum + (e.rating || 0), 0) / ratedTitles.length).toFixed(1))
      : null

    const completedCount = watchlist.filter((e) => e.status === 'completed').length
    const favoritesCount = watchlist.filter((e) => e.isFavorite).length

    // Genre Distribution (Top 8 + Other)
    const genreMap: Record<string, number> = {}
    watchlist.forEach((e) => {
      e.genres.forEach((g) => {
        genreMap[g] = (genreMap[g] || 0) + 1
      })
    })

    const sortedGenres = Object.entries(genreMap)
      .sort((a, b) => b[1] - a[1])

    const top8 = sortedGenres.slice(0, 8)
    const others = sortedGenres.slice(8)

    const totalGenresCount = sortedGenres.reduce((sum, [, count]) => sum + count, 0)

    const genreData = top8.map(([name, count]) => ({
      name,
      count,
      percentage: totalGenresCount > 0 ? Math.round((count / totalGenresCount) * 100) : 0,
    }))

    if (others.length > 0) {
      const otherCount = others.reduce((sum, [, count]) => sum + count, 0)
      genreData.push({
        name: 'Other',
        count: otherCount,
        percentage: totalGenresCount > 0 ? Math.round((otherCount / totalGenresCount) * 100) : 0,
      })
    }

    // Monthly Activity (Last 12 Months)
    const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const monthlyData = Array.from({ length: 12 }).map((_, i) => {
      const d = new Date()
      d.setMonth(d.getMonth() - (11 - i))
      const monthNum = d.getMonth() // 0-11
      const yearNum = d.getFullYear()

      const monthLogs = historyList.filter((h) => {
        const watchedDate = h.watchedAt instanceof Date
          ? h.watchedAt
          : (h.watchedAt as unknown as Timestamp).toDate()
        return watchedDate.getMonth() === monthNum && watchedDate.getFullYear() === yearNum
      })

      const moviesLogs = monthLogs.filter((h) => h.type === 'movie')
      const tvLogs = monthLogs.filter((h) => h.type === 'tv_episode')

      const moviesCount = moviesLogs.length
      const tvCount = tvLogs.length

      const moviesHours = Math.round(moviesLogs.reduce((sum, h) => sum + (h.runtimeMinutes || 0), 0) / 60)
      const tvHours = Math.round(tvLogs.reduce((sum, h) => sum + (h.runtimeMinutes || 0), 0) / 60)

      return {
        month: `${monthLabels[monthNum]} ${String(yearNum).slice(2)}`,
        movies: moviesCount,
        tv: tvCount,
        total: moviesCount + tvCount,
        moviesHours,
        tvHours,
      }
    })

    // Rating Distribution Buckets
    const ratingBuckets = [
      { label: '1-2 ⭐', count: 0 },
      { label: '3-4 ⭐', count: 0 },
      { label: '5-6 ⭐', count: 0 },
      { label: '7-8 ⭐', count: 0 },
      { label: '9-10 ⭐', count: 0 },
    ]

    watchlist.forEach((e) => {
      if (e.rating !== null) {
        if (e.rating <= 2) ratingBuckets[0]!.count++
        else if (e.rating <= 4) ratingBuckets[1]!.count++
        else if (e.rating <= 6) ratingBuckets[2]!.count++
        else if (e.rating <= 8) ratingBuckets[3]!.count++
        else ratingBuckets[4]!.count++
      }
    })

    // Media Type split percentages
    const moviePct = totalTitles > 0 ? Math.round((totalMovies / totalTitles) * 100) : 0
    const tvPct = totalTitles > 0 ? Math.round((totalTV / totalTitles) * 100) : 0

    // Current Year stats
    const currentYear = new Date().getFullYear()
    const currentYearLogs = historyList.filter((h) => {
      const d = h.watchedAt instanceof Date
        ? h.watchedAt
        : (h.watchedAt as unknown as Timestamp).toDate()
      return d.getFullYear() === currentYear
    })

    const titlesWatchedThisYear = new Set(currentYearLogs.map((h) => h.titleId)).size

    // Top genre this year
    const genreCountsThisYear: Record<string, number> = {}
    currentYearLogs.forEach((h) => {
      const match = watchlist.find((w) => w.titleId === h.titleId)
      if (match) {
        match.genres.forEach((g) => {
          genreCountsThisYear[g] = (genreCountsThisYear[g] || 0) + 1
        })
      }
    })
    const topGenre = Object.entries(genreCountsThisYear)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'

    // Most watched show this year
    const tvCountsThisYear: Record<string, number> = {}
    currentYearLogs.forEach((h) => {
      if (h.type === 'tv_episode') {
        tvCountsThisYear[h.title] = (tvCountsThisYear[h.title] || 0) + 1
      }
    })
    const mostWatchedShow = Object.entries(tvCountsThisYear)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || null

    const totalHoursThisYear = Math.round(
      currentYearLogs.reduce((sum, h) => sum + (h.runtimeMinutes || 0), 0) / 60
    )

    return {
      totalTitles,
      totalMovies,
      totalTV,
      totalRuntimeMinutes,
      totalEpisodesWatched,
      averageRating,
      completedCount,
      favoritesCount,

      currentStreakDays: streakStats.current,
      longestStreakDays: streakStats.longest,
      lastWatchedDate: streakStats.last,

      genreData,
      monthlyData,
      ratingData: ratingBuckets,
      typeSplit: { movies: totalMovies, tv: totalTV, moviePct, tvPct },
      yearlyStats: {
        year: currentYear,
        titlesWatched: titlesWatchedThisYear,
        topGenre,
        mostWatchedShow,
        totalHours: totalHoursThisYear,
      },
    }
  }, [watchlist, historyList, streakStats])

  return {
    data,
    isLoading: isWatchlistLoading || isHistoryLoading,
  }
}
