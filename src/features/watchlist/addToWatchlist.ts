import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db, COLLECTIONS } from '@/lib/firebase'
import type { MediaType, WatchStatus } from '@/types/app'

// ─── Params ───────────────────────────────────────────────────────────────────

export interface AddToWatchlistParams {
  userId: string
  titleId: string
  type: MediaType
  title: string
  posterPath: string | null
  backdropPath: string | null
  year: number
  genres: string[]
  status: WatchStatus
}

// ─── Function ─────────────────────────────────────────────────────────────────

/**
 * Creates (or overwrites) a watchlist document in Firestore.
 * Path: users/{userId}/watchlist/{titleId}
 * Document ID doubles as the titleId (e.g. 'movie:550').
 */
export async function addToWatchlist(params: AddToWatchlistParams): Promise<void> {
  const { userId, titleId, ...fields } = params

  const docRef = doc(db, `users/${userId}/${COLLECTIONS.WATCHLIST}`, titleId)

  // Cast needed: Firestore serverTimestamp() is FieldValue at write-time
  // but Timestamp at read-time — this is a known Firebase SDK pattern.
  await setDoc(docRef, {
    titleId,
    ...fields,
    rating: null,
    notes: '',
    review: '',
    isFavorite: false,
    watchDates: [],
    reWatchCount: 0,
    totalRuntime: 0,
    episodesWatched: 0,
    totalEpisodes: 0,
    currentSeason: 0,
    addedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}
