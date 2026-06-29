import React, { useRef, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, getDocs, writeBatch } from 'firebase/firestore'
import {
  Globe, Palette, Database, Bell, Info, LogOut,
  Sun, Moon, Monitor, Download, Upload, Trash2,
  Wifi, WifiOff, ChevronDown, ChevronRight,
} from 'lucide-react'

import { useAuth } from '@/features/auth/useAuth'
import { useTheme } from '@/contexts/ThemeContext'
import { useWatchlist } from '@/features/watchlist/hooks/useWatchlist'
import { db, COLLECTIONS } from '@/lib/firebase'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import type { WatchlistEntry } from '@/types/app'
import './SettingsPage.css'

// ─── Constants ────────────────────────────────────────────────────────────────

type NavSection = 'general' | 'appearance' | 'data' | 'notifications' | 'about'

const NAV_ITEMS: { id: NavSection; label: string; icon: React.ReactNode }[] = [
  { id: 'general',       label: 'General',       icon: <Globe size={15} /> },
  { id: 'appearance',    label: 'Appearance',     icon: <Palette size={15} /> },
  { id: 'data',          label: 'Data & Sync',    icon: <Database size={15} /> },
  { id: 'notifications', label: 'Notifications',  icon: <Bell size={15} /> },
  { id: 'about',         label: 'About',          icon: <Info size={15} /> },
]

const ACCENT_COLORS = [
  { hex: '#E50914', label: 'Netflix Red' },
  { hex: '#F5C518', label: 'IMDb Gold' },
  { hex: '#8B5CF6', label: 'Purple' },
  { hex: '#2ECC71', label: 'Green' },
  { hex: '#00B4D8', label: 'Teal' },
  { hex: '#FF6B6B', label: 'Coral' },
]

const ACCENT_STORAGE_KEY = 'cinetrack-accent-color'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function applyAccentColor(hex: string) {
  document.documentElement.style.setProperty('--color-brand', hex)
  localStorage.setItem(ACCENT_STORAGE_KEY, hex)
}

function getStoredAccent(): string {
  return localStorage.getItem(ACCENT_STORAGE_KEY) || '#E50914'
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const { entries, addEntry } = useWatchlist()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Active section (desktop nav) ──
  const [activeSection, setActiveSection] = useState<NavSection>('general')
  // On mobile, track which sections are expanded
  const [expandedSections, setExpandedSections] = useState<Set<NavSection>>(
    new Set(['general'])
  )

  // ── General prefs ──
  const [language, setLanguage] = useState('en')
  const [dateFormat, setDateFormat] = useState(() =>
    localStorage.getItem('cinetrack-date-format') || 'DD/MM/YYYY'
  )
  const [timeFormat, setTimeFormat] = useState(() =>
    localStorage.getItem('cinetrack-time-format') || '12h'
  )
  const [defaultStatus, setDefaultStatus] = useState(() =>
    localStorage.getItem('cinetrack-default-status') || 'plan_to_watch'
  )
  const [ratingSystem, setRatingSystem] = useState(() =>
    localStorage.getItem('cinetrack-rating-system') || '/10'
  )
  const [spoilerFree, setSpoilerFree] = useState(() =>
    localStorage.getItem('cinetrack-spoiler-free') === 'true'
  )

  // ── Appearance ──
  const [accentColor, setAccentColor] = useState(getStoredAccent)
  const [posterSize, setPosterSize] = useState(() =>
    localStorage.getItem('cinetrack-poster-size') || 'Medium'
  )
  const [gridDensity, setGridDensity] = useState(() =>
    localStorage.getItem('cinetrack-grid-density') || 'Comfortable'
  )

  // ── Notifications ──
  const [pushEnabled, setPushEnabled] = useState(false)
  const [episodeAlerts, setEpisodeAlerts] = useState(false)
  const [weeklyRecap, setWeeklyRecap] = useState(false)
  const [releaseReminders, setReleaseReminders] = useState(false)
  const [browserPermission, setBrowserPermission] = useState<'default' | 'granted' | 'denied'>('default')

  // ── Data & Sync ──
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [autoBackup, setAutoBackup] = useState(() =>
    localStorage.getItem('cinetrack-auto-backup') === 'true'
  )
  const [lastSyncTime] = useState(() => {
    const saved = localStorage.getItem('cinetrack-last-sync')
    return saved ? new Date(saved) : null
  })

  // ── Confirm dialogs ──
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)
  const [showClearHistoryConfirm, setShowClearHistoryConfirm] = useState(false)

  // ── Online / Offline listener ──
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // ── Browser notification permission ──
  useEffect(() => {
    if ('Notification' in window) {
      setBrowserPermission(Notification.permission)
    }
  }, [])

  // ── Restore saved accent color on mount ──
  useEffect(() => {
    const saved = localStorage.getItem(ACCENT_STORAGE_KEY)
    if (saved) {
      document.documentElement.style.setProperty('--color-brand', saved)
    }
  }, [])

  // ── Save helpers ──
  const save = useCallback((key: string, value: string) => {
    localStorage.setItem(key, value)
  }, [])

  // ── Accent Color ──
  const handleAccentChange = (hex: string) => {
    setAccentColor(hex)
    applyAccentColor(hex)
    showToast('Accent color updated!', 'success')
  }

  // ── Push notifications master toggle ──
  const handlePushToggle = async () => {
    if (!('Notification' in window)) {
      showToast('Notifications are not supported in this browser.', 'error')
      return
    }
    const next = !pushEnabled
    if (next) {
      const perm = await Notification.requestPermission()
      setBrowserPermission(perm)
      if (perm === 'granted') {
        setPushEnabled(true)
        showToast('Push notifications enabled!', 'success')
      } else {
        showToast('Permission was denied.', 'error')
      }
    } else {
      setPushEnabled(false)
    }
  }

  // ── Sign Out ──
  const handleSignOut = async () => {
    try {
      await signOut()
      navigate('/login')
    } catch (err) {
      console.error(err)
      showToast('Failed to sign out. Try again.', 'error')
    }
  }

  // ── Export full backup JSON ──
  const handleExport = async () => {
    if (!user) return
    try {
      showToast('Preparing export...', 'success')

      // Fetch watchlist
      const watchlistSnap = await getDocs(
        collection(db, `users/${user.uid}/${COLLECTIONS.WATCHLIST}`)
      )
      const watchlistData = watchlistSnap.docs.map((d) => ({ id: d.id, ...d.data() }))

      // Fetch history
      const historySnap = await getDocs(
        collection(db, `users/${user.uid}/${COLLECTIONS.HISTORY}`)
      )
      const historyData = historySnap.docs.map((d) => ({ id: d.id, ...d.data() }))

      // Fetch reviews
      const reviewsSnap = await getDocs(
        collection(db, `users/${user.uid}/reviews`)
      )
      const reviewsData = reviewsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))

      // Fetch notes
      const notesSnap = await getDocs(
        collection(db, `users/${user.uid}/notes`)
      )
      const notesData = notesSnap.docs.map((d) => ({ id: d.id, ...d.data() }))

      const exportPayload = {
        exportedAt: new Date().toISOString(),
        version: '1.0.0',
        watchlist: watchlistData,
        history: historyData,
        reviews: reviewsData,
        notes: notesData,
      }

      const dataStr = JSON.stringify(exportPayload, null, 2)
      const blob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `cinetrack-backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      // Record sync time
      localStorage.setItem('cinetrack-last-sync', new Date().toISOString())
      showToast('Backup exported successfully!', 'success')
    } catch (err) {
      console.error('[CineTrack] Export failed:', err)
      showToast('Export failed. Please try again.', 'error')
    }
  }

  // ── Import JSON ──
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const raw = event.target?.result as string
        const parsed = JSON.parse(raw)

        // Support both raw array format (legacy) and new structured format
        const watchlistItems: Partial<WatchlistEntry>[] = Array.isArray(parsed)
          ? parsed
          : (parsed.watchlist ?? [])

        if (!Array.isArray(watchlistItems)) {
          showToast('Invalid backup format. Must be a JSON array or CineTrack export.', 'error')
          return
        }

        let count = 0
        for (const item of watchlistItems) {
          if (item.titleId && item.type && item.title) {
            await addEntry({
              titleId:      item.titleId,
              type:         item.type,
              title:        item.title,
              posterPath:   item.posterPath  || null,
              backdropPath: item.backdropPath || null,
              year:         item.year         || 0,
              genres:       item.genres       || [],
              status:       item.status       || 'plan_to_watch',
            })
            count++
          }
        }

        showToast(`Imported ${count} titles successfully!`, 'success')
      } catch (err) {
        console.error('[CineTrack] Import failed:', err)
        showToast('Import failed. Ensure file is valid JSON.', 'error')
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    }
    reader.readAsText(file)
  }

  // ── Clear Watch History ──
  const handleClearHistory = async () => {
    if (!user) return
    try {
      const historyRef = collection(db, `users/${user.uid}/${COLLECTIONS.HISTORY}`)
      const snap = await getDocs(historyRef)
      const batch = writeBatch(db)
      snap.docs.forEach((d) => batch.delete(d.ref))

      for (const entry of entries) {
        if (entry.type === 'tv') {
          const epRef = collection(
            db,
            `users/${user.uid}/${COLLECTIONS.WATCHLIST}/${entry.titleId}/${COLLECTIONS.EPISODES}`
          )
          const epSnap = await getDocs(epRef)
          epSnap.docs.forEach((ep) => batch.delete(ep.ref))
        }
      }

      await batch.commit()

      // Reset counters on parent entries
      const parentBatch = writeBatch(db)
      const wlSnap = await getDocs(collection(db, `users/${user.uid}/${COLLECTIONS.WATCHLIST}`))
      wlSnap.docs.forEach((doc) => {
        parentBatch.set(doc.ref, { episodesWatched: 0, totalRuntime: 0, watchDates: [] }, { merge: true })
      })
      await parentBatch.commit()

      showToast('Watch history cleared.', 'success')
    } catch (err) {
      console.error(err)
      showToast('Failed to clear history.', 'error')
    }
  }

  // ── Last sync formatter ──
  const formatLastSync = () => {
    if (!lastSyncTime) return 'Never'
    const diffMs = Date.now() - lastSyncTime.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'Just now'
    if (diffMin < 60) return `${diffMin} min ago`
    const diffH = Math.floor(diffMin / 60)
    return `${diffH}h ago`
  }

  // ── Mobile accordion toggle ──
  const toggleMobileSection = (id: NavSection) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const isNotifBlocked = browserPermission === 'denied'

  // ─── Helpers: render individual sections ──────────────────────────────────

  const renderGeneral = () => (
    <section id="section-general" className="settings-section">
      <p className="settings-section-lbl">General</p>
      <div className="settings-group-box">
        {/* Language */}
        <div className="settings-row">
          <div className="settings-row-left">
            <span className="settings-row-title">Language</span>
          </div>
          <div className="settings-row-right">
            <select
              className="settings-select"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              aria-label="Language"
            >
              <option value="en">English</option>
            </select>
          </div>
        </div>

        {/* Date Format */}
        <div className="settings-row">
          <div className="settings-row-left">
            <span className="settings-row-title">Date Format</span>
          </div>
          <div className="settings-row-right">
            <div className="segmented-control" role="radiogroup" aria-label="Date format">
              {['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'].map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  role="radio"
                  aria-checked={dateFormat === fmt}
                  className={`segmented-btn ${dateFormat === fmt ? 'segmented-btn--active' : ''}`}
                  onClick={() => { setDateFormat(fmt); save('cinetrack-date-format', fmt) }}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Time Format */}
        <div className="settings-row">
          <div className="settings-row-left">
            <span className="settings-row-title">Time Format</span>
          </div>
          <div className="settings-row-right">
            <div className="segmented-control" role="radiogroup" aria-label="Time format">
              {['12h', '24h'].map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  role="radio"
                  aria-checked={timeFormat === fmt}
                  className={`segmented-btn ${timeFormat === fmt ? 'segmented-btn--active' : ''}`}
                  onClick={() => { setTimeFormat(fmt); save('cinetrack-time-format', fmt) }}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Default Status */}
        <div className="settings-row">
          <div className="settings-row-left">
            <span className="settings-row-title">Default Status</span>
            <span className="settings-row-desc">Status applied when adding new titles</span>
          </div>
          <div className="settings-row-right">
            <select
              className="settings-select"
              value={defaultStatus}
              onChange={(e) => { setDefaultStatus(e.target.value); save('cinetrack-default-status', e.target.value) }}
              aria-label="Default watchlist status"
            >
              <option value="plan_to_watch">Plan to Watch</option>
              <option value="watching">Watching</option>
            </select>
          </div>
        </div>

        {/* Rating System */}
        <div className="settings-row">
          <div className="settings-row-left">
            <span className="settings-row-title">Rating System</span>
            <span className="settings-row-desc">How ratings appear across the app</span>
          </div>
          <div className="settings-row-right">
            <div className="segmented-control" role="radiogroup" aria-label="Rating system">
              {['/10', '/5', '/5½'].map((sys) => (
                <button
                  key={sys}
                  type="button"
                  role="radio"
                  aria-checked={ratingSystem === sys}
                  className={`segmented-btn ${ratingSystem === sys ? 'segmented-btn--active' : ''}`}
                  onClick={() => { setRatingSystem(sys); save('cinetrack-rating-system', sys) }}
                >
                  {sys}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Spoiler-Free Mode */}
        <div className="settings-row">
          <div className="settings-row-left">
            <span className="settings-row-title">Spoiler-Free Mode</span>
            <span className="settings-row-desc">Hides episode titles in the tracker</span>
          </div>
          <div className="settings-row-right">
            <label className="toggle-switch" aria-label="Spoiler free mode">
              <input
                type="checkbox"
                checked={spoilerFree}
                onChange={(e) => {
                  setSpoilerFree(e.target.checked)
                  save('cinetrack-spoiler-free', String(e.target.checked))
                }}
              />
              <span className="toggle-slider" />
            </label>
          </div>
        </div>
      </div>
    </section>
  )

  const renderAppearance = () => (
    <section id="section-appearance" className="settings-section">
      <p className="settings-section-lbl">Appearance</p>
      <div className="settings-group-box">
        {/* Theme */}
        <div className="settings-row">
          <div className="settings-row-left">
            <div className="settings-row-label-wrap">
              {theme === 'light' ? <Sun size={15} /> : theme === 'dark' ? <Moon size={15} /> : <Monitor size={15} />}
              <span className="settings-row-title">Theme</span>
            </div>
          </div>
          <div className="settings-row-right">
            <div className="segmented-control" role="radiogroup" aria-label="Theme">
              <button
                type="button" role="radio" aria-checked={theme === 'light'}
                className={`segmented-btn ${theme === 'light' ? 'segmented-btn--active' : ''}`}
                onClick={() => setTheme('light')}
              >
                ☀️ Light
              </button>
              <button
                type="button" role="radio" aria-checked={theme === 'system'}
                className={`segmented-btn ${theme === 'system' ? 'segmented-btn--active' : ''}`}
                onClick={() => setTheme('system')}
              >
                System
              </button>
              <button
                type="button" role="radio" aria-checked={theme === 'dark'}
                className={`segmented-btn ${theme === 'dark' ? 'segmented-btn--active' : ''}`}
                onClick={() => setTheme('dark')}
              >
                🌙 Dark
              </button>
            </div>
          </div>
        </div>

        {/* Theme description */}
        <div className="settings-row" style={{ minHeight: 'auto', paddingTop: 4, paddingBottom: 8, borderTop: 'none' }}>
          <span className="settings-row-desc">
            {theme === 'light'  && 'IMDb-inspired warm light theme'}
            {theme === 'dark'   && 'Netflix-inspired deep dark theme'}
            {theme === 'system' && 'Follows your device system preference'}
          </span>
        </div>

        {/* Accent Color */}
        <div className="settings-row">
          <div className="settings-row-left">
            <span className="settings-row-title">Accent Color</span>
            <span className="settings-row-desc">Changes the brand color throughout the app</span>
          </div>
          <div className="settings-row-right">
            <div className="accent-swatches-row">
              {ACCENT_COLORS.map(({ hex, label }) => (
                <button
                  key={hex}
                  type="button"
                  className={`accent-swatch ${accentColor === hex ? 'accent-swatch--active' : ''}`}
                  style={{ background: hex }}
                  onClick={() => handleAccentChange(hex)}
                  aria-label={`Set accent color to ${label}`}
                  title={label}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Poster Size */}
        <div className="settings-row">
          <div className="settings-row-left">
            <span className="settings-row-title">Poster Size</span>
            <span className="settings-row-desc">Affects grid card sizes on listing pages</span>
          </div>
          <div className="settings-row-right">
            <div className="segmented-control" role="radiogroup" aria-label="Poster size">
              {['Small', 'Medium', 'Large'].map((size) => (
                <button
                  key={size}
                  type="button" role="radio" aria-checked={posterSize === size}
                  className={`segmented-btn ${posterSize === size ? 'segmented-btn--active' : ''}`}
                  onClick={() => { setPosterSize(size); save('cinetrack-poster-size', size) }}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Grid Density */}
        <div className="settings-row">
          <div className="settings-row-left">
            <span className="settings-row-title">Grid Density</span>
            <span className="settings-row-desc">Control spacing between poster cards</span>
          </div>
          <div className="settings-row-right">
            <div className="segmented-control" role="radiogroup" aria-label="Grid density">
              {['Comfortable', 'Compact'].map((density) => (
                <button
                  key={density}
                  type="button" role="radio" aria-checked={gridDensity === density}
                  className={`segmented-btn ${gridDensity === density ? 'segmented-btn--active' : ''}`}
                  onClick={() => { setGridDensity(density); save('cinetrack-grid-density', density) }}
                >
                  {density}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )

  const renderData = () => (
    <section id="section-data" className="settings-section">
      <p className="settings-section-lbl">Data & Sync</p>
      <div className="settings-group-box">
        {/* Firebase sync status */}
        <div className="settings-row">
          <div className="settings-row-left">
            <span className="settings-row-title">Firebase Sync</span>
            <span className="settings-row-desc settings-row-desc--sync">
              {isOnline ? 'Last sync: ' + formatLastSync() : 'No internet connection'}
            </span>
          </div>
          <div className="settings-row-right">
            <div className="sync-status">
              <div className={`sync-dot ${isOnline ? 'sync-dot--online' : 'sync-dot--offline'}`} />
              {isOnline ? (
                <Wifi size={14} color="var(--color-success, #22c55e)" />
              ) : (
                <WifiOff size={14} color="var(--color-error, #ef4444)" />
              )}
              <span className="sync-label" style={{ color: isOnline ? 'var(--color-success, #22c55e)' : 'var(--color-error, #ef4444)' }}>
                {isOnline ? 'Connected' : 'Offline'}
              </span>
            </div>
          </div>
        </div>

        {/* Auto Backup */}
        <div className="settings-row">
          <div className="settings-row-left">
            <span className="settings-row-title">Auto Backup</span>
            <span className="settings-row-desc">Automatically save data snapshots</span>
          </div>
          <div className="settings-row-right">
            <label className="toggle-switch" aria-label="Auto backup">
              <input
                type="checkbox"
                checked={autoBackup}
                onChange={(e) => {
                  setAutoBackup(e.target.checked)
                  save('cinetrack-auto-backup', String(e.target.checked))
                }}
              />
              <span className="toggle-slider" />
            </label>
          </div>
        </div>

        {/* Export JSON */}
        <button className="settings-row settings-row-btn" onClick={handleExport} type="button" id="btn-export-data">
          <div className="settings-row-left">
            <div className="settings-row-label-wrap">
              <Download size={15} color="var(--color-brand)" />
              <span className="settings-btn-text settings-btn-text--brand">Export Data</span>
            </div>
            <span className="settings-row-desc">Download watchlist, history, reviews & notes as JSON</span>
          </div>
        </button>

        {/* Import JSON */}
        <button
          className="settings-row settings-row-btn"
          onClick={() => fileInputRef.current?.click()}
          type="button"
          id="btn-import-data"
        >
          <div className="settings-row-left">
            <div className="settings-row-label-wrap">
              <Upload size={15} color="var(--text-secondary)" />
              <span className="settings-btn-text">Import Data</span>
            </div>
            <span className="settings-row-desc">Restore or merge entries from a JSON backup file</span>
          </div>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="settings-file-input"
          onChange={handleImport}
          aria-label="Import backup file"
        />

        {/* Clear History */}
        <button
          className="settings-row settings-row-btn"
          onClick={() => setShowClearHistoryConfirm(true)}
          type="button"
          id="btn-clear-history"
        >
          <div className="settings-row-left">
            <div className="settings-row-label-wrap">
              <Trash2 size={15} color="var(--color-error, #ef4444)" />
              <span className="settings-btn-text settings-btn-text--danger">Clear Watch History</span>
            </div>
            <span className="settings-row-desc" style={{ color: 'var(--color-error, #ef4444)' }}>
              Irreversibly clears all logs, dates, and episode progress
            </span>
          </div>
        </button>
      </div>
    </section>
  )

  const renderNotifications = () => (
    <section id="section-notifications" className="settings-section">
      {isNotifBlocked && (
        <div
          className="settings-info-banner"
          onClick={() => alert('Please reset notification permissions in your browser site settings.')}
        >
          <span>Notifications blocked by browser — Click to fix →</span>
        </div>
      )}
      <p className="settings-section-lbl">Notifications</p>
      <div className="settings-group-box">
        {/* Master Push toggle */}
        <div className="settings-row">
          <div className="settings-row-left">
            <span className="settings-row-title">Push Notifications</span>
            <span className="settings-row-desc">Master toggle for all in-app alerts</span>
          </div>
          <div className="settings-row-right">
            <label className="toggle-switch" aria-label="Push notifications master toggle">
              <input
                type="checkbox"
                checked={pushEnabled}
                onChange={handlePushToggle}
                disabled={isNotifBlocked}
              />
              <span className="toggle-slider" />
            </label>
          </div>
        </div>

        {/* New Episode Alerts */}
        <div className="settings-row">
          <div className="settings-row-left">
            <span className="settings-row-title">New Episode Alerts</span>
            <span className="settings-row-desc">Get notified when show episodes air</span>
          </div>
          <div className="settings-row-right">
            <label className="toggle-switch" aria-label="New episode alerts">
              <input
                type="checkbox"
                checked={episodeAlerts}
                onChange={(e) => setEpisodeAlerts(e.target.checked)}
                disabled={!pushEnabled || isNotifBlocked}
              />
              <span className="toggle-slider" />
            </label>
          </div>
        </div>

        {/* Weekly Recap */}
        <div className="settings-row">
          <div className="settings-row-left">
            <span className="settings-row-title">Weekly Recap</span>
            <span className="settings-row-desc">Receive a weekly summary of your stats</span>
          </div>
          <div className="settings-row-right">
            <label className="toggle-switch" aria-label="Weekly recap">
              <input
                type="checkbox"
                checked={weeklyRecap}
                onChange={(e) => setWeeklyRecap(e.target.checked)}
                disabled={!pushEnabled || isNotifBlocked}
              />
              <span className="toggle-slider" />
            </label>
          </div>
        </div>

        {/* Release Reminders */}
        <div className="settings-row">
          <div className="settings-row-left">
            <span className="settings-row-title">Release Reminders</span>
            <span className="settings-row-desc">Alerts for upcoming release dates in your watchlist</span>
          </div>
          <div className="settings-row-right">
            <label className="toggle-switch" aria-label="Release reminders">
              <input
                type="checkbox"
                checked={releaseReminders}
                onChange={(e) => setReleaseReminders(e.target.checked)}
                disabled={!pushEnabled || isNotifBlocked}
              />
              <span className="toggle-slider" />
            </label>
          </div>
        </div>
      </div>
    </section>
  )

  const renderAbout = () => (
    <section id="section-about" className="settings-section">
      <p className="settings-section-lbl">About</p>
      <div className="settings-group-box">
        {/* App name + version */}
        <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
          <span className="about-app-name">CineTrack v1.0.0</span>
          <span className="about-tagline">Built with ❤️ for movie lovers</span>
        </div>

        {/* Signed-in user */}
        <div className="settings-row">
          <div className="settings-row-left">
            <span className="settings-row-title">Signed in as</span>
            <span className="settings-row-desc">{user?.email || 'Guest Explorer'}</span>
          </div>
        </div>

        {/* Built with */}
        <div className="settings-row">
          <div className="settings-row-left">
            <span className="settings-row-title">Built with</span>
            <span className="settings-row-desc">React · Firebase · TMDb · Vite</span>
          </div>
          <div className="settings-row-right">
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>v1.0.0</span>
          </div>
        </div>

        {/* Links */}
        <div className="settings-row">
          <div className="settings-row-left">
            <span className="settings-row-title">Legal</span>
            <div className="about-links-row" style={{ marginTop: 4 }}>
              <a href="#" className="about-link">Privacy Policy</a>
              <a href="#" className="about-link">Terms of Service</a>
            </div>
          </div>
        </div>

        {/* TMDb attribution */}
        <div className="settings-row" style={{ borderTop: 'none' }}>
          <div className="tmdb-attribution-box" style={{ width: '100%' }}>
            <span className="tmdb-logo-badge">TMDb</span>
            <p className="tmdb-attribution-text">
              This product uses the TMDB API but is not endorsed or certified by TMDB.
            </p>
          </div>
        </div>
      </div>

      {/* Sign Out */}
      <button
        className="btn-sign-out"
        onClick={() => setShowSignOutConfirm(true)}
        type="button"
        id="btn-sign-out"
      >
        <LogOut size={16} />
        Sign Out
      </button>
    </section>
  )

  const SECTION_RENDERERS: Record<NavSection, () => React.ReactElement> = {
    general:       renderGeneral,
    appearance:    renderAppearance,
    data:          renderData,
    notifications: renderNotifications,
    about:         renderAbout,
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="settings-page animate-fade-in">
      <header className="settings-header">
        <h1 className="settings-title">Settings</h1>
      </header>

      <div className="settings-layout">
        {/* ── Left Nav (desktop only) ── */}
        <nav className="settings-nav" aria-label="Settings navigation">
          {NAV_ITEMS.map(({ id, label, icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveSection(id)}
              aria-current={activeSection === id ? 'page' : undefined}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '12px 16px',
                background: activeSection === id ? 'var(--bg-overlay)' : 'none',
                boxShadow: activeSection === id ? 'inset 3px 0 0 var(--color-brand)' : 'none',
                border: 'none', borderBottom: '1px solid var(--border-default)',
                borderRadius: 0,
                color: activeSection === id ? 'var(--color-brand)' : 'var(--text-secondary)',
                fontWeight: activeSection === id ? 600 : 500,
                fontSize: '14px', cursor: 'pointer', textAlign: 'left',
                fontFamily: 'var(--font-family)',
                transition: 'all 130ms ease',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {icon} {label}
              </span>
              <ChevronRight size={14} style={{ opacity: activeSection === id ? 1 : 0.35 }} />
            </button>
          ))}
        </nav>

        {/* ── Right Content (desktop: single section; mobile: all sections) ── */}
        <div className="settings-content-area">
          {/* Desktop: render only active section */}
          <div className="settings-desktop-section">
            {SECTION_RENDERERS[activeSection]()}
          </div>

          {/* Mobile: render all sections as accordions */}
          <div className="settings-mobile-accordion">
            {NAV_ITEMS.map(({ id, label, icon }) => {
              const isExpanded = expandedSections.has(id)
              return (
                <div key={id} className="settings-section" style={{ marginBottom: 0 }}>
                  <button
                    type="button"
                    className="settings-section-lbl"
                    style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 6px' }}
                    onClick={() => toggleMobileSection(id)}
                    aria-expanded={isExpanded}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {icon}
                      {label}
                    </span>
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  {isExpanded && SECTION_RENDERERS[id]()}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Confirm: Sign Out ── */}
      <ConfirmDialog
        isOpen={showSignOutConfirm}
        title="Sign Out"
        description="Are you sure you want to sign out of CineTrack? You'll need to sign back in to access your data."
        confirmLabel="Sign Out"
        confirmVariant="danger"
        onConfirm={handleSignOut}
        onCancel={() => setShowSignOutConfirm(false)}
      />

      {/* ── Confirm: Clear Watch History ── */}
      <ConfirmDialog
        isOpen={showClearHistoryConfirm}
        title="Clear Watch History"
        description="This will permanently delete all watch logs, dates, and episode progress. This action cannot be undone."
        confirmLabel="Clear History"
        confirmVariant="danger"
        onConfirm={() => {
          setShowClearHistoryConfirm(false)
          handleClearHistory()
        }}
        onCancel={() => setShowClearHistoryConfirm(false)}
      />
    </div>
  )
}
