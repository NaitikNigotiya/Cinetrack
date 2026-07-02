import { Link } from 'react-router-dom'
import './NotFoundPage.css'

export default function NotFoundPage() {
  return (
    <div className="not-found-page">
      <div className="not-found-content animate-slide-up">
        {/* Floating icon */}
        <div className="not-found-icon-wrap">
          <span className="not-found-emoji" aria-hidden="true">🎞️</span>
        </div>

        {/* 404 */}
        <h1 className="not-found-title">404</h1>

        {/* Text */}
        <p className="not-found-subtitle">Scene Not Found</p>
        <p className="not-found-message">
          Looks like this reel got cut from the film.<br />
          Let's get you back on track.
        </p>

        {/* Actions */}
        <div className="not-found-actions">
          <Link to="/" className="not-found-btn-primary">
            ← Back to Home
          </Link>
          <Link to="/search" className="not-found-btn-secondary">
            🔍 Search Titles
          </Link>
        </div>

        {/* Decorative dots */}
        <div className="not-found-dots" aria-hidden="true">
          <span className="not-found-dot" />
          <span className="not-found-dot" />
          <span className="not-found-dot" />
        </div>
      </div>
    </div>
  )
}
