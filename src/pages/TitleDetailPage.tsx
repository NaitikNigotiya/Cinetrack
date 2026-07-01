import { useEffect, useState, useMemo, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
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
  Clock,
  X,
  Share2,
  FolderOpen,
  FileText,
  ChevronDown,
  ListChecks,
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
import { useTVSeasons } from '@/features/episodes/hooks/useTVSeasons'
import { logHistoryEvent, deleteHistoryEvent } from '@/features/history/history'
import { db, COLLECTIONS } from '@/lib/firebase'
import {
  getMovieDetails,
  getTVDetails,
  getImageUrl,
  getTrailerKey,
} from '@/lib/tmdb'

import { BottomSheet } from '@/components/ui/BottomSheet'
import { TrailerModal } from '@/components/ui/TrailerModal'
import { PosterCard } from '@/components/ui/PosterCard'

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

function EpisodesTabContent({
  tmdbId, details, entry, onNavigateToTracker
}: {
  tmdbId: number
  details: TMDbTV | null
  entry: any
  onNavigateToTracker: () => void
}) {
  const [openSeason, setOpenSeason] = useState<number | null>(1)
  const { data: seasonsData } = useTVSeasons(tmdbId, 
    details?.seasons?.filter(s => s.season_number > 0).map(s => s.season_number) || []
  )

  if (!details) return null

  const seasons = details.seasons?.filter(s => s.season_number > 0) || []

  return (
    <div style={{ padding: '20px 0' }}>
      
      {/* Header with Track Episodes button */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: '20px',
      }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 700,
            color: 'var(--text-primary)' }}>
            {details.number_of_seasons} Seasons · {details.number_of_episodes} Episodes
          </div>
          {entry && (
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {entry.episodesWatched || 0} episodes watched
            </div>
          )}
        </div>
        <button
          onClick={onNavigateToTracker}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px',
            background: 'var(--color-brand)', color: 'var(--text-on-brand)',
            border: 'none', borderRadius: 'var(--radius-md)',
            fontSize: '13px', fontWeight: 700, cursor: 'pointer',
          }}
        >
          📋 Track Episodes
        </button>
      </div>

      {/* Season accordions */}
      {seasons.map(season => {
        const isOpen = openSeason === season.season_number
        const seasonDetail = seasonsData?.find(
          s => s.season_number === season.season_number
        )
        const episodes = seasonDetail?.episodes || []

        return (
          <div key={season.season_number} style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            borderRadius: 'var(--radius-lg)',
            marginBottom: '10px', overflow: 'hidden',
          }}>
            {/* Season header */}
            <div
              onClick={() => setOpenSeason(isOpen ? null : season.season_number)}
              style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                padding: '14px 16px', cursor: 'pointer',
                background: isOpen ? 'var(--bg-elevated)' : 'transparent',
                transition: 'background 150ms ease',
              }}
            >
              {/* Season poster */}
              {season.poster_path ? (
                <img
                  src={getImageUrl(season.poster_path, 'w200') || ''}
                  alt={`Season ${season.season_number}`}
                  style={{ width: 40, height: 60, borderRadius: 'var(--radius-sm)',
                    objectFit: 'cover', flexShrink: 0 }}
                />
              ) : (
                <div style={{ width: 40, height: 60, borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-overlay)', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '18px' }}>🎬</div>
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '15px',
                  color: 'var(--text-primary)' }}>
                  Season {season.season_number}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)',
                  marginTop: '2px' }}>
                  {season.episode_count} episodes
                  {season.air_date && ` · ${new Date(season.air_date).getFullYear()}`}
                </div>
              </div>

              <span style={{
                fontSize: '18px', color: 'var(--text-muted)',
                transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
                transition: 'transform 300ms ease', flexShrink: 0,
              }}>⌄</span>
            </div>

            {/* Episodes list */}
            {isOpen && (
              <div style={{ borderTop: '1px solid var(--border-default)' }}>
                {episodes.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center',
                    color: 'var(--text-muted)', fontSize: '14px' }}>
                    Loading episodes...
                  </div>
                ) : (
                  episodes.map((ep, idx) => (
                    <div key={ep.id} style={{
                      display: 'flex', gap: '14px', padding: '14px 16px',
                      borderBottom: idx < episodes.length - 1
                        ? '1px solid var(--border-default)' : 'none',
                      alignItems: 'flex-start',
                    }}>
                      {/* Episode still image */}
                      {ep.still_path ? (
                        <img
                          src={getImageUrl(ep.still_path, 'w200') || ''}
                          alt={ep.name}
                          style={{ width: 100, height: 60, borderRadius: 'var(--radius-sm)',
                            objectFit: 'cover', flexShrink: 0 }}
                          loading="lazy"
                        />
                      ) : (
                        <div style={{ width: 100, height: 60,
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--bg-overlay)', flexShrink: 0,
                          display: 'flex', alignItems: 'center',
                          justifyContent: 'center', fontSize: '20px' }}>🎬</div>
                      )}

                      {/* Episode info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline',
                          gap: '8px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700,
                            color: 'var(--text-muted)', fontFamily: 'monospace',
                            flexShrink: 0 }}>
                            E{String(ep.episode_number).padStart(2, '0')}
                          </span>
                          <span style={{ fontSize: '14px', fontWeight: 600,
                            color: 'var(--text-primary)',
                            overflow: 'hidden', textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap' }}>
                            {ep.name}
                          </span>
                        </div>

                        {/* Overview */}
                        {ep.overview && (
                          <p style={{ fontSize: '12px', color: 'var(--text-muted)',
                            lineHeight: 1.5, margin: 0,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical' as const,
                            overflow: 'hidden' }}>
                            {ep.overview}
                          </p>
                        )}

                        {/* Meta row */}
                        <div style={{ display: 'flex', alignItems: 'center',
                          gap: '12px', marginTop: '6px' }}>
                          {ep.runtime && (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              ⏱ {ep.runtime}m
                            </span>
                          )}
                          {ep.air_date && (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              📅 {new Date(ep.air_date).toLocaleDateString()}
                            </span>
                          )}
                          {ep.vote_average > 0 && (
                            <span style={{ fontSize: '11px', fontWeight: 600,
                              color: 'var(--star-filled)' }}>
                              ⭐ {ep.vote_average.toFixed(1)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TitleDetailPage() {
  const { id: paramId, titleId } = useParams<{ id?: string; titleId?: string }>()
  const routeId = titleId || paramId || ''
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()

  const [type, tmdbIdStr] = routeId.split(':')
  const tmdbId = parseInt(tmdbIdStr || '', 10)
  const isMovie = type === 'movie'
  const mediaType = isMovie ? 'movie' : 'tv'

  // Tabs navigation state
  const [activeTab, setActiveTab] = useState<'overview' | 'episodes' | 'cast' | 'reviews' | 'similar' | 'images' | 'trivia'>('overview')

  // Lightbox state for images tab
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  // Trailer state
  const [showTrailer, setShowTrailer] = useState(false)

  // ── Firestore Review Sync ──
  const [reviewsList, setReviewsList] = useState<UserReview[]>([])
  const [isReviewSheetOpen, setIsReviewSheetOpen] = useState(false)
  const [editingReview, setEditingReview] = useState<UserReview | null>(null)

  // Review form states
  const [revTitle, setRevTitle] = useState('')
  const [revRating, setRevRating] = useState(10)
  const [revText, setRevText] = useState('')
  const [revTags, setRevTags] = useState('')

  // ── Local Notes Autosave ──
  const [localNotes, setLocalNotes] = useState('')
  const [isSavingNotes, setIsSavingNotes] = useState(false)
  const [isOverviewCollapsed, setIsOverviewCollapsed] = useState(true)

  // Sheet Controls
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [showStatusSheet, setShowStatusSheet] = useState(false)
  const [showCollectionSheet, setShowCollectionSheet] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<WatchStatus>('plan_to_watch')

  // Watchlist hooks
  const { entry, update, remove } = useWatchlistEntry(routeId)
  const { addEntry } = useWatchlist()

  // ── TMDb API Queries ──
  const { data: details, isLoading: isDetailsLoading, isError } = useQuery<TMDbMovie | TMDbTV, Error>({
    queryKey: ['title-details', type, tmdbId] as const,
    queryFn: () => (isMovie ? getMovieDetails(tmdbId) : getTVDetails(tmdbId)),
    enabled: !!type && !isNaN(tmdbId),
    staleTime: 15 * 60 * 1000,
  })

  // ── Memoized & Derived values from 'details' ──
  const movieDetails = details && isMovie ? details as TMDbMovie : null
  const tvDetails = details && !isMovie ? details as TMDbTV : null

  const title = details
    ? (isMovie ? (details as TMDbMovie).title : (details as TMDbTV).name)
    : 'Details'

  const releaseYear = details
    ? parseInt((isMovie ? (details as TMDbMovie).release_date : (details as TMDbTV).first_air_date)?.slice(0, 4) || '0')
    : 0

  const backdrop = details ? getImageUrl(details.backdrop_path, 'original') : null
  const poster = details ? getImageUrl(details.poster_path, 'w500') : null
  const ratingAverage = details?.vote_average ? details.vote_average.toFixed(1) : null

  const trailerKey = useMemo(() => {
    if (!details) return null
    const videos = (details as any).videos
    return getTrailerKey(videos)
  }, [details])

  const similarTitles = useMemo(() => {
    if (!details) return []
    return (details as any).similar?.results || []
  }, [details])

  const images = useMemo(() => {
    if (!details) return []
    return (details as any).images?.backdrops?.slice(0, 12) || []
  }, [details])

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

  // ── Effects ──
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

  useEffect(() => {
    setShowMoreMenu(false)
  }, [location.pathname])

  useEffect(() => {
    if (entry) {
      setLocalNotes(entry.notes || '')
    }
  }, [entry])

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

  // Refs & Constants
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null)
  const collections: any[] = []

  // Handlers
  const handleRemove = async () => {
    if (window.confirm('Remove this title from your watchlist?')) {
      await remove()
      triggerToast('Removed from watchlist')
    }
  }

  const handleStatusChange = async (status: WatchStatus) => {
    if (!entry) return
    await update({ status })
    triggerToast(`Status updated to ${status}`)
  }

  const handleAddToWatchlist = async (status: WatchStatus) => {
    if (!details || !user || !routeId) return
    await addEntry({
      titleId: routeId,
      type: isMovie ? 'movie' : 'tv',
      title,
      posterPath: details.poster_path,
      backdropPath: details.backdrop_path,
      year: releaseYear,
      genres: details.genres.map((g) => g.name),
      status,
    })
    triggerToast('Added to watchlist!')
  }

  const handleAddToCollection = (_colId: string) => {
    triggerToast('Collection support not configured.')
  }

  const isInWatchlist = !!entry

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
        <button
          className="detail-back-btn"
          onClick={() => navigate(-1)}
          type="button"
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
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



  // Trivia source
  const triviaList = TRIVIA_DATABASE[tmdbId] ?? null

  // Image assets list
  const backdropImages = images

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
      <button
        className="detail-back-btn"
        onClick={() => navigate(-1)}
        type="button"
        aria-label="Go back"
      >
        <ArrowLeft size={20} />
      </button>

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
      <div className="detail-action-buttons-row" style={{
        display: 'flex', gap: '10px', flexWrap: 'wrap',
        marginTop: '16px', marginBottom: '8px',
        padding: '0 24px',
      }}>

        {/* 1. PRIMARY — Add to Watchlist / Status button */}
        {!isInWatchlist ? (
          <button onClick={() => setShowAddSheet(true)} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 20px',
            background: 'var(--color-brand)',
            color: 'var(--text-on-brand)',
            border: 'none', borderRadius: 'var(--radius-md)',
            fontWeight: 700, fontSize: '14px', cursor: 'pointer',
          }}>
            <Plus size={16} /> Add to Watchlist
          </button>
        ) : (
          <button onClick={() => setShowStatusSheet(true)} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 20px',
            background: 'var(--color-brand)',
            color: 'var(--text-on-brand)',
            border: 'none', borderRadius: 'var(--radius-md)',
            fontWeight: 700, fontSize: '14px', cursor: 'pointer',
          }}>
            {entry?.status === 'watching' && <><Play size={14} fill="currentColor" /> Watching</>}
            {entry?.status === 'completed' && <><Check size={14} /> Completed</>}
            {entry?.status === 'plan_to_watch' && <><Clock size={14} /> Plan to Watch</>}
            {entry?.status === 'dropped' && <><X size={14} /> Dropped</>}
            <ChevronDown size={14} />
          </button>
        )}

        {/* Track Episodes button (only for TV shows in watchlist) */}
        {isInWatchlist && !isMovie && (
          <button onClick={() => navigate(`/title/${routeId}/episodes`)} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 18px',
            background: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            fontWeight: 600, fontSize: '14px', cursor: 'pointer',
          }}>
            <ListChecks size={14} /> Track Episodes
          </button>
        )}

        {/* 2. Play Trailer */}
        <button onClick={() => setShowTrailer(true)} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 18px',
          background: 'var(--bg-elevated)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          fontWeight: 600, fontSize: '14px', cursor: 'pointer',
        }}>
          <Play size={14} fill="currentColor" /> Trailer
        </button>

        {/* 3. Favorite toggle */}
        <button onClick={handleToggleFavorite} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 18px',
          background: entry?.isFavorite ? 'rgba(229,9,20,0.1)' : 'var(--bg-elevated)',
          color: entry?.isFavorite ? '#E50914' : 'var(--text-secondary)',
          border: `1px solid ${entry?.isFavorite ? 'rgba(229,9,20,0.4)' : 'var(--border-default)'}`,
          borderRadius: 'var(--radius-md)',
          fontWeight: 600, fontSize: '14px', cursor: 'pointer',
          transition: 'all 200ms ease',
        }}>
          <Heart size={14} fill={entry?.isFavorite ? 'currentColor' : 'none'} />
          {entry?.isFavorite ? 'Favorited' : 'Favorite'}
        </button>

        {/* 4. More actions dropdown trigger */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 14px',
              background: 'var(--bg-elevated)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              fontWeight: 600, fontSize: '14px', cursor: 'pointer',
            }}
          >
            <MoreHorizontal size={16} /> More
          </button>

          {/* Dropdown menu */}
          {showMoreMenu && (
            <>
              {/* Click outside to close */}
              <div
                onClick={() => setShowMoreMenu(false)}
                style={{ position: 'fixed', inset: 0, zIndex: 99 }}
              />
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                zIndex: 100, minWidth: '200px',
                overflow: 'hidden',
              }}>
                {[
                  { icon: <FolderOpen size={15} />, label: 'Add to Collection', action: () => { setShowMoreMenu(false); setShowCollectionSheet(true) } },
                  { icon: <Star size={15} />, label: 'Rate this title', action: () => { setShowMoreMenu(false); document.getElementById('rating-section')?.scrollIntoView({ behavior: 'smooth' }) } },
                  { icon: <FileText size={15} />, label: 'Write a Review', action: () => { setShowMoreMenu(false); navigate('/reviews') } },
                  { icon: <Share2 size={15} />, label: 'Share', action: () => { setShowMoreMenu(false); handleShare() } },
                  ...(isInWatchlist ? [{ icon: <Trash2 size={15} color="var(--color-error)" />, label: 'Remove from Watchlist', action: () => { setShowMoreMenu(false); handleRemove() }, danger: true }] : []),
                ].map((item, i) => (
                  <button key={i} onClick={item.action} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', padding: '12px 16px',
                    background: 'none', border: 'none',
                    borderBottom: '1px solid var(--border-default)',
                    color: item.danger ? 'var(--color-error)' : 'var(--text-primary)',
                    fontSize: '14px', fontWeight: 500, cursor: 'pointer',
                    textAlign: 'left',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-overlay)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    {item.icon} {item.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── TABS NAVIGATION ── */}
      <nav className="detail-tab-bar">
        <button
          className={`detail-tab-btn ${activeTab === 'overview' ? 'detail-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('overview')}
          type="button"
        >
          Overview
        </button>

        {mediaType === 'tv' && (
          <button
            onClick={() => setActiveTab('episodes')}
            style={{
              padding: '12px 20px',
              fontSize: '14px', fontWeight: activeTab === 'episodes' ? 600 : 500,
              color: activeTab === 'episodes' ? 'var(--color-brand)' : 'var(--text-muted)',
              borderBottom: activeTab === 'episodes'
                ? '2px solid var(--color-brand)' : '2px solid transparent',
              background: 'none', border: 'none',
              cursor: 'pointer', whiteSpace: 'nowrap',
              transition: 'all 150ms ease',
            }}
            type="button"
          >
            Episodes
          </button>
        )}

        {(['cast', 'reviews', 'similar', 'images', 'trivia'] as const).map((tab) => (
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

        {/* ── EPISODES TAB ── */}
        {activeTab === 'episodes' && mediaType === 'tv' && (
          <div className="tab-pane animate-fade-in">
            <EpisodesTabContent
              tmdbId={tmdbId}
              details={details as TMDbTV}
              entry={entry}
              onNavigateToTracker={() => navigate(`/title/${routeId}/episodes`)}
            />
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
          <div style={{ padding: '20px 0' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700,
              color: 'var(--text-primary)', marginBottom: '16px' }}>
              More Like This
            </h3>
            {similarTitles && similarTitles.length > 0 ? (
              <div className="poster-grid">
                {similarTitles.slice(0, 18).map((item: any) => (
                  <PosterCard
                    key={item.id}
                    title={item.title || item.name || ''}
                    year={item.release_date
                      ? new Date(item.release_date).getFullYear()
                      : item.first_air_date
                      ? new Date(item.first_air_date).getFullYear()
                      : null}
                    posterPath={item.poster_path}
                    rating={item.vote_average}
                    type={mediaType as 'movie' | 'tv'}
                    onClick={() => navigate(`/title/${mediaType}:${item.id}`)}
                  />
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px',
                color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎬</div>
                <div style={{ fontSize: '15px', fontWeight: 600,
                  color: 'var(--text-primary)', marginBottom: '6px' }}>
                  No similar titles found
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── IMAGES TAB ── */}
        {activeTab === 'images' && (
          <div style={{ padding: '20px 0' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700,
              color: 'var(--text-primary)', marginBottom: '16px' }}>
              Images
            </h3>
            {images && images.length > 0 ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '8px',
              }}>
                {images.slice(0, 12).map((img: any, idx: number) => (
                  <div key={idx} onClick={() => setLightboxIndex(idx)} style={{
                    borderRadius: 'var(--radius-md)', overflow: 'hidden',
                    aspectRatio: '16/9', background: 'var(--bg-elevated)',
                    cursor: 'pointer',
                  }}>
                    <img
                      src={getImageUrl(img.file_path, 'w780') || ''}
                      alt={`Image ${idx + 1}`}
                      loading="lazy"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px',
                color: 'var(--text-muted)' }}>
                No images available
              </div>
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
      <BottomSheet isOpen={showStatusSheet} onClose={() => setShowStatusSheet(false)}>
        <div style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700,
            color: 'var(--text-primary)', marginBottom: '16px' }}>
            Update Status
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {STATUS_OPTS.map(opt => (
              <button
                key={opt.value}
                onClick={() => { handleStatusChange(opt.value); setShowStatusSheet(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '14px 16px',
                  background: entry?.status === opt.value
                    ? 'var(--bg-overlay)' : 'var(--bg-elevated)',
                  border: `1px solid ${entry?.status === opt.value
                    ? opt.color : 'var(--border-default)'}`,
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer', width: '100%', textAlign: 'left',
                  boxShadow: entry?.status === opt.value
                    ? `inset 3px 0 0 ${opt.color}` : 'none',
                  transition: 'all 150ms ease',
                }}
              >
                <span style={{ fontSize: '20px' }}>{opt.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: '14px', fontWeight: 600,
                    color: entry?.status === opt.value ? opt.color : 'var(--text-primary)',
                  }}>{opt.label}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)',
                    marginTop: '2px' }}>{opt.desc}</div>
                </div>
                {entry?.status === opt.value && (
                  <Check size={16} color={opt.color} />
                )}
              </button>
            ))}
          </div>

          {/* Remove from watchlist option at bottom */}
          {isInWatchlist && (
            <button
              onClick={() => { handleRemove(); setShowStatusSheet(false) }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 8, width: '100%', marginTop: '12px', padding: '12px',
                background: 'rgba(229,9,20,0.08)',
                border: '1px solid rgba(229,9,20,0.25)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-error)', fontSize: '14px',
                fontWeight: 600, cursor: 'pointer',
              }}
            >
              <Trash2 size={14} /> Remove from Watchlist
            </button>
          )}
        </div>
      </BottomSheet>

      {/* ── Add to Watchlist bottom sheet ── */}
      <BottomSheet isOpen={showAddSheet} onClose={() => setShowAddSheet(false)}>
        <div style={{ padding: '20px' }}>
          {/* Title preview */}
          <div style={{ display: 'flex', gap: '14px', marginBottom: '20px',
            paddingBottom: '16px', borderBottom: '1px solid var(--border-default)' }}>
            <img src={getImageUrl(details?.poster_path, 'w200') || ''} alt={title}
              style={{ width: 56, height: 84, borderRadius: 'var(--radius-md)',
                objectFit: 'cover', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '16px',
                color: 'var(--text-primary)' }}>{title}</div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)',
                marginTop: '4px' }}>{releaseYear} · {isMovie ? 'Movie' : 'TV Show'}</div>
            </div>
          </div>

          <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>
            Add as
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px',
            marginBottom: '16px' }}>
            {STATUS_OPTS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setSelectedStatus(opt.value)}
                style={{
                  padding: '12px', borderRadius: 'var(--radius-md)',
                  border: `1px solid ${selectedStatus === opt.value
                    ? opt.color : 'var(--border-default)'}`,
                  background: selectedStatus === opt.value
                    ? 'var(--bg-overlay)' : 'var(--bg-elevated)',
                  cursor: 'pointer', textAlign: 'center',
                  boxShadow: selectedStatus === opt.value
                    ? `0 0 0 1px ${opt.color}` : 'none',
                }}
              >
                <div style={{ fontSize: '20px', marginBottom: '4px' }}>{opt.emoji}</div>
                <div style={{
                  fontSize: '12px', fontWeight: 600,
                  color: selectedStatus === opt.value ? opt.color : 'var(--text-secondary)',
                }}>{opt.label}</div>
              </button>
            ))}
          </div>

          <button
            onClick={() => { handleAddToWatchlist(selectedStatus); setShowAddSheet(false) }}
            style={{
              width: '100%', padding: '14px',
              background: 'var(--color-brand)', color: 'var(--text-on-brand)',
              border: 'none', borderRadius: 'var(--radius-md)',
              fontSize: '15px', fontWeight: 700, cursor: 'pointer',
            }}
          >
            Add to Watchlist
          </button>
        </div>
      </BottomSheet>

      {/* ── Add to Collection bottom sheet ── */}
      <BottomSheet isOpen={showCollectionSheet} onClose={() => setShowCollectionSheet(false)}>
        <div style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700,
            color: 'var(--text-primary)', marginBottom: '16px' }}>
            Add to Collection
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {collections.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px',
                color: 'var(--text-muted)', fontSize: '14px' }}>
                No collections yet.{' '}
                <span
                  onClick={() => { setShowCollectionSheet(false); navigate('/collections') }}
                  style={{ color: 'var(--color-brand)', cursor: 'pointer', fontWeight: 600 }}
                >Create one →</span>
              </div>
            ) : (
              collections.map((col: any) => (
                <button key={col.id} onClick={() => handleAddToCollection(col.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px', background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)', cursor: 'pointer',
                    textAlign: 'left', width: '100%',
                  }}
                >
                  <FolderOpen size={18} color="var(--color-brand)" />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px',
                      color: 'var(--text-primary)' }}>{col.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {col.titleIds?.length || 0} titles
                    </div>
                  </div>
                </button>
              ))
            )}
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

      <TrailerModal
        isOpen={showTrailer}
        onClose={() => setShowTrailer(false)}
        videoKey={trailerKey}
        title={title || ''}
      />
    </div>
  )
}
