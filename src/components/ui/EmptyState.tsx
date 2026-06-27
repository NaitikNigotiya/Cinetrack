import type { LucideIcon } from 'lucide-react'
import './shared-ui.css'

interface EmptyStateProps {
  icon: string | LucideIcon
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  const IconComponent = typeof icon !== 'string' ? icon : null

  return (
    <div className="empty-state-centered animate-fade-in">
      <div className="empty-state-icon" aria-hidden="true">
        {IconComponent ? (
          <IconComponent size={48} color="var(--text-muted)" />
        ) : (
          <span>{typeof icon === 'string' ? icon : null}</span>
        )}
      </div>

      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-desc">{description}</p>

      {action && (
        <button
          className="empty-state-action-btn"
          onClick={action.onClick}
          type="button"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
export default EmptyState
