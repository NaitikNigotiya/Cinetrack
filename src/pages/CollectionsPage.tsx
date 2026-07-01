import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  Film,
  MoreVertical,
  ChevronLeft,
  Search,
  X,
  Check,
  Edit2,
  ArrowUpDown,
} from 'lucide-react'
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore'

import { useAuth } from '@/features/auth/useAuth'
import { useWatchlist } from '@/features/watchlist/hooks/useWatchlist'
import { db } from '@/lib/firebase'
import { getImageUrl } from '@/lib/tmdb'
import { BottomSheet } from '@/components/ui/BottomSheet'

import type { WatchlistEntry } from '@/types/app'
import './CollectionsPage.css' // loaded

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Collection {
  id: string
  name: string
  description: string
  coverTitleId: string
  titleIds: string[]
  createdAt: Timestamp
  updatedAt: Timestamp
}

interface SmartCollection {
  id: string
  name: string
  description: string
  list: WatchlistEntry[]
}

// ─── Local hook for custom collections ───
function useCollections(userId: string | undefined) {
  const [collections, setCollections] = useState<Collection[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    const q = query(collection(db, `users/${userId}/collections`), orderBy('createdAt', 'desc'))
    return onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Collection[]
      setCollections(items)
      setIsLoading(false)
    })
  }, [userId])

  const createCollection = async (name: string, description: string) => {
    if (!userId) return
    await addDoc(collection(db, `users/${userId}/collections`), {
      name,
      description,
      coverTitleId: '',
      titleIds: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }

  const updateCollection = async (collectionId: string, updates: Partial<Collection>) => {
    if (!userId) return
    const docRef = doc(db, `users/${userId}/collections`, collectionId)
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    })
  }

  const addTitle = async (collectionId: string, titleId: string) => {
    if (!userId) return
    const docRef = doc(db, `users/${userId}/collections`, collectionId)
    await updateDoc(docRef, {
      titleIds: arrayUnion(titleId),
      updatedAt: serverTimestamp(),
    })
  }

  const removeTitle = async (collectionId: string, titleId: string) => {
    if (!userId) return
    const docRef = doc(db, `users/${userId}/collections`, collectionId)
    await updateDoc(docRef, {
      titleIds: arrayRemove(titleId),
      updatedAt: serverTimestamp(),
    })
  }

  const deleteCollection = async (collectionId: string) => {
    if (!userId) return
    await deleteDoc(doc(db, `users/${userId}/collections`, collectionId))
  }

  return { collections, isLoading, createCollection, updateCollection, addTitle, removeTitle, deleteCollection }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CollectionsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { entries } = useWatchlist()
  const {
    collections,
    isLoading,
    createCollection,
    updateCollection,
    addTitle,
    removeTitle,
    deleteCollection,
  } = useCollections(user?.uid)

  // Navigation State
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null)

  // Dialog / Modal States
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isAddTitlesOpen, setIsAddTitlesOpen] = useState(false)

  // Creation Forms
  const [newColName, setNewColName] = useState('')
  const [newColDesc, setNewColDesc] = useState('')

  // Inline renaming states
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState('')

  // Context Menu state
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)

  // Add titles search
  const [searchQuery, setSearchQuery] = useState('')

  // Detail Sort Options
  const [detailSort, setDetailSort] = useState<'title' | 'year' | 'rating'>('title')

  // ── Smart Collections Logic (Auto-Generated) ──
  const smartCollections: SmartCollection[] = useMemo(() => {
    const nolanTitles = ['inception', 'interstellar', 'dark knight', 'oppenheimer', 'tenet', 'memento', 'prestige', 'dunkirk', 'batman begins']
    const mcuTitles = ['iron man', 'thor', 'captain america', 'avengers', 'guardians of the galaxy', 'black panther', 'doctor strange', 'spider-man', 'captain marvel', 'ant-man']
    const ghibliTitles = ['spirited away', 'totoro', 'howl\'s moving castle', 'princess mononoke', 'grave of the fireflies', 'ponyo', 'kiki\'s delivery']

    return [
      {
        id: 'smart:nolan',
        name: 'Christopher Nolan',
        description: 'Masterpieces directed by Christopher Nolan',
        list: entries.filter((e) => nolanTitles.some((t) => e.title.toLowerCase().includes(t))),
      },
      {
        id: 'smart:mcu',
        name: 'Marvel Cinematic Universe',
        description: 'Blockbusters from the Marvel Cinematic Universe',
        list: entries.filter((e) => mcuTitles.some((t) => e.title.toLowerCase().includes(t))),
      },
      {
        id: 'smart:ghibli',
        name: 'Studio Ghibli',
        description: 'Immersive Ghibli animated features',
        list: entries.filter((e) => ghibliTitles.some((t) => e.title.toLowerCase().includes(t))),
      },
      {
        id: 'smart:classics',
        name: '90s Classics',
        description: 'Timeless cinematic gems from 1990-1999',
        list: entries.filter((e) => e.year >= 1990 && e.year <= 1999),
      },
      {
        id: 'smart:mindblowing',
        name: 'Mind-blowing Movies',
        description: 'Highly rated titles rated 9+ by you',
        list: entries.filter((e) => e.rating !== null && e.rating >= 9),
      },
      {
        id: 'smart:comfort',
        name: 'Comfort Movies',
        description: 'Your favorite comfort titles rated 8+',
        list: entries.filter((e) => e.isFavorite && e.rating !== null && e.rating >= 8),
      },
      {
        id: 'smart:horror',
        name: 'Weekend Horror',
        description: 'Spooky horror titles for the weekend',
        list: entries.filter((e) => e.genres?.some((g) => g.toLowerCase().includes('horror'))),
      },
    ].filter((c) => c.list.length > 0)
  }, [entries])

  // ── Active Collection Resolving ──
  const activeCollection = useMemo(() => {
    if (!activeCollectionId) return null
    if (activeCollectionId.startsWith('smart:')) {
      return smartCollections.find((c) => c.id === activeCollectionId) || null
    }
    return collections.find((c) => c.id === activeCollectionId) || null
  }, [activeCollectionId, collections, smartCollections])

  // Resolved list of entries in active collection
  const activeCollectionEntries = useMemo(() => {
    if (!activeCollection) return []
    let list: WatchlistEntry[] = []

    if ('list' in activeCollection) {
      list = [...activeCollection.list]
    } else {
      const ids = activeCollection.titleIds ?? []
      list = entries.filter((e) => ids.includes(e.titleId))
    }

    // Apply sorting
    return list.sort((a, b) => {
      if (detailSort === 'year') {
        return b.year - a.year
      }
      if (detailSort === 'rating') {
        return (b.rating ?? 0) - (a.rating ?? 0)
      }
      return a.title.localeCompare(b.title) // Title A-Z default
    })
  }, [activeCollection, entries, detailSort])

  // ── Multi-select candidate list to add ──
  const candidateTitles = useMemo(() => {
    if (!activeCollection || 'list' in activeCollection) return []
    const alreadyIn = new Set(activeCollection.titleIds)
    return entries.filter(
      (e) => !alreadyIn.has(e.titleId) &&
             e.title.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [activeCollection, entries, searchQuery])

  // ── Handlers ──

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newColName.trim()) return
    await createCollection(newColName.trim(), newColDesc.trim())
    setNewColName('')
    setNewColDesc('')
    setIsCreateOpen(false)
  }

  const handleNameSave = async () => {
    if (!activeCollection || activeCollectionId?.startsWith('smart:') || !activeCollectionId) return
    if (editedName.trim() && editedName.trim() !== activeCollection.name) {
      await updateCollection(activeCollectionId, { name: editedName.trim() })
    }
    setIsEditingName(false)
  }

  const handleStartRename = () => {
    if (!activeCollection || activeCollectionId?.startsWith('smart:')) return
    setEditedName(activeCollection.name)
    setIsEditingName(true)
  }

  const handleDelete = async (colId: string) => {
    if (confirm('Delete this collection forever?')) {
      await deleteCollection(colId)
      if (activeCollectionId === colId) {
        setActiveCollectionId(null)
      }
    }
  }

  // Cover composite rendering function
  const renderCover = (titleIdsList: string[]) => {
    const list = entries.filter((e) => titleIdsList.includes(e.titleId)).slice(0, 4)
    return (
      <div className="col-cover-composite">
        {Array.from({ length: 4 }).map((_, i) => {
          const item = list[i]
          const poster = item?.posterPath ? getImageUrl(item.posterPath, 'w200') : null
          return (
            <div key={i} className="col-cover-quadrant">
              {poster ? (
                <img src={poster} alt="Poster quadrant" className="col-cover-img" />
              ) : (
                <div className="col-cover-quadrant-ph">
                  <Film size={14} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // Smart cover composite
  const renderSmartCover = (items: WatchlistEntry[]) => {
    const list = items.slice(0, 4)
    return (
      <div className="col-cover-composite col-cover-composite--smart">
        {Array.from({ length: 4 }).map((_, i) => {
          const item = list[i]
          const poster = item?.posterPath ? getImageUrl(item.posterPath, 'w200') : null
          return (
            <div key={i} className="col-cover-quadrant">
              {poster ? (
                <img src={poster} alt="Poster quadrant" className="col-cover-img" />
              ) : (
                <div className="col-cover-quadrant-ph">
                  <Film size={14} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="page-wrapper collections-page" style={{ padding: 24 }}>
        <div className="skeleton" style={{ height: 40, width: '30%', marginBottom: 24 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ aspectRatio: '1.2', borderRadius: 'var(--radius-xl)' }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="page-wrapper collections-page">

      {/* ── DETAIL VIEW OVERLAY ── */}
      {activeCollection ? (
        <div className="col-detail-pane animate-fade-in">
          {/* Header */}
          <header className="col-detail-header mobile-header-padding">
            <button className="col-back-btn" onClick={() => setActiveCollectionId(null)} type="button">
              <ChevronLeft size={16} /> Back to Collections
            </button>
            <div className="col-detail-title-block">
              {isEditingName ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    onBlur={handleNameSave}
                    onKeyDown={(e) => e.key === 'Enter' && handleNameSave()}
                    className="col-rename-input"
                    autoFocus
                  />
                  <button className="col-rename-save-btn" onClick={handleNameSave} type="button">
                    <Check size={16} />
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h2 className="col-detail-name page-title" onClick={handleStartRename}>
                    {activeCollection.name}
                  </h2>
                  {!activeCollectionId?.startsWith('smart:') && (
                    <button className="col-rename-trigger" onClick={handleStartRename} type="button">
                      <Edit2 size={13} />
                    </button>
                  )}
                </div>
              )}

              <p className="col-detail-desc page-subtitle">{activeCollection.description}</p>
              <div className="col-detail-sub-meta">
                <span>{activeCollectionEntries.length} titles</span>
                {activeCollectionId?.startsWith('smart:') && (
                  <span className="smart-badge-inline">⚡ Smart Auto-generated</span>
                )}
              </div>
            </div>

            {/* Actions Bar */}
            <div className="col-detail-actions">
              {!activeCollectionId?.startsWith('smart:') && (
                <button className="wl-btn-add-movie" onClick={() => setIsAddTitlesOpen(true)} type="button">
                  <Plus size={15} /> Add Titles
                </button>
              )}

              {/* Sort Switcher */}
              <div className="col-detail-sort-select">
                <ArrowUpDown size={13} style={{ color: 'var(--text-muted)' }} />
                <select
                  value={detailSort}
                  onChange={(e) => setDetailSort(e.target.value as any)}
                  className="col-sort-select"
                >
                  <option value="title">Title A-Z</option>
                  <option value="year">Release Year</option>
                  <option value="rating">Rating</option>
                </select>
              </div>
            </div>
          </header>

          {/* Cards Grid */}
          {activeCollectionEntries.length > 0 ? (
            <div className="col-detail-grid">
              {activeCollectionEntries.map((e) => {
                const poster = getImageUrl(e.posterPath, 'w500')
                return (
                  <div key={e.titleId} className="col-poster-container">
                    <article className="col-grid-card" onClick={() => navigate(`/title/${e.titleId}`)}>
                      <div className="col-grid-poster-wrap">
                        {poster ? (
                          <img src={poster} alt={e.title} className="col-grid-poster-img" loading="lazy" />
                        ) : (
                          <div className="col-grid-no-poster"><Film size={24} /></div>
                        )}
                        <div className="col-grid-overlay" />
                        {e.rating && <span className="col-grid-rating-badge">⭐ {e.rating}</span>}
                      </div>
                      <div className="col-grid-info">
                        <p className="col-grid-card-title">{e.title}</p>
                        <p className="col-grid-card-year">{e.year > 0 ? e.year : '—'}</p>
                      </div>
                    </article>

                    {/* Remove Action */}
                    {!activeCollectionId?.startsWith('smart:') && (
                      <button
                        className="col-remove-item-btn"
                        onClick={() => removeTitle(activeCollectionId!, e.titleId)}
                        aria-label={`Remove ${e.title} from collection`}
                        type="button"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="col-detail-empty">
              <span style={{ fontSize: 32 }}>📁</span>
              <p style={{ fontWeight: 600, margin: '8px 0 4px 0' }}>This collection is empty</p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Click "+ Add Titles" to select movies</p>
            </div>
          )}
        </div>
      ) : (
        /* ── CENTRAL COLLECTIONS MAIN VIEW ── */
        <div className="col-main-pane animate-fade-in">
          {/* Header */}
          <header className="wl-header mobile-header-padding" style={{ borderBottom: 'none', padding: '0 0 24px 0' }}>
            <div className="wl-header-left">
              <h1 className="wl-title page-title">Collections</h1>
              <p className="wl-count-label page-subtitle">Organize your movies into lists</p>
            </div>
            <div className="wl-header-actions">
              <button className="wl-btn-add-movie" onClick={() => setIsCreateOpen(true)} type="button">
                <Plus size={16} /> New Collection
              </button>
            </div>
          </header>

          {/* ⚡ SMART COLLECTIONS SECTION */}
          {smartCollections.length > 0 && (
            <section className="col-section">
              <h3 className="col-section-title">⚡ Smart Collections</h3>
              <div className="col-cards-grid">
                {smartCollections.map((col) => (
                  <article key={col.id} className="col-card" onClick={() => setActiveCollectionId(col.id)}>
                    <div className="col-card-cover-wrap">
                      {renderSmartCover(col.list)}
                      <div className="col-card-overlay-gradient" />
                      <span className="col-card-smart-badge">⚡ AUTO</span>
                      <div className="col-card-text">
                        <h4 className="col-card-name">{col.name}</h4>
                        <span className="col-card-count">{col.list.length} titles</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* 📂 CUSTOM USER COLLECTIONS SECTION */}
          <section className="col-section" style={{ marginTop: 32 }}>
            <h3 className="col-section-title">📂 Custom Collections</h3>
            {collections.length > 0 ? (
              <div className="col-cards-grid">
                {collections.map((col) => (
                  <article key={col.id} className="col-card" onClick={() => setActiveCollectionId(col.id)}>
                    <div className="col-card-cover-wrap">
                      {renderCover(col.titleIds)}
                      <div className="col-card-overlay-gradient" />

                      {/* Three-dot context menu */}
                      <div className="col-menu-container" onClick={(e) => e.stopPropagation()}>
                        <button
                          className="col-menu-trigger"
                          onClick={() => setMenuOpenId(menuOpenId === col.id ? null : col.id)}
                          aria-label="Collection options"
                          type="button"
                        >
                          <MoreVertical size={16} />
                        </button>
                        {menuOpenId === col.id && (
                          <div className="col-menu-dropdown animate-fade-in">
                            <button
                              onClick={() => {
                                setMenuOpenId(null)
                                setActiveCollectionId(col.id)
                                setEditedName(col.name)
                                setIsEditingName(true)
                              }}
                              type="button"
                            >
                              Rename
                            </button>
                            <button
                              className="col-menu-delete"
                              onClick={() => {
                                setMenuOpenId(null)
                                handleDelete(col.id)
                              }}
                              type="button"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="col-card-text">
                        <h4 className="col-card-name">{col.name}</h4>
                        <span className="col-card-count">{col.titleIds?.length ?? 0} titles</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="col-empty-placeholder">
                <span style={{ fontSize: 32 }}>📂</span>
                <p style={{ fontWeight: 600, margin: '8px 0 4px 0' }}>No custom collections yet</p>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Create a list to organize your watched titles</p>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ── CREATE COLLECTION MODAL SHEET ── */}
      <BottomSheet
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        label="Create collection"
      >
        <form onSubmit={handleCreate} className="wl-filter-sheet-body">
          <p className="filter-sheet-title" style={{ padding: '0 0 16px' }}>New Collection</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Collection Name (required)</label>
              <input
                type="text"
                required
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
                placeholder="e.g. Favorite Sci-Fi, Award Winners, Comfort Shows"
                className="review-input"
                style={{ width: '100%', marginTop: 4 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Description (optional)</label>
              <textarea
                value={newColDesc}
                onChange={(e) => setNewColDesc(e.target.value)}
                placeholder="What is this collection about?"
                className="detail-notes-textarea"
                style={{ width: '100%', height: 80, marginTop: 4 }}
              />
            </div>
            <button className="dp-confirm-btn" type="submit" style={{ marginTop: 8 }}>
              Create Collection
            </button>
          </div>
        </form>
      </BottomSheet>

      {/* ── ADD TITLES MODAL SHEET ── */}
      <BottomSheet
        isOpen={isAddTitlesOpen}
        onClose={() => {
          setIsAddTitlesOpen(false)
          setSearchQuery('')
        }}
        label="Add titles to collection"
      >
        <div className="wl-filter-sheet-body">
          <p className="filter-sheet-title" style={{ padding: '0 0 16px' }}>Add Titles</p>
          <div className="sp-input-wrap" style={{ margin: '0 0 16px 0', border: '1.5px solid var(--border-default)' }}>
            <span className="sp-input-icon"><Search size={16} /></span>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your watchlist..."
              className="sp-input"
              style={{ paddingLeft: 40, height: 40 }}
            />
          </div>

          <div className="col-search-results-list">
            {candidateTitles.length > 0 ? (
              candidateTitles.map((item) => {
                const poster = getImageUrl(item.posterPath, 'w200')
                return (
                  <div key={item.titleId} className="col-search-row">
                    {poster ? (
                      <img src={poster} alt={item.title} className="col-search-thumb" />
                    ) : (
                      <div className="col-search-thumb-ph"><Film size={12} /></div>
                    )}
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{item.title}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>{item.type === 'movie' ? 'Movie' : 'TV Show'} · {item.year}</p>
                    </div>
                    <button
                      className="col-add-candidate-btn"
                      onClick={() => addTitle(activeCollectionId!, item.titleId)}
                      type="button"
                    >
                      + Add
                    </button>
                  </div>
                )
              })
            ) : (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
                {searchQuery ? 'No matching titles found.' : 'Search your movies to add them here.'}
              </p>
            )}
          </div>
        </div>
      </BottomSheet>
    </div>
  )
}
