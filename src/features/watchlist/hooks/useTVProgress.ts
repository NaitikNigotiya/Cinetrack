import { useEffect, useState, useCallback } from 'react'
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  getDocs,
  limit,
} from 'firebase/firestore'
import { db, COLLECTIONS } from '@/lib/firebase'
import { useAuth } from '@/features/auth/useAuth'
import { logHistoryEvent, deleteHistoryEvent } from '@/features/history/history'
import type { Timestamp } from 'firebase/firestore'

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTVProgress(titleId: string, tvTitle: string, defaultEpisodeRuntime = 30) {
  const { user } = useAuth()
  const [watchedEpisodes, setWatchedEpisodes] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)

  // Real-time listener for watched episodes of this specific TV show
  useEffect(() => {
    if (!user) return

    const colRef = collection(
      db,
      `users/${user.uid}/${COLLECTIONS.WATCHLIST}/${titleId}/${COLLECTIONS.EPISODES}`,
    )

    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const episodeIds = snapshot.docs.map((d) => d.id) // e.g. ["S01E01", "S01E02"]
        setWatchedEpisodes(new Set(episodeIds))
        setIsLoading(false)
      },
      (err) => {
        console.error('[CineTrack] TV progress sync error:', err)
        setIsLoading(false)
      },
    )

    return unsubscribe
  }, [user, titleId])

  // Toggle watched status of an episode
  const toggleEpisode = useCallback(
    async (seasonNumber: number, episodeNumber: number, runtime = defaultEpisodeRuntime) => {
      if (!user) return

      const pad = (n: number) => String(n).padStart(2, '0')
      const episodeId = `S${pad(seasonNumber)}E${pad(episodeNumber)}`
      const isWatched = watchedEpisodes.has(episodeId)

      const episodeDocRef = doc(
        db,
        `users/${user.uid}/${COLLECTIONS.WATCHLIST}/${titleId}/${COLLECTIONS.EPISODES}`,
        episodeId,
      )

      if (isWatched) {
        // ── UNWATCH: Remove from subcollection & find history to delete ──
        try {
          // Remove subcollection document
          await deleteDoc(episodeDocRef)

          // Find the corresponding watchHistory entry
          const historyColRef = collection(db, `users/${user.uid}/${COLLECTIONS.HISTORY}`)
          const q = query(
            historyColRef,
            where('titleId', '==', titleId),
            where('episodeLabel', '==', episodeId),
            limit(1),
          )
          const snapshot = await getDocs(q)
          if (!snapshot.empty) {
            const histDoc = snapshot.docs[0]!
            const data = histDoc.data()
            await deleteHistoryEvent(
              user.uid,
              histDoc.id,
              titleId,
              'tv_episode',
              data.runtimeMinutes as number,
              data.watchedAt as Timestamp,
            )
          }
        } catch (err) {
          console.error('[CineTrack] Failed to unwatch episode:', err)
        }
      } else {
        // ── WATCH: Add to subcollection & log watchHistory event ──
        try {
          await setDoc(episodeDocRef, {
            seasonNumber,
            episodeNumber,
            watchedAt: new Date(),
          })

          await logHistoryEvent({
            userId: user.uid,
            titleId,
            title: tvTitle,
            type: 'tv_episode',
            episodeLabel: episodeId,
            runtimeMinutes: runtime,
          })
        } catch (err) {
          console.error('[CineTrack] Failed to watch episode:', err)
        }
      }
    },
    [user, titleId, tvTitle, watchedEpisodes, defaultEpisodeRuntime],
  )

  return { watchedEpisodes, isLoading, toggleEpisode }
}
