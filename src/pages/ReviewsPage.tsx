import { useState, useMemo, useEffect } from 'react'
import { Star, X, Search, Film } from 'lucide-react'
import { useReviews, type ReviewEntry } from '@/features/reviews/hooks/useReviews'
import { useSearch } from '@/features/search/hooks/useSearch'
import { getImageUrl } from '@/lib/tmdb'
import { useToast } from '@/components/ui/Toast'
import './ReviewsPage.css'

export default function ReviewsPage() {
  const { showToast } = useToast()
  const { reviews, isLoading, addReview, updateReview, deleteReview } = useReviews()

  // Sorting state
  const [sortBy, setSortBy] = useState<'newest' | 'highest' | 'alphabetical'>('newest')

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingReview, setEditingReview] = useState<ReviewEntry | null>(null)

  // Selected title details
  const [selectedTitle, setSelectedTitle] = useState<{
    titleId: string
    title: string
    posterPath: string | null
    year: number
  } | null>(null)

  const [rating, setRating] = useState<number>(0)
  const [reviewText, setReviewText] = useState('')

  // Tags
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')

  // TMDb Title Search (modal)
  const [searchQuery, setSearchQuery] = useState('')
  const { results: searchResults, isLoading: isSearchLoading } = useSearch(searchQuery)

  // Pre-fill modal when editing
  useEffect(() => {
    if (editingReview) {
      setSelectedTitle({
        titleId: editingReview.titleId,
        title: editingReview.title,
        posterPath: editingReview.posterPath,
        year: editingReview.year,
      })
      setRating(editingReview.rating)
      setReviewText(editingReview.reviewText)
      setTags(editingReview.tags || [])
      setSearchQuery('')
    } else {
      setSelectedTitle(null)
      setRating(0)
      setReviewText('')
      setTags([])
      setSearchQuery('')
    }
  }, [editingReview])

  // Sorting logic
  const sortedReviews = useMemo(() => {
    const getTs = (ts: any) => {
      if (!ts) return Date.now()
      return ts.toDate ? ts.toDate().getTime() : new Date(ts).getTime()
    }
    const items = [...reviews]
    if (sortBy === 'newest')      return items.sort((a, b) => getTs(b.createdAt) - getTs(a.createdAt))
    if (sortBy === 'highest')     return items.sort((a, b) => b.rating - a.rating)
    if (sortBy === 'alphabetical') return items.sort((a, b) => a.title.localeCompare(b.title))
    return items
  }, [reviews, sortBy])

  const handleOpenCreate = () => {
    setEditingReview(null)
    setIsModalOpen(true)
  }

  const handleOpenEdit = (review: ReviewEntry) => {
    setEditingReview(review)
    setIsModalOpen(true)
  }

  const handleDelete = async (reviewId: string, title: string) => {
    if (window.confirm(`Delete your review for "${title}"?`)) {
      try {
        await deleteReview(reviewId)
        showToast('Review deleted.', 'success')
      } catch {
        showToast('Failed to delete review.', 'error')
      }
    }
  }

  const handleAddTag = () => {
    let clean = tagInput.trim()
    if (!clean) return
    if (!clean.startsWith('#')) clean = `#${clean}`
    if (!tags.includes(clean)) setTags(prev => [...prev, clean])
    setTagInput('')
  }

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault()
      handleAddTag()
    }
  }

  const handleRemoveTag = (idx: number) => setTags(prev => prev.filter((_, i) => i !== idx))

  const handlePublish = async () => {
    if (!selectedTitle || rating < 1 || reviewText.length < 20) return
    try {
      if (editingReview) {
        await updateReview(editingReview.id, {
          titleId: selectedTitle.titleId, title: selectedTitle.title,
          posterPath: selectedTitle.posterPath, year: selectedTitle.year,
          rating, reviewText, tags,
        })
        showToast('Review updated!', 'success')
      } else {
        await addReview({
          titleId: selectedTitle.titleId, title: selectedTitle.title,
          posterPath: selectedTitle.posterPath, year: selectedTitle.year,
          rating, reviewText, tags,
        })
        showToast('Review published!', 'success')
      }
      setIsModalOpen(false)
    } catch {
      showToast('Failed to save review.', 'error')
    }
  }

  const isPublishDisabled = !selectedTitle || rating < 1 || reviewText.length < 20

  return (
    <div className="unified-page-container">
      <header className="unified-page-header">
        <div>
          <h1 className="page-title">Reviews</h1>
          <p className="page-subtitle">Your personal movie reviews</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="page-header-btn"
          type="button"
        >
          + Write Review
        </button>
      </header>

      {/* Loading */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 160, borderRadius: 'var(--radius-lg)' }} />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="state-display-container">
          <div className="state-display-icon">🎬</div>
          <h3 className="state-display-title">Nothing tracked yet</h3>
          <p className="state-display-msg">Your added items will organize themselves nicely right here.</p>
        </div>
      ) : (
        <>
          {/* Sort bar */}
          <div className="sort-filters-row">
            <span className="sort-label">
              Sort by:
            </span>
            {(['newest', 'highest', 'alphabetical'] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setSortBy(opt)}
                className={`sort-btn ${sortBy === opt ? 'sort-btn--active' : ''}`}
                type="button"
              >
                {opt === 'newest' ? 'Newest' : opt === 'highest' ? 'Highest Rated' : 'Title A-Z'}
              </button>
            ))}
          </div>

          {/* Reviews list */}
          <div className="reviews-list">
            {sortedReviews.map(review => (
              <div key={review.id} className="review-card animate-fade-in">
                <div className="review-card-top">
                  {review.posterPath ? (
                    <img
                      src={getImageUrl(review.posterPath, 'w200') || ''}
                      alt={review.title}
                      className="review-poster"
                    />
                  ) : (
                    <div className="review-poster" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Film size={20} color="var(--text-muted)" />
                    </div>
                  )}
                  <div className="review-card-info">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                      <div>
                        <h3 className="review-title-text" style={{ margin: 0 }}>
                          {review.title}
                        </h3>
                        <div className="review-year" style={{ marginTop: '2px' }}>
                          {review.year > 0 ? review.year : '—'} · {'⭐'.repeat(Math.round(review.rating / 2))} {review.rating}/10
                        </div>
                      </div>
                      <div className="review-actions" style={{ flexShrink: 0 }}>
                        <button
                          onClick={() => handleOpenEdit(review)}
                          className="btn-review-action"
                          type="button"
                          aria-label="Edit review"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(review.id, review.title)}
                          className="btn-review-action btn-review-action--delete"
                          type="button"
                          aria-label="Delete review"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    <p className="review-body-text" style={{ margin: '12px 0' }}>
                      {review.reviewText}
                    </p>
                    {review.tags && review.tags.length > 0 && (
                      <div className="review-tags-row">
                        {review.tags.map((tag, i) => (
                          <span key={i} className="tag-chip">
                            {tag.startsWith('#') ? tag : `#${tag}`}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Write / Edit Review Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content-box" onClick={(e) => e.stopPropagation()}>
            <header className="review-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border-default)' }}>
              <h2 className="review-modal-title" style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
                {editingReview ? 'Edit Review' : 'Write a Review'}
              </h2>
              <button className="btn-close-modal" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </header>

            <div className="review-modal-body">
              {/* Step 1: Movie / TV selection */}
              {!selectedTitle ? (
                <div className="modal-search-wrapper">
                  <label className="sort-label">Search Title</label>
                  <div className="modal-search-input-box">
                    <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      className="modal-search-input cinetrack-input"
                      placeholder="Search movie or TV show title..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  {searchQuery.length >= 2 && (
                    <div className="search-results-dropdown">
                      {isSearchLoading ? (
                        <div style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)' }}>Searching...</div>
                      ) : searchResults.length > 0 ? (
                        searchResults.map((res) => {
                          const name = res.title ?? res.name ?? 'Untitled'
                          const resYear = res.release_date
                            ? new Date(res.release_date).getFullYear()
                            : res.first_air_date
                            ? new Date(res.first_air_date).getFullYear()
                            : 0
                          const poster = getImageUrl(res.poster_path, 'w200')
                          return (
                            <div
                              key={`${res.media_type}:${res.id}`}
                              className="search-dropdown-item"
                              onClick={() => setSelectedTitle({
                                titleId: `${res.media_type}:${res.id}`,
                                title: name,
                                posterPath: res.poster_path,
                                year: resYear,
                              })}
                            >
                              {poster ? (
                                <img src={poster} alt={name} className="search-dropdown-poster" />
                              ) : (
                                <div className="search-dropdown-poster" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-overlay)' }}>
                                  <Film size={12} color="var(--text-muted)" />
                                </div>
                              )}
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: 600 }}>{name}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                  {res.media_type === 'movie' ? 'Movie' : 'TV Show'} {resYear > 0 ? `(${resYear})` : ''}
                                </div>
                              </div>
                            </div>
                          )
                        })
                      ) : (
                        <div style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)' }}>No matches found</div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="selected-title-badge animate-fade-in">
                  {selectedTitle.posterPath ? (
                    <img src={getImageUrl(selectedTitle.posterPath, 'w200') || ''} alt={selectedTitle.title} className="selected-title-poster" />
                  ) : (
                    <div className="selected-title-poster" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-overlay)' }}>
                      <Film size={16} color="var(--text-muted)" />
                    </div>
                  )}
                  <div className="selected-title-info">
                    <div className="selected-title-name">{selectedTitle.title}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {selectedTitle.year > 0 ? selectedTitle.year : '—'}
                    </div>
                  </div>
                  {!editingReview && (
                    <button className="btn-review-action" onClick={() => setSelectedTitle(null)} aria-label="Remove selection">
                      <X size={16} />
                    </button>
                  )}
                </div>
              )}

              {/* Step 2: Star rating */}
              <div className="star-rating-picker">
                <label className="sort-label">Your Rating (Required)</label>
                <div className="star-picker-row">
                  {[...Array(10)].map((_, i) => {
                    const starVal = i + 1
                    const isFilled = starVal <= rating
                    return (
                      <button
                        key={i} type="button"
                        className={`star-btn-picker ${isFilled ? 'star-btn-picker--filled' : ''}`}
                        onClick={() => setRating(starVal)}
                        aria-label={`Rate ${starVal} stars`}
                      >
                        <Star size={20} fill={isFilled ? 'var(--star-filled)' : 'none'} />
                      </button>
                    )
                  })}
                  {rating > 0 && <span className="star-rating-count-lbl">{rating}/10</span>}
                </div>
              </div>

              {/* Step 3: Review text */}
              <div className="review-text-input-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <label className="sort-label">Review (min 20 characters)</label>
                  <span style={{ fontSize: '10px', color: reviewText.length >= 20 ? 'var(--color-success)' : 'var(--text-muted)' }}>
                    {reviewText.length} chars
                  </span>
                </div>
                <textarea
                  className="review-textarea cinetrack-input"
                  placeholder="What did you think? Share your detailed review..."
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                />
              </div>

              {/* Step 4: Tags */}
              <div className="tags-input-wrapper">
                <label className="sort-label">Tags (Hashtags)</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    className="modal-search-input cinetrack-input"
                    placeholder="e.g. Thriller, Emotional, MindBending"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagInputKeyDown}
                  />
                  <button
                    type="button"
                    style={{ padding: '8px 16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '12px', border: '1px solid var(--border-default)', cursor: 'pointer' }}
                    onClick={handleAddTag}
                  >
                    Add
                  </button>
                </div>
                {tags.length > 0 && (
                  <div className="tag-chips-picker-list">
                    {tags.map((tag, tIdx) => (
                      <span key={tIdx} className="tag-chip clickable-chip" onClick={() => handleRemoveTag(tIdx)} title="Click to remove">
                        {tag} <span style={{ marginLeft: 4, fontWeight: 700 }}>×</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <footer className="review-modal-footer">
              <button className="btn-publish-review" onClick={handlePublish} disabled={isPublishDisabled}>
                Publish Review
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}
