import { useEffect, useState, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ChevronLeft,
  Heart,
  Star,
  Play,
  Check,
  Plus,
  Trash2,
  Edit,
  MoreHorizontal,
  Lightbulb,
  Film,
} from 'lucide-react'
import {
  collection,
  query as firestoreQuery,
  where,
  getDocs,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  limit,
} from 'firebase/firestore'

import { useAuth } from '@/features/auth/useAuth'
import { useWatchlistEntry } from '@/features/watchlist/hooks/useWatchlistEntry'
import { useWatchlist } from '@/features/watchlist/hooks/useWatchlist'
import { useWatchlistStore } from '@/features/watchlist/watchlistStore'
import { logHistoryEvent, deleteHistoryEvent } from '@/features/history/history'
import { db, COLLECTIONS } from '@/lib/firebase'
import {
  getMovieDetails,
  getTVDetails,
  getImageUrl,
  getTitleImages,
} from '@/lib/tmdb'

import { BottomSheet } from '@/components/ui/BottomSheet'

import type { WatchStatus } from '@/types/app'
import type { TMDbMovie, TMDbTV } from '@/types/tmdb'
import './TitleDetailPage.css'

// ─── Constants & Options ──────────────────────────────────────────────────────

const STATUS_OPTS: { value: WatchStatus; label: string; emoji: string; desc: string; color: string }[] = [
  { value: 'watching', label: 'Watching', emoji: '👁', desc: 'Actively watching this title', color: 'var(--status-watching)' },
  { value: 'completed', label: 'Completed', emoji: '✓', desc: 'Finished watching this title', color: 'var(--status-completed)' },
  { value: 'plan_to_watch', label: 'Plan to Watch', emoji: '🕐', desc: 'Want to watch in the future', color: 'var(--status-plan)' },
  { value: 'dropped', label: 'Dropped', emoji: '✗', desc: 'Decided to stop watching', color: 'var(--status-dropped)' },
]

// Hardcoded trivia facts for popular movies
const TRIVIA_DATABASE: Record<number, string[]> = {
  550: [
    "Brad Pitt and Edward Norton actually learned how to make real soap for the film.",
    "The warning screen at the beginning of the movie contains a hidden message from Tyler Durden.",
    "Brad Pitt chipped his front tooth for the role to match Tyler's chaotic look.",
    "Fight Club's author, Chuck Palahniuk, has stated that he thinks the movie is an improvement on his novel.",
    "A CGI coffee cup is hidden in almost every single scene of the movie."
  ],
  278: [
    "Though it was a box office disappointment initially, it became one of the most beloved films of all time through home rentals.",
    "The mugshots of young Red are actually photos of Morgan Freeman's son, Alfonso.",
    "Clint Eastwood, Harrison Ford, and Paul Newman were all considered for the role of Red.",
    "Stephen King sold the film rights to his novella for $5,600, but he never cashed the check.",
    "The iconic sewer crawl was actually done in chocolate syrup diluted with water."
  ],
  238: [
    "Marlon Brando wanted to make Don Corleone look like a bulldog, so he wore a custom mouthpiece.",
    "Al Pacino boycotted the Academy Awards because he was nominated for Supporting Actor while Marlon Brando got Best Actor.",
    "The horse head used in the film was real; the production got it from a dog food company.",
    "The cat held by Marlon Brando in the opening scene was a stray found in the studio lot.",
    "The term 'Godfather' was not widely used by actual mobsters before the book and movie popularized it."
  ],
  155: [
    "Heath Ledger lived alone in a hotel room for a month to formulate the Joker's psychotic personality.",
    "This was the first comic book film to reach the billion-dollar milestone at the box office.",
    "Christopher Nolan chose to shoot several key sequences in IMAX format.",
    "Christian Bale did all of his own stunt driving during the Batpod chases.",
    "The Joker's makeup design was based on Ledger's own collaboration with makeup artists."
  ],
  496243: [
    "It became the first non-English language film to win the Academy Award for Best Picture.",
    "The wealthy family's house was entirely constructed on an outdoor set by a production designer.",
    "Director Bong Joon Ho drew inspiration from his own college years working as a tutor.",
    "The famous 'Jessica Song' was adapted from a real Korean school mnemonic.",
    "Bong Joon Ho initially conceived the idea as a stage play."
  ],
  872585: [
    "No CGI was used for the recreation of the Trinity nuclear test scene.",
    "Cillian Murphy lost significant weight to match J. Robert Oppenheimer's famously thin physique.",
    "The film was shot on large-format IMAX film, including custom-developed black-and-white IMAX stock.",
    "Christopher Nolan's screenplay was uniquely written in the first-person perspective.",
    "It is the highest-grossing biographical film of all time."
  ]
}

// Streaming platform configurations
const PROVIDERS = [
  { name: 'Netflix', color: '#E50914' },
  { name: 'Prime Video', color: '#00A8E1' },
  { name: 'Apple TV', color: '#1A1A1A' },
  { name: 'Disney+', color: '#113CCF' }
]

// Types for Custom Reviews
interface UserReview {
  id: string
  title: string
  year: string
  rating: number
  reviewText: string
  tags: string[]
  createdAt?: Timestamp
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TitleDetailPage() {
  const { id: paramId, titleId } = useParams<{ id?: string; titleId?: string }>()
  const routeId = titleId || paramId || ''
  const navigate = useNavigate()
  const { user } = useAuth()

  const [type, tmdbIdStr] = routeId.split(':')
  const tmdbId = parseInt(tmdbIdStr || '', 10)
  const isMovie = type === 'movie'

  // Tabs navigation state
  const [activeTab, setActiveTab] = useState<'overview' | 'cast' | 'reviews' | 'similar' | 'images' | 'trivia'>('overview')

  // Lightbox state for images tab
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  // Watchlist hooks
  const { entry, update, remove } = useWatchlistEntry(routeId)
  const { addEntry } = useWatchlist()
  const titleIds = useWatchlistStore((s) => s.titleIds)

  // ── TMDb API Queries ──
  const { data: details, isLoading: isDetailsLoading, isError } = useQuery<TMDbMovie | TMDbTV, Error>({
    queryKey: ['title-details', type, tmdbId] as const,
    queryFn: () => (isMovie ? getMovieDetails(tmdbId) : getTVDetails(tmdbId)),
    enabled: !!type && !isNaN(tmdbId),
    staleTime: 15 * 60 * 1000,
  })

  const { data: imagesData } = useQuery({
    queryKey: ['title-images', type, tmdbId],
    queryFn: () => getTitleImages(type as 'movie' | 'tv', tmdbId),
    enabled: !!type && !isNaN(tmdbId),
    staleTime: 30 * 60 * 1000,
  })

  const movieDetails = details && isMovie ? details as TMDbMovie : null
  const tvDetails = details && !isMovie ? details as TMDbTV : null

  // ── Firestore Review Sync ──
  const [reviewsList, setReviewsList] = useState<UserReview[]>([])
  const [isReviewSheetOpen, setIsReviewSheetOpen] = useState(false)
  const [isMoreOpen, setIsMoreOpen] = useState(false)
  const [editingReview, setEditingReview] = useState<UserReview | null>(null)

  // Review form states
  const [revTitle, setRevTitle] = useState('')
  const [revRating, setRevRating] = useState(10)
  const [revText, setRevText] = useState('')
  const [revTags, setRevTags] = useState('')

  useEffect(() => {
    if (!user || !routeId) return
    const q = firestoreQuery(
      collection(db, `users/${user.uid}/reviews`),
      where('titleId', '==', routeId)
    )
    return onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as UserReview[]
      setReviewsList(items)
    })
  }, [user, routeId])

  // ── Local Notes Autosave ──
  const [localNotes, setLocalNotes] = useState('')
  const [isSavingNotes, setIsSavingNotes] = useState(false)
  const [isOverviewCollapsed, setIsOverviewCollapsed] = useState(true)

  // Sheet Controls
  const [isStatusSheetOpen, setIsStatusSheetOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null)

  // Sync inputs
  useEffect(() => {
    if (entry) {
      setLocalNotes(entry.notes || '')
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

  // Helpers
  const title = details
    ? (isMovie ? (details as TMDbMovie).title : (details as TMDbTV).name)
    : 'Details'

  const releaseYear = details
    ? parseInt((isMovie ? (details as TMDbMovie).release_date : (details as TMDbTV).first_air_date)?.slice(0, 4) || '0')
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

  // Toggle watchlist
  const handleToggleWatchlist = async () => {
    if (!details || !user || !routeId) return
    if (entry) {
      if (confirm('Remove this title from your watchlist?')) {
        await remove()
        triggerToast('Removed from watchlist')
      }
    } else {
      await addEntry({
        titleId: routeId,
        type: isMovie ? 'movie' : 'tv',
        title,
        posterPath: details.poster_path,
        backdropPath: details.backdrop_path,
        year: releaseYear,
        genres: details.genres.map((g) => g.name),
        status: 'plan_to_watch',
      })
      triggerToast('Added to watchlist!')
    }
  }

  const handleToggleFavorite = async () => {
    if (!entry) {
      // Add first then favorite
      await handleToggleWatchlist()
    }
    if (entry) {
      await update({ isFavorite: !entry.isFavorite })
    }
  }

  const handleStatusSelect = async (status: WatchStatus) => {
    if (!entry) return
    await update({ status })
    setIsStatusSheetOpen(false)
    triggerToast(`Status updated to ${status}`)
  }

  const handleRatingSelect = async (val: number) => {
    if (!entry) {
      await handleToggleWatchlist()
    }
    await update({ rating: entry?.rating === val ? null : val })
  }

  const handleAddDate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value
    if (!rawVal || !entry || !user || !routeId) return
    try {
      const selectedDate = new Date(rawVal + 'T00:00:00')
      const exists = entry.watchDates?.some((w) => {
        const d = (w as unknown as Timestamp).toDate()
        return d.toDateString() === selectedDate.toDateString()
      })

      if (exists) {
        triggerToast('Date already logged.')
        return
      }

      const runtime = isMovie ? movieDetails?.runtime ?? 120 : 30
      await logHistoryEvent({
        userId: user.uid,
        titleId: routeId,
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
    if (!entry || !user || !routeId) return
    try {
      const runtime = isMovie ? movieDetails?.runtime ?? 120 : 30
      // Find history doc to delete
      const historyColRef = collection(db, `users/${user.uid}/${COLLECTIONS.HISTORY}`)
      const q = firestoreQuery(
        historyColRef,
        where('titleId', '==', routeId),
        where('watchedAt', '==', ts),
        limit(1)
      )
      const snapshot = await getDocs(q)
      if (!snapshot.empty) {
        const docItem = snapshot.docs[0]!
        await deleteHistoryEvent(
          user.uid,
          docItem.id,
          routeId,
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

  // ── Firestore Review Handlers ──
  const openWriteReview = (rev?: UserReview) => {
    if (rev) {
      setEditingReview(rev)
      setRevTitle(rev.title)
      setRevRating(rev.rating)
      setRevText(rev.reviewText)
      setRevTags(rev.tags.join(', '))
    } else {
      setEditingReview(null)
      setRevTitle('')
      setRevRating(10)
      setRevText('')
      setRevTags('')
    }
    setIsReviewSheetOpen(true)
  }

  const handleSaveReview = async () => {
    if (!user || !routeId) return
    const reviewId = editingReview?.id || doc(collection(db, `users/${user.uid}/reviews`)).id
    const tagsArray = revTags
      .split(/[, ]+/)
      .map((t) => t.trim().replace(/^#/, ''))
      .filter((t) => t.length > 0)

    try {
      await setDoc(doc(db, `users/${user.uid}/reviews`, reviewId), {
        titleId: routeId,
        title: revTitle || title,
        year: String(releaseYear),
        rating: revRating,
        reviewText: revText,
        tags: tagsArray,
        updatedAt: serverTimestamp(),
      })
      setIsReviewSheetOpen(false)
      triggerToast('Review saved successfully!')
    } catch (e) {
      console.error(e)
    }
  }

  const handleDeleteReview = async (revId: string) => {
    if (!user || !confirm('Delete this review?')) return
    try {
      await deleteDoc(doc(db, `users/${user.uid}/reviews`, revId))
      triggerToast('Review deleted')
    } catch (e) {
      console.error(e)
    }
  }

  // Skeletons
  if (isDetailsLoading) {
    return (
      <div className="page-wrapper detail-page">
        <div className="skeleton skeleton-backdrop" style={{ height: 300 }} />
        <div style={{ display: 'flex', gap: 20, marginTop: -60, padding: '0 24px' }}>
          <div className="skeleton" style={{ width: 120, height: 180, borderRadius: 'var(--radius-lg)' }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, alignSelf: 'flex-end' }}>
            <div className="skeleton" style={{ height: 32, width: '70%' }} />
            <div className="skeleton" style={{ height: 16, width: '40%' }} />
          </div>
        </div>
      </div>
    )
  }

  if (isError || !details) {
    return (
      <div className="page-wrapper detail-page" style={{ textAlign: 'center', paddingTop: 80 }}>
        <p>Failed to load title details.</p>
        <button onClick={() => navigate(-1)} className="dp-confirm-btn" style={{ width: 'auto', marginTop: 16 }}>
          Go Back
        </button>
      </div>
    )
  }

  const currentStatusObj = entry ? STATUS_OPTS.find((o) => o.value === entry.status) : null

  // Trivia source
  const triviaList = TRIVIA_DATABASE[tmdbId] ?? null

  // Image assets list
  const backdropImages = imagesData?.backdrops?.slice(0, 16) ?? []

  // Overview grids (Cast `details` to `any` for raw properties not in TypeScript model)
  const detailsAny = details as any
  const director = details.credits?.crew?.find((c) => c.job === 'Director')?.name || 'N/A'
  const writer = details.credits?.crew?.find((c) => c.job === 'Writer' || c.job === 'Screenplay')?.name || 'N/A'
  const stars = details.credits?.cast?.slice(0, 3).map((c) => c.name).join(', ') || 'N/A'
  const productionCo = detailsAny.production_companies?.slice(0, 2).map((c: any) => c.name).join(', ') || 'N/A'
  const spokenLanguage = detailsAny.spoken_languages?.[0]?.english_name || detailsAny.original_language || 'N/A'
  const budget = movieDetails?.budget ? `$${(movieDetails.budget / 1000000).toFixed(0)}M` : 'N/A'
  const revenue = movieDetails?.revenue ? `$${(movieDetails.revenue / 1000000).toFixed(0)}M` : 'N/A'

  // Timeline variables
  const addedDate = entry?.addedAt ? entry.addedAt.toDate().toLocaleDateString() : null
  const watchedDate = entry?.watchDates && entry.watchDates.length > 0
    ? (entry.watchDates[0] as unknown as Timestamp).toDate().toLocaleDateString()
    : 'Not watched yet'
  const ratedDate = entry?.rating ? `${entry.rating} / 10` : 'Not rated yet'

  return (
    <div className="page-wrapper detail-page">

      {/* ── BACK BUTTON ── */}
      <div style={{ padding: '12px 24px 0' }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            padding: '4px 0',
            width: 'auto',
          }}
          type="button"
        >
          <ChevronLeft size={16} />
          Back
        </button>
      </div>

      {/* ── HERO BACKDROP ── */}
      <section className="detail-hero">
        {backdrop ? (
          <img src={backdrop} alt={title} className="detail-hero-backdrop" />
        ) : (
          <div style={{ background: 'var(--bg-secondary)', width: '100%', height: '100%' }} />
        )}
        <div className="detail-hero-overlay-dark" />
        <div className="detail-hero-overlay-left" />
        <div className="detail-hero-overlay-bottom" />
      </section>

      {/* ── TITLE BLOCK ── */}
      <section className="detail-title-block">
        {poster ? (
          <img src={poster} alt={title} className="detail-poster" />
        ) : (
          <div className="detail-poster detail-poster--placeholder">
            <Film size={28} />
          </div>
        )}

        <div className="detail-info-block">
          <h1 className="detail-title-text">{title}</h1>
          <p className="detail-meta-text">
            {releaseYear > 0 ? releaseYear : '—'} · {runtimeString}
          </p>
          <div className="detail-meta-text" style={{ marginTop: 2, display: 'flex', alignItems: 'baseline', gap: 6 }}>
            {ratingAverage && (
              <>
                <span className="detail-large-rating">⭐ {ratingAverage}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>(IMDb)</span>
              </>
            )}
          </div>
          <div className="detail-genres-row">
            {details.genres.slice(0, 3).map((g) => (
              <span key={g.id} className="detail-genre-chip">{g.name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── ACTION BUTTONS ROW ── */}
      <section className="detail-actions-row">
        <button className="detail-btn detail-btn--brand" type="button">
          <Play size={15} fill="currentColor" /> Play Trailer
        </button>

        <button
          className={`detail-btn ${entry?.status === 'completed' ? 'detail-btn--watched' : ''}`}
          onClick={handleToggleWatchlist}
          type="button"
        >
          {entry?.status === 'completed' ? (
            <><Check size={15} /> Watched</>
          ) : (
            <><Plus size={15} /> Watch</>
          )}
        </button>

        <button
          className={`detail-btn ${entry?.isFavorite ? 'detail-btn--fav' : ''}`}
          onClick={handleToggleFavorite}
          aria-label="Toggle Favorite"
          type="button"
        >
          <Heart size={15} fill={entry?.isFavorite ? 'currentColor' : 'none'} /> Favorite
        </button>

        <div style={{ position: 'relative' }}>
          <button className="detail-btn detail-btn--more" onClick={() => setIsMoreOpen(!isMoreOpen)} aria-label="More Options" type="button">
            <MoreHorizontal size={15} />
          </button>
          {isMoreOpen && (
            <div className="detail-more-dropdown animate-fade-in" style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 6, display: 'flex', flexDirection: 'column', gap: 4, zIndex: 100, minWidth: 140, boxShadow: 'var(--card-shadow)' }}>
              <button className="detail-dropdown-item" onClick={() => { setIsMoreOpen(false); alert('Collection feature coming soon'); }} style={{ padding: '8px 12px', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', textAlign: 'left', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                Add to Collection
              </button>
              <button className="detail-dropdown-item" onClick={() => { setIsMoreOpen(false); handleShare(); }} style={{ padding: '8px 12px', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', textAlign: 'left', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                Share Link
              </button>
              <button className="detail-dropdown-item" onClick={() => { setIsMoreOpen(false); alert('Title reported successfully'); }} style={{ padding: '8px 12px', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', textAlign: 'left', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                Report Title
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── TABS NAVIGATION ── */}
      <nav className="detail-tab-bar">
        {(['overview', 'cast', 'reviews', 'similar', 'images', 'trivia'] as const).map((tab) => (
          <button
            key={tab}
            className={`detail-tab-btn ${activeTab === tab ? 'detail-tab-btn--active' : ''}`}
            onClick={() => setActiveTab(tab)}
            type="button"
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </nav>

      {/* ── TAB CONTENT ── */}
      <main className="detail-tab-content">

        {/* ── OVERVIEW TAB ── */}
        {activeTab === 'overview' && (
          <div className="tab-pane animate-fade-in">
            <section className="detail-card">
              <h3 className="detail-card-title">Overview</h3>
              <p className="detail-overview-p">
                {isOverviewCollapsed && details.overview.length > 200
                  ? `${details.overview.slice(0, 200)}...`
                  : details.overview || 'No overview available.'}
              </p>
              {details.overview.length > 200 && (
                <button
                  className="detail-read-more"
                  onClick={() => setIsOverviewCollapsed(!isOverviewCollapsed)}
                  type="button"
                >
                  {isOverviewCollapsed ? 'Read more' : 'Read less'}
                </button>
              )}
            </section>

            {/* Details Grid */}
            <section className="detail-card">
              <h3 className="detail-card-title">Details</h3>
              <div className="detail-grid-2col">
                <div className="detail-grid-item">
                  <span className="detail-grid-lbl">Director</span>
                  <span className="detail-grid-val">{director}</span>
                </div>
                <div className="detail-grid-item">
                  <span className="detail-grid-lbl">Writer</span>
                  <span className="detail-grid-val">{writer}</span>
                </div>
                <div className="detail-grid-item">
                  <span className="detail-grid-lbl">Stars</span>
                  <span className="detail-grid-val">{stars}</span>
                </div>
                <div className="detail-grid-item">
                  <span className="detail-grid-lbl">Status</span>
                  <span className="detail-grid-val">{details.status || 'N/A'}</span>
                </div>
                <div className="detail-grid-item">
                  <span className="detail-grid-lbl">Language</span>
                  <span className="detail-grid-val">{spokenLanguage}</span>
                </div>
                <div className="detail-grid-item">
                  <span className="detail-grid-lbl">Production Co.</span>
                  <span className="detail-grid-val">{productionCo}</span>
                </div>
                {isMovie && (
                  <>
                    <div className="detail-grid-item">
                      <span className="detail-grid-lbl">Budget</span>
                      <span className="detail-grid-val">{budget}</span>
                    </div>
                    <div className="detail-grid-item">
                      <span className="detail-grid-lbl">Revenue</span>
                      <span className="detail-grid-val">{revenue}</span>
                    </div>
                  </>
                )}
              </div>
            </section>

            {/* Status & Personal Section (If in watchlist) */}
            {entry && (
              <>
                <section className="detail-card">
                  <h3 className="detail-card-title">Status Management</h3>
                  <div className="detail-status-row">
                    {currentStatusObj && (
                      <div className="detail-status-pill-indicator">
                        <span className="detail-status-dot-large" style={{ background: currentStatusObj.color }} />
                        <span>{currentStatusObj.label}</span>
                      </div>
                    )}
                    <button className="detail-btn detail-btn--brand" onClick={() => setIsStatusSheetOpen(true)} type="button">
                      Change Status
                    </button>
                  </div>
                </section>

                <section className="detail-card">
                  <h3 className="detail-card-title">Personal rating</h3>
                  <div className="detail-stars-interactive">
                    {Array.from({ length: 10 }).map((_, i) => {
                      const starVal = i + 1
                      const isStarActive = (entry.rating ?? 0) >= starVal
                      return (
                        <button
                          key={starVal}
                          className="detail-star-btn"
                          onClick={() => handleRatingSelect(starVal)}
                          aria-label={`Rate ${starVal} stars`}
                          type="button"
                        >
                          <Star size={24} fill={isStarActive ? 'var(--star-filled)' : 'none'} color={isStarActive ? 'var(--star-filled)' : 'var(--text-muted)'} />
                        </button>
                      )
                    })}
                  </div>
                  {entry.rating && <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>You rated this: <strong>{entry.rating} / 10</strong></p>}
                </section>

                <section className="detail-card">
                  <h3 className="detail-card-title">Personal Notes</h3>
                  <textarea
                    ref={notesTextareaRef}
                    className="detail-notes-textarea"
                    value={localNotes}
                    onChange={(e) => setLocalNotes(e.target.value)}
                    placeholder="Auto-saved on blur. Add your personal thoughts here..."
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    <span>{isSavingNotes && 'Saving...'}</span>
                    <span>{localNotes.length} chars</span>
                  </div>
                </section>

                {/* Timeline & Watch Date logger */}
                <section className="detail-card">
                  <h3 className="detail-card-title">Timeline</h3>
                  <div className="detail-timeline">
                    <div className="detail-timeline-item">
                      <span className="detail-timeline-dot" />
                      <div className="detail-timeline-info">
                        <span className="detail-timeline-lbl">Added</span>
                        <span className="detail-timeline-val">{addedDate || 'Not in Watchlist'}</span>
                      </div>
                    </div>
                    <div className="detail-timeline-item">
                      <span className="detail-timeline-dot" />
                      <div className="detail-timeline-info">
                        <span className="detail-timeline-lbl">Watched</span>
                        <span className="detail-timeline-val">{watchedDate}</span>
                      </div>
                    </div>
                    <div className="detail-timeline-item">
                      <span className="detail-timeline-dot" />
                      <div className="detail-timeline-info">
                        <span className="detail-timeline-lbl">Rated</span>
                        <span className="detail-timeline-val">{ratedDate}</span>
                      </div>
                    </div>
                  </div>

                  {entry.watchDates && entry.watchDates.length > 0 && (
                    <div className="dates-chips-row" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
                      {entry.watchDates
                        .map((w) => w as unknown as Timestamp)
                        .sort((a, b) => b.seconds - a.seconds)
                        .map((ts, idx) => {
                          const date = ts.toDate()
                          return (
                            <span key={idx} className="date-chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-pill)', padding: '4px 10px', fontSize: 12 }}>
                              <span>{date.toLocaleDateString()}</span>
                              <button
                                className="date-chip-remove"
                                onClick={() => handleRemoveDate(ts)}
                                aria-label={`Remove watch log date ${date.toLocaleDateString()}`}
                                type="button"
                                style={{ color: 'var(--color-error)' }}
                              >
                                <Trash2 size={11} />
                              </button>
                            </span>
                          )
                        })}
                    </div>
                  )}
                  <div className="date-add-trigger" style={{ marginTop: 12 }}>
                    <button className="watch-date-add-btn" type="button" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1.5px solid var(--border-default)', background: 'transparent', padding: '6px 14px', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}>
                      <span>+ Add watch date</span>
                      <input
                        type="date"
                        className="date-add-input"
                        onChange={handleAddDate}
                        max={new Date().toISOString().slice(0, 10)}
                        aria-label="Select watch date"
                        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                      />
                    </button>
                  </div>
                </section>
              </>
            )}

            {/* Where to Watch */}
            <section className="detail-card">
              <h3 className="detail-card-title">Where to watch</h3>
              <div className="detail-providers-row">
                {PROVIDERS.map((provider) => (
                  <span
                    key={provider.name}
                    className="detail-provider-pill"
                    style={{ borderLeft: `3px solid ${provider.color}` }}
                  >
                    {provider.name}
                  </span>
                ))}
              </div>
              <p className="detail-providers-msg">Streaming availability may vary by region</p>
            </section>
          </div>
        )}

        {/* ── CAST TAB ── */}
        {activeTab === 'cast' && (
          <div className="tab-pane animate-fade-in">
            {details.credits?.cast && details.credits.cast.length > 0 ? (
              <div className="cast-grid">
                {details.credits.cast.slice(0, 12).map((cast) => {
                  const avatar = getImageUrl(cast.profile_path, 'w200')
                  return (
                    <div key={cast.id} className="detail-cast-card">
                      {avatar ? (
                        <img src={avatar} alt={cast.name} className="detail-cast-avatar" />
                      ) : (
                        <div className="detail-cast-avatar detail-cast-avatar--placeholder">👤</div>
                      )}
                      <p className="detail-cast-name">{cast.name}</p>
                      <p className="detail-cast-char">{cast.character}</p>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="detail-tab-empty">No cast details available.</p>
            )}
          </div>
        )}

        {/* ── REVIEWS TAB ── */}
        {activeTab === 'reviews' && (
          <div className="tab-pane animate-fade-in">
            <div className="detail-tab-header">
              <h3 className="detail-card-title" style={{ margin: 0 }}>Journal Reviews</h3>
              <button className="detail-write-rev-btn" onClick={() => openWriteReview()} type="button">
                Write a Review
              </button>
            </div>

            {reviewsList.length > 0 ? (
              <div className="detail-reviews-list">
                {reviewsList.map((rev) => (
                  <article key={rev.id} className="detail-rev-card">
                    <div className="detail-rev-top">
                      <div className="detail-rev-meta">
                        <h4 className="detail-rev-title">{rev.title}</h4>
                        <span className="detail-rev-year">{rev.year} · ⭐ {rev.rating}/10</span>
                      </div>
                      <div className="detail-rev-actions">
                        <button className="detail-rev-action-btn" onClick={() => openWriteReview(rev)} aria-label="Edit review" type="button">
                          <Edit size={14} />
                        </button>
                        <button className="detail-rev-action-btn detail-rev-action-btn--delete" onClick={() => handleDeleteReview(rev.id)} aria-label="Delete review" type="button">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <p className="detail-rev-text">{rev.reviewText}</p>
                    {rev.tags && rev.tags.length > 0 && (
                      <div className="detail-rev-tags">
                        {rev.tags.map((tag) => (
                          <span key={tag} className="detail-tag-chip">#{tag}</span>
                        ))}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <p className="detail-tab-empty">You haven't written any reviews for this title yet.</p>
            )}
          </div>
        )}

        {/* ── SIMILAR TAB ── */}
        {activeTab === 'similar' && (
          <div className="tab-pane animate-fade-in">
            {details.similar?.results && details.similar.results.length > 0 ? (
              <div className="sp-results-grid">
                {details.similar.results.slice(0, 10).map((sim) => {
                  const simId = `${sim.media_type || (isMovie ? 'movie' : 'tv')}:${sim.id}`
                  const poster = getImageUrl(sim.poster_path, 'w500')
                  const rating = sim.vote_average > 0 ? sim.vote_average.toFixed(1) : null
                  const year = (sim.release_date ?? sim.first_air_date)?.slice(0, 4) ?? '—'
                  const title = sim.title ?? sim.name ?? 'Untitled'
                  const inList = titleIds.includes(simId)

                  return (
                    <article
                      key={sim.id}
                      className="sp-card"
                      onClick={() => navigate(`/watchlist/${encodeURIComponent(simId)}`)}
                    >
                      <div className="sp-card-poster-wrap">
                        {poster ? (
                          <img src={poster} alt={title} className="sp-card-poster" loading="lazy" />
                        ) : (
                          <div className="sp-card-no-poster"><Film size={32} color="var(--text-muted)" /></div>
                        )}
                        <div className="sp-card-gradient" />
                        <div className="sp-card-overlay-text">
                          <p className="sp-card-overlay-title">{title}</p>
                          <p className="sp-card-overlay-year">{year}</p>
                        </div>
                        {rating && <span className="sp-card-rating-badge">⭐ {rating}</span>}
                        {inList && <span className="sp-card-added-badge" style={{ position: 'absolute', top: 5, right: 5, background: 'var(--color-success)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 'var(--radius-sm)' }}>✓ Added</span>}
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : (
              <p className="detail-tab-empty">No similar titles found.</p>
            )}
          </div>
        )}

        {/* ── IMAGES TAB ── */}
        {activeTab === 'images' && (
          <div className="tab-pane animate-fade-in">
            {backdropImages.length > 0 ? (
              <div className="detail-images-grid">
                {backdropImages.map((img, idx) => {
                  const url = getImageUrl(img.file_path, 'w500')
                  return (
                    <div key={idx} className="detail-img-card" onClick={() => setLightboxIndex(idx)}>
                      <img src={url!} alt={`Backdrop ${idx + 1}`} className="detail-img-thumb" loading="lazy" />
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="detail-tab-empty">No images available.</p>
            )}
          </div>
        )}

        {/* ── TRIVIA TAB ── */}
        {activeTab === 'trivia' && (
          <div className="tab-pane animate-fade-in">
            {triviaList ? (
              <ol className="detail-trivia-list">
                {triviaList.map((fact, idx) => (
                  <li key={idx} className="detail-trivia-item">
                    <div className="detail-trivia-icon-box">
                      <Lightbulb size={16} />
                    </div>
                    <div className="detail-trivia-content">
                      <span className="detail-trivia-num">Fact #{idx + 1}</span>
                      <p className="detail-trivia-text">{fact}</p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="detail-tab-empty">No trivia available yet.</p>
            )}
          </div>
        )}
      </main>

      {/* ── Image Lightbox Modal ── */}
      {lightboxIndex !== null && (
        <div className="dp-lightbox" onClick={() => setLightboxIndex(null)}>
          <button className="dp-lightbox-close" onClick={() => setLightboxIndex(null)} type="button">×</button>
          <div className="dp-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img
              src={getImageUrl(backdropImages[lightboxIndex]!.file_path, 'original')!}
              alt="Backdrop Lightbox"
              className="dp-lightbox-img"
            />
            {backdropImages.length > 1 && (
              <div className="dp-lightbox-nav">
                <button
                  onClick={() => setLightboxIndex((lightboxIndex - 1 + backdropImages.length) % backdropImages.length)}
                  type="button"
                >
                  ◀ Prev
                </button>
                <span className="dp-lightbox-counter">{lightboxIndex + 1} / {backdropImages.length}</span>
                <button
                  onClick={() => setLightboxIndex((lightboxIndex + 1) % backdropImages.length)}
                  type="button"
                >
                  Next ▶
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Watch Status bottom sheet ── */}
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

      {/* ── Review Sheet ── */}
      <BottomSheet
        isOpen={isReviewSheetOpen}
        onClose={() => setIsReviewSheetOpen(false)}
        label="Write a review"
      >
        <div className="status-sheet-content">
          <p className="filter-sheet-title" style={{ padding: '0 0 16px' }}>
            {editingReview ? 'Edit Review' : 'Write a Review'}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Review Headline</label>
              <input
                type="text"
                value={revTitle}
                onChange={(e) => setRevTitle(e.target.value)}
                placeholder="e.g. Masterpiece!, Disappointing, Worth a watch"
                className="review-input"
                style={{ width: '100%', marginTop: 4 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Star Rating ({revRating}/10)</label>
              <input
                type="range"
                min="1"
                max="10"
                value={revRating}
                onChange={(e) => setRevRating(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--color-brand)', marginTop: 4 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Review Body</label>
              <textarea
                value={revText}
                onChange={(e) => setRevText(e.target.value)}
                placeholder="Write your full thoughts on this title..."
                className="detail-notes-textarea"
                style={{ width: '100%', height: 120, marginTop: 4 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Tags (comma/space separated)</label>
              <input
                type="text"
                value={revTags}
                onChange={(e) => setRevTags(e.target.value)}
                placeholder="e.g. masterpiece, thriller, mindbending"
                className="review-input"
                style={{ width: '100%', marginTop: 4 }}
              />
            </div>
            <button className="dp-confirm-btn" onClick={handleSaveReview} type="button">
              Save Review
            </button>
          </div>
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
