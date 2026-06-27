import { useEffect, useState, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  Heart,
  Star,
  Calendar,
  Film,
  Save,
  Trash2,
  Share2,
  Edit2,
  ChevronRight,
} from 'lucide-react'
import {
  collection,
  query as firestoreQuery,
  where,
  getDocs,
  limit,
  Timestamp,
} from 'firebase/firestore'

import { useAuth } from '@/features/auth/useAuth'
import { useWatchlistEntry } from '@/features/watchlist/hooks/useWatchlistEntry'
import { useWatchlist } from '@/features/watchlist/hooks/useWatchlist'
import { logHistoryEvent, deleteHistoryEvent } from '@/features/history/history'
import { db, COLLECTIONS } from '@/lib/firebase'
import {
  getMovieDetails,
  getTVDetails,
  getImageUrl,
} from '@/lib/tmdb'

import { BottomSheet } from '@/components/ui/BottomSheet'

import type { WatchStatus } from '@/types/app'
import type { TMDbMovie, TMDbTV } from '@/types/tmdb'
import './TitleDetailPage.css'

// ─── Constants & Options ──────────────────────────────────────────────────────

const STATUS_OPTS: { value: WatchStatus; label: string; emoji: string; desc: string; color: string }[] = [
  { value: 'watching',      label: 'Watching',      emoji: '👁', desc: 'Actively watching this title', color: 'var(--status-watching)' },
  { value: 'completed',     label: 'Completed',     emoji: '✓', desc: 'Finished watching this title', color: 'var(--status-completed)' },
  { value: 'plan_to_watch', label: 'Plan to Watch', emoji: '🕐', desc: 'Want to watch in the future', color: 'var(--status-plan)' },
  { value: 'dropped',       label: 'Dropped',       emoji: '✗', desc: 'Decided to stop watching', color: 'var(--status-dropped)' },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function TitleDetailPage() {
  const { id } = useParams<{ id: string }>() // Composite key 'movie:550' or 'tv:1396'
  const navigate = useNavigate()
  const { user } = useAuth()

  const [type, tmdbIdStr] = id?.split(':') ?? []
  const tmdbId = parseInt(tmdbIdStr || '', 10)
  const isMovie = type === 'movie'

  // ── Watchlist Hook ─────────────────────────────────────────────────────────
  const { entry, update, remove } = useWatchlistEntry(id || '')
  const { addEntry } = useWatchlist()

  // ── React Query: TMDB Details ──────────────────────────────────────────────
  const { data: details, isLoading: isDetailsLoading, isError } = useQuery<TMDbMovie | TMDbTV, Error>({
    queryKey: ['title-details', type, tmdbId] as const,
    queryFn: () => (isMovie ? getMovieDetails(tmdbId) : getTVDetails(tmdbId)),
    enabled: !!type && !isNaN(tmdbId),
    staleTime: 15 * 60 * 1000,
  })

  const movieDetails = details && isMovie ? details as TMDbMovie : null
  const tvDetails = details && !isMovie ? details as TMDbTV : null

  // ── Local Edit States ──────────────────────────────────────────────────────
  const [localNotes, setLocalNotes] = useState('')
  const [localReview, setLocalReview] = useState('')
  const [isSavingNotes, setIsSavingNotes] = useState(false)
  const [isSavingReview, setIsSavingReview] = useState(false)
  const [isOverviewCollapsed, setIsOverviewCollapsed] = useState(true)

  // Sheet Controls
  const [isStatusSheetOpen, setIsStatusSheetOpen] = useState(false)
  const [isRatingSheetOpen, setIsRatingSheetOpen] = useState(false)

  // Share Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const notesTextareaRef = useRef<HTMLTextAreaElement>(null)

  // Sync inputs
  useEffect(() => {
    if (entry) {
      setLocalNotes(entry.notes || '')
      setLocalReview(entry.review || '')
    }
  }, [entry])

  // Debounced notes autosave (800ms)
  useEffect(() => {
    if (!entry) return
    if (localNotes === (entry.notes || '')) return

    setIsSavingNotes(true)
    const timeout = setTimeout(async () => {
      try {
        await update({ notes: localNotes })
      } catch (err) {
        console.error(err)
      } finally {
        setIsSavingNotes(false)
      }
    }, 800)

    return () => clearTimeout(timeout)
  }, [localNotes, entry, update])

  // Computed fields
  const title = details
    ? (isMovie ? (details as TMDbMovie).title : (details as TMDbTV).name)
    : 'Details'

  const releaseYear = details
    ? parseInt(
        (isMovie ? (details as TMDbMovie).release_date : (details as TMDbTV).first_air_date)?.slice(0, 4) || '0'
      )
    : 0

  const backdrop = details ? getImageUrl(details.backdrop_path, 'original') : null
  const poster = details ? getImageUrl(details.poster_path, 'w500') : null
  const ratingAverage = details?.vote_average ? details.vote_average.toFixed(1) : null

  const runtimeString = useMemo(() => {
    if (isMovie && movieDetails) {
      const mins = movieDetails.runtime ?? 0
      if (!mins) return ''
      const hrs = Math.floor(mins / 60)
      const remainingMins = mins % 60
      return hrs > 0 ? `${hrs}h ${remainingMins}m` : `${mins}m`
    } else if (tvDetails) {
      const seasonsCount = tvDetails.number_of_seasons
      return `${seasonsCount} Season${seasonsCount > 1 ? 's' : ''}`
    }
    return ''
  }, [isMovie, movieDetails, tvDetails])

  // Toast
  const triggerToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 2500)
  }

  // Copy Link
  const handleShare = () => {
    void navigator.clipboard.writeText(window.location.href)
    triggerToast('Link copied to clipboard! 🔗')
  }

  // Toggling watchlist membership
  const handleAdd = async () => {
    if (!details || !user || !id) return
    try {
      await addEntry({
        titleId: id,
        type: isMovie ? 'movie' : 'tv',
        title,
        posterPath: details.poster_path,
        backdropPath: details.backdrop_path,
        year: releaseYear,
        genres: details.genres.map((g) => g.name),
        status: 'plan_to_watch',
      })
      triggerToast('Added to watchlist!')
    } catch (err) {
      console.error(err)
    }
  }

  const handleToggleFavorite = async () => {
    if (!entry) return
    await update({ isFavorite: !entry.isFavorite })
  }

  const handleStatusSelect = async (status: WatchStatus) => {
    if (!entry) return
    await update({ status })
    setIsStatusSheetOpen(false)
  }

  const handleRatingStarSelect = async (rate: number) => {
    if (!entry) return
    const newRating = entry.rating === rate ? null : rate
    await update({ rating: newRating })
  }

  const handleClearRating = async () => {
    if (!entry) return
    await update({ rating: null })
  }

  const handleReviewBlur = async () => {
    if (!entry) return
    if (localReview === (entry.review || '')) return
    setIsSavingReview(true)
    try {
      await update({ review: localReview })
    } catch (err) {
      console.error(err)
    } finally {
      setIsSavingReview(false)
    }
  }

  // Date picker handler
  const handleAddDate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value
    if (!rawVal || !entry || !user || !id) return
    try {
      const selectedDate = new Date(rawVal + 'T00:00:00') // Avoid timezone shift
      // Duplicate check
      const exists = entry.watchDates?.some((w) => {
        const d = (w as unknown as Timestamp).toDate()
        return d.toDateString() === selectedDate.toDateString()
      })

      if (exists) {
        triggerToast('Already logged this date.')
        return
      }

      const runtime = isMovie ? movieDetails?.runtime ?? 120 : 30
      await logHistoryEvent({
        userId: user.uid,
        titleId: id,
        title,
        type: isMovie ? 'movie' : 'tv_episode',
        episodeLabel: isMovie ? null : 'Rewatched',
        runtimeMinutes: runtime,
      })

      triggerToast('Watch date logged!')
    } catch (err) {
      console.error(err)
    }
  }

  const handleRemoveDate = async (ts: Timestamp) => {
    if (!entry || !user || !id) return
    try {
      const runtime = isMovie ? movieDetails?.runtime ?? 120 : 30
      // Find history doc to delete
      const historyColRef = collection(db, `users/${user.uid}/${COLLECTIONS.HISTORY}`)
      const q = firestoreQuery(
        historyColRef,
        where('titleId', '==', id),
        where('watchedAt', '==', ts),
        limit(1)
      )
      const snapshot = await getDocs(q)
      if (!snapshot.empty) {
        const docItem = snapshot.docs[0]!
        await deleteHistoryEvent(
          user.uid,
          docItem.id,
          id,
          isMovie ? 'movie' : 'tv_episode',
          runtime,
          ts
        )
        triggerToast('Watch date removed.')
      }
    } catch (err) {
      console.error(err)
    }
  }

  // TV Progress indicators
  const tvProgressLabel = useMemo(() => {
    if (!tvDetails || !entry) return ''
    return `${entry.episodesWatched} of ${tvDetails.number_of_episodes || '??'} episodes`
  }, [tvDetails, entry])

  const tvProgressBarPercent = useMemo(() => {
    if (!tvDetails || !entry || !tvDetails.number_of_episodes) return 0
    return Math.round((entry.episodesWatched / tvDetails.number_of_episodes) * 100)
  }, [tvDetails, entry])

  // Skeletons
  if (isDetailsLoading) {
    return (
      <div className="detail-page">
        <div className="skeleton skeleton-backdrop" />
        <div className="detail-header" style={{ marginTop: -50 }}>
          <div className="skeleton skeleton-poster-circle" />
          <div className="detail-meta" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="skeleton" style={{ height: 28, width: '70%', borderRadius: 4 }} />
            <div className="skeleton" style={{ height: 16, width: '40%', borderRadius: 4 }} />
          </div>
        </div>
        <div className="detail-body">
          <div className="skeleton" style={{ height: 140, borderRadius: 'var(--radius-lg)' }} />
        </div>
      </div>
    )
  }

  if (isError || !details) {
    return (
      <div className="detail-page" style={{ padding: 24, textAlign: 'center' }}>
        <p>Failed to load title details.</p>
        <button onClick={() => navigate(-1)} className="watchlist-empty-cta" style={{ marginTop: 12 }}>
          Go Back
        </button>
      </div>
    )
  }

  const currentStatusObj = entry ? STATUS_OPTS.find((o) => o.value === entry.status) : null

  return (
    <div className="detail-page animate-fade-in">

      {/* ── Hero Backdrop section ── */}
      <section className="detail-hero" aria-label="Hero visual">
        {backdrop ? (
          <img src={backdrop} alt={title} className="detail-hero-backdrop" />
        ) : (
          <div style={{ background: 'var(--bg-elevated)', width: '100%', height: '100%' }} />
        )}
        <div className="detail-hero-overlay" />

        {/* Back navigation */}
        <div className="detail-hero-actions-left">
          <button className="detail-hero-btn" onClick={() => navigate(-1)} aria-label="Go back" type="button">
            <ArrowLeft size={20} />
          </button>
        </div>

        {/* Action triggers */}
        <div className="detail-hero-actions-right">
          <button className="detail-hero-btn" onClick={handleShare} aria-label="Copy page link" type="button">
            <Share2 size={18} />
          </button>
          {entry && (
            <button
              className={`detail-hero-btn${entry.isFavorite ? ' detail-hero-btn--active' : ''}`}
              onClick={handleToggleFavorite}
              aria-label={entry.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              type="button"
            >
              <Heart size={18} fill={entry.isFavorite ? '#ff4757' : 'none'} />
            </button>
          )}
        </div>

        {/* Poster */}
        {poster ? (
          <img src={poster} alt={title} className="detail-hero-poster" />
        ) : (
          <div className="detail-hero-poster" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Film size={24} color="var(--text-muted)" />
          </div>
        )}
      </section>

      {/* ── Title block info ── */}
      <section className="detail-title-block">
        <h1 className="detail-main-title">{title}</h1>
        <div className="detail-meta-row">
          <span>{releaseYear > 0 ? releaseYear : '—'}</span>
          <span>·</span>
          <span>{runtimeString}</span>
          {ratingAverage && (
            <>
              <span>·</span>
              <span className="detail-rating-label">
                <Star size={11} fill="var(--star-filled)" stroke="none" />
                {ratingAverage}
              </span>
            </>
          )}
        </div>

        {/* Genres chip scroll */}
        <div className="detail-genres-scroll" aria-label="Genres">
          {details.genres.map((g) => (
            <span key={g.id} className="detail-genre-pill">
              {g.name}
            </span>
          ))}
        </div>

        {/* Status Badge */}
        {currentStatusObj && (
          <div className="detail-status-badge">
            <span className="detail-status-dot" style={{ background: currentStatusObj.color }} />
            <span>{currentStatusObj.label}</span>
          </div>
        )}
      </section>

      {/* ── Watchlist Guard banner ── */}
      {!entry ? (
        <div className="detail-sections-container" style={{ paddingTop: 16 }}>
          <div className="detail-card-section add-banner animate-fade-in">
            <p className="add-banner-text">Discovering this scene? Keep logs and watch checklists in your journal.</p>
            <button className="add-banner-btn" onClick={handleAdd} type="button">
              + Add to Watchlist
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Quick Actions Row */}
          <div className="detail-actions-row" role="group" aria-label="Quick title edits">
            <button className="detail-action-btn" onClick={() => setIsStatusSheetOpen(true)} type="button">
              <span>{currentStatusObj?.emoji || '📋'}</span>
              <span>{currentStatusObj?.label || 'Status'} ▾</span>
            </button>
            <button
              className={`detail-action-btn${entry.rating !== null ? ' detail-action-btn--active' : ''}`}
              onClick={() => setIsRatingSheetOpen(true)}
              type="button"
            >
              <Star size={16} fill={entry.rating !== null ? 'var(--star-filled)' : 'none'} />
              <span>{entry.rating !== null ? `${entry.rating} / 10` : 'Rate'}</span>
            </button>
            <button
              className={`detail-action-btn${entry.isFavorite ? ' detail-action-btn--active' : ''}`}
              onClick={handleToggleFavorite}
              type="button"
            >
              <Heart size={16} fill={entry.isFavorite ? '#ff4757' : 'none'} />
              <span>{entry.isFavorite ? 'Favorite' : 'Fav'}</span>
            </button>
            <button
              className="detail-action-btn"
              onClick={() => {
                notesTextareaRef.current?.focus()
                notesTextareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
              }}
              type="button"
            >
              <Edit2 size={16} />
              <span>Notes</span>
            </button>
          </div>

          {/* Core Sections Container */}
          <div className="detail-sections-container">

            {/* Overview */}
            <section className="detail-card-section">
              <h2 className="detail-section-lbl">Overview</h2>
              <p className={`overview-text${isOverviewCollapsed ? ' overview-text--collapsed' : ''}`}>
                {details.overview || 'No overview description available.'}
              </p>
              {details.overview && details.overview.length > 140 && (
                <button
                  className="overview-toggle-btn"
                  onClick={() => setIsOverviewCollapsed(!isOverviewCollapsed)}
                  type="button"
                >
                  {isOverviewCollapsed ? 'Read more' : 'Show less'}
                </button>
              )}
            </section>

            {/* TV Progress tracker bar */}
            {!isMovie && tvDetails && (
              <section className="detail-card-section animate-fade-in">
                <h2 className="detail-section-lbl">Episode Progress</h2>
                <p className="progress-summary">{tvProgressLabel}</p>
                <div className="season-progress-bar-bg">
                  <div className="season-progress-bar-fg" style={{ width: `${tvProgressBarPercent}%` }} />
                </div>
                <button
                  className="progress-track-btn"
                  onClick={() => navigate(`/watchlist/${encodeURIComponent(id || '')}/episodes`)}
                  type="button"
                >
                  <span>Track Episodes</span>
                  <ChevronRight size={16} />
                </button>
              </section>
            )}

            {/* Notes Section */}
            <section className="detail-card-section">
              <h2 className="detail-section-lbl">
                <Edit2 size={12} />
                Personal Notes
              </h2>
              <div className="notes-textarea-container">
                <textarea
                  ref={notesTextareaRef}
                  className="notes-textarea"
                  value={localNotes}
                  onChange={(e) => setLocalNotes(e.target.value)}
                  placeholder="Tap to add your thoughts..."
                  maxLength={1000}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                    {isSavingNotes && 'Saving edits…'}
                  </span>
                  <span className="notes-char-count">{localNotes.length} / 1000 characters</span>
                </div>
              </div>
            </section>

            {/* Review Section */}
            <section className="detail-card-section">
              <h2 className="detail-section-lbl">One-line Review</h2>
              <div className="review-input-wrapper">
                <input
                  type="text"
                  maxLength={160}
                  className="review-input"
                  value={localReview}
                  onChange={(e) => setLocalReview(e.target.value)}
                  onBlur={handleReviewBlur}
                  placeholder="Draft a single-line review sentence..."
                  aria-label="One line review"
                />
                {isSavingReview && (
                  <span className="saving-indicator" style={{ position: 'absolute', right: 12, top: 12 }}>
                    <Save size={12} />
                  </span>
                )}
              </div>
            </section>

            {/* Cast Section */}
            {details.credits?.cast && details.credits.cast.length > 0 && (
              <section className="detail-card-section">
                <h2 className="detail-section-lbl">Top Cast</h2>
                <div className="cast-rail" role="list">
                  {details.credits.cast.slice(0, 10).map((cast) => {
                    const avatar = getImageUrl(cast.profile_path, 'w200')
                    return (
                      <div key={cast.id} className="cast-card" role="listitem">
                        {avatar ? (
                          <img src={avatar} alt={cast.name} className="cast-avatar" loading="lazy" />
                        ) : (
                          <div className="cast-avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
                            <span>👤</span>
                          </div>
                        )}
                        <p className="cast-name">{cast.name}</p>
                        <p className="cast-character">{cast.character}</p>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* Similar Titles */}
            {details.similar?.results && details.similar.results.length > 0 && (
              <section className="detail-card-section">
                <h2 className="detail-section-lbl">More Like This</h2>
                <div className="similar-rail">
                  {details.similar.results.slice(0, 8).map((sim) => {
                    const simPoster = getImageUrl(sim.poster_path, 'w200')
                    const simTitle = sim.title ?? sim.name ?? 'Untitled'
                    const simId = `${sim.media_type || (isMovie ? 'movie' : 'tv')}:${sim.id}`

                    return (
                      <div
                        key={sim.id}
                        className="similar-card"
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate(`/watchlist/${encodeURIComponent(simId)}`)}
                        onKeyDown={(e) => e.key === 'Enter' && navigate(`/watchlist/${encodeURIComponent(simId)}`)}
                        aria-label={simTitle}
                      >
                        {simPoster ? (
                          <img src={simPoster} alt={simTitle} className="similar-poster" loading="lazy" />
                        ) : (
                          <div className="similar-poster" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Film size={18} color="var(--text-muted)" />
                          </div>
                        )}
                        <p className="similar-title">{simTitle}</p>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* Watch Dates section */}
            <section className="detail-card-section">
              <h2 className="detail-section-lbl">
                <Calendar size={12} />
                Watched on
              </h2>
              <div className="dates-chips-row" role="group" aria-label="Log dates">
                {entry.watchDates && entry.watchDates.length > 0 ? (
                  entry.watchDates
                    .map((w) => w as unknown as Timestamp)
                    .sort((a, b) => b.seconds - a.seconds) // Newest first
                    .map((ts, idx) => {
                      const date = ts.toDate()
                      return (
                        <span key={idx} className="date-chip">
                          <span>{date.toLocaleDateString()}</span>
                          <button
                            className="date-chip-remove"
                            onClick={() => handleRemoveDate(ts)}
                            aria-label={`Remove watch log date ${date.toLocaleDateString()}`}
                            type="button"
                          >
                            <Trash2 size={12} />
                          </button>
                        </span>
                      )
                    })
                ) : (
                  <p className="notes-placeholder" style={{ margin: 0, padding: 0 }}>No watch sessions logged yet.</p>
                )}
              </div>

              {/* Add watch date input wrapper */}
              <div className="date-add-trigger">
                <button className="watch-date-add-btn" type="button" style={{ width: 'auto', padding: '8px 16px' }}>
                  <span>+ Add watch date</span>
                  <input
                    type="date"
                    className="date-add-input"
                    onChange={handleAddDate}
                    max={new Date().toISOString().slice(0, 10)}
                    aria-label="Select watch date"
                  />
                </button>
              </div>
            </section>

            {/* Delete button card */}
            <button
              onClick={() => {
                if (confirm('Are you sure you want to remove this title from your watchlist?')) {
                  void remove()
                }
              }}
              style={{
                width: '100%',
                padding: 12,
                borderRadius: 'var(--radius-lg)',
                border: '1.5px solid var(--color-error)',
                background: 'transparent',
                color: 'var(--color-error)',
                fontWeight: 600,
                fontFamily: 'var(--font-family)',
                fontSize: 'var(--text-sm)',
                cursor: 'pointer',
                transition: 'background var(--transition-fast)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(192, 57, 43, 0.08)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              type="button"
            >
              Remove from Watchlist
            </button>
          </div>
        </>
      )}

      {/* ── Status Picker bottom sheet ── */}
      <BottomSheet
        isOpen={isStatusSheetOpen}
        onClose={() => setIsStatusSheetOpen(false)}
        label="Select Watch Status"
      >
        <div className="status-sheet-content">
          <p className="filter-sheet-title" style={{ padding: '0 0 16px' }}>Update Status</p>
          <div className="status-picker-list" role="radiogroup" aria-label="Watch Status Options">
            {STATUS_OPTS.map((opt) => {
              const isActive = entry?.status === opt.value
              return (
                <div
                  key={opt.value}
                  className={`status-picker-item${isActive ? ' status-picker-item--active' : ''}`}
                  onClick={() => handleStatusSelect(opt.value)}
                  role="radio"
                  aria-checked={isActive}
                >
                  <div className="status-picker-icon-box" style={{ background: opt.color, color: '#fff' }} aria-hidden="true">
                    <span>{opt.emoji}</span>
                  </div>
                  <div className="status-picker-details">
                    <p className="status-picker-label">{opt.label}</p>
                    <p className="status-picker-desc">{opt.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </BottomSheet>

      {/* ── Rating Picker bottom sheet ── */}
      <BottomSheet
        isOpen={isRatingSheetOpen}
        onClose={() => setIsRatingSheetOpen(false)}
        label="Select Rating"
      >
        <div className="rating-sheet-content">
          <p className="filter-sheet-title" style={{ padding: '0 0 12px' }}>Your Rating</p>

          <div className="rating-sheet-stars" aria-label="Rate out of 10 stars">
            {Array.from({ length: 10 }).map((_, idx) => {
              const val = idx + 1
              const isActive = (entry?.rating ?? 0) >= val
              return (
                <span
                  key={val}
                  className={`rating-sheet-star-item${isActive ? ' rating-sheet-star-filled' : ''}`}
                  onClick={() => handleRatingStarSelect(val)}
                  aria-label={`Star ${val}`}
                  role="button"
                >
                  <Star size={30} fill={isActive ? 'var(--star-filled)' : 'none'} />
                </span>
              )
            })}
          </div>

          <p className="rating-sheet-value">
            {entry?.rating !== null && entry?.rating !== undefined
              ? `${entry.rating} / 10`
              : 'Not Rated'}
          </p>

          <button className="rating-sheet-clear-btn" onClick={handleClearRating} type="button">
            Clear rating
          </button>
        </div>
      </BottomSheet>

      {/* ── Toast message banner ── */}
      {toastMessage && (
        <div className="toast" role="status" aria-live="polite">
          {toastMessage}
        </div>
      )}
    </div>
  )
}
