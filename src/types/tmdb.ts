// ─── TMDb API Response Types ──────────────────────────────────────────────────

export interface TMDbSearchResult {
  id: number
  media_type: 'movie' | 'tv' | 'person'
  title?: string          // movies
  name?: string           // tv & people
  poster_path: string | null
  backdrop_path: string | null
  release_date?: string   // movies
  first_air_date?: string // tv
  vote_average: number
  genre_ids: number[]
  overview: string
}

export interface TMDbSearchResponse {
  results: TMDbSearchResult[]
  total_results: number
  total_pages: number
  page: number
}

// ─── Credits ──────────────────────────────────────────────────────────────────

export interface TMDbCastMember {
  id: number
  name: string
  character: string
  profile_path: string | null
  order: number
}

export interface TMDbCrewMember {
  id: number
  name: string
  job: string
  department: string
  profile_path: string | null
}

export interface TMDbCredits {
  cast: TMDbCastMember[]
  crew: TMDbCrewMember[]
}

// ─── Videos ───────────────────────────────────────────────────────────────────

export interface TMDbVideo {
  id: string
  key: string
  name: string
  site: string
  type: string
  official: boolean
}

export interface TMDbVideos {
  results: TMDbVideo[]
}

// ─── Genre ────────────────────────────────────────────────────────────────────

export interface TMDbGenre {
  id: number
  name: string
}

// ─── Movie ────────────────────────────────────────────────────────────────────

export interface TMDbMovie {
  id: number
  title: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  release_date: string
  runtime: number | null
  vote_average: number
  vote_count: number
  genres: TMDbGenre[]
  status: string
  tagline: string
  budget: number
  revenue: number
  imdb_id: string | null
  credits: TMDbCredits
  videos: TMDbVideos
  similar: TMDbSearchResponse
}

// ─── TV ───────────────────────────────────────────────────────────────────────

export interface TMDbSeasonSummary {
  id: number
  season_number: number
  episode_count: number
  name: string
  poster_path: string | null
  air_date: string | null
}

export interface TMDbTV {
  id: number
  name: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  first_air_date: string
  episode_run_time: number[]
  vote_average: number
  vote_count: number
  genres: TMDbGenre[]
  number_of_seasons: number
  number_of_episodes: number
  seasons: TMDbSeasonSummary[]
  status: string
  tagline: string
  type: string
  credits: TMDbCredits
  videos: TMDbVideos
  similar: TMDbSearchResponse
}

// ─── Season / Episode ─────────────────────────────────────────────────────────

export interface TMDbEpisode {
  id: number
  episode_number: number
  name: string
  overview: string
  runtime: number | null
  still_path: string | null
  air_date: string | null
  vote_average: number
}

export interface TMDbSeason {
  id: number
  season_number: number
  name: string
  overview: string
  poster_path: string | null
  air_date: string | null
  episodes: TMDbEpisode[]
}
