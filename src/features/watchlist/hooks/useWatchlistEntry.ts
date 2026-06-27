import { useWatchlist } from './useWatchlist'
import type { WatchlistEntry } from '@/types/app'
import type { EntryUpdates } from './useWatchlist'

// ─── Types ────────────────────────────────────────────────────────────────────

interface UseWatchlistEntryReturn {
  entry: WatchlistEntry | undefined
  isInList: boolean
  update: (updates: EntryUpdates) => Promise<void>
  remove: () => Promise<void>
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Looks up a single watchlist entry by titleId.
 * Derives from the shared Zustand store — no extra Firestore listener.
 * Used by TitleDetailPage and SearchPage to check membership and mutate.
 */
export function useWatchlistEntry(titleId: string): UseWatchlistEntryReturn {
  const { entries, updateEntry, removeEntry } = useWatchlist()

  const entry = entries.find((e) => e.titleId === titleId)

  return {
    entry,
    isInList: entry !== undefined,
    update: (updates) => updateEntry(titleId, updates),
    remove: () => removeEntry(titleId),
  }
}
