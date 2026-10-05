import { useMemo, useState, type FormEvent } from 'react'
import { ChevronLeft, ChevronRight, Plus, Receipt, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import { formatMoney, formatQty, monthLabel, relativeDay, shiftMonth, today } from '../lib/format'
import { recentStores } from '../lib/items'
import type { Purchase } from '../types'
import { Sheet } from '../ui/Sheet'
import { Empty, Field, PageHead } from '../ui/bits'

const CHART_MONTHS = 6

export default function SpendingScreen() {
  const { purchases } = useStore()
  const thisMonth = today().slice(0, 7)
  const [month, setMonth] = useState(thisMonth)
  const [editing, setEditing] = useState<Purchase | 'new' | null>(null)

  const byMonth = useMemo(() => {
    const totals = new Map<string, number>()
    for (const p of purchases) {
      const key = p.purchased_on.slice(0, 7)
      totals.set(key, (totals.get(key) ?? 0) + p.price)
    }
    return totals
  }, [purchases])

  const monthPurchases = useMemo(
    () => purchases.filter((p) => p.purchased_on.startsWith(month)).sort((a, b) => b.purchased_on.localeCompare(a.purchased_on) || b.created_at.localeCompare(a.created_at)),
    [purchases, month],
  )

  const total = byMonth.get(month) ?? 0
  const previous = byMonth.get(shiftMonth(month, -1)) ?? 0
  const trips = new Set(monthPurchases.map((p) => `${p.purchased_on}|${p.store ?? ''}`)).size

  const stores = useMemo(() => {
    const totals = new Map<string, number>()
    for (const p of monthPurchases) totals.set(p.store || 'No store', (totals.get(p.store || 'No store') ?? 0) + p.price)
    return [...totals.entries()].sort((a, b) => b[1] - a[1])
  }, [monthPurchases])

  const days = useMemo(() => {
    const map = new Map<string, Purchase[]>()
    for (const p of monthPurchases) map.set(p.purchased_on, [...(map.get(p.purchased_on) ?? []), p])
    return [...map.entries()]
  }, [monthPurchases])

  const chartMonths = Array.from({ length: CHART_MONTHS }, (_, i) => shiftMonth(month, i - (CHART_MONTHS - 1)))
  const chartMax = Math.max(...chartMonths.map((k) => byMonth.get(k) ?? 0), 1)

  let comparison: string | null = null
  if (previous > 0 && total > 0) {
    const pct = Math.round(((total - previous) / previous) * 100)
    const prevName = monthLabel(shiftMonth(month, -1), 'short')
    comparison = pct === 0 ? `Same as ${prevName}` : `${Math.abs(pct)}% ${pct > 0 ? 'more' : 'less'} than ${prevName}`
  }

  return (
    <>
      <PageHead title="Spending" subtitle="What your groceries cost" />

      <div className="month-nav">
        <button className="icon-btn" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">
          <ChevronLeft size={20} />
        </button>
        <span className="month-nav-label">{monthLabel(month)}</span>
        <button className="icon-btn" onClick={() => setMonth(shiftMonth(month, 1))} disabled={month >= thisMonth} aria-label="Next month">
          <ChevronRight size={20} />
        </button>
      </div>

      <section className="card hero">
        <div className="hero-total">{formatMoney(total)}</div>
        <div className="hero-sub">
          {monthPurchases.length === 0
            ? 'No purchases logged'
            : `${monthPurchases.length} item${monthPurchases.length === 1 ? '' : 's'} · ${trips} trip${trips === 1 ? '' : 's'}`}
          {comparison && <span> · {comparison}</span>}
        </div>

        <div className="chart" role="list" aria-label={`Spending for the ${CHART_MONTHS} months ending ${monthLabel(month)}`}>
          {chartMonths.map((key) => {
            const value = byMonth.get(key) ?? 0
            const selected = key === month
            return (
              <button
                key={key}
                role="listitem"
                className={`bar${selected ? ' bar-on' : ''}`}
                onClick={() => setMonth(key)}
                aria-label={`${monthLabel(key)}: ${formatMoney(value)}`}
                aria-current={selected ? 'true' : undefined}
              >
                <span className="bar-track">
                  <span className="bar-fill" style={{ height: `${(value / chartMax) * 100}%` }}>
                    <span className="bar-value">{formatMoney(value, true)}</span>
                  </span>
                </span>
                <span className="bar-label">{monthLabel(key, 'short')}</span>
              </button>
            )
          })}
        </div>
      </section>

      {stores.length > 0 && (
        <section className="card">
          <h2 className="card-title">By store</h2>
          <ul className="breakdown">
            {stores.map(([name, amount]) => (
              <li key={name}>
                <div className="breakdown-head">
                  <span>{name}</span>
                  <span>
                    {formatMoney(amount)} <span className="muted">{Math.round((amount / total) * 100)}%</span>
                  </span>
                </div>
                <div className="breakdown-track">
                  <div className="breakdown-fill" style={{ width: `${(amount / stores[0][1]) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {monthPurchases.length === 0 ? (
        <Empty icon={<Receipt size={28} />} title={`Nothing logged for ${monthLabel(month, 'short')}`}>
          Add prices when you check out from your shopping list, or log a purchase with the + button.
        </Empty>
      ) : (
        days.map(([day, items]) => (
          <section key={day}>
            <h2 className="section-title section-title-split">
              <span>{relativeDay(day)}</span>
              <span>{formatMoney(items.reduce((s, p) => s + p.price, 0))}</span>
            </h2>
            <ul className="items">
              {items.map((p) => {
                const qty = formatQty(p.quantity, p.unit)
                return (
                  <li key={p.id} className="item">
                    <button className="item-main" onClick={() => setEditing(p)}>
                      <span className="item-name">{p.name}</span>
                      <span className="item-sub muted">{[qty, p.store].filter(Boolean).join(' · ')}</span>
                    </button>
                    <span className="item-price">{formatMoney(p.price)}</span>
                  </li>
                )
              })}
            </ul>
          </section>
        ))
      )}

      <button className="fab" onClick={() => setEditing('new')} aria-label="Log a purchase">
        <Plus size={24} />
      </button>

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Log a purchase' : 'Edit purchase'}>
        {editing && <PurchaseForm item={editing === 'new' ? null : editing} defaultDate={month === thisMonth ? today() : `${month}-01`} onDone={() => setEditing(null)} />}
      </Sheet>
    </>
  )
}

function PurchaseForm({ item, defaultDate, onDone }: { item: Purchase | null; defaultDate: string; onDone: () => void }) {
  const { purchases, addPurchase, updatePurchase, removePurchase } = useStore()
  const stores = useMemo(() => recentStores(purchases).slice(0, 4), [purchases])
  const [name, setName] = useState(item?.name ?? '')
  const [price, setPrice] = useState(item ? String(item.price) : '')
  const [store, setStore] = useState(item?.store ?? '')
  const [date, setDate] = useState(item?.purchased_on ?? defaultDate)

  function submit(e: FormEvent) {
    e.preventDefault()
    const data = { name: name.trim(), price: Number(price), store: store.trim() || null, purchased_on: date }
    if (item) updatePurchase(item.id, data)
    else addPurchase({ ...data, quantity: 1, unit: null })
    onDone()
  }

  return (
    <form className="form" onSubmit={submit}>
      <Field label="What did you buy?">
        <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Weekly groceries" data-autofocus={item ? undefined : true} />
      </Field>
      <div className="field-row">
        <Field label="Price">
          <span className="money money-lg">
            <span aria-hidden>$</span>
            <input type="number" inputMode="decimal" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required placeholder="0.00" />
          </span>
        </Field>
        <Field label="Date">
          <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value || defaultDate)} required />
        </Field>
      </div>
      <Field label="Store" group>
        <input value={store} onChange={(e) => setStore(e.target.value)} placeholder="Optional" aria-label="Store" />
        {stores.length > 0 && (
          <div className="chips">
            {stores.map((s) => (
              <button type="button" key={s} className={`chip${store === s ? ' chip-on' : ''}`} onClick={() => setStore(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
      </Field>
      <div className="form-actions">
        {item && (
          <button
            type="button"
            className="btn btn-danger-ghost"
            onClick={() => {
              removePurchase(item.id)
              onDone()
            }}
          >
            <Trash2 size={18} /> Delete
          </button>
        )}
        <button type="submit" className="btn btn-primary">
          {item ? 'Save' : 'Add'}
        </button>
      </div>
    </form>
  )
}
