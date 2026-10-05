import type { CSSProperties, ReactNode } from 'react'
import { AlertTriangle, Clock } from 'lucide-react'
import { expiryInfo } from '../lib/format'
import { categoryStyle, guessCategory, itemEmoji } from '../lib/categories'

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} aria-hidden className="logo">
      <defs>
        <linearGradient id="snackstack-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7c3aed" />
          <stop offset="0.55" stopColor="#db2777" />
          <stop offset="1" stopColor="#f97316" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="120" fill="url(#snackstack-logo)" />
      <g fill="#fff">
        <rect x="136" y="300" width="240" height="60" rx="30" />
        <rect x="160" y="220" width="192" height="60" rx="30" opacity=".85" />
        <rect x="184" y="140" width="144" height="60" rx="30" opacity=".7" />
      </g>
    </svg>
  )
}

// A tile tinted in the aisle's colour, with the item's own emoji (🥚 for eggs),
// or the aisle's emoji when we don't have one for that item.
export function ItemIcon({ name, category, emoji }: { name?: string; category: string | null; emoji?: string }) {
  const style = categoryStyle(category ?? (name ? guessCategory(name) : null))
  return (
    <span className="item-icon" style={{ '--tile': style.color } as CSSProperties} aria-hidden>
      {emoji ?? (name && itemEmoji(name)) ?? style.emoji}
    </span>
  )
}

export function PageHead({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </header>
  )
}

export function Field({ label, children, group }: { label: string; children: ReactNode; group?: boolean }) {
  // Groups (like a stepper with buttons) can't sit inside <label>: clicking the text would press a button.
  if (group) {
    return (
      <div className="field" role="group" aria-label={label}>
        <span className="field-label">{label}</span>
        {children}
      </div>
    )
  }
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  )
}

export function Empty({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h2>{title}</h2>
      {children && <div className="empty-text">{children}</div>}
    </div>
  )
}

export function ExpiryPill({ date }: { date: string | null }) {
  if (!date) return null
  const { text, tone } = expiryInfo(date)
  return (
    <span className={`pill pill-${tone}`}>
      {tone === 'ok' ? <Clock size={12} /> : <AlertTriangle size={12} />}
      {text}
    </span>
  )
}

export function Skeleton() {
  return (
    <div className="skeleton-wrap" aria-label="Loading" role="status">
      <div className="skeleton skeleton-title" />
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="skeleton skeleton-row" style={{ animationDelay: `${i * 80}ms` }} />
      ))}
    </div>
  )
}
