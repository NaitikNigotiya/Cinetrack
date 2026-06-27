import { create } from 'zustand'
import type { WatchlistEntry } from '@/types/app'

// ─── Store Shape ──────────────────────────────────────────────────────────────

interface WatchlistStoreState {
  /** Full entry objects ordered by updatedAt desc (from Firestore) */
  entries: WatchlistEntry[]
  /** Derived string[] kept for O(1)-ish search page membership checks */
  titleIds: string[]
  isLoaded: boolean

  setEntries: (entries: WatchlistEntry[]) => void
  addEntry: (entry: WatchlistEntry) => void
  updateEntry: (titleId: string, updates: Partial<WatchlistEntry>) => void
  removeEntry: (titleId: string) => void
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useWatchlistStore = create<WatchlistStoreState>((set) => ({
  entries: [],
  titleIds: [],
  isLoaded: false,

  setEntries: (entries) =>
    set({ entries, titleIds: entries.map((e) => e.titleId), isLoaded: true }),

  addEntry: (entry) =>
    set((s) => {
      if (s.titleIds.includes(entry.titleId)) return s
      return {
        entries: [entry, ...s.entries],
        titleIds: [entry.titleId, ...s.titleIds],
      }
    }),

  updateEntry: (titleId, updates) =>
    set((s) => ({
      entries: s.entries.map((e) =>
        e.titleId === titleId ? { ...e, ...updates } : e,
      ),
    })),

  removeEntry: (titleId) =>
    set((s) => ({
      entries: s.entries.filter((e) => e.titleId !== titleId),
      titleIds: s.titleIds.filter((id) => id !== titleId),
    })),
}))
