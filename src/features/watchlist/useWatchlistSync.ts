import { useEffect } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db, COLLECTIONS } from '@/lib/firebase'
import { useAuth } from '@/features/auth/useAuth'
import { useWatchlistStore } from './watchlistStore'
import type { WatchlistEntry } from '@/types/app'

/**
 * Real-time Firestore listener — syncs the user's full watchlist into Zustand.
 * Called once from AppShell so the listener is active for the entire session.
 */
export function useWatchlistSync(): void {
  const { user } = useAuth()
  const setEntries = useWatchlistStore((s) => s.setEntries)

  useEffect(() => {
    if (!user) return

    const q = query(
      collection(db, `users/${user.uid}/${COLLECTIONS.WATCHLIST}`),
      orderBy('updatedAt', 'desc'),
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const entries = snapshot.docs.map(
          (d) => ({ titleId: d.id, ...d.data() } as unknown as WatchlistEntry),
        )
        setEntries(entries)
      },
      (err) => {
        console.error('[CineTrack] watchlist sync error:', err)
      },
    )

    return unsubscribe
  }, [user, setEntries])
}
