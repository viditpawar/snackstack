// Turns the raw text read from a receipt photo into a store, date, line items, tax and total.
// Receipts vary a lot, so this is a best guess: the user always reviews it before saving.

export type ReceiptLine = { name: string; price: number }
export type ParsedReceipt = {
  store: string | null
  date: string | null
  items: ReceiptLine[]
  tax: number | null
  total: number | null
}

// A price at the end of a line, optionally followed by a tax flag ("3.99 F", "2.50-", "-1.00", "$4.29 *").
const PRICE_AT_END = /(-)?\s?[$€£₹]?\s?(\d{1,5}(?:[.,]\d{3})*[.,]\s?\d{2})\s?(-)?(?:\s+[A-Z*]{1,2})?\s*$/

const NOT_AN_ITEM =
  /\b(sub\s*-?\s*total|total|tax|vat|gst|hst|change|cash|visa|master\s*card|mastercard|amex|discover|debit|credit|card|balance|tender(ed)?|payment|paid|auth|approv\w*|ref|tip|due|amount|points|rewards?|tel|phone|www|thank|cashier|trans(action)?|terminal|merchant|member|loyalty|items?\s+sold|count)\b/i
const DISCOUNT = /\b(coupon|discount|savings?|promo|instant|off|markdown|reduced)\b/i
const TAX = /\b(tax|vat|gst|hst|pst)\b/i
const TOTAL = /\b(total|balance\s+due|amount\s+due)\b/i
const TOTAL_EXCLUDE = /\b(sub|tax|sav\w*|items?|disc\w*|qty|count|points)\b/i

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const DATE_NUMERIC = /\b(\d{1,4})[/\-.](\d{1,2})[/\-.](\d{2,4})\b/
const DATE_WORDS = /\b(?:(\d{1,2})\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*(\d{1,2})?,?\s+(\d{4})\b/i

function parseAmount(raw: string): number {
  const compact = raw.replace(/\s/g, '')
  // The last separator is the decimal point; any earlier ones group thousands.
  const normalized = compact.replace(/[.,](?=\d{3}(\D|$))/g, '').replace(',', '.')
  return Number(normalized)
}

function iso(y: number, m: number, d: number): string | null {
  const date = new Date(y, m - 1, d)
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function findDate(text: string, today: string): string | null {
  const candidates: (string | null)[] = []
  for (const line of text.split('\n')) {
    const n = line.match(DATE_NUMERIC)
    if (n) {
      const [a, b, c] = [Number(n[1]), Number(n[2]), Number(n[3])]
      if (n[1].length === 4) candidates.push(iso(a, b, c))
      else {
        const year = c < 100 ? 2000 + c : c
        // US order (month first) unless the first number can't be a month.
        candidates.push(a > 12 ? iso(year, b, a) : iso(year, a, b) ?? iso(year, b, a))
      }
    }
    const w = line.match(DATE_WORDS)
    if (w) {
      const month = MONTHS.indexOf(w[2].toLowerCase().slice(0, 3)) + 1
      const day = Number(w[1] ?? w[3])
      if (day) candidates.push(iso(Number(w[4]), month, day))
    }
  }
  const [y, m, d] = today.split('-').map(Number)
  const earliest = iso(y - 2, m, Math.min(d, 28))!
  return candidates.find((c): c is string => !!c && c <= today && c >= earliest) ?? null
}

function cleanName(raw: string): string {
  let name = raw
    .replace(/\b\d{5,}\b/g, ' ') // product codes
    .replace(/\d+(\.\d+)?\s*(lb|lbs|kg|oz|g)\s*@.*$/i, ' ') // "1.23 lb @ 2.99/lb"
    .replace(/\d+\s*@.*$/, ' ') // "2 @ 3.99"
    .replace(/[^\p{L}\p{N}%&'/ .-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[\s.\-/]+|[\s.\-/]+$/g, '')
  // Receipts are usually ALL CAPS; make them readable.
  if (name === name.toUpperCase()) name = name.toLowerCase().replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase())
  return name
}

const letters = (s: string) => (s.match(/\p{L}/gu) ?? []).length

function findStore(lines: string[], knownStores: string[]): string | null {
  const head = lines.slice(0, 6)
  const headText = head.join(' ').toLowerCase()
  for (const store of knownStores) {
    const key = store.toLowerCase().replace(/[’']/g, "'")
    const firstWord = key.split(' ')[0]
    if (headText.replace(/[’']/g, "'").includes(key) || (firstWord.length >= 4 && headText.includes(firstWord))) return store
  }
  const candidate = head.find((l) => {
    const t = l.trim()
    return letters(t) >= 3 && letters(t) / t.length > 0.5 && !/^\d/.test(t) && !NOT_AN_ITEM.test(t) && !DATE_NUMERIC.test(t)
  })
  return candidate ? cleanName(candidate).slice(0, 40) : null
}

export function parseReceipt(text: string, knownStores: string[], today: string): ParsedReceipt {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  const items: ReceiptLine[] = []
  const totals: number[] = []
  let tax = 0
  let pendingName: string | null = null

  for (const line of lines) {
    const m = line.match(PRICE_AT_END)
    if (!m) {
      // A text-only line can be the name for a price on the next line ("BANANAS" / "2 @ 0.59  1.18").
      pendingName = letters(line) >= 3 && !NOT_AN_ITEM.test(line) && !DATE_NUMERIC.test(line) ? line : null
      continue
    }
    const amount = parseAmount(m[2])
    const negative = !!(m[1] || m[3])
    const label = line.slice(0, m.index).trim()

    if (TOTAL.test(label)) {
      // "Total savings", "total items" and friends are summaries, not the amount paid.
      if (!TOTAL_EXCLUDE.test(label)) totals.push(amount)
    } else if (TAX.test(label) && !/\b(before|pre|incl\w*)\b/i.test(label)) {
      tax += amount
    } else if (negative || DISCOUNT.test(label)) {
      // Discounts come right after the item they apply to.
      const last = items[items.length - 1]
      if (last) last.price = Math.max(0, Math.round((last.price - amount) * 100) / 100)
    } else if (!NOT_AN_ITEM.test(label) && !DATE_NUMERIC.test(label)) {
      let name = cleanName(label)
      if (letters(name) < 2 && pendingName) name = cleanName(pendingName)
      if (letters(name) >= 2 && amount > 0 && amount < 1000) items.push({ name, price: amount })
    }
    pendingName = null
  }

  return {
    store: findStore(lines, knownStores),
    date: findDate(text, today),
    items,
    tax: tax > 0 ? Math.round(tax * 100) / 100 : null,
    total: totals.length ? Math.max(...totals) : null,
  }
}
