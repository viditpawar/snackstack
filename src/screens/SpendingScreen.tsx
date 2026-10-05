import { useMemo, useState, type FormEvent } from 'react'
import { ChevronLeft, ChevronRight, Plus, Receipt, Trash, Trash2, X } from 'lucide-react'
import { useStore } from '../store'
import { useSettings } from '../lib/settings'
import { currencySymbol, daysInMonth, formatMoney, formatQty, monthLabel, relativeDay, shiftMonth, today } from '../lib/format'
import { normalizeName, recentStores } from '../lib/items'
import { CATEGORIES } from '../lib/categories'
import type { Purchase } from '../types'
import { Sheet } from '../ui/Sheet'
import { PriceHistory } from '../ui/PriceHistory'
import { Empty, Field, PageHead } from '../ui/bits'

const CHART_MONTHS = 6

export default function SpendingScreen() {
  const { purchases, waste, removeWaste } = useStore()
  const { budget } = useSettings()
  const thisMonth = today().slice(0, 7)
  const [month, setMonth] = useState(thisMonth)
  const [editing, setEditing] = useState<Purchase | 'new' | null>(null)
  const [historyFor, setHistoryFor] = useState<string | null>(null)
  const [breakdownBy, setBreakdownBy] = useState<'store' | 'category'>('store')

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
  const monthWaste = useMemo(() => waste.filter((w) => w.logged_on.startsWith(month)).sort((a, b) => b.logged_on.localeCompare(a.logged_on)), [waste, month])
  const wasteTotal = monthWaste.reduce((s, w) => s + (w.cost ?? 0), 0)

  const total = byMonth.get(month) ?? 0
  const previous = byMonth.get(shiftMonth(month, -1)) ?? 0
  const trips = new Set(monthPurchases.map((p) => `${p.purchased_on}|${p.store ?? ''}`)).size

  const breakdown = useMemo(() => {
    const totals = new Map<string, number>()
    for (const p of monthPurchases) {
      const key = breakdownBy === 'store' ? p.store || 'No store' : p.category || 'Other'
      totals.set(key, (totals.get(key) ?? 0) + p.price)
    }
    return [...totals.entries()].sort((a, b) => b[1] - a[1])
  }, [monthPurchases, breakdownBy])

  const topItems = useMemo(() => {
    const totals = new Map<string, { name: string; amount: number; count: number }>()
    for (const p of monthPurchases) {
      const key = normalizeName(p.name)
      const entry = totals.get(key) ?? { name: p.name, amount: 0, count: 0 }
      entry.amount += p.price
      entry.count++
      totals.set(key, entry)
    }
    return [...totals.values()].sort((a, b) => b.amount - a.amount).slice(0, 5)
  }, [monthPurchases])

  const days = useMemo(() => {
    const map = new Map<string, Purchase[]>()
    for (const p of monthPurchases) map.set(p.purchased_on, [...(map.get(p.purchased_on) ?? []), p])
    return [...map.entries()]
  }, [monthPurchases])

  const chartMonths = Array.from({ length: CHART_MONTHS }, (_, i) => shiftMonth(month, i - (CHART_MONTHS - 1)))
  const chartMax = Math.max(...chartMonths.map((k) => byMonth.get(k) ?? 0), budget ?? 0, 1)

  let comparison: string | null = null
  if (previous > 0 && total > 0) {
    const pct = Math.round(((total - previous) / previous) * 100)
    const prevName = monthLabel(shiftMonth(month, -1), 'short')
    comparison = pct === 0 ? `Same as ${prevName}` : `${Math.abs(pct)}% ${pct > 0 ? 'more' : 'less'} than ${prevName}`
  }

  // Only project the current month, and only once there's a few days of data.
  const dayOfMonth = new Date().getDate()
  const projected = month === thisMonth && total > 0 && dayOfMonth >= 5 ? (total / dayOfMonth) * daysInMonth(month) : null

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

        {budget && <BudgetBar spent={total} budget={budget} projected={projected} />}
        {!budget && projected && <p className="hero-sub">On pace for about {formatMoney(projected)} this month</p>}

        <div className="chart" role="list" aria-label={`Spending for the ${CHART_MONTHS} months ending ${monthLabel(month)}`}>
          {budget && <div className="chart-budget" style={{ bottom: `calc((100% - 22px) * ${budget / chartMax})` }} aria-hidden />}
          {chartMonths.map((key) => {
            const value = byMonth.get(key) ?? 0
            const selected = key === month
            return (
              <button
                key={key}
                role="listitem"
                className={`bar${selected ? ' bar-on' : ''}${budget && value > budget ? ' bar-over' : ''}`}
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
        {budget && <p className="chart-legend">Dashed line: your {formatMoney(budget)} monthly budget</p>}
      </section>

      {breakdown.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h2 className="card-title">Breakdown</h2>
            <div className="segmented segmented-sm" role="radiogroup" aria-label="Break down by">
              <button role="radio" aria-checked={breakdownBy === 'store'} onClick={() => setBreakdownBy('store')}>
                Store
              </button>
              <button role="radio" aria-checked={breakdownBy === 'category'} onClick={() => setBreakdownBy('category')}>
                Aisle
              </button>
            </div>
          </div>
          <ul className="breakdown">
            {breakdown.map(([name, amount]) => (
              <li key={name}>
                <div className="breakdown-head">
                  <span>{name}</span>
                  <span>
                    {formatMoney(amount)} <span className="muted">{Math.round((amount / total) * 100)}%</span>
                  </span>
                </div>
                <div className="breakdown-track">
                  <div className="breakdown-fill" style={{ width: `${(amount / breakdown[0][1]) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {topItems.length > 1 && (
        <section className="card">
          <h2 className="card-title">Top items</h2>
          <ul className="mini-list">
            {topItems.map((t, i) => (
              <li key={t.name}>
                <button className="mini-main mini-link" onClick={() => setHistoryFor(t.name)}>
                  <span className="rank">{i + 1}</span>
                  <span className="item-name">{t.name}</span>
                  {t.count > 1 && <span className="muted">×{t.count}</span>}
                </button>
                <strong className="tabular">{formatMoney(t.amount)}</strong>
              </li>
            ))}
          </ul>
          <p className="hint">Tap an item to see its price history.</p>
        </section>
      )}

      {monthWaste.length > 0 && (
        <section className="card">
          <h2 className="card-title">
            <Trash size={18} /> Food waste
          </h2>
          <p className="muted waste-summary">
            {monthWaste.length} item{monthWaste.length === 1 ? '' : 's'} tossed
            {wasteTotal > 0 && (
              <>
                {' '}
                · about <strong className="text-danger">{formatMoney(wasteTotal)}</strong> thrown away
              </>
            )}
          </p>
          <ul className="mini-list">
            {monthWaste.slice(0, 6).map((w) => (
              <li key={w.id}>
                <span className="mini-main">
                  <span className="item-name">{w.name}</span>
                  <span className="muted">{[formatQty(w.quantity, w.unit), relativeDay(w.logged_on)].filter(Boolean).join(' · ')}</span>
                </span>
                <span className="row-end">
                  {w.cost !== null && <span className="tabular">{formatMoney(w.cost)}</span>}
                  <button className="icon-btn icon-btn-sm" onClick={() => removeWaste(w.id)} aria-label={`Remove ${w.name} from waste log`}>
                    <X size={16} />
                  </button>
                </span>
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

      <button className="fab" onClick={() => setEditing('new')} aria-label="Log a purchase" data-shortcut="new">
        <Plus size={24} />
      </button>

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Log a purchase' : 'Edit purchase'}>
        {editing && <PurchaseForm item={editing === 'new' ? null : editing} defaultDate={month === thisMonth ? today() : `${month}-01`} onDone={() => setEditing(null)} />}
      </Sheet>
      <Sheet open={historyFor !== null} onClose={() => setHistoryFor(null)} title={historyFor ?? 'Price history'}>
        {historyFor && <PriceHistory name={historyFor} />}
      </Sheet>
    </>
  )
}

function BudgetBar({ spent, budget, projected }: { spent: number; budget: number; projected: number | null }) {
  const pct = Math.min(100, (spent / budget) * 100)
  const over = spent > budget
  const tone = over ? 'over' : pct >= 85 ? 'near' : 'ok'
  return (
    <div className={`budget budget-${tone}`}>
      <div className="budget-track">
        <div className="budget-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="budget-text">
        <span>{over ? `${formatMoney(spent - budget)} over budget` : `${formatMoney(budget - spent)} left of ${formatMoney(budget)}`}</span>
        {projected && <span className="muted">On pace for {formatMoney(projected)}</span>}
      </div>
    </div>
  )
}

function PurchaseForm({ item, defaultDate, onDone }: { item: Purchase | null; defaultDate: string; onDone: () => void }) {
  const { purchases, addPurchase, updatePurchase, removePurchase, categoryFor } = useStore()
  const stores = useMemo(() => recentStores(purchases).slice(0, 4), [purchases])
  const [name, setName] = useState(item?.name ?? '')
  const [price, setPrice] = useState(item ? String(item.price) : '')
  const [store, setStore] = useState(item?.store ?? '')
  const [date, setDate] = useState(item?.purchased_on ?? defaultDate)
  const [category, setCategory] = useState<string | null>(item?.category ?? null)
  const [categoryTouched, setCategoryTouched] = useState(!!item)

  function submit(e: FormEvent) {
    e.preventDefault()
    const data = { name: name.trim(), price: Number(price), store: store.trim() || null, purchased_on: date, category }
    if (item) updatePurchase(item.id, data)
    else addPurchase({ ...data, quantity: 1, unit: null })
    onDone()
  }

  return (
    <form className="form" onSubmit={submit}>
      <Field label="What did you buy?">
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            if (!categoryTouched) setCategory(categoryFor(e.target.value))
          }}
          required
          placeholder="e.g. Weekly groceries"
          data-autofocus={item ? undefined : true}
        />
      </Field>
      <div className="field-row">
        <Field label="Price">
          <span className="money">
            <span aria-hidden>{currencySymbol()}</span>
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
      <Field label="Aisle" group>
        <div className="chips">
          {CATEGORIES.map((c) => (
            <button
              type="button"
              key={c}
              className={`chip${category === c ? ' chip-on' : ''}`}
              onClick={() => {
                setCategory(category === c ? null : c)
                setCategoryTouched(true)
              }}
            >
              {c}
            </button>
          ))}
        </div>
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
      {item && (
        <details className="disclosure">
          <summary>Price history</summary>
          <PriceHistory name={item.name} />
        </details>
      )}
    </form>
  )
}
