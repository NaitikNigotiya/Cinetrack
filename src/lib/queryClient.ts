import { QueryClient } from '@tanstack/react-query'

// ─── React Query Client ───────────────────────────────────────────────────────

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      /**
       * TMDb data is considered fresh for 5 minutes.
       * After that, React Query will refetch in the background on next use.
       */
      staleTime: 5 * 60 * 1000,

      /**
       * Unused / inactive queries are garbage collected after 30 minutes.
       * This keeps memory tidy while still caching across navigation.
       */
      gcTime: 30 * 60 * 1000,

      /**
       * Retry failed requests up to 2 times before surfacing an error.
       * The TMDb client already handles 429 internally, so this covers
       * transient network failures.
       */
      retry: 2,

      /**
       * 'offlineFirst' — React Query will serve cached data immediately
       * without attempting a network request when offline.
       * Pairs with Firestore's IndexedDB persistence and the PWA service worker.
       */
      networkMode: 'offlineFirst',

      /**
       * Always refetch on window focus so stale data is refreshed
       * when the user switches tabs or comes back to the app.
       */
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 1,
      networkMode: 'offlineFirst',
    },
  },
})
