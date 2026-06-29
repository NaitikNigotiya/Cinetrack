import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Film,
  Calendar as CalendarIcon,
  List as ListIcon,
  Clock as ClockIcon,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
} from 'lucide-react'

import { useWatchlist } from '@/features/watchlist/hooks/useWatchlist'
import { getImageUrl } from '@/lib/tmdb'
import type { WatchlistEntry } from '@/types/app'
import { PosterCard } from '@/components/ui/PosterCard'

import './CompletedPage.css'

// ─── Constants & Types ────────────────────────────────────────────────────────

type ViewTab = 'timeline' | 'calendar' | 'list'
type SortColumn = 'date' | 'title' | 'rating' | 'runtime' | 'genre'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getWatchDate(e: WatchlistEntry): Date {
  if (e.watchDates && e.watchDates.length > 0) {
    const sorted = [...e.watchDates].sort((a, b) => b.seconds - a.seconds)
    return sorted[0]!.toDate()
  }
  return e.updatedAt?.toDate ? e.updatedAt.toDate() : new Date()
}

function getMonthDaysCount(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getMonthStartDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CompletedPage() {
  const navigate = useNavigate()
  const { entries, isLoading } = useWatchlist()

  // Tab State
  const [activeTab, setActiveTab] = useState<ViewTab>('timeline')

  // Calendar View State
  const [calendarDate, setCalendarDate] = useState(() => new Date())
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<number | null>(null)

  // List View Sort State
  const [sortCol, setSortCol] = useState<SortColumn>('date')
  const [sortAsc, setSortAsc] = useState(false)

  // ── 1. Completed Entries with Watch Dates ──
  const completedEntries = useMemo(() => {
    return entries
      .filter((e) => e.status === 'completed')
      .map((entry) => ({
        ...entry,
        completionDate: getWatchDate(entry),
      }))
  }, [entries])

  // ── 2. Time-Based Buckets & Stats ──
  const stats = useMemo(() => {
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()

    const thisMonthList = completedEntries.filter(
      (e) => e.completionDate.getMonth() === currentMonth && e.completionDate.getFullYear() === currentYear
    )

    const thisYearList = completedEntries.filter((e) => e.completionDate.getFullYear() === currentYear)

    // Run times and ratings calculation
    const totalRuntimeMinutes = completedEntries.reduce((acc, e) => acc + (e.totalRuntime || 120), 0)
    const ratedTitles = completedEntries.filter((e) => e.rating !== null)
    const avgRating = ratedTitles.length > 0
      ? (ratedTitles.reduce((acc, e) => acc + e.rating!, 0) / ratedTitles.length).toFixed(1)
      : 'N/A'

    const thisMonthHours = Math.round(thisMonthList.reduce((acc, e) => acc + (e.totalRuntime || 120), 0) / 60)
    const thisYearHours = Math.round(thisYearList.reduce((acc, e) => acc + (e.totalRuntime || 120), 0) / 60)
    const allTimeHours = Math.round(totalRuntimeMinutes / 60)

    const avgRuntimeMins = completedEntries.length > 0
      ? Math.round(totalRuntimeMinutes / completedEntries.length)
      : 0
    const avgHrs = Math.floor(avgRuntimeMins / 60)
    const avgMins = avgRuntimeMins % 60

    return {
      thisMonthCount: thisMonthList.length,
      thisMonthMovies: thisMonthList.filter((e) => e.type === 'movie').length,
      thisMonthTV: thisMonthList.filter((e) => e.type === 'tv').length,
      thisMonthHours,

      thisYearCount: thisYearList.length,
      thisYearMovies: thisYearList.filter((e) => e.type === 'movie').length,
      thisYearTV: thisYearList.filter((e) => e.type === 'tv').length,
      thisYearHours,

      allTimeCount: completedEntries.length,
      allTimeMovies: completedEntries.filter((e) => e.type === 'movie').length,
      allTimeTV: completedEntries.filter((e) => e.type === 'tv').length,
      allTimeHours,

      avgRating,
      avgRuntimeStr: avgHrs > 0 ? `${avgHrs}h ${avgMins}m` : `${avgMins}m`,
      thisMonthList,
      thisYearList,
    }
  }, [completedEntries])

  // ── 3. Grouped Timeline List (Newest first) ──
  const timelineMonths = useMemo(() => {
    const groups: Record<string, typeof completedEntries> = {}
    completedEntries.forEach((e) => {
      const monthStr = e.completionDate.toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      })
      if (!groups[monthStr]) groups[monthStr] = []
      groups[monthStr].push(e)
    })

    return Object.entries(groups)
      .map(([monthLabel, items]) => {
        const sortedItems = items.sort((a, b) => b.completionDate.getTime() - a.completionDate.getTime())
        const totalHrs = Math.round(items.reduce((acc, e) => acc + (e.totalRuntime || 120), 0) / 60)
        return { monthLabel, items: sortedItems, totalHrs }
      })
      .sort((a, b) => {
        const dateA = a.items[0]?.completionDate.getTime() ?? 0
        const dateB = b.items[0]?.completionDate.getTime() ?? 0
        return dateB - dateA
      })
  }, [completedEntries])

  // ── 4. Mini Calendar Calculations (Current Month) ──
  const miniCalendarDays = useMemo(() => {
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()
    const daysInMonth = getMonthDaysCount(currentYear, currentMonth)
    const startDay = getMonthStartDayOfWeek(currentYear, currentMonth)

    const list: ({ day: number | null; hasActivity: boolean; hasCompletion: boolean; isToday: boolean } | null)[] = []

    // Empty offset cells
    for (let i = 0; i < startDay; i++) {
      list.push(null)
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dayCompletions = completedEntries.filter(
        (e) => e.completionDate.getDate() === d &&
               e.completionDate.getMonth() === currentMonth &&
               e.completionDate.getFullYear() === currentYear
      )

      list.push({
        day: d,
        hasActivity: dayCompletions.length > 0,
        hasCompletion: dayCompletions.length > 0,
        isToday: now.getDate() === d,
      })
    }

    return list
  }, [completedEntries])

  // ── 5. Full Calendar Grid (Interactive Mode) ──
  const fullCalendarDays = useMemo(() => {
    const year = calendarDate.getFullYear()
    const month = calendarDate.getMonth()
    const daysInMonth = getMonthDaysCount(year, month)
    const startDay = getMonthStartDayOfWeek(year, month)

    const list: ({ day: number; date: Date; completions: typeof completedEntries } | null)[] = []

    // Padding offset
    for (let i = 0; i < startDay; i++) {
      list.push(null)
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dDate = new Date(year, month, d)
      const completions = completedEntries.filter(
        (e) => e.completionDate.getDate() === d &&
               e.completionDate.getMonth() === month &&
               e.completionDate.getFullYear() === year
      )
      list.push({ day: d, date: dDate, completions })
    }

    return list
  }, [calendarDate, completedEntries])

  const calendarMonthLabel = calendarDate.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })

  const selectedCalendarItems = useMemo(() => {
    if (selectedCalendarDay === null) return []
    const year = calendarDate.getFullYear()
    const month = calendarDate.getMonth()
    return completedEntries.filter(
      (e) => e.completionDate.getDate() === selectedCalendarDay &&
             e.completionDate.getMonth() === month &&
             e.completionDate.getFullYear() === year
    )
  }, [selectedCalendarDay, calendarDate, completedEntries])

  // ── 6. List View Sorting ──
  const handleSortToggle = (col: SortColumn) => {
    if (sortCol === col) {
      setSortAsc((a) => !a)
    } else {
      setSortCol(col)
      setSortAsc(false)
    }
  }

  const sortedList = useMemo(() => {
    const list = [...completedEntries]
    return list.sort((a, b) => {
      let valA: any = ''
      let valB: any = ''

      if (sortCol === 'title') {
        valA = a.title
        valB = b.title
      } else if (sortCol === 'rating') {
        valA = a.rating ?? 0
        valB = b.rating ?? 0
      } else if (sortCol === 'runtime') {
        valA = a.totalRuntime ?? 0
        valB = b.totalRuntime ?? 0
      } else if (sortCol === 'genre') {
        valA = a.genres?.[0] ?? ''
        valB = b.genres?.[0] ?? ''
      } else {
        // completion date
        valA = a.completionDate.getTime()
        valB = b.completionDate.getTime()
      }

      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA)
      }
      return sortAsc ? valA - valB : valB - valA
    })
  }, [completedEntries, sortCol, sortAsc])

  // ── Navigation calendar actions ──
  const handlePrevMonth = () => {
    setSelectedCalendarDay(null)
    setCalendarDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setSelectedCalendarDay(null)
    setCalendarDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  // ── Skeleton Loader ──
  if (isLoading) {
    return (
      <div className="page-wrapper completed-page" style={{ padding: 24 }}>
        <div className="skeleton" style={{ height: 40, width: '30%', marginBottom: 24 }} />
        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
          <div className="skeleton" style={{ height: 36, width: 100, borderRadius: 'var(--radius-pill)' }} />
          <div className="skeleton" style={{ height: 36, width: 100, borderRadius: 'var(--radius-pill)' }} />
        </div>
        <div className="skeleton" style={{ height: 200, borderRadius: 'var(--radius-lg)' }} />
      </div>
    )
  }

  const isCompletedEmpty = completedEntries.length === 0

  return (
    <div className="page-wrapper completed-page">

      {/* ── HEADER ── */}
      <header className="cp-header">
        <div className="cp-header-left">
          <h1 className="cp-title">Completed</h1>
          <nav className="cp-tab-bar" role="tablist">
            {(['timeline', 'calendar', 'list'] as const).map((tab) => {
              const label = tab.charAt(0).toUpperCase() + tab.slice(1)
              return (
                <button
                  key={tab}
                  className={`cp-tab-btn ${activeTab === tab ? 'cp-tab-btn--active' : ''}`}
                  onClick={() => setActiveTab(tab)}
                  role="tab"
                  aria-selected={activeTab === tab}
                  type="button"
                >
                  {tab === 'timeline' && <ClockIcon size={13} style={{ marginRight: 4 }} />}
                  {tab === 'calendar' && <CalendarIcon size={13} style={{ marginRight: 4 }} />}
                  {tab === 'list' && <ListIcon size={13} style={{ marginRight: 4 }} />}
                  {label}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Top general stats strip */}
        <div className="cp-header-stats-strip">
          <div className="cp-strip-item">
            <span className="cp-strip-lbl">This Month</span>
            <span className="cp-strip-val">{stats.thisMonthCount} titles · {stats.thisMonthHours}h</span>
          </div>
          <div className="cp-strip-item">
            <span className="cp-strip-lbl">This Year</span>
            <span className="cp-strip-val">{stats.thisYearCount} titles · {stats.thisYearHours}h</span>
          </div>
          <div className="cp-strip-item">
            <span className="cp-strip-lbl">All Time</span>
            <span className="cp-strip-val">{stats.allTimeCount} titles · {stats.allTimeHours}h</span>
          </div>
        </div>
      </header>

      {/* ── EMPTY STATE ── */}
      {isCompletedEmpty ? (
        <div className="cp-empty-state">
          <span className="cp-empty-emoji" role="img" aria-label="trophy">🏆</span>
          <h2 className="cp-empty-title">No completed titles</h2>
          <p className="cp-empty-desc">Mark items as Completed from your watchlist to see them here.</p>
          <button className="cp-empty-cta" onClick={() => navigate('/watchlist')} type="button">
            My Watchlist
          </button>
        </div>
      ) : (
        /* ── DASHBOARD LAYOUT (Left views panel, Right monthly stats sidebar) ── */
        <div className="cp-layout-columns">

          {/* LEFT VIEWS AREA */}
          <main className="cp-main-content">

            {/* TIMELINE TAB */}
            {activeTab === 'timeline' && (
              <div className="timeline-pane animate-fade-in">
                {timelineMonths.map((group) => (
                  <section key={group.monthLabel} className="timeline-group">
                    <div className="timeline-group-header">
                      <h3 className="timeline-group-title">{group.monthLabel}</h3>
                      <span className="timeline-group-stats">{group.items.length} titles · {group.totalHrs}h</span>
                    </div>

                    <div className="poster-grid">
                      {group.items.map((e) => (
                        <PosterCard
                          key={e.titleId}
                          title={e.title}
                          year={e.year}
                          posterPath={e.posterPath}
                          rating={e.rating}
                          type={e.type}
                          status="completed"
                          onClick={() => navigate(`/title/${e.titleId}`)}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}

            {/* CALENDAR TAB */}
            {activeTab === 'calendar' && (
              <div className="calendar-pane animate-fade-in">
                <header className="full-cal-header">
                  <button onClick={handlePrevMonth} className="full-cal-nav-btn" type="button">
                    <ChevronLeft size={16} />
                  </button>
                  <h3 className="full-cal-title">{calendarMonthLabel}</h3>
                  <button onClick={handleNextMonth} className="full-cal-nav-btn" type="button">
                    <ChevronRight size={16} />
                  </button>
                </header>

                <div className="full-cal-grid">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                    <div key={d} className="full-cal-day-header">{d}</div>
                  ))}
                  {fullCalendarDays.map((cell, idx) => {
                    if (!cell) {
                      return <div key={`empty-${idx}`} className="full-cal-cell full-cal-cell--empty" />
                    }
                    const isSelected = selectedCalendarDay === cell.day
                    const hasWatches = cell.completions.length > 0
                    return (
                      <button
                        key={`cell-${cell.day}`}
                        className={`full-cal-cell ${isSelected ? 'full-cal-cell--selected' : ''} ${hasWatches ? 'full-cal-cell--activity' : ''}`}
                        onClick={() => setSelectedCalendarDay(isSelected ? null : cell.day)}
                        type="button"
                      >
                        <span className="full-cal-cell-num">{cell.day}</span>
                        {hasWatches && (
                          <div className="full-cal-activity-indicator">
                            <span className="full-cal-dot" />
                            <span className="full-cal-count-badge">{cell.completions.length}</span>
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Selected calendar items details drawer */}
                {selectedCalendarDay !== null && (
                  <div className="selected-day-details-panel animate-fade-in">
                    <h4 className="selected-day-title">
                      Watched on {calendarDate.toLocaleDateString(undefined, { month: 'long' })} {selectedCalendarDay}, {calendarDate.getFullYear()}
                    </h4>
                    {selectedCalendarItems.length > 0 ? (
                      <div className="selected-day-list">
                        {selectedCalendarItems.map((e) => (
                          <div key={e.titleId} className="selected-day-row" onClick={() => navigate(`/title/${e.titleId}`)}>
                            <img src={getImageUrl(e.posterPath, 'w200')!} alt={e.title} className="selected-day-thumb" />
                            <div className="selected-day-info">
                              <p className="selected-day-item-title">{e.title}</p>
                              <p className="selected-day-item-meta">{e.type === 'movie' ? 'Movie' : 'TV Show'} · {e.year}</p>
                            </div>
                            <span className="selected-day-item-time">{Math.round((e.totalRuntime || 120) / 60)}h</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="selected-day-empty">No titles completed on this day.</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* LIST TAB */}
            {activeTab === 'list' && (
              <div className="list-pane animate-fade-in">
                <table className="list-view-table">
                  <thead>
                    <tr>
                      <th onClick={() => handleSortToggle('date')} className="sortable-th">
                        Completion Date <ArrowUpDown size={12} style={{ marginLeft: 4 }} />
                      </th>
                      <th onClick={() => handleSortToggle('title')} className="sortable-th">
                        Title <ArrowUpDown size={12} style={{ marginLeft: 4 }} />
                      </th>
                      <th onClick={() => handleSortToggle('rating')} className="sortable-th">
                        Rating <ArrowUpDown size={12} style={{ marginLeft: 4 }} />
                      </th>
                      <th onClick={() => handleSortToggle('runtime')} className="sortable-th">
                        Runtime <ArrowUpDown size={12} style={{ marginLeft: 4 }} />
                      </th>
                      <th onClick={() => handleSortToggle('genre')} className="sortable-th">
                        Genre <ArrowUpDown size={12} style={{ marginLeft: 4 }} />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedList.map((e) => {
                      const poster = getImageUrl(e.posterPath, 'w200')
                      return (
                        <tr key={e.titleId} onClick={() => navigate(`/title/${e.titleId}`)} className="list-view-row">
                          <td>{e.completionDate.toLocaleDateString()}</td>
                          <td>
                            <div className="list-title-cell">
                              {poster ? (
                                <img src={poster} alt={e.title} className="list-row-thumb" />
                              ) : (
                                <div className="list-row-thumb-ph"><Film size={12} /></div>
                              )}
                              <span>{e.title}</span>
                            </div>
                          </td>
                          <td>{e.rating ? `⭐ ${e.rating}/10` : '—'}</td>
                          <td>{Math.round((e.totalRuntime || 120) / 60)}h {e.totalRuntime ? e.totalRuntime % 60 : 0}m</td>
                          <td>
                            <span className="list-genre-tag">{e.genres?.[0] || 'N/A'}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </main>

          {/* RIGHT SIDEBAR (Desktop stats panel) */}
          <aside className="cp-sidebar desktop-only">
            <h3 className="cp-sidebar-title">This Month</h3>

            {/* Mini calendar grid */}
            <div className="mini-cal">
              <div className="mini-cal-weekdays">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                  <span key={i} className="mini-cal-wk-lbl">{d}</span>
                ))}
              </div>
              <div className="mini-cal-grid">
                {miniCalendarDays.map((cell, idx) => {
                  if (!cell) {
                    return <span key={`empty-${idx}`} className="mini-cal-cell mini-cal-cell--empty" />
                  }
                  return (
                    <span
                      key={`mini-${cell.day}`}
                      className={`mini-cal-cell ${cell.hasActivity ? 'mini-cal-cell--activity' : ''} ${cell.isToday ? 'mini-cal-cell--today' : ''}`}
                    >
                      <span className="mini-cal-cell-num">{cell.day}</span>
                      {cell.hasCompletion && <span className="mini-cal-dot-indicator" />}
                    </span>
                  )
                })}
              </div>
            </div>

            {/* General metrics */}
            <section className="cp-sidebar-section">
              <h4 className="cp-sidebar-sec-title">Analytics summary</h4>
              <div className="sidebar-stats-list">
                <div className="sidebar-stats-row">
                  <span>This Month</span>
                  <strong>{stats.thisMonthCount} titles · {stats.thisMonthHours}h</strong>
                </div>
                <div className="sidebar-stats-row">
                  <span>This Year</span>
                  <strong>{stats.thisYearMovies} Movies · {stats.thisYearTV} TV Show{stats.thisYearTV !== 1 ? 's' : ''}</strong>
                </div>
                <div className="sidebar-stats-row">
                  <span>Avg Rating</span>
                  <strong>⭐ {stats.avgRating} / 10</strong>
                </div>
                <div className="sidebar-stats-row">
                  <span>Avg. Runtime</span>
                  <strong>{stats.avgRuntimeStr}</strong>
                </div>
              </div>
            </section>

            {/* Recently Completed poster cards */}
            <section className="cp-sidebar-section">
              <h4 className="cp-sidebar-sec-title">Recently Completed</h4>
              <div className="sidebar-recent-list">
                {completedEntries.slice(0, 2).map((e) => {
                  const poster = getImageUrl(e.posterPath, 'w200')
                  return (
                    <div key={e.titleId} className="recent-completed-row-card" onClick={() => navigate(`/title/${e.titleId}`)}>
                      {poster ? (
                        <img src={poster} alt={e.title} className="recent-completed-row-img" />
                      ) : (
                        <div className="recent-completed-row-ph"><Film size={14} /></div>
                      )}
                      <div className="recent-completed-row-info">
                        <p className="recent-completed-row-title">{e.title}</p>
                        <p className="recent-completed-row-date">{e.completionDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          </aside>
        </div>
      )}
    </div>
  )
}
