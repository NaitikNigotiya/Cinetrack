import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  query,
  where,
  getDocs,
  limit,
  Timestamp,
  increment,
  serverTimestamp,
} from 'firebase/firestore'
import { db, COLLECTIONS } from '@/lib/firebase'
import { useAuth } from '@/features/auth/useAuth'
import { useWatchlistEntry } from '@/features/watchlist/hooks/useWatchlistEntry'
import { logHistoryEvent, deleteHistoryEvent } from '@/features/history/history'
import { queueOperation } from '@/pwa/offlineQueue'
import type { TMDbTV } from '@/types/tmdb'

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface SeasonProgress {
  seasonNumber: number
  episodesWatched: number[] // e.g. [1, 2, 3]
  totalEpisodes: number
  completed: boolean
  runtimeMinutes: number
}

interface UseEpisodeProgressReturn {
  seasons: SeasonProgress[]
  updateEpisode: (seasonNum: number, episodeNum: number, watched: boolean, runtime: number) => Promise<void>
  markSeasonComplete: (seasonNum: number, episodes: { episode_number: number; runtime: number | null }[]) => Promise<void>
  markSeasonIncomplete: (seasonNum: number, episodes: { episode_number: number; runtime: number | null }[]) => Promise<void>
  totalWatched: number
  totalEpisodes: number
  isLoading: boolean
}

const pad = (n: number) => String(n).padStart(2, '0')

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useEpisodeProgress(
  titleId: string,
  tvDetails: TMDbTV | undefined,
  defaultRuntime = 30
): UseEpisodeProgressReturn {
  const { user } = useAuth()
  const { entry, update } = useWatchlistEntry(titleId)

  const [watchedList, setWatchedList] = useState<{ id: string; seasonNumber: number; episodeNumber: number }[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Sync watched episodes list in real-time
  useEffect(() => {
    if (!user) return

    const colRef = collection(
      db,
      `users/${user.uid}/${COLLECTIONS.WATCHLIST}/${titleId}/${COLLECTIONS.EPISODES}`,
    )

    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const items = snapshot.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            seasonNumber: data.seasonNumber as number,
            episodeNumber: data.episodeNumber as number,
          }
        })
        setWatchedList(items)
        setIsLoading(false)
      },
      (err) => {
        console.error('[CineTrack] TV episode sync error:', err)
        setIsLoading(false)
      },
    )

    return unsubscribe
  }, [user, titleId])

  // Map of watched keys like "S01E03" -> true
  const watchedMap = useMemo(() => {
    const map = new Map<string, boolean>()
    watchedList.forEach((item) => {
      map.set(`S${pad(item.seasonNumber)}E${pad(item.episodeNumber)}`, true)
    })
    return map
  }, [watchedList])

  // Get active seasons configurations from TMDB TV Details
  const seasonsConfig = useMemo(() => {
    if (!tvDetails) return []
    return tvDetails.seasons.filter((s) => s.season_number > 0)
  }, [tvDetails])

  // Calculate progress for each season
  const seasons = useMemo<SeasonProgress[]>(() => {
    if (!tvDetails) return []

    return seasonsConfig.map((s) => {
      const seasonNum = s.season_number
      const watched = watchedList
        .filter((w) => w.seasonNumber === seasonNum)
        .map((w) => w.episodeNumber)
        .sort((a, b) => a - b)

      const totalEpisodes = s.episode_count
      const isCompleted = totalEpisodes > 0 && watched.length === totalEpisodes

      // Estimate runtime minutes for watched episodes in this season
      const runTime = watched.length * (tvDetails.episode_run_time?.[0] ?? defaultRuntime)

      return {
        seasonNumber: seasonNum,
        episodesWatched: watched,
        totalEpisodes,
        completed: isCompleted,
        runtimeMinutes: runTime,
      }
    })
  }, [tvDetails, seasonsConfig, watchedList, defaultRuntime])

  const totalWatched = watchedList.length
  const totalEpisodes = tvDetails?.number_of_episodes ?? 0

  // ── 1. Update Episode ──
  const updateEpisode = useCallback(
    async (seasonNum: number, episodeNum: number, watched: boolean, runtime: number) => {
      if (!user) return
      const episodeKey = `S${pad(seasonNum)}E${pad(episodeNum)}`

      // Offline queue fallback
      if (!navigator.onLine) {
        await queueOperation({
          type: 'updateEpisode',
          payload: {
            titleId,
            episodeKey,
            watched,
            data: {
              seasonNumber: seasonNum,
              episodeNumber: episodeNum,
              watchedAt: new Date().toISOString(),
            },
          },
        })
        return
      }
      const episodeDocRef = doc(
        db,
        `users/${user.uid}/${COLLECTIONS.WATCHLIST}/${titleId}/${COLLECTIONS.EPISODES}`,
        episodeKey,
      )

      if (watched) {
        // Watch
        await setDoc(episodeDocRef, {
          seasonNumber: seasonNum,
          episodeNumber: episodeNum,
          watchedAt: new Date(),
        })

        await logHistoryEvent({
          userId: user.uid,
          titleId,
          title: tvDetails?.name || 'TV Show',
          type: 'tv_episode',
          episodeLabel: episodeKey,
          runtimeMinutes: runtime,
        })
      } else {
        // Unwatch
        await deleteDoc(episodeDocRef)

        // Find history doc to delete
        const historyCol = collection(db, `users/${user.uid}/${COLLECTIONS.HISTORY}`)
        const q = query(
          historyCol,
          where('titleId', '==', titleId),
          where('episodeLabel', '==', episodeKey),
          limit(1),
        )
        const snap = await getDocs(q)
        if (!snap.empty) {
          const histDoc = snap.docs[0]!
          const histData = histDoc.data()
          await deleteHistoryEvent(
            user.uid,
            histDoc.id,
            titleId,
            'tv_episode',
            histData.runtimeMinutes as number,
            histData.watchedAt as Timestamp,
          )
        }
      }

      // Update current season focus on parent watchlist
      if (entry && entry.currentSeason !== seasonNum) {
        await update({ currentSeason: seasonNum })
      }
    },
    [user, titleId, tvDetails, entry, update],
  )

  // ── 2. Mark Season Complete ──
  const markSeasonComplete = useCallback(
    async (seasonNum: number, episodes: { episode_number: number; runtime: number | null }[]) => {
      if (!user || !tvDetails) return

      const batch = writeBatch(db)
      let addedEpisodesCount = 0
      let addedRuntime = 0

      for (const ep of episodes) {
        const epKey = `S${pad(seasonNum)}E${pad(ep.episode_number)}`
        if (!watchedMap.has(epKey)) {
          const epDocRef = doc(
            db,
            `users/${user.uid}/${COLLECTIONS.WATCHLIST}/${titleId}/${COLLECTIONS.EPISODES}`,
            epKey,
          )
          batch.set(epDocRef, {
            seasonNumber: seasonNum,
            episodeNumber: ep.episode_number,
            watchedAt: new Date(),
          })

          // Add history event
          const histCol = collection(db, `users/${user.uid}/${COLLECTIONS.HISTORY}`)
          const newHistDocRef = doc(histCol)
          const runTimeVal = ep.runtime ?? tvDetails.episode_run_time?.[0] ?? defaultRuntime
          batch.set(newHistDocRef, {
            titleId,
            title: tvDetails.name,
            type: 'tv_episode',
            episodeLabel: epKey,
            watchedAt: serverTimestamp(),
            runtimeMinutes: runTimeVal,
          })

          addedEpisodesCount++
          addedRuntime += runTimeVal
        }
      }

      if (addedEpisodesCount > 0) {
        // Commit DB updates
        await batch.commit()

        // Update parent watchlist totals
        await update({
          episodesWatched: increment(addedEpisodesCount) as unknown as number,
          totalRuntime: increment(addedRuntime) as unknown as number,
          currentSeason: seasonNum,
        })
      }
    },
    [user, titleId, tvDetails, watchedMap, defaultRuntime, update],
  )

  // ── 3. Mark Season Incomplete ──
  const markSeasonIncomplete = useCallback(
    async (seasonNum: number, episodes: { episode_number: number; runtime: number | null }[]) => {
      if (!user || !tvDetails) return

      const batch = writeBatch(db)
      let removedEpisodesCount = 0
      let removedRuntime = 0

      // Find all history logs for this season
      const historyCol = collection(db, `users/${user.uid}/${COLLECTIONS.HISTORY}`)
      const q = query(
        historyCol,
        where('titleId', '==', titleId)
      )

      // Get history docs to identify which to delete
      const histSnap = await getDocs(q)
      const matchingHistDocs = histSnap.docs.filter((d) => {
        const label = d.data().episodeLabel as string | undefined
        return label?.startsWith(`S${pad(seasonNum)}E`)
      })

      // Delete episode subcollection records
      for (const ep of episodes) {
        const epKey = `S${pad(seasonNum)}E${pad(ep.episode_number)}`
        if (watchedMap.has(epKey)) {
          const epDocRef = doc(
            db,
            `users/${user.uid}/${COLLECTIONS.WATCHLIST}/${titleId}/${COLLECTIONS.EPISODES}`,
            epKey,
          )
          batch.delete(epDocRef)

          // Delete matching history log
          const matchedLog = matchingHistDocs.find((d) => d.data().episodeLabel === epKey)
          if (matchedLog) {
            batch.delete(matchedLog.ref)
          }

          const runTimeVal = ep.runtime ?? tvDetails.episode_run_time?.[0] ?? defaultRuntime
          removedEpisodesCount++
          removedRuntime += runTimeVal
        }
      }

      if (removedEpisodesCount > 0) {
        await batch.commit()

        // Decrement parent watchlist totals
        await update({
          episodesWatched: increment(-removedEpisodesCount) as unknown as number,
          totalRuntime: increment(-removedRuntime) as unknown as number,
          currentSeason: seasonNum,
        })
      }
    },
    [user, titleId, tvDetails, watchedMap, defaultRuntime, update],
  )

  return {
    seasons,
    updateEpisode,
    markSeasonComplete,
    markSeasonIncomplete,
    totalWatched,
    totalEpisodes,
    isLoading,
  }
}
