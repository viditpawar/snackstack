import { useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import { Trash2 } from 'lucide-react'

// A list row you can swipe left to reveal a delete button, or swipe all the way to delete.
// Vertical scrolling is left to the browser (touch-action: pan-y); we only take horizontal drags.

const ACTION_WIDTH = 92

// Only one row is open at a time.
let closeOpenRow: (() => void) | null = null

type Props = {
  onDelete: () => void
  label?: string
  className?: string
  children: ReactNode
}

export function SwipeRow({ onDelete, label = 'Delete', className = '', children }: Props) {
  const ref = useRef<HTMLLIElement>(null)
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const offsetRef = useRef(0)
  const drag = useRef<{ x: number; y: number; base: number; horizontal: boolean | null } | null>(null)
  const swallowClick = useRef(false)

  const move = (x: number) => {
    offsetRef.current = x
    setOffset(x)
  }

  const close = () => {
    move(0)
    if (closeOpenRow === close) closeOpenRow = null
  }

  function remove() {
    const width = ref.current?.offsetWidth ?? 400
    move(-width)
    closeOpenRow = null
    window.setTimeout(onDelete, 160)
  }

  function onPointerDown(e: PointerEvent<HTMLLIElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    drag.current = { x: e.clientX, y: e.clientY, base: offsetRef.current, horizontal: null }
    swallowClick.current = false
  }

  function onPointerMove(e: PointerEvent<HTMLLIElement>) {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (d.horizontal === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      d.horizontal = Math.abs(dx) > Math.abs(dy)
      if (!d.horizontal) {
        drag.current = null
        return
      }
      ref.current?.setPointerCapture(e.pointerId)
      setDragging(true)
      if (closeOpenRow && closeOpenRow !== close) closeOpenRow()
    }
    swallowClick.current = true
    const width = ref.current?.offsetWidth ?? 400
    // Follows the finger leftwards; a little resistance if you pull right.
    const next = d.base + dx
    move(next > 0 ? next * 0.2 : Math.max(-width, next))
  }

  function onPointerUp() {
    const d = drag.current
    drag.current = null
    if (!d?.horizontal) return
    setDragging(false)
    const width = ref.current?.offsetWidth ?? 400
    const x = offsetRef.current
    if (x < -width * 0.55) remove()
    else if (x < -ACTION_WIDTH / 2) {
      move(-ACTION_WIDTH)
      closeOpenRow = close
    } else close()
  }

  // A swipe shouldn't also count as a tap, and tapping an open row just closes it.
  function onClickCapture(e: MouseEvent) {
    if (swallowClick.current) {
      swallowClick.current = false
      e.preventDefault()
      e.stopPropagation()
    } else if (offsetRef.current !== 0 && !(e.target as HTMLElement).closest('.swipe-action')) {
      e.preventDefault()
      e.stopPropagation()
      close()
    }
  }

  const open = offset < 0
  return (
    <li
      ref={ref}
      className="swipe"
      data-open={open || dragging ? '' : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClickCapture={onClickCapture}
    >
      <button type="button" className="swipe-action" onClick={remove} tabIndex={open ? 0 : -1} aria-hidden={!open}>
        <Trash2 size={18} />
        {label}
      </button>
      <div className={`swipe-content ${className}`} style={{ transform: `translateX(${offset}px)`, transition: dragging ? 'none' : undefined }}>
        {children}
      </div>
    </li>
  )
}
