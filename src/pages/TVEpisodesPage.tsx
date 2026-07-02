import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'

import { useWatchlistEntry } from '@/features/watchlist/hooks/useWatchlistEntry'
import { useTVProgress } from '@/features/watchlist/hooks/useTVProgress'
import { getTVDetails, getTVSeason } from '@/lib/tmdb'

import type { TMDbTV } from '@/types/tmdb'
import './TVEpisodesPage.css'

// ─── Season Checklist ─────────────────────────────────────────────────────────

function SeasonChecklist({
  tvId,
  seasonNumber,
  tvTitle,
  averageEpisodeRuntime,
}: {
  tvId: number
  seasonNumber: number
  tvTitle: string
  averageEpisodeRuntime: number
}) {
  const { data: seasonData, isLoading: isSeasonLoading } = useQuery({
    queryKey: ['tv', tvId, 'season', seasonNumber] as const,
    queryFn: () => getTVSeason(tvId, seasonNumber),
    staleTime: 10 * 60 * 1000,
  })

  const { watchedEpisodes, toggleEpisode } = useTVProgress(
    `tv:${tvId}`,
    tvTitle,
    averageEpisodeRuntime,
  )

  const episodes = seasonData?.episodes ?? []
  const total = episodes.length

  const pad = (n: number) => String(n).padStart(2, '0')

  const watchedCount = useMemo(() => {
    if (!seasonData) return 0
    const seasonStr = pad(seasonNumber)
    return episodes.filter((ep) =>
      watchedEpisodes.has(`S${seasonStr}E${pad(ep.episode_number)}`),
    ).length
  }, [seasonData, watchedEpisodes, episodes, seasonNumber])

  const progressPercent = total > 0 ? Math.round((watchedCount / total) * 100) : 0

  // ── Skeletons ──────────────────────────────────────────────────────────────

  if (isSeasonLoading) {
    return (
      <>
        <div className="episodes-progress-banner skeleton" style={{ height: 74, margin: '16px 16px 0' }} />
        <div className="episodes-content">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton ep-card-skeleton" style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
      </>
    )
  }

  if (total === 0) {
    return (
      <div className="episodes-empty animate-fade-in">
        <span className="episodes-empty-icon" aria-hidden="true">🎬</span>
        <p className="episodes-empty-text">No episodes available for this season yet.</p>
      </div>
    )
  }

  const seasonStr = pad(seasonNumber)

  return (
    <>
      {/* Progress Banner */}
      <div className="episodes-progress-banner animate-fade-in">
        <div className="episodes-progress-header">
          <span className="episodes-progress-label">Season {seasonNumber} Progress</span>
          <span className="episodes-progress-count">
            <strong>{watchedCount}</strong> / {total} episodes
            <span className="episodes-progress-pct">{progressPercent}%</span>
          </span>
        </div>
        <div className="episodes-progress-track">
          <div className="episodes-progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      {/* Episode Cards */}
      <div className="episodes-content" role="group" aria-label={`Season ${seasonNumber} episodes`}>
        {episodes.map((ep, idx) => {
          const episodeCode = `S${seasonStr}E${pad(ep.episode_number)}`
          const isWatched = watchedEpisodes.has(episodeCode)
          const runtime = ep.runtime ?? averageEpisodeRuntime

          return (
            <div
              key={ep.id}
              className={`ep-card animate-fade-in${isWatched ? ' ep-card--watched' : ''}`}
              style={{ animationDelay: `${idx * 30}ms` }}
              onClick={() => toggleEpisode(seasonNumber, ep.episode_number, runtime)}
              role="button"
              tabIndex={0}
              aria-pressed={isWatched}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  toggleEpisode(seasonNumber, ep.episode_number, runtime)
                }
              }}
            >
              <div className="ep-checkbox-wrap">
                <input
                  type="checkbox"
                  className="ep-checkbox"
                  checked={isWatched}
                  onChange={() => {}}
                  tabIndex={-1}
                  aria-label={`Mark ${episodeCode} as watched`}
                />
              </div>

              <div className="ep-info">
                <div className="ep-title-row">
                  <span className="ep-code">{episodeCode}</span>
                  <span className="ep-name">{ep.name || `Episode ${ep.episode_number}`}</span>
                </div>
                <div className="ep-meta">
                  {ep.air_date && (
                    <span className="ep-air-date">
                      {new Date(ep.air_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>
                  )}
                  {runtime > 0 && (
                    <span className="ep-runtime">{runtime}m</span>
                  )}
                </div>
              </div>

              <div className="ep-watched-badge" aria-hidden="true">
                <CheckCircle2 size={14} />
                Watched
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TVEpisodesPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [type, tmdbIdStr] = id?.split(':') ?? []
  const tmdbId = parseInt(tmdbIdStr || '', 10)

  const { data: details, isLoading: isDetailsLoading } = useQuery<TMDbTV, Error>({
    queryKey: ['title-details', 'tv', tmdbId] as const,
    queryFn: () => getTVDetails(tmdbId),
    enabled: type === 'tv' && !isNaN(tmdbId),
    staleTime: 15 * 60 * 1000,
  })

  const { entry } = useWatchlistEntry(id || '')

  const [selectedSeason, setSelectedSeason] = useState(entry?.currentSeason || 1)

  const seasons = details?.seasons
    ? details.seasons.filter((s) => s.season_number > 0)
    : []

  // ── Loading skeleton ───────────────────────────────────────────────────────

  if (isDetailsLoading) {
    return (
      <div className="episodes-page">
        <header className="episodes-header">
          <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', flexShrink: 0 }} />
          <div className="episodes-header-title-box">
            <div className="skeleton" style={{ height: 10, width: '35%', borderRadius: 4 }} />
            <div className="skeleton" style={{ height: 17, width: '55%', borderRadius: 4, marginTop: 6 }} />
          </div>
        </header>
        <div className="seasons-scroll-row">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton" style={{ width: 80, height: 34, borderRadius: 'var(--radius-pill)', flexShrink: 0 }} />
          ))}
        </div>
        <div className="episodes-progress-banner skeleton" style={{ height: 74, margin: '16px 16px 0' }} />
        <div className="episodes-content">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton ep-card-skeleton" style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
      </div>
    )
  }

  const showTitle = details?.name || 'TV Episodes'

  return (
    <div className="episodes-page">
      {/* Sticky Header */}
      <header className="episodes-header">
        <button
          className="episodes-back-btn"
          onClick={() => navigate(-1)}
          aria-label="Go back"
          type="button"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="episodes-header-title-box">
          <p className="episodes-header-show-title">{showTitle}</p>
          <h1 className="episodes-header-title">Track Episodes</h1>
        </div>
      </header>

      {/* Season Selection */}
      {seasons.length > 0 && (
        <div className="seasons-scroll-row" role="tablist" aria-label="Seasons">
          {seasons.map((s) => {
            const isActive = selectedSeason === s.season_number
            return (
              <button
                key={s.id}
                className={`season-pill-btn${isActive ? ' season-pill-btn--active' : ''}`}
                onClick={() => setSelectedSeason(s.season_number)}
                role="tab"
                aria-selected={isActive}
                type="button"
              >
                Season {s.season_number}
              </button>
            )
          })}
        </div>
      )}

      {/* Episode Checklist */}
      <SeasonChecklist
        tvId={tmdbId}
        seasonNumber={selectedSeason}
        tvTitle={showTitle}
        averageEpisodeRuntime={
          details?.episode_run_time?.[0]
            ? details.episode_run_time[0]
            : 30
        }
      />
    </div>
  )
}
