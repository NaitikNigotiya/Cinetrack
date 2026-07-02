import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, getDocs, writeBatch } from 'firebase/firestore'
import {
  Palette,
  Settings,
  Database,
  Bell,
  User,
  Info,
  LogOut,
} from 'lucide-react'

import { useTheme } from '@/contexts/ThemeContext'
import { useAuth } from '@/features/auth/useAuth'
import { useWatchlist } from '@/features/watchlist/hooks/useWatchlist'
import { db, COLLECTIONS } from '@/lib/firebase'
import './SettingsPage.css'

export default function SettingsPage() {
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const { user, signOut } = useAuth()
  const { entries } = useWatchlist()

  // ─── STATE MANAGEMENT ───────────────────────────────────────────────────────
  const [dateFormat, setDateFormat] = useState(
    () => localStorage.getItem('cinetrack-date-format') || 'DD/MM/YYYY'
  )
  const [timeFormat, setTimeFormat] = useState(
    () => localStorage.getItem('cinetrack-time-format') || '12h'
  )
  const [defaultStatus, setDefaultStatus] = useState(
    () => localStorage.getItem('cinetrack-default-status') || 'plan_to_watch'
  )
  const [spoilerFree, setSpoilerFree] = useState(
    () => localStorage.getItem('cinetrack-spoiler-free') === 'true'
  )
  const [ratingSystem, setRatingSystem] = useState(
    () => localStorage.getItem('cinetrack-rating-system') || 'ten'
  )
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [episodeAlerts, setEpisodeAlerts] = useState(false)
  const [weeklyRecap, setWeeklyRecap] = useState(false)
  const [accentColor, setAccentColor] = useState(
    () => localStorage.getItem('cinetrack-accent-color') || '#E50914'
  )

  // Apply stored accent color on mount
  useEffect(() => {
    const saved = localStorage.getItem('cinetrack-accent-color')
    if (saved) {
      document.documentElement.style.setProperty('--color-brand', saved)
    }
  }, [])

  // Sync state changes to local storage
  const handleDateFormatChange = (val: string) => {
    setDateFormat(val)
    localStorage.setItem('cinetrack-date-format', val)
  }

  const handleTimeFormatChange = (val: string) => {
    setTimeFormat(val)
    localStorage.setItem('cinetrack-time-format', val)
  }

  const handleDefaultStatusChange = (val: string) => {
    setDefaultStatus(val)
    localStorage.setItem('cinetrack-default-status', val)
  }

  const handleSpoilerFreeChange = (val: boolean) => {
    setSpoilerFree(val)
    localStorage.setItem('cinetrack-spoiler-free', String(val))
  }

  const handleRatingSystemChange = (val: string) => {
    setRatingSystem(val)
    localStorage.setItem('cinetrack-rating-system', val)
  }

  const handleAccentChange = (color: string) => {
    setAccentColor(color)
    document.documentElement.style.setProperty('--color-brand', color)
    localStorage.setItem('cinetrack-accent-color', color)
  }

  // ─── HANDLERS ───────────────────────────────────────────────────────────────
  const downloadFile = (filename: string, data: string) => {
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExport = () => {
    try {
      const dataStr = JSON.stringify(entries, null, 2)
      downloadFile(`cinetrack-backup-${new Date().toISOString().slice(0, 10)}.json`, dataStr)
    } catch (err) {
      console.error('[CineTrack] Export backup failed:', err)
      alert('Export failed.')
    }
  }

  const handleClearHistory = async () => {
    if (!user) return
    const message = 'Are you sure you want to permanently clear all watch history logs? This action is destructive and cannot be undone.'
    if (window.confirm(message)) {
      try {
        const historyColRef = collection(db, `users/${user.uid}/${COLLECTIONS.HISTORY}`)
        const snapshot = await getDocs(historyColRef)

        const batch = writeBatch(db)
        snapshot.docs.forEach((docItem) => {
          batch.delete(docItem.ref)
        })

        // Reset episodes subcollections for TV progress
        for (const entry of entries) {
          if (entry.type === 'tv') {
            const epColRef = collection(
              db,
              `users/${user.uid}/${COLLECTIONS.WATCHLIST}/${entry.titleId}/${COLLECTIONS.EPISODES}`
            )
            const epSnap = await getDocs(epColRef)
            epSnap.docs.forEach((epDoc) => {
              batch.delete(epDoc.ref)
            })
          }
        }

        await batch.commit()

        // Reset runtime/episode counters on parent watchlist entries
        const parentBatch = writeBatch(db)
        const watchlistColRef = collection(db, `users/${user.uid}/${COLLECTIONS.WATCHLIST}`)
        const wlSnap = await getDocs(watchlistColRef)

        wlSnap.docs.forEach((wlDoc) => {
          parentBatch.set(
            wlDoc.ref,
            {
              episodesWatched: 0,
              totalRuntime: 0,
              watchDates: [],
            },
            { merge: true }
          )
        })

        await parentBatch.commit()
        alert('Watch history cleared successfully.')
      } catch (err) {
        console.error('[CineTrack] Clear history failed:', err)
        alert('Failed to clear history.')
      }
    }
  }

  const handleSignOutClick = () => {
    if (window.confirm('Are you sure you want to sign out?')) {
      signOut().then(() => {
        navigate('/login')
      })
    }
  }

  return (
    <div className="unified-page-container">
      <header className="unified-page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage your preferences and account</p>
        </div>
      </header>

      {/* ─── APPEARANCE SECTION ─── */}
      <div style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        borderRadius: 'var(--radius-xl)',
        marginBottom: '16px',
        overflow: 'hidden',
        width: '100%',
        boxSizing: 'border-box',
      }}>
        {/* Section header */}
        <div style={{
          padding: '16px 20px 12px',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <Palette size={18} color="var(--color-brand)" />
          <span style={{ fontSize: '13px', fontWeight: 700,
            color: 'var(--text-muted)', textTransform: 'uppercase',
            letterSpacing: '1px' }}>Appearance</span>
        </div>

        {/* Row 1: Theme */}
        <div className="settings-row">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '15px', fontWeight: 600,
              color: 'var(--text-primary)' }}>Theme</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)',
              marginTop: '2px' }}>
              {theme === 'light' && 'IMDb-inspired warm theme'}
              {theme === 'dark' && 'Netflix-inspired dark theme'}
              {theme === 'system' && 'Follows device'}
            </div>
          </div>
          {/* Segmented Control */}
          <div style={{
            display: 'flex', background: 'var(--bg-elevated)',
            borderRadius: 'var(--radius-md)', padding: '3px', gap: '2px',
            border: '1px solid var(--border-default)',
          }}>
            {[
              { value: 'light', label: '☀️ Light' },
              { value: 'system', label: '🌓 System' },
              { value: 'dark', label: '🌙 Dark' }
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value as any)}
                style={{
                  padding: '6px 14px', borderRadius: 'calc(var(--radius-md) - 2px)',
                  border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500,
                  background: theme === opt.value ? 'var(--color-brand)' : 'transparent',
                  color: theme === opt.value ? 'var(--text-on-brand)' : 'var(--text-muted)',
                  transition: 'all 150ms ease', whiteSpace: 'nowrap',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Accent Color */}
        <div className="settings-row">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '15px', fontWeight: 600,
              color: 'var(--text-primary)' }}>Accent Color</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)',
              marginTop: '2px' }}>Customize the app's brand color</div>
          </div>
          {/* Swatches */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {['#E50914', '#F5C518', '#8B5CF6', '#2ECC71', '#00B4D8', '#FF6B6B'].map(color => {
              const isSelected = accentColor === color
              return (
                <button
                  key={color}
                  onClick={() => handleAccentChange(color)}
                  style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    background: color, border: 'none', cursor: 'pointer',
                    outline: isSelected ? '2px solid var(--text-primary)' : 'none',
                    outlineOffset: isSelected ? '2px' : '0px',
                    transform: isSelected ? 'scale(1.2)' : 'none',
                    transition: 'all 150ms ease',
                  }}
                  aria-label={`Select accent color ${color}`}
                />
              )
            })}
          </div>
        </div>

        {/* Row 3: Rating System */}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          gap: '16px',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '15px', fontWeight: 600,
              color: 'var(--text-primary)' }}>Rating System</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)',
              marginTop: '2px' }}>How ratings appear across the app</div>
          </div>
          {/* Segmented Control */}
          <div style={{
            display: 'flex', background: 'var(--bg-elevated)',
            borderRadius: 'var(--radius-md)', padding: '3px', gap: '2px',
            border: '1px solid var(--border-default)',
          }}>
            {[
              { value: 'ten', label: '/10' },
              { value: 'five', label: '/5' },
              { value: 'half', label: '/5½' }
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => handleRatingSystemChange(opt.value)}
                style={{
                  padding: '6px 14px', borderRadius: 'calc(var(--radius-md) - 2px)',
                  border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500,
                  background: ratingSystem === opt.value ? 'var(--color-brand)' : 'transparent',
                  color: ratingSystem === opt.value ? 'var(--text-on-brand)' : 'var(--text-muted)',
                  transition: 'all 150ms ease', whiteSpace: 'nowrap',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── GENERAL SECTION ─── */}
      <div style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        borderRadius: 'var(--radius-xl)',
        marginBottom: '16px',
        overflow: 'hidden',
        width: '100%',
        boxSizing: 'border-box',
      }}>
        {/* Section header */}
        <div style={{
          padding: '16px 20px 12px',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <Settings size={18} color="var(--color-brand)" />
          <span style={{ fontSize: '13px', fontWeight: 700,
            color: 'var(--text-muted)', textTransform: 'uppercase',
            letterSpacing: '1px' }}>General</span>
        </div>

        {/* Row 1: Date Format */}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-default)',
          gap: '16px',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '15px', fontWeight: 600,
              color: 'var(--text-primary)' }}>Date Format</div>
          </div>
          {/* Segmented Control */}
          <div style={{
            display: 'flex', background: 'var(--bg-elevated)',
            borderRadius: 'var(--radius-md)', padding: '3px', gap: '2px',
            border: '1px solid var(--border-default)',
          }}>
            {[
              { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
              { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
              { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' }
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => handleDateFormatChange(opt.value)}
                style={{
                  padding: '6px 14px', borderRadius: 'calc(var(--radius-md) - 2px)',
                  border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500,
                  background: dateFormat === opt.value ? 'var(--color-brand)' : 'transparent',
                  color: dateFormat === opt.value ? 'var(--text-on-brand)' : 'var(--text-muted)',
                  transition: 'all 150ms ease', whiteSpace: 'nowrap',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Time Format */}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-default)',
          gap: '16px',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '15px', fontWeight: 600,
              color: 'var(--text-primary)' }}>Time Format</div>
          </div>
          {/* Segmented Control */}
          <div style={{
            display: 'flex', background: 'var(--bg-elevated)',
            borderRadius: 'var(--radius-md)', padding: '3px', gap: '2px',
            border: '1px solid var(--border-default)',
          }}>
            {[
              { value: '12h', label: '12h' },
              { value: '24h', label: '24h' }
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => handleTimeFormatChange(opt.value)}
                style={{
                  padding: '6px 14px', borderRadius: 'calc(var(--radius-md) - 2px)',
                  border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500,
                  background: timeFormat === opt.value ? 'var(--color-brand)' : 'transparent',
                  color: timeFormat === opt.value ? 'var(--text-on-brand)' : 'var(--text-muted)',
                  transition: 'all 150ms ease', whiteSpace: 'nowrap',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Row 3: Default Status */}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-default)',
          gap: '16px',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '15px', fontWeight: 600,
              color: 'var(--text-primary)' }}>Default Status</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)',
              marginTop: '2px' }}>Status applied when adding new titles</div>
          </div>
          <select
            value={defaultStatus}
            onChange={(e) => handleDefaultStatusChange(e.target.value)}
            className="cinetrack-select"
            style={{
              width: 'auto',
            }}
          >
            <option value="plan_to_watch">Plan to Watch</option>
            <option value="watching">Watching</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        {/* Row 4: Spoiler-Free Mode */}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          gap: '16px',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '15px', fontWeight: 600,
              color: 'var(--text-primary)' }}>Spoiler-Free Mode</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)',
              marginTop: '2px' }}>Hides episode titles in the tracker</div>
          </div>
          {/* Custom Toggle Switch */}
          <div
            onClick={() => handleSpoilerFreeChange(!spoilerFree)}
            style={{
              width: '44px', height: '24px', borderRadius: '999px',
              background: spoilerFree ? 'var(--color-brand)' : 'var(--border-strong)',
              position: 'relative', cursor: 'pointer',
              transition: 'background 200ms ease', flexShrink: 0,
            }}
          >
            <div style={{
              position: 'absolute', top: '2px',
              left: spoilerFree ? '22px' : '2px',
              width: '20px', height: '20px', borderRadius: '50%',
              background: 'white',
              transition: 'left 200ms ease',
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }} />
          </div>
        </div>
      </div>

      {/* ─── DATA & SYNC SECTION ─── */}
      <div style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        borderRadius: 'var(--radius-xl)',
        marginBottom: '16px',
        overflow: 'hidden',
        width: '100%',
        boxSizing: 'border-box',
      }}>
        {/* Section header */}
        <div style={{
          padding: '16px 20px 12px',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <Database size={18} color="var(--color-brand)" />
          <span style={{ fontSize: '13px', fontWeight: 700,
            color: 'var(--text-muted)', textTransform: 'uppercase',
            letterSpacing: '1px' }}>Data & Sync</span>
        </div>

        {/* Row 1: Sync Status */}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-default)',
          gap: '16px',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '15px', fontWeight: 600,
              color: 'var(--text-primary)' }}>Sync Status</div>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <div style={{
              width: '8px', height: '8px', background: '#2ECC71',
              borderRadius: '50%',
            }} />
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-success)' }}>
              Connected
            </span>
          </div>
        </div>

        {/* Row 2: Export Data */}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-default)',
          gap: '16px',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '15px', fontWeight: 600,
              color: 'var(--text-primary)' }}>Export Data</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)',
              marginTop: '2px' }}>Download all your data as JSON</div>
          </div>
          <button
            onClick={handleExport}
            style={{
              padding: '8px 16px', background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
              fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer',
            }}
          >
            Export JSON
          </button>
        </div>

        {/* Row 3: Clear Watch History */}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          gap: '16px',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '15px', fontWeight: 600,
              color: 'var(--text-primary)' }}>Clear Watch History</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)',
              marginTop: '2px' }}>Permanently delete your watch history log</div>
          </div>
          <button
            onClick={handleClearHistory}
            style={{
              padding: '8px 16px', background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-md)',
              fontSize: '13px', fontWeight: 600, color: 'var(--color-error)', cursor: 'pointer',
            }}
          >
            Clear History
          </button>
        </div>
      </div>

      {/* ─── NOTIFICATIONS SECTION ─── */}
      <div style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        borderRadius: 'var(--radius-xl)',
        marginBottom: '16px',
        overflow: 'hidden',
        width: '100%',
        boxSizing: 'border-box',
      }}>
        {/* Section header */}
        <div style={{
          padding: '16px 20px 12px',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <Bell size={18} color="var(--color-brand)" />
          <span style={{ fontSize: '13px', fontWeight: 700,
            color: 'var(--text-muted)', textTransform: 'uppercase',
            letterSpacing: '1px' }}>Notifications</span>
        </div>

        {/* Row 1: Push Notifications */}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-default)',
          gap: '16px',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '15px', fontWeight: 600,
              color: 'var(--text-primary)' }}>Push Notifications</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)',
              marginTop: '2px' }}>Enable browser push notifications</div>
          </div>
          {/* Custom Toggle Switch */}
          <div
            onClick={() => setNotificationsEnabled(!notificationsEnabled)}
            style={{
              width: '44px', height: '24px', borderRadius: '999px',
              background: notificationsEnabled ? 'var(--color-brand)' : 'var(--border-strong)',
              position: 'relative', cursor: 'pointer',
              transition: 'background 200ms ease', flexShrink: 0,
            }}
          >
            <div style={{
              position: 'absolute', top: '2px',
              left: notificationsEnabled ? '22px' : '2px',
              width: '20px', height: '20px', borderRadius: '50%',
              background: 'white',
              transition: 'left 200ms ease',
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }} />
          </div>
        </div>

        {/* Row 2: New Episode Alerts */}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-default)',
          gap: '16px',
          opacity: notificationsEnabled ? 1 : 0.5,
          pointerEvents: notificationsEnabled ? 'auto' : 'none',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '15px', fontWeight: 600,
              color: 'var(--text-primary)' }}>New Episode Alerts</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)',
              marginTop: '2px' }}>Get notified when new episodes release</div>
          </div>
          {/* Custom Toggle Switch */}
          <div
            onClick={() => setEpisodeAlerts(!episodeAlerts)}
            style={{
              width: '44px', height: '24px', borderRadius: '999px',
              background: episodeAlerts ? 'var(--color-brand)' : 'var(--border-strong)',
              position: 'relative', cursor: 'pointer',
              transition: 'background 200ms ease', flexShrink: 0,
            }}
          >
            <div style={{
              position: 'absolute', top: '2px',
              left: episodeAlerts ? '22px' : '2px',
              width: '20px', height: '20px', borderRadius: '50%',
              background: 'white',
              transition: 'left 200ms ease',
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }} />
          </div>
        </div>

        {/* Row 3: Weekly Recap */}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          gap: '16px',
          opacity: notificationsEnabled ? 1 : 0.5,
          pointerEvents: notificationsEnabled ? 'auto' : 'none',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '15px', fontWeight: 600,
              color: 'var(--text-primary)' }}>Weekly Recap</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)',
              marginTop: '2px' }}>Weekly summary of your watching activity</div>
          </div>
          {/* Custom Toggle Switch */}
          <div
            onClick={() => setWeeklyRecap(!weeklyRecap)}
            style={{
              width: '44px', height: '24px', borderRadius: '999px',
              background: weeklyRecap ? 'var(--color-brand)' : 'var(--border-strong)',
              position: 'relative', cursor: 'pointer',
              transition: 'background 200ms ease', flexShrink: 0,
            }}
          >
            <div style={{
              position: 'absolute', top: '2px',
              left: weeklyRecap ? '22px' : '2px',
              width: '20px', height: '20px', borderRadius: '50%',
              background: 'white',
              transition: 'left 200ms ease',
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }} />
          </div>
        </div>
      </div>

      {/* ─── ACCOUNT SECTION ─── */}
      <div style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        borderRadius: 'var(--radius-xl)',
        marginBottom: '16px',
        overflow: 'hidden',
        width: '100%',
        boxSizing: 'border-box',
      }}>
        {/* Section header */}
        <div style={{
          padding: '16px 20px 12px',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <User size={18} color="var(--color-brand)" />
          <span style={{ fontSize: '13px', fontWeight: 700,
            color: 'var(--text-muted)', textTransform: 'uppercase',
            letterSpacing: '1px' }}>Account</span>
        </div>

        {/* Row 1: Signed in as */}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-default)',
          gap: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'User'}
                style={{ width: '40px', height: '40px', borderRadius: '50%' }}
              />
            ) : (
              <div style={{
                width: '40px', height: '40px', borderRadius: '50%',
                background: 'var(--bg-overlay)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: '16px', color: 'var(--text-secondary)'
              }}>
                {(user?.displayName || user?.email || '?').charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {user?.displayName || 'CineTrack User'}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                {user?.email}
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Sign Out */}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          gap: '16px',
        }}>
          <button
            onClick={handleSignOutClick}
            style={{
              width: '100%', padding: '12px',
              background: 'rgba(229,9,20,0.08)',
              border: '1px solid rgba(229,9,20,0.25)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-error)', fontSize: '14px',
              fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 8,
            }}
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </div>

      {/* ─── ABOUT SECTION ─── */}
      <div style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        borderRadius: 'var(--radius-xl)',
        marginBottom: '16px',
        overflow: 'hidden',
        width: '100%',
        boxSizing: 'border-box',
      }}>
        {/* Section header */}
        <div style={{
          padding: '16px 20px 12px',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <Info size={18} color="var(--color-brand)" />
          <span style={{ fontSize: '13px', fontWeight: 700,
            color: 'var(--text-muted)', textTransform: 'uppercase',
            letterSpacing: '1px' }}>About</span>
        </div>

        {/* Row 1: Version */}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-default)',
          gap: '16px',
        }}>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>Version</div>
          <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>CineTrack v1.0.0</div>
        </div>

        {/* Row 2: Built with */}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-default)',
          gap: '16px',
        }}>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>Built with</div>
          <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Firebase · TMDb · React</div>
        </div>

        {/* Row 3: TMDb Attribution */}
        <div style={{
          padding: '16px 20px',
          gap: '16px',
        }}>
          <p style={{
            fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.6',
            margin: 0,
          }}>
            This product uses the TMDB API but is not endorsed or certified by TMDB.
          </p>
        </div>
      </div>

    </div>
  )
}
