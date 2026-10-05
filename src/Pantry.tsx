import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from './supabase'
import type { PantryItem } from './types'
import { daysUntil, formatDate, formatQty } from './dates'

const SOON_DAYS = 3

export default function Pantry() {
  const [items, setItems] = useState<PantryItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unit, setUnit] = useState('')
  const [category, setCategory] = useState('')
  const [expiresOn, setExpiresOn] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('pantry_items')
      .select('*')
      .order('expires_on', { ascending: true, nullsFirst: false })
      .order('name')
    if (error) setError(error.message)
    else setItems(data)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function add(e: FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('pantry_items').insert({
      name: name.trim(),
      quantity: Number(quantity),
      unit: unit.trim() || null,
      category: category.trim() || null,
      expires_on: expiresOn || null,
    })
    if (error) return setError(error.message)
    setName('')
    setQuantity('1')
    setUnit('')
    setCategory('')
    setExpiresOn('')
    load()
  }

  async function setQty(item: PantryItem, q: number) {
    const { error } = await supabase.from('pantry_items').update({ quantity: Math.max(0, q) }).eq('id', item.id)
    if (error) return setError(error.message)
    load()
  }

  async function remove(id: string) {
    const { error } = await supabase.from('pantry_items').delete().eq('id', id)
    if (error) return setError(error.message)
    load()
  }

  async function addToList(item: PantryItem) {
    const { error } = await supabase.from('shopping_items').insert({ name: item.name, quantity: 1, unit: item.unit })
    if (error) return setError(error.message)
    setNotice(`Added ${item.name} to your shopping list.`)
  }

  const expiringSoon = items.filter((i) => i.expires_on && daysUntil(i.expires_on) <= SOON_DAYS).length

  return (
    <section>
      <form onSubmit={add} className="stack">
        <div className="row">
          <input placeholder="Item name" value={name} onChange={(e) => setName(e.target.value)} required className="grow" />
          <input type="number" min="0" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="narrow" aria-label="Quantity" required />
          <input placeholder="unit" value={unit} onChange={(e) => setUnit(e.target.value)} className="narrow" aria-label="Unit" />
        </div>
        <div className="row">
          <input placeholder="Category (optional)" value={category} onChange={(e) => setCategory(e.target.value)} className="grow" />
          <input type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} aria-label="Expires on" />
          <button type="submit">Add</button>
        </div>
      </form>
      {error && <p className="error">{error}</p>}
      {notice && <p className="notice">{notice}</p>}
      {expiringSoon > 0 && (
        <p className="warn">
          {expiringSoon} item{expiringSoon === 1 ? '' : 's'} expired or expiring within {SOON_DAYS} days.
        </p>
      )}
      {items.length === 0 && <p className="muted">Nothing in your pantry yet.</p>}
      <ul className="list">
        {items.map((item) => (
          <li key={item.id} className={item.quantity === 0 ? 'faded' : ''}>
            <div className="row">
              <span className="grow">
                {item.name} <span className="muted">{formatQty(item.quantity, item.unit)}</span>
                {item.category && <span className="tag">{item.category}</span>}
                <ExpiryBadge date={item.expires_on} />
              </span>
              <button className="small" onClick={() => setQty(item, item.quantity - 1)} aria-label="Decrease">
                -
              </button>
              <button className="small" onClick={() => setQty(item, item.quantity + 1)} aria-label="Increase">
                +
              </button>
              <button className="link" onClick={() => addToList(item)}>
                To list
              </button>
              <button className="link danger" onClick={() => remove(item.id)} aria-label={`Remove ${item.name}`}>
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ExpiryBadge({ date }: { date: string | null }) {
  if (!date) return null
  const days = daysUntil(date)
  if (days < 0) return <span className="badge expired">Expired {formatDate(date)}</span>
  if (days === 0) return <span className="badge soon">Expires today</span>
  if (days <= SOON_DAYS) return <span className="badge soon">Expires in {days} day{days === 1 ? '' : 's'}</span>
  return <span className="badge">Expires {formatDate(date)}</span>
}
