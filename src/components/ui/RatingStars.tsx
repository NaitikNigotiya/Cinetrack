import { useState } from 'react'
import { Star } from 'lucide-react'
import './shared-ui.css'

interface RatingStarsProps {
  rating: number | null
  max: 10 | 5
  size: 'sm' | 'md' | 'lg'
  interactive?: boolean
  onChange?: (v: number) => void
}

export function RatingStars({
  rating,
  max,
  size,
  interactive = false,
  onChange,
}: RatingStarsProps) {
  const [hoverRating, setHoverRating] = useState<number | null>(null)

  // Map sizes to pixel values
  const pixelSize = size === 'sm' ? 14 : size === 'md' ? 20 : 28

  // Current value to display (hover takes precedence in interactive mode)
  const displayValue = hoverRating !== null ? hoverRating : (rating ?? 0)

  // Trigger selection change
  const handleStarClick = (val: number) => {
    if (interactive && onChange) {
      onChange(val)
    }
  }

  // Helper to render stars list
  const starsArray = Array.from({ length: max }, (_, index) => index + 1)

  return (
    <div className="rating-stars-wrapper" aria-label={`Rating: ${rating ?? 0} out of ${max}`}>
      <div className="stars-list-row">
        {starsArray.map((starVal) => {
          // Calculate filling state for each star
          const isFilled = displayValue >= starVal
          const isHalf = !isFilled && displayValue >= starVal - 0.5

          return (
            <button
              key={starVal}
              type="button"
              className={`star-icon-btn${interactive ? ' star-icon-btn--interactive' : ''}`}
              onClick={() => handleStarClick(starVal)}
              onMouseEnter={() => interactive && setHoverRating(starVal)}
              onMouseLeave={() => interactive && setHoverRating(null)}
              disabled={!interactive}
              style={{ width: pixelSize, height: pixelSize }}
            >
              <Star
                size={pixelSize}
                fill={isFilled ? 'var(--star-filled)' : isHalf ? 'url(#halfStarGradient)' : 'none'}
                stroke={isFilled || isHalf ? 'var(--star-filled)' : 'var(--star-empty)'}
              />
            </button>
          )
        })}
      </div>

      {/* SVG definitions for rendering half stars */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <linearGradient id="halfStarGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="50%" stopColor="var(--star-filled)" />
            <stop offset="50%" stopColor="transparent" stopOpacity="1" />
          </linearGradient>
        </defs>
      </svg>

      {/* Numeric label indicator */}
      <span className="star-numeric-lbl">
        {rating !== null ? `${rating} / ${max}` : `Not Rated`}
      </span>
    </div>
  )
}
export default RatingStars
