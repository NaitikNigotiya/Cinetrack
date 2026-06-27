import type { Timestamp } from 'firebase/firestore'

// ─── Watchlist Entry ──────────────────────────────────────────────────────────

export type WatchStatus = 'watching' | 'completed' | 'plan_to_watch' | 'dropped'
export type MediaType = 'movie' | 'tv'

export interface WatchlistEntry {
  /** Composite key: 'movie:550' or 'tv:1396' */
  titleId: string
  type: MediaType
  title: string
  posterPath: string | null
  backdropPath: string | null
  /** Release / first-air year */
  year: number
  genres: string[]

  // ── Status & Rating ──
  status: WatchStatus
  /** 0.5–10 scale, null means unrated */
  rating: number | null
  notes: string
  review: string
  isFavorite: boolean

  // ── Watch History ────
  /** Dates the user watched/re-watched the title */
  watchDates: Timestamp[]
  reWatchCount: number
  /** Cumulative minutes watched */
  totalRuntime: number

  // ── TV Progress ──────
  episodesWatched: number
  totalEpisodes: number
  currentSeason: number

  // ── Timestamps ───────
  addedAt: Timestamp
  updatedAt: Timestamp
}

// ─── Season Progress ──────────────────────────────────────────────────────────

export interface SeasonProgress {
  seasonNumber: number
  /** Array of watched episode numbers, e.g. [1, 2, 3] */
  episodesWatched: number[]
  totalEpisodes: number
  completed: boolean
  runtimeMinutes: number
}

// ─── Watch History Entry ──────────────────────────────────────────────────────

export type WatchHistoryType = 'movie' | 'tv_episode'

export interface WatchHistoryEntry {
  id: string
  titleId: string
  title: string
  type: WatchHistoryType
  /** 'S01E03' for episodes, null for movies */
  episodeLabel: string | null
  watchedAt: Timestamp
  runtimeMinutes: number
}

// ─── User Settings ────────────────────────────────────────────────────────────

export type ThemePreference = 'light' | 'dark' | 'system'
export type RatingSystem = 'ten' | 'five' | 'fivehalf'

export interface UserSettings {
  theme: ThemePreference
  /** Rating display scale */
  ratingSystem: RatingSystem
  defaultStatus: WatchStatus
  notificationsEnabled: boolean
}

// ─── Utility: App-side WatchlistEntry (Dates converted from Timestamps) ───────

export interface WatchlistEntryClient extends Omit<WatchlistEntry, 'watchDates' | 'addedAt' | 'updatedAt'> {
  watchDates: Date[]
  addedAt: Date
  updatedAt: Date
}
