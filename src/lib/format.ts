// Dates are stored as plain 'YYYY-MM-DD' strings and treated as local dates.

export const SOON_DAYS = 3

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function today(): string {
  return toISODate(new Date())
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(n: number, from = today()): string {
  const d = parseISODate(from)
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

export function daysUntil(s: string): number {
  const ms = parseISODate(s).getTime() - parseISODate(today()).getTime()
  return Math.round(ms / 86_400_000)
}

export function earliest(a: string | null, b: string | null): string | null {
  if (!a) return b
  if (!b) return a
  return a < b ? a : b
}

export function formatDate(s: string): string {
  const d = parseISODate(s)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) })
}

export function relativeDay(s: string): string {
  const ago = -daysUntil(s)
  if (ago === 0) return 'Today'
  if (ago === 1) return 'Yesterday'
  if (ago > 1 && ago < 7) return parseISODate(s).toLocaleDateString(undefined, { weekday: 'long' })
  return formatDate(s)
}

export type Tone = 'expired' | 'soon' | 'ok'

export function expiryInfo(s: string): { text: string; tone: Tone; days: number } {
  const days = daysUntil(s)
  if (days < -1) return { text: `Expired ${-days} days ago`, tone: 'expired', days }
  if (days === -1) return { text: 'Expired yesterday', tone: 'expired', days }
  if (days === 0) return { text: 'Expires today', tone: 'soon', days }
  if (days === 1) return { text: 'Expires tomorrow', tone: 'soon', days }
  if (days <= SOON_DAYS) return { text: `${days} days left`, tone: 'soon', days }
  if (days <= 14) return { text: `${days} days left`, tone: 'ok', days }
  return { text: `Until ${formatDate(s)}`, tone: 'ok', days }
}

// The user's currency, set from their settings when the app loads.
let currency = 'USD'

export function setCurrencyCode(code: string) {
  currency = code
}

export function formatMoney(n: number, compact = false): string {
  return n.toLocaleString(undefined, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    ...(compact ? { notation: 'compact', maximumFractionDigits: n >= 1000 ? 1 : 0 } : {}),
  })
}

export function currencySymbol(): string {
  return (0).toLocaleString(undefined, { style: 'currency', currency, currencyDisplay: 'narrowSymbol', maximumFractionDigits: 0 }).replace(/[\d\s.,]/g, '')
}

export function daysInMonth(key: string): number {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

export function formatQty(quantity: number, unit: string | null): string {
  if (unit) return `${quantity} ${unit}`
  return quantity === 1 ? '' : `×${quantity}`
}

export function round(n: number): number {
  return Math.round(n * 100) / 100
}

// Month keys are 'YYYY-MM'.
export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function monthLabel(key: string, style: 'long' | 'short' = 'long'): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  return d.toLocaleDateString(undefined, style === 'long' ? { month: 'long', year: 'numeric' } : { month: 'short' })
}

export function greeting(): string {
  const h = new Date().getHours()
  if (h >= 5 && h < 12) return 'Good morning'
  if (h >= 12 && h < 17) return 'Good afternoon'
  return 'Good evening'
}
