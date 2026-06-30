import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { lazy } from 'react'

// ── Shared UI Contexts ───────────────────────────────────────────────────────
import { ToastProvider } from '@/components/ui/Toast'

// ── Auth & Layout ───────────────────────────────────────────────────────────
import { AuthGuard } from '@/features/auth/AuthGuard'
import { AppShell } from '@/components/layout/AppShell'
import { ErrorBoundary } from '@/components/ErrorBoundary'

// ── Pages (Eager/Critical Path) ─────────────────────────────────────────────
import LoginPage from '@/pages/LoginPage'
import HomePage from '@/pages/HomePage'
import SearchPage from '@/pages/SearchPage'
import WatchlistPage from '@/pages/WatchlistPage'
import TitleDetailPage from '@/pages/TitleDetailPage'
import NotFoundPage from '@/pages/NotFoundPage'

// ── Lazy-loaded Pages ───────────────────────────────────────────────────────
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage'))
const CalendarPage = lazy(() => import('@/pages/CalendarPage'))
const CollectionsPage = lazy(() => import('@/pages/CollectionsPage'))
const CompletedPage = lazy(() => import('@/pages/CompletedPage'))
const DiscoverPage = lazy(() => import('@/pages/DiscoverPage'))
const EpisodeTrackerPage = lazy(() => import('@/pages/EpisodeTrackerPage'))
const FavoritesPage = lazy(() => import('@/pages/FavoritesPage'))
const HistoryPage = lazy(() => import('@/pages/HistoryPage'))
const NotesPage = lazy(() => import('@/pages/NotesPage'))
const ReviewsPage = lazy(() => import('@/pages/ReviewsPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))
const WatchingPage = lazy(() => import('@/pages/WatchingPage'))

// ─── Router ───────────────────────────────────────────────────────────────────

const router = createBrowserRouter([
  // ── Public: no AuthGuard ──────────────────────────────────────────────────
  {
    path: '/login',
    element: <LoginPage />,
  },

  // ── Protected: AuthGuard wraps AppShell which renders Outlet ──────────────
  {
    element: (
      <AuthGuard>
        <AppShell />
      </AuthGuard>
    ),
    children: [
      {
        path: '/',
        element: (
          <ErrorBoundary fallbackTitle="Dashboard error">
            <HomePage />
          </ErrorBoundary>
        ),
      },
      {
        path: '/search',
        element: (
          <ErrorBoundary fallbackTitle="Search error">
            <SearchPage />
          </ErrorBoundary>
        ),
      },
      {
        path: '/discover',
        element: (
          <ErrorBoundary fallbackTitle="Discover error">
            <DiscoverPage />
          </ErrorBoundary>
        ),
      },
      {
        path: '/watchlist',
        element: (
          <ErrorBoundary fallbackTitle="Watchlist error">
            <WatchlistPage />
          </ErrorBoundary>
        ),
      },
      {
        path: '/watchlist/:id',
        element: (
          <ErrorBoundary fallbackTitle="Title Detail error">
            <TitleDetailPage />
          </ErrorBoundary>
        ),
      },
      {
        path: '/title/:id',
        element: (
          <ErrorBoundary fallbackTitle="Title Detail error">
            <TitleDetailPage />
          </ErrorBoundary>
        ),
      },
      {
        path: '/title/:id/episodes',
        element: (
          <ErrorBoundary fallbackTitle="Episode Tracker error">
            <EpisodeTrackerPage />
          </ErrorBoundary>
        ),
      },
      {
        path: '/watchlist/:id/episodes',
        element: (
          <ErrorBoundary fallbackTitle="Episode Tracker error">
            <EpisodeTrackerPage />
          </ErrorBoundary>
        ),
      },
      {
        path: '/watching',
        element: (
          <ErrorBoundary fallbackTitle="Watching error">
            <WatchingPage />
          </ErrorBoundary>
        ),
      },
      {
        path: '/completed',
        element: (
          <ErrorBoundary fallbackTitle="Completed error">
            <CompletedPage />
          </ErrorBoundary>
        ),
      },
      {
        path: '/collections',
        element: (
          <ErrorBoundary fallbackTitle="Collections error">
            <CollectionsPage />
          </ErrorBoundary>
        ),
      },
      {
        path: '/calendar',
        element: (
          <ErrorBoundary fallbackTitle="Calendar error">
            <CalendarPage />
          </ErrorBoundary>
        ),
      },
      {
        path: '/reviews',
        element: (
          <ErrorBoundary fallbackTitle="Reviews error">
            <ReviewsPage />
          </ErrorBoundary>
        ),
      },
      {
        path: '/notes',
        element: (
          <ErrorBoundary fallbackTitle="Notes error">
            <NotesPage />
          </ErrorBoundary>
        ),
      },
      {
        path: '/analytics',
        element: (
          <ErrorBoundary fallbackTitle="Analytics error">
            <AnalyticsPage />
          </ErrorBoundary>
        ),
      },
      {
        path: '/favorites',
        element: (
          <ErrorBoundary fallbackTitle="Favorites error">
            <FavoritesPage />
          </ErrorBoundary>
        ),
      },
      {
        path: '/history',
        element: (
          <ErrorBoundary fallbackTitle="History error">
            <HistoryPage />
          </ErrorBoundary>
        ),
      },
      {
        path: '/settings',
        element: (
          <ErrorBoundary fallbackTitle="Settings error">
            <SettingsPage />
          </ErrorBoundary>
        ),
      },
    ],
  },

  // ── Catch-all ─────────────────────────────────────────────────────────────
  {
    path: '*',
    element: <NotFoundPage />,
  },
])

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  )
}

