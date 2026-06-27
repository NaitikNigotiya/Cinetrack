import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  increment,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db, COLLECTIONS } from '@/lib/firebase'
import type { WatchHistoryType } from '@/types/app'

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface LogHistoryParams {
  userId: string
  titleId: string
  title: string
  type: WatchHistoryType
  episodeLabel: string | null
  runtimeMinutes: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Logs a watch event in the history collection and updates parent stats.
 */
export async function logHistoryEvent(params: LogHistoryParams): Promise<string> {
  const { userId, titleId, title, type, episodeLabel, runtimeMinutes } = params
  const now = Timestamp.now()

  // 1. Add to watchHistory collection
  const historyRef = collection(db, `users/${userId}/${COLLECTIONS.HISTORY}`)
  const newEventDoc = await addDoc(historyRef, {
    titleId,
    title,
    type,
    episodeLabel,
    watchedAt: serverTimestamp(),
    runtimeMinutes,
  })

  // 2. Update parent watchlist entry
  const watchlistDocRef = doc(db, `users/${userId}/${COLLECTIONS.WATCHLIST}`, titleId)
  await updateDoc(watchlistDocRef, {
    totalRuntime: increment(runtimeMinutes),
    watchDates: arrayUnion(now),
    updatedAt: serverTimestamp(),
    ...(type === 'tv_episode' ? { episodesWatched: increment(1) } : {}),
  })

  return newEventDoc.id
}

/**
 * Removes a watch event from the history collection and decrements parent stats.
 */
export async function deleteHistoryEvent(
  userId: string,
  eventId: string,
  titleId: string,
  type: WatchHistoryType,
  runtimeMinutes: number,
  watchedAt: Timestamp,
): Promise<void> {
  // 1. Delete history doc
  const historyDocRef = doc(db, `users/${userId}/${COLLECTIONS.HISTORY}`, eventId)
  await deleteDoc(historyDocRef)

  // 2. Decrement parent watchlist stats
  const watchlistDocRef = doc(db, `users/${userId}/${COLLECTIONS.WATCHLIST}`, titleId)
  await updateDoc(watchlistDocRef, {
    totalRuntime: increment(-runtimeMinutes),
    watchDates: arrayRemove(watchedAt),
    updatedAt: serverTimestamp(),
    ...(type === 'tv_episode' ? { episodesWatched: increment(-1) } : {}),
  })
}
