import type { WatchStatus } from '@/types/app'
import './shared-ui.css'

interface StatusBadgeProps {
  status: WatchStatus
}

export function StatusBadge({ status }: StatusBadgeProps) {
  // Label and Emoji configurations
  const config = {
    watching: { label: 'Watching', emoji: '👁' },
    completed: { label: 'Completed', emoji: '✓' },
    plan_to_watch: { label: 'Plan to Watch', emoji: '🕐' },
    dropped: { label: 'Dropped', emoji: '✗' },
  }[status] || { label: 'Unknown', emoji: '•' }

  return (
    <span
      className={`status-pill-badge status-badge--${status}`}
      aria-label={`Status: ${config.label}`}
    >
      <span className="status-pill-emoji" aria-hidden="true">
        {config.emoji}
      </span>
      <span>{config.label}</span>
    </span>
  )
}
export default StatusBadge
