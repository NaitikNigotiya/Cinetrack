import { useState, useMemo, useEffect } from 'react'
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'
import { Clock, Film } from 'lucide-react'

import { useAuth } from '@/features/auth/useAuth'
import { useWatchlist } from '@/features/watchlist/hooks/useWatchlist'
import { db, COLLECTIONS } from '@/lib/firebase'
import { getImageUrl } from '@/lib/tmdb'

import type { WatchHistoryEntry } from '@/types/app'
import type { Timestamp } from 'firebase/firestore'
import './HistoryPage.css'

export default function HistoryPage() {
  const { user } = useAuth()
  const { entries: watchlist } = useWatchlist()

  const [historyList, setHistoryList] = useState<WatchHistoryEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null) // null means "All"

  // Sync watch history list in real-time
  useEffect(() => {
    if (!user) return

    const q = query(
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
        setIsLoading(false)
      },
      (err) => {
        console.error('[CineTrack] History page sync error:', err)
        setIsLoading(false)
      },
    )

    return unsubscribe
  }, [user])

  // Map of titleId -> posterPath to render poster thumbnails
  const posterMap = useMemo(() => {
    const map = new Map<string, string | null>()
    watchlist.forEach((w) => {
      map.set(w.titleId, w.posterPath)
    })
    return map
  }, [watchlist])

  // Extract unique months with log counts
  const monthsList = useMemo(() => {
    const counts: Record<string, number> = {}
    historyList.forEach((h) => {
      const date = h.watchedAt instanceof Date
        ? h.watchedAt
        : (h.watchedAt as unknown as Timestamp).toDate()
      const label = date.toLocaleString('default', { month: 'short', year: 'numeric' })
      counts[label] = (counts[label] || 0) + 1
    })

    return Object.entries(counts).map(([label, count]) => ({
      label,
      count,
    }))
  }, [historyList])

  // Filter list by selected month
  const filteredHistory = useMemo(() => {
    if (!selectedMonth) return historyList

    return historyList.filter((h) => {
      const date = h.watchedAt instanceof Date
        ? h.watchedAt
        : (h.watchedAt as unknown as Timestamp).toDate()
      const label = date.toLocaleString('default', { month: 'short', year: 'numeric' })
      return label === selectedMonth
    })
  }, [historyList, selectedMonth])

  // Group by calendar day
  const groupedHistory = useMemo(() => {
    const groups: { dateLabel: string; items: WatchHistoryEntry[]; totalRuntime: number }[] = []

    filteredHistory.forEach((item) => {
      const date = item.watchedAt instanceof Date
        ? item.watchedAt
        : (item.watchedAt as unknown as Timestamp).toDate()

      const dateLabel = date.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })

      let group = groups.find((g) => g.dateLabel === dateLabel)
      if (!group) {
        group = { dateLabel, items: [], totalRuntime: 0 }
        groups.push(group)
      }
      group.items.push(item)
      group.totalRuntime += item.runtimeMinutes || 0
    })

    return groups
  }, [filteredHistory])

  // Utility to format runtime mins
  const formatRuntime = (mins: number) => {
    const hrs = Math.floor(mins / 60)
    const remaining = mins % 60
    return hrs > 0 ? `${hrs}h ${remaining}m` : `${remaining}m`
  }

  const totalLogsCount = historyList.length

  return (
    <div className="unified-page-container">
      <header className="unified-page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 className="page-title">Watch History</h1>
            <span className="watchlist-badge-count">{totalLogsCount} logs</span>
          </div>
          <p className="page-subtitle">A timeline of everything you've watched</p>
        </div>
      </header>

      {/* Month scroll row */}
      {monthsList.length > 0 && (
        <div className="history-months-scroll" role="tablist" aria-label="Month selection rails">
          <button
            className={`month-pill-btn${selectedMonth === null ? ' month-pill-btn--active' : ''}`}
            onClick={() => setSelectedMonth(null)}
            role="tab"
            aria-selected={selectedMonth === null}
            type="button"
          >
            All ({totalLogsCount})
          </button>
          {monthsList.map((m) => {
            const isActive = selectedMonth === m.label
            return (
              <button
                key={m.label}
                className={`month-pill-btn${isActive ? ' month-pill-btn--active' : ''}`}
                onClick={() => setSelectedMonth(m.label)}
                role="tab"
                aria-selected={isActive}
                type="button"
              >
                {m.label} ({m.count})
              </button>
            )
          })}
        </div>
      )}

      {/* History timeline list */}
      <main className="history-content" style={{ paddingBottom: '40px' }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="skeleton" style={{ height: 28, width: '40%', borderRadius: 4, marginTop: 12 }} />
            <div className="skeleton" style={{ height: 80, borderRadius: 'var(--radius-md)' }} />
          </div>
        ) : groupedHistory.length > 0 ? (
          <div className="history-timeline">
            {groupedHistory.map((group) => (
              <div key={group.dateLabel}>
                {/* Date Group Header */}
                <h2 className="history-date-header">{group.dateLabel}</h2>

                {/* Date Group List */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {group.items.map((item) => {
                    const posterPath = posterMap.get(item.titleId) || null
                    const poster = getImageUrl(posterPath, 'w200')
                    const isTv = item.type === 'tv_episode'

                    const dateObj = item.watchedAt instanceof Date
                      ? item.watchedAt
                      : (item.watchedAt as unknown as Timestamp).toDate()

                    const timeLabel = dateObj.toLocaleTimeString(undefined, {
                      hour: 'numeric',
                      minute: '2-digit',
                    })

                    return (
                      <article key={item.id} className="history-item-row animate-fade-in">
                        {poster ? (
                          <img src={poster} alt={item.title} className="history-thumbnail" loading="lazy" />
                        ) : (
                          <div className="history-thumbnail" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Film size={16} color="var(--text-muted)" />
                          </div>
                        )}

                        <div className="history-row-details">
                          <div className="history-row-title-box">
                            <span className="history-row-title">{item.title}</span>
                            {isTv && item.episodeLabel && (
                              <span className="history-episode-lbl">{item.episodeLabel}</span>
                            )}
                          </div>

                          <div className="history-badge-row">
                            <span className={`history-type-pill history-type-pill--${isTv ? 'tv' : 'movie'}`}>
                              {isTv ? 'TV' : 'Movie'}
                            </span>
                          </div>
                        </div>

                        {/* Right details */}
                        <div className="history-right-meta">
                          <span className="history-time-lbl">{timeLabel}</span>
                          <span className="history-runtime-lbl">
                            {formatRuntime(item.runtimeMinutes || 0)}
                          </span>
                        </div>
                      </article>
                    )
                  })}
                </div>

                {/* Date Group Footer */}
                <div className="history-date-footer">
                  Total: {formatRuntime(group.totalRuntime)} watched
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="history-empty animate-fade-in">
            <Clock size={48} className="history-empty-emoji" color="var(--text-muted)" />
            <p className="history-empty-title">No history yet</p>
            <p className="history-empty-subtitle">
              Start watching and tracking to see your history logs presented here chronologically.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
