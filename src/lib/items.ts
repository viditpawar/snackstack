import type { PantryItem, Purchase } from '../types'

const UNITS = new Set([
  'g', 'kg', 'oz', 'lb', 'lbs', 'ml', 'l', 'gal', 'qt',
  'pack', 'packs', 'pk', 'bag', 'bags', 'box', 'boxes', 'can', 'cans', 'jar', 'jars',
  'bottle', 'bottles', 'carton', 'cartons', 'loaf', 'loaves', 'bunch', 'bunches',
  'dozen', 'pc', 'pcs', 'piece', 'pieces', 'tub', 'tubs', 'roll', 'rolls',
])

export type ParsedItem = { name: string; quantity: number; unit: string | null }

// Turns "2 kg rice", "3 apples", "milk x2" or "eggs" into a name, quantity and unit.
export function parseQuickAdd(raw: string): ParsedItem | null {
  let text = raw.trim().replace(/\s+/g, ' ')
  if (!text) return null
  let quantity = 1
  let unit: string | null = null

  const lead = text.match(/^(\d+(?:\.\d+)?)(\s*)(.+)$/)
  const trail = text.match(/^(.+?)\s*[x×]\s*(\d+(?:\.\d+)?)$/i)
  if (lead) {
    const [first, ...rest] = lead[3].split(' ')
    const hasUnit = rest.length > 0 && UNITS.has(first.toLowerCase())
    // "7up" stays a name; "2kg rice" and "2 rice" are quantities.
    if (lead[2] || hasUnit) {
      quantity = Number(lead[1])
      text = hasUnit ? rest.join(' ') : lead[3]
      if (hasUnit) unit = first.toLowerCase()
      text = text.replace(/^of /i, '')
    }
  } else if (trail) {
    text = trail[1]
    quantity = Number(trail[2])
  }

  if (!(quantity > 0)) quantity = 1
  if (!text) return null
  return { name: text.charAt(0).toUpperCase() + text.slice(1), quantity, unit }
}

export function normalizeName(name: string): string {
  return name.trim().toLowerCase()
}

export function sameItem(a: { name: string; unit: string | null }, b: { name: string; unit: string | null }): boolean {
  return normalizeName(a.name) === normalizeName(b.name) && (a.unit ?? '').toLowerCase() === (b.unit ?? '').toLowerCase()
}

export type HistoryEntry = { name: string; unit: string | null; count: number }

// Everything the user has ever bought or stocked, most frequent first.
export function buildHistory(pantry: PantryItem[], purchases: Purchase[]): HistoryEntry[] {
  const map = new Map<string, HistoryEntry>()
  for (const r of [...purchases, ...pantry]) {
    const key = normalizeName(r.name)
    const entry = map.get(key)
    if (entry) entry.count++
    else map.set(key, { name: r.name, unit: r.unit, count: 1 })
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

export function lastPrice(purchases: Purchase[], name: string): number | null {
  const key = normalizeName(name)
  let best: Purchase | null = null
  for (const p of purchases) {
    if (normalizeName(p.name) === key && (!best || p.purchased_on > best.purchased_on)) best = p
  }
  return best ? best.price : null
}

export function recentStores(purchases: Purchase[]): string[] {
  const latest = new Map<string, string>()
  for (const p of purchases) {
    if (!p.store) continue
    const prev = latest.get(p.store)
    if (!prev || p.purchased_on > prev) latest.set(p.store, p.purchased_on)
  }
  return [...latest.entries()].sort((a, b) => b[1].localeCompare(a[1])).map(([s]) => s)
}

// "milk, eggs, bread" or a pasted multi-line list -> one entry per item.
// Spoken input also splits on "and", since you can't say a comma.
export function splitItems(text: string, spoken = false): string[] {
  return text
    .split(spoken ? /\n|,|;|\band\b/i : /\n|,|;/)
    .map((s) => s.replace(/^[\s\-•*·]+|\s+$/g, ''))
    .filter(Boolean)
}

export function isLow(p: PantryItem): boolean {
  return p.quantity === 0 || (p.min_quantity !== null && p.quantity < p.min_quantity)
}

// How many to buy to get back to the level you like to keep.
export function restockQuantity(p: PantryItem): number {
  return p.min_quantity ? Math.max(1, Math.ceil(p.min_quantity - p.quantity)) : 1
}

export function priceStats(purchases: Purchase[], name: string) {
  const key = normalizeName(name)
  const history = purchases.filter((p) => normalizeName(p.name) === key).sort((a, b) => b.purchased_on.localeCompare(a.purchased_on))
  if (history.length === 0) return null
  const prices = history.map((p) => p.price)
  const cheapest = history.reduce((best, p) => (p.price < best.price ? p : best))
  return {
    history,
    last: history[0],
    average: prices.reduce((s, p) => s + p, 0) / prices.length,
    cheapest,
    total: prices.reduce((s, p) => s + p, 0),
  }
}
