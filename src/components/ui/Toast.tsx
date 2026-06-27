import { createContext, useContext, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react'
import './shared-ui.css'

// ─── Interfaces ───────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'info' | 'warning'

interface ToastItem {
  id: string
  message: string
  type: ToastType
  duration: number
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, duration?: number) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const showToast = useCallback((message: string, type: ToastType = 'info', duration = 3000) => {
    const id = Math.random().toString(36).substring(2, 9)
    const newToast: ToastItem = { id, message, type, duration }

    setToasts((prev) => {
      // Limit to max 3 toasts
      const active = [...prev, newToast]
      if (active.length > 3) {
        return active.slice(active.length - 3)
      }
      return active
    })

    // Automatically remove toast after duration
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, duration)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Floating Stacking Toasts Panel */}
      <div className="toast-panel-container" role="status" aria-live="polite">
        {toasts.map((t) => {
          const dismissDelay = `${t.duration - 250}ms`
          return (
            <div
              key={t.id}
              className={`toast-pill toast-pill--${t.type}`}
              style={{ '--dismiss-delay': dismissDelay } as React.CSSProperties}
            >
              <div className="toast-icon" aria-hidden="true">
                {t.type === 'success' && <CheckCircle size={16} />}
                {t.type === 'error' && <AlertCircle size={16} />}
                {t.type === 'info' && <Info size={16} />}
                {t.type === 'warning' && <AlertTriangle size={16} />}
              </div>
              <span className="toast-message-text">{t.message}</span>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
