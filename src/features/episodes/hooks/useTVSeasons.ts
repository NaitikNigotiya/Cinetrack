import { useQuery } from '@tanstack/react-query'
import { getTVSeason } from '@/lib/tmdb'
import type { TMDbSeason } from '@/types/tmdb'

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Fetches details for multiple seasons of a TV show in parallel.
 * Caches results in React Query for 24 hours.
 */
export function useTVSeasons(tvId: number, seasonNumbers: number[]) {
  return useQuery<TMDbSeason[], Error>({
    queryKey: ['tv-seasons', tvId, seasonNumbers] as const,
    queryFn: async () => {
      const details = await Promise.all(
        seasonNumbers.map((num) => getTVSeason(tvId, num)),
      )
      return details
    },
    enabled: tvId > 0 && seasonNumbers.length > 0,
    staleTime: 24 * 60 * 60 * 1000, // Cached for 24 hours
  })
}
