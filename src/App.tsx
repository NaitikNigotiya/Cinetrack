import { createBrowserRouter, RouterProvider } from 'react-router-dom'

// ── Shared UI Contexts ───────────────────────────────────────────────────────
import { ToastProvider } from '@/components/ui/Toast'

// ── Auth & Layout ───────────────────────────────────────────────────────────
import { AuthGuard } from '@/features/auth/AuthGuard'
import { AppShell } from '@/components/layout/AppShell'

// ── Pages ───────────────────────────────────────────────────────────────────
import LoginPage from '@/pages/LoginPage'
import HomePage from '@/pages/HomePage'
import SearchPage from '@/pages/SearchPage'
import WatchlistPage from '@/pages/WatchlistPage'
import TitleDetailPage from '@/pages/TitleDetailPage'
import AnalyticsPage from '@/pages/AnalyticsPage'
import FavoritesPage from '@/pages/FavoritesPage'
import HistoryPage from '@/pages/HistoryPage'
import SettingsPage from '@/pages/SettingsPage'
import EpisodeTrackerPage from '@/pages/EpisodeTrackerPage'
import NotFoundPage from '@/pages/NotFoundPage'

// ── New Pages ───────────────────────────────────────────────────────────────
import DiscoverPage from '@/pages/DiscoverPage'
import WatchingPage from '@/pages/WatchingPage'
import CompletedPage from '@/pages/CompletedPage'
import CollectionsPage from '@/pages/CollectionsPage'
import CalendarPage from '@/pages/CalendarPage'
import ReviewsPage from '@/pages/ReviewsPage'
import NotesPage from '@/pages/NotesPage'

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
      { path: '/',              element: <HomePage /> },
      { path: '/search',        element: <SearchPage /> },
      { path: '/discover',      element: <DiscoverPage /> },
      { path: '/watchlist',     element: <WatchlistPage /> },
      { path: '/watchlist/:id', element: <TitleDetailPage /> },
      { path: '/title/:id',     element: <TitleDetailPage /> },
      { path: '/watchlist/:id/episodes', element: <EpisodeTrackerPage /> },
      { path: '/watching',      element: <WatchingPage /> },
      { path: '/completed',     element: <CompletedPage /> },
      { path: '/collections',   element: <CollectionsPage /> },
      { path: '/calendar',      element: <CalendarPage /> },
      { path: '/reviews',       element: <ReviewsPage /> },
      { path: '/notes',         element: <NotesPage /> },
      { path: '/analytics',     element: <AnalyticsPage /> },
      { path: '/favorites',     element: <FavoritesPage /> },
      { path: '/history',       element: <HistoryPage /> },
      { path: '/settings',      element: <SettingsPage /> },
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
