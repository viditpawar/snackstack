import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from './supabase'
import type { Purchase } from './types'
import { formatDate, formatMoney, formatQty, today } from './dates'

// 'YYYY-MM' -> ['YYYY-MM-01', first day of the next month]
function monthRange(month: string): [string, string] {
  const [y, m] = month.split('-').map(Number)
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
  return [`${month}-01`, `${next}-01`]
}

export default function Spending() {
  const [month, setMonth] = useState(today().slice(0, 7))
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [store, setStore] = useState('')
  const [date, setDate] = useState(today())

  const load = useCallback(async () => {
    const [start, end] = monthRange(month)
    const { data, error } = await supabase
      .from('purchases')
      .select('*')
      .gte('purchased_on', start)
      .lt('purchased_on', end)
      .order('purchased_on', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setPurchases(data)
  }, [month])

  useEffect(() => {
    load()
  }, [load])

  async function add(e: FormEvent) {
    e.preventDefault()
    const { error } = await supabase
      .from('purchases')
      .insert({ name: name.trim(), price: Number(price), store: store.trim() || null, purchased_on: date })
    if (error) return setError(error.message)
    setName('')
    setPrice('')
    load()
  }

  async function remove(id: string) {
    const { error } = await supabase.from('purchases').delete().eq('id', id)
    if (error) return setError(error.message)
    load()
  }

  const total = purchases.reduce((sum, p) => sum + Number(p.price), 0)
  const byStore = new Map<string, number>()
  for (const p of purchases) {
    const key = p.store || 'No store'
    byStore.set(key, (byStore.get(key) ?? 0) + Number(p.price))
  }

  return (
    <section>
      <form onSubmit={add} className="stack">
        <div className="row">
          <input placeholder="What did you buy?" value={name} onChange={(e) => setName(e.target.value)} required className="grow" />
          <input type="number" min="0" step="0.01" placeholder="Price" value={price} onChange={(e) => setPrice(e.target.value)} required className="narrow" />
        </div>
        <div className="row">
          <input placeholder="Store (optional)" value={store} onChange={(e) => setStore(e.target.value)} className="grow" />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required aria-label="Date" />
          <button type="submit">Add</button>
        </div>
      </form>
      {error && <p className="error">{error}</p>}

      <div className="summary">
        <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} aria-label="Month" />
        <div>
          <div className="muted">Total</div>
          <div className="total">{formatMoney(total)}</div>
        </div>
      </div>

      {byStore.size > 1 && (
        <ul className="breakdown">
          {[...byStore.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([s, amount]) => (
              <li key={s}>
                <span>{s}</span>
                <span>{formatMoney(amount)}</span>
              </li>
            ))}
        </ul>
      )}

      {purchases.length === 0 && <p className="muted">No purchases this month.</p>}
      <ul className="list">
        {purchases.map((p) => (
          <li key={p.id}>
            <div className="row">
              <span className="grow">
                {p.name} <span className="muted">{formatQty(p.quantity, p.unit)}</span>
                <span className="muted small-text">
                  {formatDate(p.purchased_on)}
                  {p.store && ` · ${p.store}`}
                </span>
              </span>
              <strong>{formatMoney(Number(p.price))}</strong>
              <button className="link danger" onClick={() => remove(p.id)} aria-label={`Remove ${p.name}`}>
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
