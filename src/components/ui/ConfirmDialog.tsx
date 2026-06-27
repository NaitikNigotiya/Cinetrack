import { useEffect } from 'react'
import './shared-ui.css'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  description: string
  confirmLabel: string
  confirmVariant: 'danger' | 'primary'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel,
  confirmVariant,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // Hook escape key listener
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onCancel])

  if (!isOpen) return null

  const handleBackdropClick = (e: React.MouseEvent) => {
    // Only cancel if clicking the backdrop wrapper directly
    if (e.target === e.currentTarget) {
      onCancel()
    }
  }

  const confirmBtnClass = `dialog-btn dialog-btn--${confirmVariant}`

  return (
    <div
      className="dialog-backdrop-overlay"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title-id"
      aria-describedby="dialog-desc-id"
    >
      <div className="dialog-card-panel">
        <h3 id="dialog-title-id" className="dialog-title">
          {title}
        </h3>
        <p id="dialog-desc-id" className="dialog-description">
          {description}
        </p>

        <div className="dialog-actions-row">
          <button
            className="dialog-btn dialog-btn--cancel"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className={confirmBtnClass}
            onClick={onConfirm}
            type="button"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
export default ConfirmDialog
