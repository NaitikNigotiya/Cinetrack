import { Link } from 'react-router-dom'
import './NotFoundPage.css'

export default function NotFoundPage() {
  return (
    <div className="not-found-page">
      <div className="not-found-content animate-fade-in">
        <span className="not-found-emoji" aria-hidden="true">🎞️</span>
        <h1 className="not-found-title">404</h1>
        <p className="not-found-message">This scene doesn't exist.</p>
        <Link to="/" className="not-found-link">
          ← Back to Home
        </Link>
      </div>
    </div>
  )
}
