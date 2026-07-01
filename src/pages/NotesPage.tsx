import { useState, useEffect, useMemo, useRef } from 'react'
import { Plus, X, Search, Trash2, Link as LinkIcon, Film, Check } from 'lucide-react'
import { useNotes, type NoteEntry } from '@/features/notes/hooks/useNotes'
import { useWatchlist } from '@/features/watchlist/hooks/useWatchlist'
import { useSearch } from '@/features/search/hooks/useSearch'
import { getImageUrl } from '@/lib/tmdb'
import { useTheme } from '@/contexts/ThemeContext'
import { useToast } from '@/components/ui/Toast'
import './NotesPage.css'

// ─── Constants & Color Swatch Palette ─────────────────────────────────────────

const COLOR_PALETTE = {
  yellow: { light: '#FFF9C4', dark: '#423d14', textLight: '#1a1a1a', textDark: '#f5f5f5', border: '#e8dc7d' },
  green:  { light: '#C8E6C9', dark: '#16331a', textLight: '#1a1a1a', textDark: '#f5f5f5', border: '#a5d6a7' },
  blue:   { light: '#BBDEFB', dark: '#0c253d', textLight: '#1a1a1a', textDark: '#f5f5f5', border: '#90caf9' },
  pink:   { light: '#F8BBD0', dark: '#4c1729', textLight: '#1a1a1a', textDark: '#f5f5f5', border: '#f48fb1' },
  dark:   { light: '#F5F5F5', dark: '#2A2A2A', textLight: '#1a1a1a', textDark: '#f5f5f5', border: '#cccccc' },
  white:  { light: '#FFFFFF', dark: '#1F1F1F', textLight: '#1a1a1a', textDark: '#e8e8e8', border: '#e0dfd8' },
} as const

type ColorKey = keyof typeof COLOR_PALETTE

const CATEGORIES = ['General', 'Watchlist', 'Recommendations', 'Reviews', 'Trivia', 'Marathon']

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function NotesPage() {
  const { theme } = useTheme()
  const { showToast } = useToast()
  const { notes, isLoading, addNote, updateNote, deleteNote } = useNotes()
  const { entries: watchlist } = useWatchlist()

  // Selected note for editing
  const [activeNote, setActiveNote] = useState<NoteEntry | null>(null)

  // Editor states
  const [localTitle, setLocalTitle] = useState('')
  const [localContent, setLocalContent] = useState('')
  const [localCategory, setLocalCategory] = useState('General')
  const [localColor, setLocalColor] = useState<ColorKey>('yellow')
  const [localTitleId, setLocalTitleId] = useState<string | null>(null)

  // Autosave status state
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'dirty'>('saved')
  const saveTimeoutRef = useRef<any>(null)

  // Movie Link state within editor
  const [isLinkPopoverOpen, setIsLinkPopoverOpen] = useState(false)
  const [linkSearchQuery, setLinkSearchQuery] = useState('')
  const { results: linkSearchResults } = useSearch(linkSearchQuery)

  // Map of titleId -> posterPath to render small posters
  const watchlistPosterMap = useMemo(() => {
    const map = new Map<string, string | null>()
    watchlist.forEach((w) => {
      map.set(w.titleId, w.posterPath)
    })
    return map
  }, [watchlist])

  // Map color options for rendering
  const isDarkTheme = theme === 'dark'

  // Trigger autosave debounced loop
  useEffect(() => {
    if (!activeNote) return

    // Skip autosave if the draft hasn't changed from saved version
    if (
      localTitle === activeNote.title &&
      localContent === activeNote.content &&
      localCategory === activeNote.category &&
      localColor === activeNote.color &&
      localTitleId === activeNote.titleId
    ) {
      setSaveStatus('saved')
      return
    }

    setSaveStatus('dirty')

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Debounce save request by 1000ms
    saveTimeoutRef.current = setTimeout(async () => {
      setSaveStatus('saving')
      try {
        await updateNote(activeNote.id, {
          title: localTitle,
          content: localContent,
          category: localCategory,
          color: localColor,
          titleId: localTitleId,
        })
        setSaveStatus('saved')
      } catch (err) {
        console.error('[CineTrack] Autosave error:', err)
        setSaveStatus('dirty')
      }
    }, 1000)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [localTitle, localContent, localCategory, localColor, localTitleId, activeNote, updateNote])

  // Open note in editor
  const handleOpenEditor = (note: NoteEntry) => {
    setActiveNote(note)
    setLocalTitle(note.title)
    setLocalContent(note.content)
    setLocalCategory(note.category || 'General')
    setLocalColor((note.color as ColorKey) || 'yellow')
    setLocalTitleId(note.titleId || null)
    setSaveStatus('saved')
  }

  // Create Note from Template
  const handleCreateFromTemplate = async (templateTitle: string) => {
    const noteTitle = templateTitle === 'Blank Note' ? 'Untitled Note' : templateTitle
    try {
      const newId = await addNote({
        title: noteTitle,
        content: '',
        category: templateTitle === 'Blank Note' ? 'General' : 'Watchlist',
        color: 'yellow',
        titleId: null,
      })

      // Construct a local representation to trigger active editor instantly
      const draftNote: NoteEntry = {
        id: newId,
        title: noteTitle,
        content: '',
        category: templateTitle === 'Blank Note' ? 'General' : 'Watchlist',
        color: 'yellow',
        titleId: null,
        createdAt: null,
        updatedAt: null,
      }

      handleOpenEditor(draftNote)
    } catch (e) {
      console.error(e)
      showToast('Failed to create note.', 'error')
    }
  }

  // Close editor & flush unsaved changes immediately
  const handleCloseEditor = async () => {
    if (activeNote && saveStatus === 'dirty') {
      try {
        await updateNote(activeNote.id, {
          title: localTitle,
          content: localContent,
          category: localCategory,
          color: localColor,
          titleId: localTitleId,
        })
      } catch (err) {
        console.error(err)
      }
    }
    setActiveNote(null)
  }

  // Delete note
  const handleDeleteNote = async (id: string, title: string, event: React.MouseEvent) => {
    event.stopPropagation()
    if (window.confirm(`Delete note "${title}"?`)) {
      try {
        await deleteNote(id)
        showToast('Note deleted.', 'success')
        if (activeNote?.id === id) {
          setActiveNote(null)
        }
      } catch (e) {
        console.error(e)
        showToast('Failed to delete note.', 'error')
      }
    }
  }

  // Inline delete inside editor
  const handleEditorDelete = async () => {
    if (!activeNote) return
    if (window.confirm(`Delete note "${localTitle || 'Untitled'}"?`)) {
      try {
        await deleteNote(activeNote.id)
        showToast('Note deleted.', 'success')
        setActiveNote(null)
      } catch (e) {
        console.error(e)
        showToast('Failed to delete note.', 'error')
      }
    }
  }

  const formatNoteDate = (ts: any) => {
    if (!ts) return 'Just now'
    const date = ts.toDate ? ts.toDate() : new Date(ts)
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className="page-wrapper notes-page page-scroll animate-fade-in">
      <header className="notes-header mobile-header-padding">
        <h1 className="reviews-title page-title">Notes</h1>
        <button className="btn-new-note" onClick={() => handleCreateFromTemplate('Blank Note')}>
          <Plus size={16} />
          New Note
        </button>
      </header>

      {/* Predefined Templates Section */}
      <section className="templates-container">
        <h3 className="templates-title">Predefined Templates</h3>
        <div className="templates-grid">
          <button className="template-card-btn" onClick={() => handleCreateFromTemplate('Movies to Recommend')}>
            <span>📋</span> Movies to Recommend
          </button>
          <button className="template-card-btn" onClick={() => handleCreateFromTemplate('Oscar Watchlist')}>
            <span>🏆</span> Oscar Watchlist
          </button>
          <button className="template-card-btn" onClick={() => handleCreateFromTemplate('Hidden Gems')}>
            <span>💎</span> Hidden Gems
          </button>
          <button className="template-card-btn" onClick={() => handleCreateFromTemplate('Best Endings')}>
            <span>🎬</span> Best Endings
          </button>
          <button className="template-card-btn" onClick={() => handleCreateFromTemplate('Blank Note')}>
            <span>📝</span> Blank Note
          </button>
        </div>
      </section>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 120, borderRadius: 'var(--radius-lg)' }} />
          ))}
        </div>
      ) : notes.length > 0 ? (
        /* Masonry Grid */
        <div className="notes-masonry-grid">
          {notes.map((note) => {
            const colorConfig = COLOR_PALETTE[note.color as ColorKey] || COLOR_PALETTE.yellow
            const cardBg = isDarkTheme ? colorConfig.dark : colorConfig.light
            const cardText = isDarkTheme ? colorConfig.textDark : colorConfig.textLight
            const cardBorder = colorConfig.border

            // Render linked movie details
            const hasLink = !!note.titleId
            const posterPath = note.titleId ? watchlistPosterMap.get(note.titleId) : null
            const poster = posterPath ? getImageUrl(posterPath, 'w200') : null

            return (
              <div key={note.id} className="note-card-wrapper">
                <article
                  className={`note-card ${note.color === 'dark' ? 'note-card--dark-color' : ''}`}
                  style={{
                    background: cardBg,
                    color: cardText,
                    borderColor: isDarkTheme ? 'transparent' : cardBorder,
                  }}
                  onClick={() => handleOpenEditor(note)}
                >
                  <div className="note-card-header">
                    <span className="note-card-category">{note.category || 'General'}</span>
                    <button
                      className="btn-delete-note"
                      onClick={(e) => handleDeleteNote(note.id, note.title, e)}
                      aria-label="Delete note"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  <h3 className="note-card-title">{note.title || 'Untitled Note'}</h3>
                  <p className="note-card-content">{note.content || 'No content'}</p>

                  <div className="note-card-footer">
                    <span className="note-card-date">{formatNoteDate(note.updatedAt || note.createdAt)}</span>
                    {hasLink && (
                      <div className="note-card-link-badge">
                        <LinkIcon size={10} />
                        {poster ? (
                          <img src={poster} alt="linked movie" className="note-card-poster-tiny" />
                        ) : (
                          <Film size={10} />
                        )}
                      </div>
                    )}
                  </div>
                </article>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="notes-empty-state animate-fade-in">
          <div className="notes-empty-icon" role="img" aria-label="blank notepad">📝</div>
          <h2 className="notes-empty-title">No notes yet</h2>
          <p className="notes-empty-subtitle">Save checklists, thoughts, trivia, or recommendations</p>
          <button className="btn-new-note" onClick={() => handleCreateFromTemplate('Blank Note')}>
            Create First Note
          </button>
        </div>
      )}

      {/* Note Editor Overlay Modal */}
      {activeNote && (
        <div className="note-editor-overlay" onClick={handleCloseEditor}>
          <div
            className="note-editor-modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: isDarkTheme ? COLOR_PALETTE[localColor].dark : COLOR_PALETTE[localColor].light,
              color: isDarkTheme ? COLOR_PALETTE[localColor].textDark : COLOR_PALETTE[localColor].textLight,
            }}
          >
            <header className="note-editor-header">
              <button className="btn-close-editor" onClick={handleCloseEditor} aria-label="Close note editor">
                <X size={20} />
              </button>
            </header>

            <div className="note-editor-body">
              {/* Linked movie badge inside editor */}
              {localTitleId && (
                <div className="note-editor-linked-movie animate-fade-in">
                  <LinkIcon size={12} />
                  <span>Linked Title: {watchlist.find((w) => w.titleId === localTitleId)?.title || 'Movie linked'}</span>
                  <button
                    onClick={() => setLocalTitleId(null)}
                    style={{ color: 'inherit', marginLeft: 6, fontWeight: 700 }}
                  >
                    ×
                  </button>
                </div>
              )}

              <input
                type="text"
                className="note-editor-title-input"
                placeholder="Title"
                value={localTitle}
                onChange={(e) => setLocalTitle(e.target.value)}
                autoFocus
              />

              <textarea
                className="note-editor-content-textarea"
                placeholder="Start writing..."
                value={localContent}
                onChange={(e) => setLocalContent(e.target.value)}
              />
            </div>

            {/* Bottom Editor Toolbar */}
            <footer className="note-editor-toolbar">
              <div className="note-editor-tools-group">
                {/* Color swatch circles picker */}
                <div className="note-color-picker">
                  {(Object.keys(COLOR_PALETTE) as ColorKey[]).map((col) => (
                    <button
                      key={col}
                      type="button"
                      className={`color-swatch-circle swatch-${col} ${localColor === col ? 'color-swatch-circle--active' : ''}`}
                      onClick={() => setLocalColor(col)}
                      aria-label={`Change note color to ${col}`}
                    />
                  ))}
                </div>

                {/* Category selector */}
                <select
                  value={localCategory}
                  onChange={(e) => setLocalCategory(e.target.value)}
                  className="note-select-tool"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>

                {/* Link to Movie */}
                <button
                  type="button"
                  className="btn-link-movie-tool"
                  onClick={() => setIsLinkPopoverOpen(true)}
                >
                  <LinkIcon size={12} />
                  Link Title
                </button>
              </div>

              {/* Status / Delete Group */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span className="autosave-status-lbl">
                  {saveStatus === 'dirty' && 'Unsaved changes...'}
                  {saveStatus === 'saving' && 'Saving...'}
                  {saveStatus === 'saved' && (
                    <>
                      <Check size={10} color="var(--color-success)" /> Saved
                    </>
                  )}
                </span>

                <button
                  type="button"
                  className="btn-review-action btn-review-action--delete"
                  onClick={handleEditorDelete}
                  aria-label="Delete note"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </footer>
          </div>

          {/* Linking Movie search popover overlay */}
          {isLinkPopoverOpen && (
            <div className="movie-link-popover-overlay" onClick={() => setIsLinkPopoverOpen(false)}>
              <div className="movie-link-popover" onClick={(e) => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Link Title</span>
                  <button onClick={() => setIsLinkPopoverOpen(false)}>
                    <X size={14} />
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <Search size={12} style={{ position: 'absolute', left: 8, top: 8, color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="modal-search-input"
                    style={{ paddingLeft: '28px', paddingTop: '4px', paddingBottom: '4px' }}
                    placeholder="Search movie..."
                    value={linkSearchQuery}
                    onChange={(e) => setLinkSearchQuery(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="movie-link-search-results">
                  {linkSearchQuery.length >= 2 ? (
                    linkSearchResults.length > 0 ? (
                      linkSearchResults.map((res) => {
                        const name = res.title ?? res.name ?? 'Untitled'
                        const compositeId = `${res.media_type}:${res.id}`
                        return (
                          <div
                            key={compositeId}
                            className="movie-link-result-item"
                            onClick={() => {
                              setLocalTitleId(compositeId)
                              setIsLinkPopoverOpen(false)
                              setLinkSearchQuery('')
                            }}
                          >
                            {name}
                          </div>
                        )
                      })
                    ) : (
                      <div style={{ padding: 6, fontSize: '10px', color: 'var(--text-muted)' }}>No matches</div>
                    )
                  ) : (
                    <div style={{ padding: 6, fontSize: '10px', color: 'var(--text-muted)' }}>Type to search...</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
