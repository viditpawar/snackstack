import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

// A modal that slides up from the bottom on phones and sits centered on wider screens.
// Children only mount while open, so forms inside start fresh every time.
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {open && (
        <div className="sheet-panel">
          <div className="sheet-handle" aria-hidden />
          <header className="sheet-head">
            <h2>{title}</h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              <X size={20} />
            </button>
          </header>
          <div className="sheet-content">{children}</div>
        </div>
      )}
    </dialog>
  )
}
