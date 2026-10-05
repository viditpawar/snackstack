// Dates are stored as plain 'YYYY-MM-DD' strings and treated as local dates.

export function today(): string {
  return toISODate(new Date())
}

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function daysUntil(s: string): number {
  const ms = parseISODate(s).getTime() - parseISODate(today()).getTime()
  return Math.round(ms / 86_400_000)
}

export function formatDate(s: string): string {
  return parseISODate(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatMoney(n: number): string {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD' })
}

export function formatQty(quantity: number, unit: string | null): string {
  return unit ? `${quantity} ${unit}` : `×${quantity}`
}
