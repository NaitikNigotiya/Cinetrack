import type {
  TMDbMovie,
  TMDbTV,
  TMDbSeason,
  TMDbSearchResponse,
} from '@/types/tmdb'

// ─── Config ───────────────────────────────────────────────────────────────────

const BASE_URL = import.meta.env.VITE_TMDB_BASE_URL as string
const API_KEY = import.meta.env.VITE_TMDB_API_KEY as string
/** Bearer token for TMDb v4 API / Authorization-header auth */
export const TMDB_READ_TOKEN = import.meta.env.VITE_TMDB_READ_ACCESS_TOKEN as string

const IMAGE_BASES = {
  w200: import.meta.env.VITE_TMDB_IMAGE_W200 as string,
  w500: import.meta.env.VITE_TMDB_IMAGE_W500 as string,
  w780: import.meta.env.VITE_TMDB_IMAGE_W780 as string,
  original: import.meta.env.VITE_TMDB_IMAGE_ORIGINAL as string,
} as const

export type ImageSize = keyof typeof IMAGE_BASES

// ─── Rate-limit aware fetch ───────────────────────────────────────────────────

const MAX_RETRIES = 4
const BASE_BACKOFF_MS = 500

async function tmdbFetch<T>(
  path: string,
  params: Record<string, string | number | boolean> = {},
  retries = 0,
): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`)
  url.searchParams.set('api_key', API_KEY)

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value))
  }

  const response = await fetch(url.toString())

  // ── Rate limit: 429 Too Many Requests ──
  if (response.status === 429) {
    if (retries >= MAX_RETRIES) {
      throw new TMDbError('Rate limit exceeded. Please try again later.', 429)
    }
    const retryAfterHeader = response.headers.get('Retry-After')
    const retryAfterMs = retryAfterHeader
      ? parseInt(retryAfterHeader, 10) * 1000
      : BASE_BACKOFF_MS * Math.pow(2, retries)

    await delay(retryAfterMs)
    return tmdbFetch<T>(path, params, retries + 1)
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { status_message?: string }
    throw new TMDbError(
      body.status_message ?? `TMDb request failed: ${response.status}`,
      response.status,
    )
  }

  return response.json() as Promise<T>
}

// ─── Custom Error ─────────────────────────────────────────────────────────────

export class TMDbError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message)
    this.name = 'TMDbError'
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Search movies, TV shows, and people in a single request.
 * Adults content is excluded by default.
 */
export function searchMulti(
  query: string,
  page = 1,
): Promise<TMDbSearchResponse> {
  return tmdbFetch<TMDbSearchResponse>('/search/multi', {
    query,
    page,
    include_adult: false,
  })
}

/**
 * Full movie details with credits, trailer videos, and similar titles.
 */
export function getMovieDetails(id: number): Promise<TMDbMovie> {
  return tmdbFetch<TMDbMovie>(`/movie/${id}`, {
    append_to_response: 'credits,videos,similar',
  })
}

/**
 * Full TV show details with credits, trailer videos, and similar titles.
 */
export function getTVDetails(id: number): Promise<TMDbTV> {
  return tmdbFetch<TMDbTV>(`/tv/${id}`, {
    append_to_response: 'credits,videos,similar',
  })
}

/**
 * Season details with full episode list.
 */
export function getTVSeason(tvId: number, season: number): Promise<TMDbSeason> {
  return tmdbFetch<TMDbSeason>(`/tv/${tvId}/season/${season}`)
}

/**
 * Trending titles. Use type='all' for a mixed feed, or 'movie'/'tv' to filter.
 * Window is either 'day' (hourly updates) or 'week'.
 */
export function getTrending(
  type: 'all' | 'movie' | 'tv',
  window: 'day' | 'week',
): Promise<TMDbSearchResponse> {
  return tmdbFetch<TMDbSearchResponse>(`/trending/${type}/${window}`)
}

/**
 * Build a full image URL from a TMDb poster/backdrop path.
 * Returns null when the path is null (missing poster gracefully handled).
 */
export function getImageUrl(
  path: string | null,
  size: ImageSize,
): string | null {
  if (!path) return null
  return `${IMAGE_BASES[size]}${path}`
}

/**
 * Discover new movie releases within a specific date window.
 */
export function getNewReleases(
  startDateStr: string,
  endDateStr: string,
): Promise<TMDbSearchResponse> {
  return tmdbFetch<TMDbSearchResponse>('/discover/movie', {
    'primary_release_date.gte': startDateStr,
    'primary_release_date.lte': endDateStr,
    sort_by: 'popularity.desc',
  })
}

/**
 * Top-rated movies from TMDb.
 */
export function getTopRated(page = 1): Promise<TMDbSearchResponse> {
  return tmdbFetch<TMDbSearchResponse>('/movie/top_rated', { page })
}

/**
 * Discover movies filtered by genre id, sorted by vote_average desc.
 */
export function discoverByGenre(
  genreId: number,
  sortBy = 'popularity.desc',
  page = 1,
): Promise<TMDbSearchResponse> {
  return tmdbFetch<TMDbSearchResponse>('/discover/movie', {
    with_genres: genreId,
    sort_by: sortBy,
    'vote_count.gte': 100,
    page,
  })
}

/**
 * Get title backdrop/poster images from TMDb.
 */
export function getTitleImages(
  type: 'movie' | 'tv',
  id: number,
): Promise<{ backdrops: { file_path: string }[] }> {
  return tmdbFetch<{ backdrops: { file_path: string }[] }>(`/${type}/${id}/images`)
}
