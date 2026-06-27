import './shared-ui.css'
import '@/styles/animations.css' // Import skeleton base animations

interface SkeletonTextProps {
  lines: number
  width?: string
}

export function SkeletonText({ lines, width = '100%' }: SkeletonTextProps) {
  return (
    <div style={{ width }}>
      {Array.from({ length: lines }).map((_, i) => {
        // Randomize sizes slightly for a natural text shape look
        const randomWidth = lines > 1 && i === lines - 1 ? '60%' : '100%'
        return (
          <div
            key={i}
            className="skeleton skeleton-line"
            style={{ width: randomWidth }}
          />
        )
      })}
    </div>
  )
}

export function SkeletonCard() {
  return (
    <div className="skeleton-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="skeleton skeleton-poster-box" />
      <div className="skeleton-text-meta">
        <div className="skeleton skeleton-line" style={{ width: '80%', height: 12 }} />
        <div className="skeleton skeleton-line" style={{ width: '50%', height: 9, marginTop: 4 }} />
      </div>
    </div>
  )
}

interface SkeletonGridProps {
  count: number
}

export function SkeletonGrid({ count }: SkeletonGridProps) {
  return (
    <div className="watchlist-grid">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}
