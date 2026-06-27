import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'

import { useWatchlistEntry } from '@/features/watchlist/hooks/useWatchlistEntry'
import { useTVProgress } from '@/features/watchlist/hooks/useTVProgress'
import { getTVDetails, getTVSeason } from '@/lib/tmdb'

import type { TMDbTV } from '@/types/tmdb'
import './TVEpisodesPage.css'
import './TitleDetailPage.css' // Reuse SeasonChecklist progress/episode items styling

// ─── Sub-components ───────────────────────────────────────────────────────────

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

  const watchedCount = useMemo(() => {
    if (!seasonData) return 0
    const pad = (n: number) => String(n).padStart(2, '0')
    const seasonStr = pad(seasonNumber)
    return episodes.filter((ep) =>
      watchedEpisodes.has(`S${seasonStr}E${pad(ep.episode_number)}`),
    ).length
  }, [seasonData, watchedEpisodes, episodes, seasonNumber])

  const progressPercent = total > 0 ? Math.round((watchedCount / total) * 100) : 0

  if (isSeasonLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div className="skeleton" style={{ height: 24, borderRadius: 'var(--radius-sm)' }} />
        <div className="skeleton" style={{ height: 240, borderRadius: 'var(--radius-md)' }} />
      </div>
    )
  }

  const pad = (n: number) => String(n).padStart(2, '0')

  return (
    <div>
      {/* Progress Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 8 }}>
        <span>Progress</span>
        <span>{watchedCount} / {total} Episodes ({progressPercent}%)</span>
      </div>
      <div className="season-progress-bar-bg" style={{ marginBottom: 20 }}>
        <div className="season-progress-bar-fg" style={{ width: `${progressPercent}%` }} />
      </div>

      {/* Episode Checklist */}
      <div className="episode-list" role="group" aria-label={`Season ${seasonNumber} Checklist`}>
        {episodes.map((ep) => {
          const episodeCode = `S${pad(seasonNumber)}E${pad(ep.episode_number)}`
          const isChecked = watchedEpisodes.has(episodeCode)

          return (
            <div
              key={ep.id}
              className="episode-item animate-fade-in"
              onClick={() => toggleEpisode(seasonNumber, ep.episode_number, ep.runtime ?? averageEpisodeRuntime)}
            >
              <div className="episode-checkbox-wrapper">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => {}} // Driven by card parent container click
                  className="episode-checkbox"
                  aria-label={`Mark Episode ${ep.episode_number}: ${ep.name} as watched`}
                />
              </div>
              <div className="episode-info">
                <div className="episode-title-row">
                  <span className="episode-code">{episodeCode}</span>
                  <span className="episode-name">{ep.name || `Episode ${ep.episode_number}`}</span>
                </div>
                {ep.air_date && (
                  <p className="episode-air-date">Air date: {new Date(ep.air_date).toLocaleDateString()}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TVEpisodesPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [type, tmdbIdStr] = id?.split(':') ?? []
  const tmdbId = parseInt(tmdbIdStr || '', 10)

  // Load parent TV details
  const { data: details, isLoading: isDetailsLoading } = useQuery<TMDbTV, Error>({
    queryKey: ['title-details', 'tv', tmdbId] as const,
    queryFn: () => getTVDetails(tmdbId),
    enabled: type === 'tv' && !isNaN(tmdbId),
    staleTime: 15 * 60 * 1000,
  })

  // Load watchlist entry
  const { entry } = useWatchlistEntry(id || '')

  const [selectedSeason, setSelectedSeason] = useState(entry?.currentSeason || 1)

  const seasons = details?.seasons
    ? details.seasons.filter((s) => s.season_number > 0)
    : []

  if (isDetailsLoading) {
    return (
      <div className="episodes-page">
        <header className="episodes-header">
          <div className="skeleton" style={{ width: 24, height: 24, borderRadius: '50%' }} />
          <div className="episodes-header-title-box">
            <div className="skeleton" style={{ height: 12, width: '40%', borderRadius: 4 }} />
            <div className="skeleton" style={{ height: 18, width: '60%', borderRadius: 4, marginTop: 4 }} />
          </div>
        </header>
        <div className="episodes-content">
          <div className="skeleton" style={{ height: 120, borderRadius: 'var(--radius-lg)' }} />
        </div>
      </div>
    )
  }

  const showTitle = details?.name || 'TV Episodes'

  return (
    <div className="episodes-page">
      {/* Header */}
      <header className="episodes-header">
        <button className="episodes-back-btn" onClick={() => navigate(-1)} aria-label="Go back" type="button">
          <ArrowLeft size={20} />
        </button>
        <div className="episodes-header-title-box">
          <p className="episodes-header-show-title">{showTitle}</p>
          <h1 className="episodes-header-title">Track Episodes</h1>
        </div>
      </header>

      {/* Season Selection Row */}
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
      <main className="episodes-content">
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
      </main>
    </div>
  )
}
