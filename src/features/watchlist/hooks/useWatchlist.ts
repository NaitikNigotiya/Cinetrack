import { useCallback } from 'react'
import {
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db, COLLECTIONS } from '@/lib/firebase'
import { useAuth } from '@/features/auth/useAuth'
import { useWatchlistStore } from '../watchlistStore'
import { queueOperation } from '@/pwa/offlineQueue'
import type { WatchlistEntry, MediaType, WatchStatus } from '@/types/app'

// ─── Public types ─────────────────────────────────────────────────────────────

export interface AddEntryParams {
  titleId: string
  type: MediaType
  title: string
  posterPath: string | null
  backdropPath: string | null
  year: number
  genres: string[]
  status: WatchStatus
}

/** Fields that callers are allowed to update after creation */
export type EntryUpdates = Partial<
  Pick<
    WatchlistEntry,
    | 'status'
    | 'rating'
    | 'notes'
    | 'review'
    | 'isFavorite'
    | 'watchDates'
    | 'reWatchCount'
    | 'totalRuntime'
    | 'episodesWatched'
    | 'totalEpisodes'
    | 'currentSeason'
  >
>

export interface UseWatchlistReturn {
  entries: WatchlistEntry[]
  isLoading: boolean
  total: number
  /** Total minutes across all entries */
  totalRuntime: number
  addEntry: (params: AddEntryParams) => Promise<void>
  updateEntry: (titleId: string, updates: EntryUpdates) => Promise<void>
  removeEntry: (titleId: string) => Promise<void>
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWatchlist(): UseWatchlistReturn {
  const { user } = useAuth()
  const {
    entries,
    isLoaded,
    addEntry: storeAdd,
    updateEntry: storeUpdate,
    removeEntry: storeRemove,
  } = useWatchlistStore()

  const total = entries.length
  const totalRuntime = entries.reduce((sum, e) => sum + e.totalRuntime, 0)

  // ── addEntry ──────────────────────────────────────────────────────────────

  const addEntry = useCallback(
    async (params: AddEntryParams) => {
      if (!user) return
      // Duplicate guard
      if (entries.some((e) => e.titleId === params.titleId)) return

      const now = Timestamp.now()
      const newEntry: WatchlistEntry = {
        ...params,
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
        addedAt: now,
        updatedAt: now,
      }

      // Optimistic
      storeAdd(newEntry)

      // Offline queue fallback
      if (!navigator.onLine) {
        await queueOperation({
          type: 'addEntry',
          payload: {
            titleId: params.titleId,
            data: {
              ...newEntry,
              // Convert timestamps to ISO string representation to make them IndexedDB serializable
              addedAt: newEntry.addedAt.toDate().toISOString(),
              updatedAt: newEntry.updatedAt.toDate().toISOString(),
            },
          },
        })
        return
      }

      try {
        const ref = doc(db, `users/${user.uid}/${COLLECTIONS.WATCHLIST}`, params.titleId)
        // Cast needed: serverTimestamp() is FieldValue at write-time, Timestamp at read-time
        await setDoc(ref, {
          ...(newEntry as unknown as Record<string, unknown>),
          addedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      } catch (err) {
        storeRemove(params.titleId) // rollback
        throw err
      }
    },
    [user, entries, storeAdd, storeRemove],
  )

  // ── updateEntry ───────────────────────────────────────────────────────────

  const updateEntry = useCallback(
    async (titleId: string, updates: EntryUpdates) => {
      if (!user) return
      const previous = entries.find((e) => e.titleId === titleId)
      if (!previous) return

      const now = Timestamp.now()
      // Optimistic
      storeUpdate(titleId, { ...updates, updatedAt: now })

      // Offline queue fallback
      if (!navigator.onLine) {
        await queueOperation({
          type: 'updateEntry',
          payload: {
            titleId,
            data: {
              ...updates,
              updatedAt: now.toDate().toISOString(),
            },
          },
        })
        return
      }

      try {
        const ref = doc(db, `users/${user.uid}/${COLLECTIONS.WATCHLIST}`, titleId)
        await setDoc(
          ref,
          { ...(updates as unknown as Record<string, unknown>), updatedAt: serverTimestamp() },
          { merge: true },
        )
      } catch (err) {
        storeUpdate(titleId, previous) // rollback
        throw err
      }
    },
    [user, entries, storeUpdate],
  )

  // ── removeEntry ───────────────────────────────────────────────────────────

  const removeEntry = useCallback(
    async (titleId: string) => {
      if (!user) return
      const previous = entries.find((e) => e.titleId === titleId)
      if (!previous) return

      // Optimistic
      storeRemove(titleId)

      // Offline queue fallback
      if (!navigator.onLine) {
        await queueOperation({
          type: 'removeEntry',
          payload: {
            titleId,
          },
        })
        return
      }

      try {
        const ref = doc(db, `users/${user.uid}/${COLLECTIONS.WATCHLIST}`, titleId)
        await deleteDoc(ref)
      } catch (err) {
        storeAdd(previous) // rollback
        throw err
      }
    },
    [user, entries, storeRemove, storeAdd],
  )

  return { entries, isLoading: !isLoaded, total, totalRuntime, addEntry, updateEntry, removeEntry }
}
