import { useCallback, useState } from 'react'

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'cinetrack-recent-searches'
const MAX_RECENT = 8

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readStorage(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as string[]
  } catch {
    return []
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface UseRecentSearchesReturn {
  recent: string[]
  addSearch: (query: string) => void
  clearSearch: (query: string) => void
  clearAll: () => void
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useRecentSearches(): UseRecentSearchesReturn {
  const [recent, setRecent] = useState<string[]>(readStorage)

  const persist = useCallback((searches: string[]) => {
    setRecent(searches)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(searches))
  }, [])

  const addSearch = useCallback(
    (query: string) => {
      const trimmed = query.trim()
      if (!trimmed) return
      // Deduplicate + move to front + cap at MAX_RECENT
      persist(
        [trimmed, ...recent.filter((r) => r !== trimmed)].slice(0, MAX_RECENT),
      )
    },
    [recent, persist],
  )

  const clearSearch = useCallback(
    (query: string) => persist(recent.filter((r) => r !== query)),
    [recent, persist],
  )

  const clearAll = useCallback(() => persist([]), [persist])

  return { recent, addSearch, clearSearch, clearAll }
}
