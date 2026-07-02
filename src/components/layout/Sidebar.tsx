import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  Home,
  Search,
  Compass,
  Bookmark,
  Play,
  CheckCircle,
  Heart,
  FolderOpen,
  Calendar,
  Star,
  FileText,
  BarChart2,
  Settings,
  LogOut,
} from 'lucide-react'
import { useAuth } from '@/features/auth/useAuth'
import './Sidebar.css'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, signOut } = useAuth()
  const location = useLocation()

  // Close sidebar on path change (mobile)
  useEffect(() => {
    onClose()
  }, [location.pathname])

  // Touch Swipe Handling for Swipe Left to Close
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0]!.clientX)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0]!.clientX)
  }

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    const distance = touchStart - touchEnd
    // Swipe left is when start is greater than end by a threshold
    if (distance > 60) {
      onClose()
    }
    setTouchStart(null)
    setTouchEnd(null)
  }

  const menuGroups = [
    {
      label: 'MAIN',
      items: [
        { label: 'Dashboard', to: '/', icon: Home, end: true },
        { label: 'Search', to: '/search', icon: Search },
        { label: 'Discover', to: '/discover', icon: Compass },
      ],
    },
    {
      label: 'MY LIBRARY',
      items: [
        { label: 'Watchlist', to: '/watchlist', icon: Bookmark },
        { label: 'Watching', to: '/watching', icon: Play },
        { label: 'Completed', to: '/completed', icon: CheckCircle },
        { label: 'Favorites', to: '/favorites', icon: Heart },
        { label: 'Collections', to: '/collections', icon: FolderOpen },
      ],
    },
    {
      label: 'TRACK',
      items: [
        { label: 'Calendar', to: '/calendar', icon: Calendar },
        { label: 'Reviews', to: '/reviews', icon: Star },
        { label: 'Notes', to: '/notes', icon: FileText },
        { label: 'Analytics', to: '/analytics', icon: BarChart2 },
      ],
    },
    {
      label: 'OTHER',
      items: [
        { label: 'Settings', to: '/settings', icon: Settings },
      ],
    },
  ]

  return (
    <>
      {/* Backdrop overlay behind sidebar on mobile */}
      {isOpen && (
        <div
          className="sidebar-backdrop mobile-only animate-fade-in"
          onClick={onClose}
        />
      )}

      {/* Main Sidebar Panel */}
      <aside
        className={`sidebar-aside app-sidebar ${isOpen ? 'sidebar-aside--open' : ''}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
          
          {/* Logo — fixed at top */}
          <div className="sidebar-logo" style={{
            padding: '24px 20px 20px 20px',
            borderBottom: '1px solid var(--border-default)',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: 'var(--color-brand)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                fontSize: 20,
              }}>
                🎬
              </div>
              <div>
                <div style={{
                  fontSize: 20, fontWeight: 900, letterSpacing: '0.5px', lineHeight: 1,
                  color: 'var(--text-primary)',
                }}>
                  CINE<span style={{ color: 'var(--color-brand)' }}>TRACK</span>
                </div>
                <div style={{
                  fontSize: 9, fontWeight: 600, letterSpacing: '2px',
                  color: 'var(--text-muted)', marginTop: 3, textTransform: 'uppercase',
                }}>
                  Track · Rate · Remember
                </div>
              </div>
            </div>
          </div>

          {/* Nav groups — takes all remaining space */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
            <nav className="sidebar-nav-container" style={{ overflow: 'visible' }}>
              {menuGroups.map((group) => (
                <div key={group.label} className="sidebar-nav-group">
                  <div className="sidebar-group-label">{group.label}</div>
                  {group.items.map((item) => {
                    const Icon = item.icon
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end ?? false}
                        className={({ isActive }) =>
                          `sidebar-nav-item ${isActive ? 'sidebar-nav-item--active' : ''}`
                        }
                      >
                        <Icon size={18} className="sidebar-item-icon" />
                        <span>{item.label}</span>
                      </NavLink>
                    )
                  })}
                </div>
              ))}
            </nav>
          </div>

          {/* Profile — pinned at bottom */}
          <div style={{
            borderTop: '1px solid var(--border-default)',
            padding: '16px',
            background: 'var(--bg-secondary)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <img
                src={user?.photoURL || ''}
                alt={user?.displayName || ''}
                style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
              />
              <div style={{ overflow: 'hidden', flex: 1 }}>
                <div style={{
                  fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                }}>
                  {user?.displayName}
                </div>
                <div style={{
                  fontSize: 11, color: 'var(--text-muted)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                }}>
                  {user?.email}
                </div>
              </div>
            </div>
            <button
              onClick={signOut}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-default)',
                background: 'transparent',
                color: 'var(--color-error)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'background var(--transition-fast)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(192,57,43,0.1)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <LogOut size={14} />
              Sign Out
            </button>
          </div>

        </div>
      </aside>
    </>
  )
}
