import { NavLink } from 'react-router-dom'
import { Home, Search, List, BarChart2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import './BottomNav.css'

// ─── Nav Items Config ─────────────────────────────────────────────────────────

interface NavItem {
  to: string
  icon: LucideIcon
  label: string
  end?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/',          icon: Home,     label: 'Home',      end: true },
  { to: '/search',    icon: Search,   label: 'Search' },
  { to: '/watchlist', icon: List,     label: 'Watchlist' },
  { to: '/analytics', icon: BarChart2, label: 'Analytics' },
]

// ─── Component ────────────────────────────────────────────────────────────────

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {NAV_ITEMS.map(({ to, icon: Icon, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end ?? false}
          className={({ isActive }) =>
            ['bottom-nav-item', isActive ? 'bottom-nav-item--active' : ''].join(' ').trim()
          }
          aria-label={label}
        >
          <Icon
            size={24}
            strokeWidth={1.75}
            className="bottom-nav-icon"
            aria-hidden="true"
          />
          <span className="bottom-nav-label">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
