import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { searchMulti } from '@/lib/tmdb'
import type { TMDbSearchResult } from '@/types/tmdb'

// ─── Types ────────────────────────────────────────────────────────────────────

interface UseSearchReturn {
  results: TMDbSearchResult[]
  isLoading: boolean
  isError: boolean
  isEmpty: boolean
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSearch(query: string): UseSearchReturn {
  // Internal debounced value — avoids firing a query on every keystroke
  const [debouncedQuery, setDebouncedQuery] = useState(query)

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 400)
    return () => clearTimeout(id)
  }, [query])

  const enabled = debouncedQuery.trim().length >= 2

  const { data, isLoading, isError } = useQuery({
    queryKey: ['search', debouncedQuery] as const,
    queryFn: () => searchMulti(debouncedQuery),
    enabled,
    staleTime: 5 * 60 * 1000,
    // Keep previous results visible while new ones load (avoids flash)
    placeholderData: (prev) => prev,
  })

  // Strip person results — we only track movies and TV shows
  const results = (data?.results ?? []).filter(
    (r): r is TMDbSearchResult => r.media_type !== 'person',
  )

  return {
    results,
    isLoading: enabled && isLoading,
    isError,
    isEmpty: enabled && !isLoading && !isError && results.length === 0,
  }
}
