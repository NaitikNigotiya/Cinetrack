import { useState } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts'
import { BarChart2, Star, Flame } from 'lucide-react'

import { useAnalytics } from '@/features/analytics/hooks/useAnalytics'
import { useTheme } from '@/contexts/ThemeContext'
import './AnalyticsPage.css'

// ─── Theme Colors ─────────────────────────────────────────────────────────────

const LIGHT_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#87A96B']
const DARK_COLORS  = ['#60A5FA', '#34D399', '#FBBF24', '#F87171', '#A78BFA', '#F472B6', '#2DD4BF', '#98FF98']

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Rating Stars Sub-component */
function SummaryRatingStars({ rating }: { rating: number }) {
  const filledCount = Math.floor(rating)
  const hasHalf = rating % 1 >= 0.5

  return (
    <div className="summary-rating-stars" aria-label={`Average rating ${rating} stars`}>
      {Array.from({ length: 10 }).map((_, i) => {
        const val = i + 1
        const isFilled = val <= filledCount
        const isHalf = val === filledCount + 1 && hasHalf

        return (
          <span key={i} style={{ display: 'flex', alignItems: 'center' }}>
            <Star
              size={12}
              fill={isFilled || isHalf ? 'var(--star-filled)' : 'none'}
              stroke={isFilled || isHalf ? 'var(--star-filled)' : 'currentColor'}
            />
          </span>
        )
      })}
    </div>
  )
}

/** Custom Tooltip for Stacked Monthly Activity Chart */
function CustomMonthlyTooltip({ active, payload, label, showHours }: any) {
  if (active && payload && payload.length) {
    const moviesVal = payload[0]?.value ?? 0
    const tvVal = payload[1]?.value ?? 0
    const unit = showHours ? 'h' : ' watched'

    return (
      <div className="custom-chart-tooltip">
        <p className="custom-tooltip-title">{label}</p>
        <div className="custom-tooltip-row">
          <span className="custom-tooltip-square" style={{ background: payload[0].fill }} />
          <span>Movies</span>
          <span className="custom-tooltip-val">{moviesVal}{unit}</span>
        </div>
        <div className="custom-tooltip-row">
          <span className="custom-tooltip-square" style={{ background: payload[1].fill }} />
          <span>TV Shows</span>
          <span className="custom-tooltip-val">{tvVal}{unit}</span>
        </div>
      </div>
    )
  }
  return null
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { theme } = useTheme()
  const { data, isLoading } = useAnalytics()

  // Y Axis state for monthly activity
  const [activityMetric, setActivityMetric] = useState<'count' | 'hours'>('count')

  // Hover index state for genre donut chart
  const [activeGenreIndex, setActiveGenreIndex] = useState<number | null>(null)

  const activeColors = theme === 'dark' ? DARK_COLORS : LIGHT_COLORS

  // Total conversion
  const totalWatchHours = Math.round(data.totalRuntimeMinutes / 60)
  const convertedDays = (totalWatchHours / 24).toFixed(1)

  // Top genre calculations for center of donut
  const topGenreName = data.genreData[0]?.name || 'N/A'
  const topGenreCount = data.genreData[0]?.count || 0

  // ── Render ──

  return (
    <div className="analytics-page animate-fade-in">
      {/* Header */}
      <header className="analytics-header">
        <div className="analytics-header-row">
          <BarChart2 size={24} className="analytics-header-icon" />
          <h1 className="analytics-title">Your Stats</h1>
        </div>
      </header>

      {/* Content */}
      <main className="analytics-content">
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="analytics-grid-2x2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 110, borderRadius: 'var(--radius-lg)' }} />
              ))}
            </div>
            <div className="skeleton" style={{ height: 320, borderRadius: 'var(--radius-lg)' }} />
            <div className="skeleton" style={{ height: 260, borderRadius: 'var(--radius-lg)' }} />
          </div>
        ) : data.totalTitles > 0 ? (
          <>
            {/* ── SECTION 1: SUMMARY CARDS ── */}
            <section className="analytics-grid-2x2" aria-label="Quick statistics grid">
              {/* Card 1: Watch Time */}
              <div className="summary-stat-card">
                <span className="summary-stat-value">{totalWatchHours}h</span>
                <span className="summary-stat-label">Watch Time</span>
                <span className="summary-stat-sub">~{convertedDays} days of content</span>
              </div>

              {/* Card 2: Titles */}
              <div className="summary-stat-card">
                <span className="summary-stat-value">{data.totalTitles}</span>
                <span className="summary-stat-label">Titles Tracked</span>
                <span className="summary-stat-sub">{data.totalMovies} movies · {data.totalTV} shows</span>
              </div>

              {/* Card 3: Rating */}
              <div className="summary-stat-card">
                <span className="summary-stat-value">
                  {data.averageRating !== null ? data.averageRating : '—'}
                </span>
                <span className="summary-stat-label">Avg Rating</span>
                {data.averageRating !== null ? (
                  <SummaryRatingStars rating={data.averageRating} />
                ) : (
                  <span className="summary-stat-sub">No ratings logged yet</span>
                )}
              </div>

              {/* Card 4: Streak */}
              <div className="summary-stat-card">
                <span className="summary-stat-value" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Flame size={20} fill="var(--color-brand)" stroke="none" />
                  {data.currentStreakDays}
                </span>
                <span className="summary-stat-label">Day Streak</span>
                <span className="summary-stat-sub">Longest: {data.longestStreakDays} days</span>
              </div>
            </section>

            {/* ── SECTION 2: GENRE DISTRIBUTION ── */}
            <section className="analytics-card">
              <h2 className="analytics-section-title">Genres</h2>

              {data.genreData.length < 3 ? (
                // Simple Horizontal bar chart if few genres
                <div style={{ padding: '8px 0' }}>
                  {data.genreData.map((genre, idx) => (
                    <div key={genre.name} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                        <span style={{ fontWeight: 600 }}>{genre.name}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{genre.count} titles</span>
                      </div>
                      <div className="season-progress-bar-bg" style={{ height: 8 }}>
                        <div
                          className="season-progress-bar-fg"
                          style={{
                            width: `${genre.percentage}%`,
                            background: activeColors[idx % activeColors.length],
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                // Rich Pie donut chart
                <div>
                  <div className="chart-container-donut">
                    <ResponsiveContainer width={300} height={260}>
                      <PieChart>
                        <Pie
                          data={data.genreData}
                          cx="50%"
                          cy="50%"
                          innerRadius={70}
                          outerRadius={100}
                          paddingAngle={3}
                          dataKey="count"
                          onMouseEnter={(_, idx) => setActiveGenreIndex(idx)}
                          onMouseLeave={() => setActiveGenreIndex(null)}
                        >
                          {data.genreData.map((_, index) => {
                            const isHovered = activeGenreIndex === index
                            return (
                              <Cell
                                key={`cell-${index}`}
                                fill={activeColors[index % activeColors.length] || '#FFF'}
                                stroke="var(--card-bg)"
                                strokeWidth={2}
                                style={{
                                  transform: isHovered ? 'scale(1.03)' : 'scale(1)',
                                  transformOrigin: '50% 50%',
                                  transition: 'transform 200ms ease',
                                  cursor: 'pointer',
                                }}
                              />
                            )
                          })}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>

                    {/* Donut Center text */}
                    <div className="donut-center-lbl">
                      <span className="donut-center-title">
                        {activeGenreIndex !== null && data.genreData[activeGenreIndex]
                          ? data.genreData[activeGenreIndex].name
                          : topGenreName}
                      </span>
                      <span className="donut-center-count">
                        {activeGenreIndex !== null && data.genreData[activeGenreIndex]
                          ? `${data.genreData[activeGenreIndex].count} titles`
                          : `${topGenreCount} titles`}
                      </span>
                    </div>
                  </div>

                  {/* Horizontal legend chips */}
                  <div className="genre-legend-list">
                    {data.genreData.map((genre, idx) => (
                      <span key={genre.name} className="genre-legend-pill">
                        <span className="genre-legend-dot" style={{ background: activeColors[idx % activeColors.length] }} />
                        <span>{genre.name}</span>
                        <span className="genre-legend-count">{genre.count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* ── SECTION 3: MONTHLY ACTIVITY ── */}
            <section className="analytics-card">
              <div className="monthly-controls">
                <h2 className="analytics-section-title" style={{ margin: 0 }}>Monthly Activity</h2>
                <div className="metric-toggle-group">
                  <button
                    className={`metric-toggle-btn${activityMetric === 'count' ? ' metric-toggle-btn--active' : ''}`}
                    onClick={() => setActivityMetric('count')}
                    type="button"
                  >
                    Count
                  </button>
                  <button
                    className={`metric-toggle-btn${activityMetric === 'hours' ? ' metric-toggle-btn--active' : ''}`}
                    onClick={() => setActivityMetric('hours')}
                    type="button"
                  >
                    Hours
                  </button>
                </div>
              </div>

              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.monthlyData}
                    margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                  >
                    <XAxis
                      dataKey="month"
                      tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      content={
                        <CustomMonthlyTooltip
                          showHours={activityMetric === 'hours'}
                        />
                      }
                      cursor={{ fill: 'var(--bg-overlay)', opacity: 0.15 }}
                    />
                    <Bar
                      dataKey={activityMetric === 'hours' ? 'moviesHours' : 'movies'}
                      stackId="a"
                      fill="var(--color-brand)"
                      radius={[0, 0, 0, 0]}
                    />
                    <Bar
                      dataKey={activityMetric === 'hours' ? 'tvHours' : 'tv'}
                      stackId="a"
                      fill="#4A90E2" // secondary color
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Chart Legend */}
              <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  <span style={{ width: 10, height: 10, background: 'var(--color-brand)', borderRadius: 2 }} />
                  <span>Movies</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  <span style={{ width: 10, height: 10, background: '#4A90E2', borderRadius: 2 }} />
                  <span>TV Shows</span>
                </div>
              </div>
            </section>

            {/* ── SECTION 4: RATING DISTRIBUTION ── */}
            <section className="analytics-card">
              <h2 className="analytics-section-title">Your Ratings</h2>

              <div style={{ width: '100%', height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={data.ratingData}
                    margin={{ top: 0, right: 20, left: -10, bottom: 0 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="label"
                      type="category"
                      tick={{ fill: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Bar
                      dataKey="count"
                      radius={[0, 4, 4, 0]}
                      label={{
                        position: 'right',
                        fill: 'var(--text-secondary)',
                        fontSize: 10,
                        fontWeight: 'bold',
                        className: 'rating-bar-label',
                      }}
                    >
                      {data.ratingData.map((_, index) => {
                        // Rating scale gradient color fills
                        const colors = ['#EF4444', '#F59E0B', '#F5C518', '#8B5CF6', '#10B981']
                        return <Cell key={`cell-${index}`} fill={colors[index] || 'var(--color-brand)'} />
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* ── SECTION 5: MOVIE vs TV SPLIT ── */}
            <section className="analytics-card">
              <h2 className="analytics-section-title">Movie vs TV Split</h2>
              <div className="split-visual-row">
                <div className="split-movie-bar" style={{ width: `${data.typeSplit.moviePct}%` }} />
                <div className="split-tv-bar" style={{ width: `${data.typeSplit.tvPct}%` }} />
              </div>
              <p className="split-label-text">
                {data.typeSplit.moviePct}% Movies ({data.typeSplit.movies}) · {data.typeSplit.tvPct}% TV Shows ({data.typeSplit.tv})
              </p>
            </section>

            {/* ── SECTION 6: YEARLY WRAPPED CARD ── */}
            {data.totalTitles > 10 && (
              <section className="wrapped-recap-card animate-fade-in" aria-label="Yearly Wrapped Highlights">
                <div className="wrapped-header">
                  <span className="wrapped-year">{data.yearlyStats.year} WRAPPED</span>
                  <span className="wrapped-badge">Highlight</span>
                </div>

                <div className="wrapped-main-stat">
                  {data.yearlyStats.titlesWatched} Titles Watched
                </div>

                <div className="wrapped-row-grid">
                  <div className="wrapped-metric-box">
                    <span className="wrapped-metric-val">{data.yearlyStats.totalHours}h</span>
                    <span className="wrapped-metric-lbl">Total Time</span>
                  </div>
                  <div className="wrapped-metric-box">
                    <span className="wrapped-metric-val">{data.yearlyStats.topGenre}</span>
                    <span className="wrapped-metric-lbl">Top Genre</span>
                  </div>
                </div>

                {data.yearlyStats.mostWatchedShow && (
                  <div className="wrapped-metric-box" style={{ borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: 10 }}>
                    <span className="wrapped-metric-val">{data.yearlyStats.mostWatchedShow}</span>
                    <span className="wrapped-metric-lbl">Most Watched Series</span>
                  </div>
                )}
              </section>
            )}
          </>
        ) : (
          <div className="analytics-empty animate-fade-in">
            <span className="analytics-empty-emoji" aria-hidden="true">📊</span>
            <p className="analytics-empty-title">No statistics available</p>
            <p className="analytics-empty-subtitle">
              Your watchlist is currently empty. Add titles to see runtime, genre and status statistics.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
