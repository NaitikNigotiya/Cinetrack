import { useEffect, useState, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ChevronDown, Film, EyeOff, Eye } from 'lucide-react'

import { useWatchlistEntry } from '@/features/watchlist/hooks/useWatchlistEntry'
import { useEpisodeProgress } from '@/features/episodes/hooks/useEpisodeProgress'
import { useTVSeasons } from '@/features/episodes/hooks/useTVSeasons'
import { getTVDetails, getImageUrl } from '@/lib/tmdb'

import { triggerConfetti } from '@/components/ui/Confetti'

import type { TMDbTV } from '@/types/tmdb'
import './EpisodeTrackerPage.css'

// ─── Sub-components ───────────────────────────────────────────────────────────

interface EpisodeRowProps {
  episode: {
    episode_number: number
    name: string
    air_date: string | null
    runtime: number | null
  }
  isWatched: boolean
  isFocused: boolean
  spoilerFree: boolean
  isNextToWatch: boolean
  onToggle: () => void
  onFocus: () => void
}

function EpisodeRow({
  episode,
  isWatched,
  isFocused,
  spoilerFree,
  isNextToWatch,
  onToggle,
  onFocus,
}: EpisodeRowProps) {
  const rowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isFocused) {
      rowRef.current?.focus()
    }
  }, [isFocused])

  const epCode = `E${String(episode.episode_number).padStart(2, '0')}`
  const nameDisplay = spoilerFree ? `Episode ${episode.episode_number}` : episode.name
  const dateLabel = episode.air_date ? new Date(episode.air_date).toLocaleDateString() : 'No air date'

  return (
    <div
      ref={rowRef}
      className="tracker-episode-row"
      tabIndex={0}
      onClick={onToggle}
      onFocus={onFocus}
      onKeyDown={(e) => {
        if (e.key === ' ') {
          e.preventDefault()
          onToggle()
        }
      }}
      role="checkbox"
      aria-checked={isWatched}
      aria-label={`${epCode}: ${nameDisplay}`}
      style={{
        borderColor: isNextToWatch ? 'var(--color-brand)' : undefined,
        background: isNextToWatch ? 'color-mix(in srgb, var(--color-brand) 6%, transparent)' : undefined,
      }}
    >
      <div className="tracker-episode-checkbox-wrapper">
        <input
          type="checkbox"
          checked={isWatched}
          onChange={() => {}} // Driven by parent click handler
          className="tracker-episode-checkbox"
          tabIndex={-1}
        />
      </div>

      <span className="tracker-episode-code">{epCode}</span>

      {isNextToWatch && (
        <span style={{
          fontSize: '9px', fontWeight: 800, letterSpacing: '1px',
          background: 'var(--color-brand)', color: 'var(--text-on-brand)',
          padding: '2px 6px', borderRadius: '999px', flexShrink: 0,
          textTransform: 'uppercase',
        }}>Next</span>
      )}

      <div className="tracker-episode-main-info">
        <div className="tracker-episode-name-row">
          <span className="tracker-episode-name">{nameDisplay}</span>
          {episode.runtime && (
            <span className="tracker-episode-runtime">{episode.runtime}m</span>
          )}
        </div>
        <p className="tracker-episode-air-date">{dateLabel}</p>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EpisodeTrackerPage() {
  const { titleId, id: paramId } = useParams<{ titleId?: string; id?: string }>()
  const id = titleId || paramId
  const navigate = useNavigate()

  const [type, tmdbIdStr] = id?.split(':') ?? []
  const tmdbId = parseInt(tmdbIdStr || '', 10)
  const isTv = type === 'tv'

  // Redirect if not a TV show
  useEffect(() => {
    if (id && !isTv) {
      alert('Episode tracking is only available for TV shows.')
      navigate(`/title/${encodeURIComponent(id)}`, { replace: true })
    }
  }, [id, isTv, navigate])

  // ── TMDb TV details query ──
  const { data: details, isLoading: isDetailsLoading } = useQuery<TMDbTV, Error>({
    queryKey: ['title-details', 'tv', tmdbId] as const,
    queryFn: () => getTVDetails(tmdbId),
    enabled: isTv && !isNaN(tmdbId),
    staleTime: 15 * 60 * 1000,
  })

  // Watchlist entry
  const { entry, update } = useWatchlistEntry(id || '')

  // ── Seasons parallel queries ──
  const seasonNumbers = useMemo(() => {
    if (!details) return []
    return details.seasons.filter((s) => s.season_number > 0).map((s) => s.season_number)
  }, [details])

  const { data: seasonsDetails, isLoading: isSeasonsLoading } = useTVSeasons(tmdbId, seasonNumbers)

  // Episode checklist states
  const {
    seasons: seasonsProgress,
    updateEpisode,
    markSeasonComplete,
    markSeasonIncomplete,
    totalWatched,
    totalEpisodes,
    isLoading: isProgressLoading,
  } = useEpisodeProgress(id || '', details)

  // Local UI State
  const [openSeasons, setOpenSeasons] = useState<Record<number, boolean>>({})
  const [spoilerFree, setSpoilerFree] = useState(() => {
    return localStorage.getItem('cinetrack-spoiler-free') === 'true'
  })
  const [focusedEpisodeIndex, setFocusedEpisodeIndex] = useState<number | null>(null)
  const [activeSeasonNumber, setActiveSeasonNumber] = useState<number | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Trigger Toast
  const triggerToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  // Toggle season accordion
  const toggleSeasonOpen = (num: number) => {
    setOpenSeasons((prev) => ({ ...prev, [num]: !prev[num] }))
    setFocusedEpisodeIndex(null)
    setActiveSeasonNumber(num)
  }

  // Memoize flat array of episodes for the active season to support Arrow navigation
  const activeSeasonEpisodes = useMemo(() => {
    if (activeSeasonNumber === null || !seasonsDetails) return []
    const season = seasonsDetails.find((s) => s.season_number === activeSeasonNumber)
    return season?.episodes ?? []
  }, [activeSeasonNumber, seasonsDetails])

  // Keydown handlers for arrow key lists navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeSeasonNumber === null || activeSeasonEpisodes.length === 0) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setFocusedEpisodeIndex((prev) => {
          if (prev === null) return 0
          return Math.min(prev + 1, activeSeasonEpisodes.length - 1)
        })
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setFocusedEpisodeIndex((prev) => {
          if (prev === null) return 0
          return Math.max(prev - 1, 0)
        })
      }
    };

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeSeasonNumber, activeSeasonEpisodes])

  const toggleSpoilerFree = () => {
    const newVal = !spoilerFree
    setSpoilerFree(newVal)
    localStorage.setItem('cinetrack-spoiler-free', String(newVal))
  }

  // Handle single episode checks
  const handleToggleEpisode = async (seasonNum: number, episodeNum: number, runtime: number) => {
    const progress = seasonsProgress.find((s) => s.seasonNumber === seasonNum)
    if (!progress) return

    const isWatched = progress.episodesWatched.includes(episodeNum)
    const wouldBeComplete = !isWatched && progress.episodesWatched.length + 1 === progress.totalEpisodes

    try {
      await updateEpisode(seasonNum, episodeNum, !isWatched, runtime)

      if (wouldBeComplete) {
        // Season completion celebration!
        triggerConfetti('season')
        triggerToast(`Season ${seasonNum} complete! 🎉`)

        // Check if this completes the entire show
        const otherSeasonsComplete = seasonsProgress
          .filter((s) => s.seasonNumber !== seasonNum)
          .every((s) => s.completed)

        if (otherSeasonsComplete) {
          triggerConfetti('show')
          triggerToast(`Series complete! Amazing job! 🏆`)
          if (entry && entry.status !== 'completed') {
            await update({ status: 'completed' })
          }
        }
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleMarkAll = async (seasonNum: number) => {
    const seasonDetail = seasonsDetails?.find((s) => s.season_number === seasonNum)
    if (!seasonDetail) return
    const episodes = seasonDetail.episodes.map((e) => ({
      episode_number: e.episode_number,
      runtime: e.runtime,
    }))

    try {
      await markSeasonComplete(seasonNum, episodes)
      triggerConfetti('season')
      triggerToast(`Season ${seasonNum} complete! 🎉`)

      // Check if this completes the entire show
      const otherSeasonsComplete = seasonsProgress
        .filter((s) => s.seasonNumber !== seasonNum)
        .every((s) => s.completed)

      if (otherSeasonsComplete) {
        triggerConfetti('show')
        triggerToast(`Series complete! Amazing job! 🏆`)
        if (entry && entry.status !== 'completed') {
          await update({ status: 'completed' })
        }
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleUnmarkAll = async (seasonNum: number) => {
    const seasonDetail = seasonsDetails?.find((s) => s.season_number === seasonNum)
    if (!seasonDetail) return
    const episodes = seasonDetail.episodes.map((e) => ({
      episode_number: e.episode_number,
      runtime: e.runtime,
    }))

    try {
      await markSeasonIncomplete(seasonNum, episodes)
      triggerToast(`Season ${seasonNum} progress cleared.`)
    } catch (err) {
      console.error(err)
    }
  }

  // Calculations
  const averageEpisodeRuntime = details?.episode_run_time?.[0] ?? 30
  const totalMinutesWatched = totalWatched * averageEpisodeRuntime
  const hoursWatched = Math.floor(totalMinutesWatched / 60)
  const remainingMins = totalMinutesWatched % 60
  const progressPercent = totalEpisodes > 0 ? Math.round((totalWatched / totalEpisodes) * 100) : 0

  const activeSeasonLabel = useMemo(() => {
    if (!entry) return ''
    return `Season ${entry.currentSeason || 1} of ${seasonsProgress.length}`
  }, [entry, seasonsProgress])

  // Loading indicator screen
  const isPageLoading = isDetailsLoading || isSeasonsLoading || isProgressLoading

  if (isPageLoading) {
    return (
      <div className="episodes-page">
        <header className="episodes-header">
          <div className="skeleton" style={{ width: 24, height: 24, borderRadius: '50%' }} />
          <div className="episodes-header-title-box">
            <div className="skeleton" style={{ height: 12, width: '45%', borderRadius: 4 }} />
            <div className="skeleton" style={{ height: 18, width: '65%', borderRadius: 4, marginTop: 4 }} />
          </div>
        </header>
        <div className="episodes-content">
          <div className="skeleton" style={{ height: 140, borderRadius: 'var(--radius-lg)', marginBottom: 12 }} />
          <div className="skeleton" style={{ height: 60, borderRadius: 'var(--radius-md)', marginBottom: 12 }} />
          <div className="skeleton" style={{ height: 60, borderRadius: 'var(--radius-md)' }} />
        </div>
      </div>
    )
  }

  const showTitle = details?.name || 'Episode Tracker'

  return (
    <div className="episodes-page animate-fade-in">
      {/* ── Header ── */}
      <header className="episodes-header">
        <button className="episodes-back-btn" onClick={() => navigate(-1)} aria-label="Go back" type="button">
          <ArrowLeft size={20} />
        </button>
        <div className="episodes-header-title-box">
          <p className="episodes-header-show-title">{showTitle}</p>
          <h1 className="episodes-header-title">Episode Tracker</h1>
        </div>

        {/* Spoiler Toggle button */}
        <button
          className="detail-hero-btn"
          onClick={toggleSpoilerFree}
          title={spoilerFree ? 'Show episode titles' : 'Hide episode titles (Spoiler-free)'}
          style={{ width: 32, height: 32 }}
          aria-label={spoilerFree ? 'Show episode titles' : 'Hide episode titles (Spoiler-free)'}
          type="button"
        >
          {spoilerFree ? <Eye size={16} /> : <EyeOff size={16} />}
        </button>
      </header>

      {/* ── Progress Section ── */}
      <section className="detail-sections-container" style={{ paddingBottom: 0 }}>
        <div className="detail-card-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {totalWatched} / {totalEpisodes} episodes · {activeSeasonLabel}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Watched ~{hoursWatched}h {remainingMins}m
            </span>
          </div>

          {/* Large Progress Bar */}
          <div className="season-progress-bar-bg" style={{ height: 6 }}>
            <div className="season-progress-bar-fg" style={{ width: `${progressPercent}%` }} />
          </div>
          <p style={{ textAlign: 'right', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            {progressPercent}% Complete
          </p>
        </div>
      </section>

      {/* ── Season Accordions list ── */}
      <main className="episodes-content">
        {seasonsProgress.map((season) => {
          const sNumber = season.seasonNumber
          const isOpen = !!openSeasons[sNumber]
          const isComplete = season.completed

          // Find corresponding season metadata from TMDB Details
          const seasonMeta = details?.seasons.find((sm) => sm.season_number === sNumber)
          const seasonPoster = seasonMeta?.poster_path ? getImageUrl(seasonMeta.poster_path, 'w200') : null

          // Find season episodes list fetched from TMDB Seasons Query
          const seasonDetail = seasonsDetails?.find((sd) => sd.season_number === sNumber)
          const episodes = seasonDetail?.episodes ?? []

          const badgeClass = isComplete
            ? 'accordion-completion-badge--complete'
            : 'accordion-completion-badge--partial'

          const progressText = isComplete
            ? '✓ Complete'
            : `${season.episodesWatched.length} / ${season.totalEpisodes} watched`

          const seasonProgressPercent =
            season.totalEpisodes > 0
              ? Math.round((season.episodesWatched.length / season.totalEpisodes) * 100)
              : 0

          return (
            <div key={sNumber} className={`accordion-item${isOpen ? ' accordion-item--open' : ''}`}>
              {/* Closed Accordion Header */}
              <div
                className="accordion-header"
                onClick={() => toggleSeasonOpen(sNumber)}
                role="button"
                aria-expanded={isOpen}
                aria-controls={`season-panel-${sNumber}`}
              >
                {seasonPoster ? (
                  <img src={seasonPoster} alt={`Season ${sNumber}`} className="accordion-poster" loading="lazy" />
                ) : (
                  <div className="accordion-poster" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Film size={16} color="var(--text-muted)" />
                  </div>
                )}

                <div className="accordion-header-details">
                  <div className="accordion-title-row">
                    <span className="accordion-season-title">Season {sNumber}</span>
                    <span className="accordion-episode-count">
                      · {season.totalEpisodes} episodes
                    </span>
                    <span className={`accordion-completion-badge ${badgeClass}`}>
                      {progressText}
                    </span>
                  </div>

                  {/* Season mini progress bar */}
                  <div className="accordion-mini-bar-bg">
                    <div className="accordion-mini-bar-fg" style={{ width: `${seasonProgressPercent}%` }} />
                  </div>
                </div>

                <ChevronDown
                  size={18}
                  className={`accordion-chevron-icon${isOpen ? ' accordion-chevron-icon--open' : ''}`}
                  aria-hidden="true"
                />
              </div>

              {/* Opened Accordion Content */}
              {isOpen && (
                <div id={`season-panel-${sNumber}`} className="accordion-content" role="region">
                  <div className="accordion-bulk-row">
                    <button
                      className="accordion-bulk-btn"
                      onClick={() => handleMarkAll(sNumber)}
                      type="button"
                    >
                      ✓ Mark all watched
                    </button>
                    <button
                      className="accordion-bulk-btn"
                      onClick={() => handleUnmarkAll(sNumber)}
                      type="button"
                    >
                      ✗ Clear all
                    </button>
                  </div>

                  {/* Episodes Rows Checklist */}
                  <div className="tracker-episode-list">
                    {episodes.map((ep, idx) => {
                      const isWatched = season.episodesWatched.includes(ep.episode_number)
                      const isFocused = activeSeasonNumber === sNumber && focusedEpisodeIndex === idx

                      const unwatchedEpisodes = episodes.filter(e => !season.episodesWatched.includes(e.episode_number))
                      const nextUnwatchedNum = unwatchedEpisodes.length > 0
                        ? Math.min(...unwatchedEpisodes.map(e => e.episode_number))
                        : null
                      const isNextToWatch = !season.completed && 
                        nextUnwatchedNum !== null &&
                        ep.episode_number === nextUnwatchedNum

                      return (
                        <EpisodeRow
                          key={ep.id}
                          episode={ep}
                          isWatched={isWatched}
                          isFocused={isFocused}
                          spoilerFree={spoilerFree}
                          isNextToWatch={isNextToWatch}
                          onToggle={() =>
                            handleToggleEpisode(
                              sNumber,
                              ep.episode_number,
                              ep.runtime ?? averageEpisodeRuntime
                            )
                          }
                          onFocus={() => {
                            setActiveSeasonNumber(sNumber)
                            setFocusedEpisodeIndex(idx)
                          }}
                        />
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </main>

      {/* ── Toast notifications ── */}
      {toastMessage && (
        <div className="toast animate-slide-up" role="status" aria-live="polite">
          {toastMessage}
        </div>
      )}
    </div>
  )
}
