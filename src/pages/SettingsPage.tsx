import { useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, writeBatch, getDocs } from 'firebase/firestore'

import { useAuth } from '@/features/auth/useAuth'
import { useTheme } from '@/contexts/ThemeContext'
import { useWatchlist } from '@/features/watchlist/hooks/useWatchlist'
import { db, COLLECTIONS } from '@/lib/firebase'

import type { WatchlistEntry } from '@/types/app'
import './SettingsPage.css'

export default function SettingsPage() {
  const { user, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const { entries, addEntry } = useWatchlist()
  const navigate = useNavigate()

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Local Preferences (Sync via LocalStorage) ──
  const [ratingSystem, setRatingSystem] = useState(() => {
    return localStorage.getItem('cinetrack-rating-system') || '/ 10'
  })
  const [defaultStatus, setDefaultStatus] = useState(() => {
    return localStorage.getItem('cinetrack-default-status') || 'plan_to_watch'
  })
  const [spoilerFree, setSpoilerFree] = useState(() => {
    return localStorage.getItem('cinetrack-spoiler-free') === 'true'
  })

  // Notifications
  const [fcmAlerts, setFcmAlerts] = useState(false)
  const [weeklyReminder, setWeeklyReminder] = useState(false)
  const [browserPermission, setBrowserPermission] = useState<'default' | 'granted' | 'denied'>('default')

  useEffect(() => {
    if ('Notification' in window) {
      setBrowserPermission(Notification.permission)
    }
  }, [])

  // Sync preference updates to localStorage
  const handleRatingSystemChange = (val: string) => {
    setRatingSystem(val)
    localStorage.setItem('cinetrack-rating-system', val)
  }

  const handleDefaultStatusChange = (val: string) => {
    setDefaultStatus(val)
    localStorage.setItem('cinetrack-default-status', val)
  }

  const handleSpoilerFreeChange = (val: boolean) => {
    setSpoilerFree(val)
    localStorage.setItem('cinetrack-spoiler-free', String(val))
  }

  // ── Handle FCM Alerts toggle ──
  const handleFcmToggle = async () => {
    if (!('Notification' in window)) {
      alert('Notifications are not supported in this browser.')
      return
    }

    const nextVal = !fcmAlerts
    if (nextVal) {
      const permission = await Notification.requestPermission()
      setBrowserPermission(permission)
      if (permission === 'granted') {
        setFcmAlerts(true)
      } else {
        setFcmAlerts(false)
      }
    } else {
      setFcmAlerts(false)
    }
  }

  // ── Sign Out ──
  const handleSignOut = async () => {
    if (confirm("Sign out of CineTrack? You'll need to sign back in.")) {
      try {
        await signOut()
        navigate('/login')
      } catch (err) {
        console.error(err)
      }
    }
  }

  // ── Export Watchlist (JSON download) ──
  const handleExport = () => {
    try {
      const dataStr = JSON.stringify(entries, null, 2)
      const blob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `cinetrack_backup_${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('[CineTrack] Export backup failed:', err)
      alert('Export failed.')
    }
  }

  // ── Import Watchlist (JSON read & merge) ──
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const raw = event.target?.result as string
        const parsed = JSON.parse(raw) as Partial<WatchlistEntry>[]

        if (!Array.isArray(parsed)) {
          alert('Invalid backup format. Backup must be a JSON array.')
          return
        }

        // Loop over entries and merge them using setDoc or addEntry
        for (const item of parsed) {
          if (item.titleId && item.type && item.title) {
            await addEntry({
              titleId: item.titleId,
              type: item.type,
              title: item.title,
              posterPath: item.posterPath || null,
              backdropPath: item.backdropPath || null,
              year: item.year || 0,
              genres: item.genres || [],
              status: item.status || 'plan_to_watch',
            })
          }
        }
        alert('Backup merged successfully!')
      } catch (err) {
        console.error('[CineTrack] Import backup failed:', err)
        alert('Import failed. Please ensure backup file is correct JSON.')
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    }
    reader.readAsText(file)
  }

  // ── Clear Watch History ──
  const handleClearHistory = async () => {
    if (!user) return
    const message = 'Are you sure you want to permanently clear all watch history logs? This action is destructive and cannot be undone.'
    if (confirm(message)) {
      try {
        const historyColRef = collection(db, `users/${user.uid}/${COLLECTIONS.HISTORY}`)
        const snapshot = await getDocs(historyColRef)

        const batch = writeBatch(db)
        snapshot.docs.forEach((docItem) => {
          batch.delete(docItem.ref)
        })

        // Also reset episodes subcollections for TV progress
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

  const isNotificationBlocked = browserPermission === 'denied'

  return (
    <div className="settings-page animate-fade-in">
      <header className="settings-header">
        <h1 className="settings-title">Settings</h1>
      </header>

      <main className="settings-content">
        {/* Permission Banner Block if denied in browser */}
        {isNotificationBlocked && (
          <div
            className="settings-info-banner"
            onClick={() => alert('Please reset notification permissions in your browser site settings.')}
          >
            <span>Notifications blocked. Enable in settings →</span>
          </div>
        )}

        {/* 1. SECTION: APPEARANCE */}
        <section className="settings-section">
          <p className="settings-section-lbl">Appearance</p>
          <div className="settings-group-box">
            {/* Theme picker segmented */}
            <div className="settings-row">
              <div className="settings-row-left">
                <span className="settings-row-title">Theme</span>
                <span className="settings-row-desc">Switch application color palettes</span>
              </div>
              <div className="settings-row-right">
                <div className="segmented-control" role="radiogroup" aria-label="Theme Selection">
                  <button
                    className={`segmented-btn${theme === 'light' ? ' segmented-btn--active' : ''}`}
                    onClick={() => setTheme('light')}
                    role="radio"
                    aria-checked={theme === 'light'}
                    type="button"
                  >
                    ☀️ Light
                  </button>
                  <button
                    className={`segmented-btn${theme === 'system' ? ' segmented-btn--active' : ''}`}
                    onClick={() => setTheme('system')}
                    role="radio"
                    aria-checked={theme === 'system'}
                    type="button"
                  >
                    🌓 System
                  </button>
                  <button
                    className={`segmented-btn${theme === 'dark' ? ' segmented-btn--active' : ''}`}
                    onClick={() => setTheme('dark')}
                    role="radio"
                    aria-checked={theme === 'dark'}
                    type="button"
                  >
                    🌙 Dark
                  </button>
                </div>
              </div>
            </div>

            {/* Rating System */}
            <div className="settings-row">
              <div className="settings-row-left">
                <span className="settings-row-title">Rating System</span>
                <span className="settings-row-desc">Customize details ratings style</span>
              </div>
              <div className="settings-row-right">
                <div className="segmented-control" role="radiogroup" aria-label="Rating System Style">
                  {['/ 10', '/ 5', '/ 5 ★½'].map((val) => {
                    const isActive = ratingSystem === val
                    return (
                      <button
                        key={val}
                        className={`segmented-btn${isActive ? ' segmented-btn--active' : ''}`}
                        onClick={() => handleRatingSystemChange(val)}
                        role="radio"
                        aria-checked={isActive}
                        type="button"
                      >
                        {val}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2. SECTION: TRACKING */}
        <section className="settings-section">
          <p className="settings-section-lbl">Tracking</p>
          <div className="settings-group-box">
            {/* Default Status */}
            <div className="settings-row">
              <div className="settings-row-left">
                <span className="settings-row-title">Default Status</span>
                <span className="settings-row-desc">Set status when adding new items</span>
              </div>
              <div className="settings-row-right">
                <select
                  className="settings-select"
                  value={defaultStatus}
                  onChange={(e) => handleDefaultStatusChange(e.target.value)}
                  aria-label="Default watchlist status"
                >
                  <option value="plan_to_watch">Plan to Watch</option>
                  <option value="watching">Watching</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>

            {/* Spoiler-Free Mode */}
            <div className="settings-row">
              <div className="settings-row-left">
                <span className="settings-row-title">Spoiler-Free Mode</span>
                <span className="settings-row-desc">Hides episode names in the episode tracker</span>
              </div>
              <div className="settings-row-right">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={spoilerFree}
                    onChange={(e) => handleSpoilerFreeChange(e.target.checked)}
                    aria-label="Spoiler free mode toggle"
                  />
                  <span className="toggle-slider" />
                </label>
              </div>
            </div>
          </div>
        </section>

        {/* 3. SECTION: NOTIFICATIONS */}
        <section className="settings-section">
          <p className="settings-section-lbl">Notifications</p>
          <div className="settings-group-box">
            {/* New Episode Alerts */}
            <div className="settings-row">
              <div className="settings-row-left">
                <span className="settings-row-title">New Episode Alerts</span>
                <span className="settings-row-desc">Get push notices when show episodes air</span>
              </div>
              <div className="settings-row-right">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={fcmAlerts}
                    onChange={handleFcmToggle}
                    disabled={isNotificationBlocked}
                    aria-label="New episode alerts toggle"
                  />
                  <span className="toggle-slider" />
                </label>
              </div>
            </div>

            {/* Weekly Reminder */}
            <div className="settings-row">
              <div className="settings-row-left">
                <span className="settings-row-title">Weekly Reminder</span>
                <span className="settings-row-desc">Alert weekly to log watched titles</span>
              </div>
              <div className="settings-row-right">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={weeklyReminder}
                    onChange={(e) => setWeeklyReminder(e.target.checked)}
                    disabled={isNotificationBlocked}
                    aria-label="Weekly reminder toggle"
                  />
                  <span className="toggle-slider" />
                </label>
              </div>
            </div>
          </div>
        </section>

        {/* 4. SECTION: DATA MANAGEMENT */}
        <section className="settings-section">
          <p className="settings-section-lbl">Data</p>
          <div className="settings-group-box">
            {/* Export */}
            <button className="settings-row settings-row-btn" onClick={handleExport} type="button">
              <div className="settings-row-left">
                <span className="settings-btn-text">Export as JSON</span>
                <span className="settings-row-desc">Download a backup file of your watchlist</span>
              </div>
            </button>

            {/* Import */}
            <button
              className="settings-row settings-row-btn"
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              <div className="settings-row-left">
                <span className="settings-btn-text">Import from Backup</span>
                <span className="settings-row-desc">Restore or merge data from a JSON file</span>
              </div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="settings-file-input"
              onChange={handleImport}
              aria-label="File input backup selector"
            />

            {/* Clear History */}
            <button className="settings-row settings-row-btn" onClick={handleClearHistory} type="button">
              <div className="settings-row-left">
                <span className="settings-btn-text settings-btn-text--danger">Clear Watch History</span>
                <span className="settings-row-desc" style={{ color: 'var(--color-error)' }}>
                  Irreversibly clears all logs, dates, and progress
                </span>
              </div>
            </button>
          </div>
        </section>

        {/* 5. SECTION: ACCOUNT */}
        <section className="settings-section">
          <p className="settings-section-lbl">Account</p>
          <div className="settings-group-box">
            <div className="settings-row">
              <div className="settings-row-left">
                <span className="settings-row-title">Signed in as</span>
                <span className="settings-row-desc">{user?.email || 'Guest Explorer'}</span>
              </div>
            </div>
            <button className="settings-row settings-row-btn" onClick={handleSignOut} type="button">
              <div className="settings-row-left">
                <span className="settings-btn-text settings-btn-text--danger">Sign Out</span>
                <span className="settings-row-desc">Log out of your journal account</span>
              </div>
            </button>
          </div>
        </section>

        {/* 6. SECTION: ABOUT */}
        <section className="settings-section">
          <p className="settings-section-lbl">About</p>
          <div className="settings-group-box">
            <div className="settings-row">
              <div className="settings-row-left">
                <span className="settings-row-title">Version</span>
                <span className="settings-row-desc">Build index iteration</span>
              </div>
              <div className="settings-row-right">
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>1.0.0</span>
              </div>
            </div>
            <div className="settings-row">
              <div className="settings-row-left">
                <span className="settings-row-title">Built with</span>
                <span className="settings-row-desc">Firebase · TMDb · React</span>
              </div>
            </div>
          </div>

          {/* TMDb Attribution text */}
          <div className="tmdb-attribution-box">
            <p className="tmdb-attribution-text">
              This product uses the TMDB API but is not endorsed or certified by TMDB.
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}
