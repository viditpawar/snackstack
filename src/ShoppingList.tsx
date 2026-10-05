import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from './supabase'
import type { ShoppingItem } from './types'
import { formatQty } from './dates'

export default function ShoppingList() {
  const [items, setItems] = useState<ShoppingItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [buyingId, setBuyingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unit, setUnit] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('shopping_items').select('*').order('created_at')
    if (error) setError(error.message)
    else setItems(data)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function add(e: FormEvent) {
    e.preventDefault()
    const { error } = await supabase
      .from('shopping_items')
      .insert({ name: name.trim(), quantity: Number(quantity), unit: unit.trim() || null })
    if (error) return setError(error.message)
    setName('')
    setQuantity('1')
    setUnit('')
    load()
  }

  async function remove(id: string) {
    const { error } = await supabase.from('shopping_items').delete().eq('id', id)
    if (error) return setError(error.message)
    load()
  }

  return (
    <section>
      <form onSubmit={add} className="row">
        <input placeholder="Add an item..." value={name} onChange={(e) => setName(e.target.value)} required className="grow" />
        <input type="number" min="0.01" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="narrow" aria-label="Quantity" required />
        <input placeholder="unit" value={unit} onChange={(e) => setUnit(e.target.value)} className="narrow" aria-label="Unit" />
        <button type="submit">Add</button>
      </form>
      {error && <p className="error">{error}</p>}
      {items.length === 0 && <p className="muted">Your shopping list is empty.</p>}
      <ul className="list">
        {items.map((item) => (
          <li key={item.id}>
            <div className="row">
              <span className="grow">
                {item.name} <span className="muted">{formatQty(item.quantity, item.unit)}</span>
              </span>
              <button onClick={() => setBuyingId(buyingId === item.id ? null : item.id)}>Bought</button>
              <button className="link danger" onClick={() => remove(item.id)} aria-label={`Remove ${item.name}`}>
                Remove
              </button>
            </div>
            {buyingId === item.id && (
              <BuyForm
                item={item}
                onDone={() => {
                  setBuyingId(null)
                  load()
                }}
                onError={setError}
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

// Marking an item as bought can record what it cost and move it into the pantry.
function BuyForm({ item, onDone, onError }: { item: ShoppingItem; onDone: () => void; onError: (msg: string) => void }) {
  const [price, setPrice] = useState('')
  const [store, setStore] = useState('')
  const [addToPantry, setAddToPantry] = useState(true)
  const [expiresOn, setExpiresOn] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    const base = { name: item.name, quantity: item.quantity, unit: item.unit }

    if (price !== '') {
      const { error } = await supabase.from('purchases').insert({ ...base, price: Number(price), store: store.trim() || null })
      if (error) return fail(error.message)
    }
    if (addToPantry) {
      const { error } = await supabase.from('pantry_items').insert({ ...base, expires_on: expiresOn || null })
      if (error) return fail(error.message)
    }
    const { error } = await supabase.from('shopping_items').delete().eq('id', item.id)
    if (error) return fail(error.message)
    onDone()
  }

  function fail(msg: string) {
    setBusy(false)
    onError(msg)
  }

  return (
    <form onSubmit={submit} className="subform">
      <label>
        Price paid
        <input type="number" min="0" step="0.01" placeholder="optional" value={price} onChange={(e) => setPrice(e.target.value)} />
      </label>
      <label>
        Store
        <input placeholder="optional" value={store} onChange={(e) => setStore(e.target.value)} />
      </label>
      <label className="check">
        <input type="checkbox" checked={addToPantry} onChange={(e) => setAddToPantry(e.target.checked)} />
        Add to pantry
      </label>
      {addToPantry && (
        <label>
          Expires on
          <input type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} />
        </label>
      )}
      <button type="submit" disabled={busy}>
        Save
      </button>
    </form>
  )
}
