import { useState, useEffect, useMemo } from 'react'
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
  Film,
} from 'lucide-react'

import { useAuth } from '@/features/auth/useAuth'
import { useWatchlist } from '@/features/watchlist/hooks/useWatchlist'
import { db, COLLECTIONS } from '@/lib/firebase'
import { getMovieDetails, getTVDetails, getImageUrl, searchMulti } from '@/lib/tmdb'
import { deleteHistoryEvent } from '@/features/history/history'
import { usePlannedWatches } from '@/features/calendar/usePlannedWatches'

import { useToast } from '@/components/ui/Toast'

import type { WatchHistoryEntry, MediaType } from '@/types/app'
import type { TMDbMovie, TMDbTV } from '@/types/tmdb'

import './CalendarPage.css'

// ─── Interfaces ───────────────────────────────────────────────────────────────

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

function DayDetailContent({
  selectedDay,
  dayLogs,
  plannedItems,
  onClose,
  onAddWatch,
  onAddPlan,
  onDeleteLog,
  onDeletePlan,
  getPosterUrl,
}: {
  selectedDay: Date
  dayLogs: any[]
  plannedItems: any[]
  onClose: () => void
  onAddWatch: () => void
  onAddPlan: () => void
  onDeleteLog: (id: string) => void
  onDeletePlan: (id: string) => void
  getPosterUrl: (titleId: string) => string | null
}) {
  const isPast = selectedDay <= new Date()
  const isToday = selectedDay.toDateString() === new Date().toDateString()

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 700,
            color: 'var(--text-primary)', margin: 0 }}>
            {selectedDay.toLocaleDateString('en-US', {
              weekday: 'long', month: 'long', day: 'numeric'
            })}
          </h3>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {isToday ? '📅 Today'
              : isPast ? '✅ Past date'
              : '🔮 Upcoming'}
          </div>
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: 'none',
          color: 'var(--text-muted)', cursor: 'pointer',
          fontSize: '18px', lineHeight: 1,
        }}>✕</button>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {(isPast || isToday) && (
          <button onClick={onAddWatch} style={{
            flex: 1, padding: '9px', border: 'none', cursor: 'pointer',
            background: 'var(--color-brand)', color: 'var(--text-on-brand)',
            borderRadius: 'var(--radius-md)', fontSize: '12px', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            ✓ Log Watch
          </button>
        )}
        {!isPast && (
          <button onClick={onAddPlan} style={{
            flex: 1, padding: '9px', border: '1px solid #00B4D8', cursor: 'pointer',
            background: 'rgba(0,180,216,0.1)', color: '#00B4D8',
            borderRadius: 'var(--radius-md)', fontSize: '12px', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            📅 Plan Watch
          </button>
        )}
        {isToday && (
          <button onClick={onAddPlan} style={{
            flex: 1, padding: '9px', border: '1px solid #00B4D8', cursor: 'pointer',
            background: 'rgba(0,180,216,0.1)', color: '#00B4D8',
            borderRadius: 'var(--radius-md)', fontSize: '12px', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            📅 Plan for Later
          </button>
        )}
      </div>

      {/* Watched section */}
      {dayLogs.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px',
            textTransform: 'uppercase', color: 'var(--color-brand)',
            marginBottom: '10px' }}>
            ✅ Watched ({dayLogs.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {dayLogs.map((log, idx) => {
              const poster = getPosterUrl(log.titleId)
              return (
                <div key={idx} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 12px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                  borderLeft: '3px solid var(--color-brand)',
                  borderRadius: 'var(--radius-md)',
                }}>
                  {poster ? (
                    <img
                      src={poster}
                      alt={log.title}
                      style={{ width: 32, height: 48, borderRadius: 4,
                        objectFit: 'cover', flexShrink: 0,
                        background: 'var(--bg-overlay)' }}
                    />
                  ) : (
                    <div style={{ width: 32, height: 48, borderRadius: 4,
                      background: 'var(--bg-overlay)', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '16px' }}>🎬</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '13px',
                      color: 'var(--text-primary)', overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.title}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)',
                      marginTop: '2px' }}>
                      {log.episodeLabel && `${log.episodeLabel} · `}
                      {log.runtimeMinutes && `${log.runtimeMinutes}m · `}
                      {new Date(log.watchedAt instanceof Date ? log.watchedAt : (log.watchedAt as any)?.toDate ? (log.watchedAt as any).toDate() : log.watchedAt).toLocaleTimeString('en-US', {
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </div>
                  </div>
                  <button onClick={() => onDeleteLog(log.id)} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', fontSize: '14px', flexShrink: 0,
                    padding: '4px',
                  }}>🗑️</button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Planned section */}
      {plannedItems.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px',
            textTransform: 'uppercase', color: '#00B4D8',
            marginBottom: '10px' }}>
            📅 Planned ({plannedItems.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {plannedItems.map((plan) => {
              const planPoster = plan.posterPath ? getImageUrl(plan.posterPath, 'w200') : null
              return (
                <div key={plan.id} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 12px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                  borderLeft: '3px solid #00B4D8',
                  borderRadius: 'var(--radius-md)',
                }}>
                  {planPoster ? (
                    <img
                      src={planPoster}
                      alt={plan.title}
                      style={{ width: 32, height: 48, borderRadius: 4,
                        objectFit: 'cover', flexShrink: 0,
                        background: 'var(--bg-overlay)' }}
                    />
                  ) : (
                    <div style={{ width: 32, height: 48, borderRadius: 4,
                      background: 'var(--bg-overlay)', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '16px' }}>🎬</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '13px',
                      color: 'var(--text-primary)', overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {plan.title}
                    </div>
                    {plan.note && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)',
                        marginTop: '2px', overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {plan.note}
                      </div>
                    )}
                  </div>
                  <button onClick={() => onDeletePlan(plan.id)} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', fontSize: '14px',
                    padding: '4px', flexShrink: 0,
                  }}>🗑️</button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {dayLogs.length === 0 && plannedItems.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0',
          color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>📭</div>
          <div style={{ fontSize: '14px' }}>Nothing logged for this day</div>
        </div>
      )}
    </div>
  )
}

function AddWatchModal({ date, mode, onClose, onAdd }: {
  date: Date
  mode: 'watched' | 'planned'
  onClose: () => void
  onAdd: (result: any, note: string, targetDate: string) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [note, setNote] = useState('')
  const [targetDate, setTargetDate] = useState(() => {
    const yyyy = date.getFullYear()
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  })
  const [isSearching, setIsSearching] = useState(false)

  const handleSearch = async (q: string) => {
    setQuery(q)
    if (q.length < 2) { setResults([]); return }
    setIsSearching(true)
    try {
      const res = await searchMulti(q)
      setResults(res.results.filter((r: any) =>
        r.media_type === 'movie' || r.media_type === 'tv'
      ).slice(0, 8))
    } catch (e) { console.error(e) }
    finally { setIsSearching(false) }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.8)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: '480px',
        background: 'var(--bg-secondary)',
        borderRadius: 'var(--radius-xl)',
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border-default)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700,
            color: 'var(--text-primary)' }}>
            {mode === 'watched' ? 'Log Watch' : 'Plan Watch'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none',
            cursor: 'pointer', color: 'var(--text-muted)', fontSize: '18px' }}>✕</button>
        </div>

        <div style={{ padding: '20px' }}>
          {/* Date picker */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600,
              color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
              {mode === 'watched' ? 'Date Watched' : 'Planned Date'}
            </label>
            <input
              type="date"
              value={targetDate}
              onChange={e => setTargetDate(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px',
                background: 'var(--input-bg)', border: '1px solid var(--input-border)',
                borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                fontSize: '14px', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Search input */}
          {!selected ? (
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600,
                color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Search Title
              </label>
              <input
                autoFocus
                type="text"
                value={query}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Search movies, TV shows..."
                style={{
                  width: '100%', padding: '10px 12px',
                  background: 'var(--input-bg)', border: '1px solid var(--input-border)',
                  borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                  fontSize: '14px', boxSizing: 'border-box',
                }}
              />
              {/* Results */}
              {results.length > 0 && (
                <div style={{ marginTop: '8px', border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)', overflow: 'hidden',
                  maxHeight: '280px', overflowY: 'auto' }}>
                  {results.map(r => (
                    <div key={r.id} onClick={() => setSelected(r)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '10px 12px', cursor: 'pointer',
                        borderBottom: '1px solid var(--border-default)',
                        background: 'var(--bg-elevated)',
                      }}
                      onMouseEnter={e =>
                        e.currentTarget.style.background = 'var(--bg-overlay)'}
                      onMouseLeave={e =>
                        e.currentTarget.style.background = 'var(--bg-elevated)'}
                    >
                      <img
                        src={r.poster_path
                          ? `https://image.tmdb.org/t/p/w200${r.poster_path}` : ''}
                        alt={r.title || r.name}
                        style={{ width: 32, height: 48, borderRadius: 4,
                          objectFit: 'cover', background: 'var(--bg-overlay)' }}
                        onError={e => { e.currentTarget.style.display = 'none' }}
                      />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '14px',
                          color: 'var(--text-primary)' }}>
                          {r.title || r.name}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {r.media_type === 'movie' ? '🎬 Movie' : '📺 TV Show'}
                          {(r.release_date || r.first_air_date) &&
                            ` · ${new Date(r.release_date || r.first_air_date).getFullYear()}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {isSearching && (
                <div style={{ textAlign: 'center', padding: '12px',
                  color: 'var(--text-muted)', fontSize: '13px' }}>
                  Searching...
                </div>
              )}
            </div>
          ) : (
            /* Selected title */
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px', background: 'var(--bg-elevated)',
                borderRadius: 'var(--radius-md)', marginBottom: '12px',
                border: '1px solid var(--color-brand)' }}>
                <img
                  src={selected.poster_path
                    ? `https://image.tmdb.org/t/p/w200${selected.poster_path}` : ''}
                  alt={selected.title || selected.name}
                  style={{ width: 40, height: 60, borderRadius: 4, objectFit: 'cover' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '14px',
                    color: 'var(--text-primary)' }}>
                    {selected.title || selected.name}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-brand)',
                    marginTop: '2px' }}>Selected ✓</div>
                </div>
                <button onClick={() => setSelected(null)} style={{
                  background: 'none', border: 'none',
                  cursor: 'pointer', color: 'var(--text-muted)',
                }}>✕</button>
              </div>

              {/* Note field */}
              <label style={{ fontSize: '12px', fontWeight: 600,
                color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Note (optional)
              </label>
              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder={mode === 'watched'
                  ? 'e.g. Watched with friends' : 'e.g. Movie night plan'}
                style={{
                  width: '100%', padding: '10px 12px',
                  background: 'var(--input-bg)', border: '1px solid var(--input-border)',
                  borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                  fontSize: '14px', boxSizing: 'border-box', marginBottom: '16px',
                }}
              />

              {/* Submit button */}
              <button
                onClick={() => { onAdd(selected, note, targetDate); onClose() }}
                style={{
                  width: '100%', padding: '12px',
                  background: mode === 'watched' ? 'var(--color-brand)' : '#00B4D8',
                  color: 'white', border: 'none', borderRadius: 'var(--radius-md)',
                  fontSize: '15px', fontWeight: 700, cursor: 'pointer',
                }}
              >
                {mode === 'watched' ? 'Log Watch' : 'Add to Plan'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── MAIN CALENDAR PAGE ───────────────────────────────────────────────────────

export default function CalendarPage() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const { entries: watchlist, addEntry } = useWatchlist()

  // Views & Reference dates
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month')
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(() => new Date())

  const [showAddModal, setShowAddModal] = useState(false)
  const [addMode, setAddMode] = useState<'watched' | 'planned'>('watched')
  const { plannedWatches, addPlan, removePlan } = usePlannedWatches()

  const plannedByDate = useMemo(() => {
    const map: Record<string, any[]> = {}
    plannedWatches.forEach(plan => {
      const dateKey = plan.plannedDate
      if (!map[dateKey]) {
        map[dateKey] = []
      }
      map[dateKey]!.push(plan)
    })
    return map
  }, [plannedWatches])

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

  const todayKey = new Date().toISOString().split('T')[0]

  const prevMonth = () => {
    setCurrentDate((prev) => {
      const next = new Date(prev)
      if (viewMode === 'month') {
        next.setMonth(next.getMonth() - 1)
      } else {
        next.setDate(next.getDate() - 7)
      }
      return next
    })
  }

  const nextMonth = () => {
    setCurrentDate((prev) => {
      const next = new Date(prev)
      if (viewMode === 'month') {
        next.setMonth(next.getMonth() + 1)
      } else {
        next.setDate(next.getDate() + 7)
      }
      return next
    })
  }

  const goToToday = () => {
    const today = new Date()
    setCurrentDate(today)
    setSelectedDay(today)
  }

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


  const selectedDateWatches = useMemo(() => {
    if (!selectedDay) return []
    const key = getLocalDateString(selectedDay)
    return watchesByDateMap.get(key) || []
  }, [selectedDay, watchesByDateMap])

  // Build calendar days array (with null for empty cells)
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const days: (Date | null)[] = []
    
    for (let i = 0; i < firstDay; i++) days.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(new Date(year, month, d))
    }
    while (days.length % 7 !== 0) days.push(null)
    return days
  }, [currentDate])


  // Firestore Add/Log watch integration
  const handleAddWatch = async (title: string, titleId: string, type: MediaType, posterPath: string | null, customDate?: string) => {
    if (!user || (!selectedDay && !customDate)) return

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

      // 3. Log into watchHistory at midday local on selectedDate/customDate to prevent timezone wraps
      const logDate = customDate ? new Date(customDate + 'T12:00:00') : new Date(selectedDay!)
      const now = new Date()
      if (!customDate) {
        logDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds())
      }
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

  const handleDeleteLog = async (id: string) => {
    if (!user) return
    const item = historyList.find((h) => h.id === id)
    if (!item) return
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

  const handleAddEntry = async (result: any, note: string, targetDate: string) => {
    if (addMode === 'planned') {
      await addPlan({
        titleId: `${result.media_type}:${result.id}`,
        title: result.title || result.name,
        posterPath: result.poster_path,
        type: result.media_type,
        plannedDate: targetDate,
        note,
      })
      showToast(`Planned watch for "${result.title || result.name}" successfully!`, 'success')
    } else {
      await handleAddWatch(
        result.title || result.name,
        `${result.media_type}:${result.id}`,
        result.media_type,
        result.poster_path,
        targetDate
      )
    }
  }

  // Format runtime Helper
  const formatRuntime = (mins: number) => {
    const hrs = Math.floor(mins / 60)
    const remaining = mins % 60
    return hrs > 0 ? `${hrs}h ${remaining}m` : `${remaining}m`
  }

  return (
    <div className="calendar-container">

      {/* Page header — fixed at top */}
      <div className="mobile-header-padding" style={{
        padding: '20px 24px 16px', flexShrink: 0,
        borderBottom: '1px solid var(--border-default)',
        background: 'var(--bg-primary)',
      }}>
        <div className="calendar-header-container">
          
          {/* Month navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button onClick={prevMonth} className="calendar-nav-btn" type="button">‹</button>
            <h2 style={{ fontSize: '20px', fontWeight: 800,
              color: 'var(--text-primary)', margin: 0, minWidth: '160px',
              textAlign: 'center' }}>
              {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h2>
            <button onClick={nextMonth} className="calendar-nav-btn" type="button">›</button>
            <button onClick={goToToday} style={{
              padding: '6px 14px', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-default)',
              background: 'var(--bg-elevated)', cursor: 'pointer',
              fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)',
            }}>Today</button>
          </div>

          {/* View toggle */}
          <div style={{ display: 'flex', gap: '4px',
            background: 'var(--bg-elevated)', padding: '3px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-default)' }}>
            {['Month', 'Week'].map(v => (
              <button key={v} onClick={() => setViewMode(v.toLowerCase() as 'month' | 'week')}
                style={{
                  padding: '5px 14px', borderRadius: 'calc(var(--radius-md) - 2px)',
                  border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500,
                  background: viewMode === v.toLowerCase()
                    ? 'var(--color-brand)' : 'transparent',
                  color: viewMode === v.toLowerCase()
                    ? 'var(--text-on-brand)' : 'var(--text-muted)',
                }}>{v}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Main body — calendar + optional side panel */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Calendar grid area */}
        <div style={{
          flex: 1, overflowY: 'auto', overflowX: 'hidden',
          padding: '0',
        }}>
          {viewMode === 'month' ? (
            <>
              {/* Day of week headers */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
                borderBottom: '1px solid var(--border-default)',
                position: 'sticky', top: 0, background: 'var(--bg-primary)', zIndex: 1,
              }}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} style={{
                    padding: '10px 8px', textAlign: 'center',
                    fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.5px',
                  }}>{day}</div>
                ))}
              </div>

              {/* Calendar days grid */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
              }}>
                {calendarDays.map((day, idx) => {
                  if (!day) return (
                    <div key={`empty-${idx}`} style={{
                      minHeight: '80px', padding: '8px',
                      borderRight: '1px solid var(--border-default)',
                      borderBottom: '1px solid var(--border-default)',
                      background: 'var(--bg-secondary)', opacity: 0.4,
                    }} />
                  )

                  const dateKey = getLocalDateString(day)
                  const dayWatched = watchesByDateMap.get(dateKey) || []
                  const dayPlanned = plannedByDate[dateKey] || []

                  const isToday = dateKey === todayKey
                  const isSelected = selectedDay && getLocalDateString(selectedDay) === dateKey
                  const isCurrentMonth = day.getMonth() === currentDate.getMonth()

                  return (
                    <div
                      key={dateKey}
                      onClick={() => setSelectedDay(day)}
                      style={{
                        minHeight: '80px', padding: '6px',
                        borderRight: '1px solid var(--border-default)',
                        borderBottom: '1px solid var(--border-default)',
                        cursor: 'pointer', overflow: 'hidden',
                        background: isSelected ? 'rgba(245, 197, 24, 0.1)'
                          : 'var(--bg-primary)',
                        outline: isSelected
                          ? '2px solid var(--color-brand)' : 'none',
                        outlineOffset: '-2px',
                        opacity: isCurrentMonth ? 1 : 0.35,
                        transition: 'background 150ms ease',
                      }}
                      onMouseEnter={e =>
                        !isSelected && (e.currentTarget.style.background = 'var(--bg-elevated)')}
                      onMouseLeave={e =>
                        !isSelected && (e.currentTarget.style.background = 'var(--bg-primary)')}
                    >
                      {/* Day number */}
                      <div style={{
                        width: 24, height: 24, borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '12px', fontWeight: isToday ? 700 : 400,
                        background: isToday ? 'var(--color-brand)' : 'transparent',
                        color: isToday ? 'var(--text-on-brand)' : 'var(--text-muted)',
                        marginLeft: 'auto', marginBottom: '4px',
                      }}>
                        {day.getDate()}
                      </div>

                      {/* Activity pills */}
                      <div className="calendar-day-cell-content">
                        {dayWatched.slice(0, 3).map((log, i) => (
                          <div key={`w-${i}`} className="calendar-pill calendar-pill--watched">
                            • {log.title}
                          </div>
                        ))}
                        {dayPlanned.slice(0, Math.max(0, 3 - dayWatched.length)).map((plan, i) => (
                          <div key={`p-${i}`} className="calendar-pill calendar-pill--planned">
                            📅 {plan.title}
                          </div>
                        ))}
                        {(dayWatched.length + dayPlanned.length) > 3 && (
                          <div className="calendar-pill-more">
                            +{dayWatched.length + dayPlanned.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            /* Week View Layout */
            <div className="calendar-week-grid">
              {weekDaysGrid.map((date, idx) => {
                const key = getLocalDateString(date)
                const dayWatches = watchesByDateMap.get(key) || []
                const dayReleases = releasesByDateMap.get(key) || []
                const isToday = getLocalDateString(new Date()) === key
                const isSelected = selectedDay && getLocalDateString(selectedDay) === key

                const dayName = date.toLocaleDateString(undefined, { weekday: 'short' })

                return (
                  <div
                    key={idx}
                    className={`week-column ${isToday ? 'week-column--today' : ''}`}
                    onClick={() => {
                      setSelectedDay(date)
                    }}
                    style={{
                      outline: isSelected ? '2px solid var(--color-brand)' : 'none',
                      outlineOffset: '-2px',
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

                      {/* Planned */}
                      {(plannedByDate[key] || []).map((p) => (
                        <div key={p.id} className="week-item-card" style={{ borderLeft: '3px solid #00B4D8' }}>
                          <span className="week-item-title" title={p.title}>
                            📅 {p.title}
                          </span>
                          {p.note && (
                            <div className="week-item-meta">
                              <span>{p.note}</span>
                            </div>
                          )}
                        </div>
                      ))}

                      {dayWatches.length === 0 && dayReleases.length === 0 && (plannedByDate[key] || []).length === 0 && (
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
        </div>

        {/* Right side panel — only when a day is selected, desktop only */}
        {selectedDay && (
          <div style={{
            width: '320px', flexShrink: 0,
            borderLeft: '1px solid var(--border-default)',
            background: 'var(--bg-secondary)',
            overflowY: 'auto', padding: '20px',
          }}
            className="calendar-side-panel"
          >
            <DayDetailContent
              selectedDay={selectedDay}
              dayLogs={selectedDateWatches}
              plannedItems={plannedByDate[getLocalDateString(selectedDay)] || []}
              onClose={() => setSelectedDay(null)}
              onAddWatch={() => { setAddMode('watched'); setShowAddModal(true) }}
              onAddPlan={() => { setAddMode('planned'); setShowAddModal(true) }}
              onDeleteLog={handleDeleteLog}
              onDeletePlan={removePlan}
              getPosterUrl={(titleId) => {
                const posterPath = watchlistPosterMap.get(titleId) || null
                return getImageUrl(posterPath, 'w200')
              }}
            />
          </div>
        )}
      </div>

      {/* Mobile bottom sheet when day selected */}
      {selectedDay && (
        <div className="calendar-bottom-sheet">
          <div style={{
            padding: '16px 20px',
            maxHeight: '50vh', overflowY: 'auto',
          }}>
            <DayDetailContent
              selectedDay={selectedDay}
              dayLogs={selectedDateWatches}
              plannedItems={plannedByDate[getLocalDateString(selectedDay)] || []}
              onClose={() => setSelectedDay(null)}
              onAddWatch={() => { setAddMode('watched'); setShowAddModal(true) }}
              onAddPlan={() => { setAddMode('planned'); setShowAddModal(true) }}
              onDeleteLog={handleDeleteLog}
              onDeletePlan={removePlan}
              getPosterUrl={(titleId) => {
                const posterPath = watchlistPosterMap.get(titleId) || null
                return getImageUrl(posterPath, 'w200')
              }}
            />
          </div>
        </div>
      )}

      {showAddModal && selectedDay && (
        <AddWatchModal
          date={selectedDay}
          mode={addMode}
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddEntry}
        />
      )}
    </div>
  )
}
