import {
  useEffect,
  useRef,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import './BottomSheet.css'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BottomSheetProps {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
  /** Accessible label for the dialog */
  label?: string
}

// ─── Focusable selector ───────────────────────────────────────────────────────

const FOCUSABLE = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

// ─── Component ────────────────────────────────────────────────────────────────

export function BottomSheet({ isOpen, onClose, children, label = 'Menu' }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<Element | null>(null)

  // Drag-to-dismiss state
  const touchStartY = useRef(0)

  useEffect(() => {
    if (!isOpen) return

    // Save focus so we can restore it when sheet closes
    previousFocusRef.current = document.activeElement
    document.body.style.overflow = 'hidden'

    // Focus first focusable element after animation starts
    const focusTimer = setTimeout(() => {
      const first = sheetRef.current?.querySelector<HTMLElement>(FOCUSABLE)
      first?.focus()
    }, 50)

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }

      // Tab focus trap
      if (e.key === 'Tab' && sheetRef.current) {
        const focusable = [...sheetRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last?.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first?.focus()
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      clearTimeout(focusTimer)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
      // Restore focus to the element that opened the sheet
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus()
      }
    }
  }, [isOpen, onClose])

  // ── Drag to dismiss ──────────────────────────────────────────────────────────
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0]?.clientY ?? 0
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    const endY = e.changedTouches[0]?.clientY ?? 0
    if (endY - touchStartY.current > 80) onClose()
  }

  if (!isOpen) return null

  return createPortal(
    <div className="bottom-sheet-portal">
      {/* Backdrop */}
      <div
        className="bottom-sheet-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="bottom-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="bottom-sheet-handle-bar" aria-hidden="true" />
        {children}
      </div>
    </div>,
    document.body,
  )
}
