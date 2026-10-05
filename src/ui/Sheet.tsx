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

  // iOS Safari doesn't shrink the page when the keyboard opens, so a bottom sheet ends up behind it.
  // Size the dialog to the visible part of the screen instead, and keep the focused field in view.
  useEffect(() => {
    const dialog = ref.current
    const viewport = window.visualViewport
    if (!open || !dialog || !viewport) return

    const fit = () => {
      dialog.style.height = `${viewport.height}px`
      dialog.style.top = `${viewport.offsetTop}px`
    }
    const reveal = (e: FocusEvent) => {
      const field = e.target as HTMLElement
      if (!field.matches('input, select, textarea')) return
      // Wait for the keyboard to finish sliding up.
      window.setTimeout(() => field.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300)
    }

    fit()
    viewport.addEventListener('resize', fit)
    viewport.addEventListener('scroll', fit)
    dialog.addEventListener('focusin', reveal)
    return () => {
      viewport.removeEventListener('resize', fit)
      viewport.removeEventListener('scroll', fit)
      dialog.removeEventListener('focusin', reveal)
      dialog.style.height = ''
      dialog.style.top = ''
    }
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
