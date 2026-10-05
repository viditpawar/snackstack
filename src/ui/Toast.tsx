import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'

type ToastOptions = {
  action?: { label: string; onClick: () => void }
  tone?: 'error'
  duration?: number
}

type ToastItem = ToastOptions & { id: number; message: string }

type ShowToast = (message: string, options?: ToastOptions) => void

const ToastContext = createContext<ShowToast>(() => {})

let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), [])

  const show = useCallback<ShowToast>(
    (message, options = {}) => {
      const id = ++nextId
      setToasts((list) => [...list.slice(-2), { id, message, ...options }])
      window.setTimeout(() => dismiss(id), options.duration ?? (options.action ? 6000 : 4000))
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast${t.tone === 'error' ? ' toast-error' : ''}`}>
            <span className="toast-message">{t.message}</span>
            {t.action && (
              <button
                className="toast-action"
                onClick={() => {
                  t.action!.onClick()
                  dismiss(t.id)
                }}
              >
                {t.action.label}
              </button>
            )}
            <button className="toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
