import { useMemo, useRef, useState, type FormEvent } from 'react'
import { Check, ListChecks, Plus, ShoppingBasket, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import { useCart } from '../lib/cart'
import { buildHistory, lastPrice, normalizeName, parseQuickAdd, recentStores, type HistoryEntry } from '../lib/items'
import { addDays, formatMoney, formatQty, today } from '../lib/format'
import type { ShoppingItem } from '../types'
import { Sheet } from '../ui/Sheet'
import { Stepper } from '../ui/Stepper'
import { Empty, Field, PageHead } from '../ui/bits'

export default function ShoppingScreen() {
  const { shopping } = useStore()
  const { cart, toggle } = useCart(shopping)
  const [editing, setEditing] = useState<ShoppingItem | null>(null)
  const [checkingOut, setCheckingOut] = useState(false)

  const sorted = useMemo(() => [...shopping].sort((a, b) => a.created_at.localeCompare(b.created_at)), [shopping])
  const toBuy = sorted.filter((i) => !cart.has(i.id))
  const inCart = sorted.filter((i) => cart.has(i.id))

  function onToggle(id: string) {
    navigator.vibrate?.(8)
    toggle(id)
  }

  const row = (item: ShoppingItem) => {
    const checked = cart.has(item.id)
    const qty = formatQty(item.quantity, item.unit)
    return (
      <li key={item.id} className={`item${checked ? ' item-done' : ''}`}>
        <button className={`check${checked ? ' check-on' : ''}`} onClick={() => onToggle(item.id)} aria-pressed={checked} aria-label={`${item.name} in cart`}>
          <Check size={16} strokeWidth={3} />
        </button>
        <button className="item-main" onClick={() => setEditing(item)}>
          <span className="item-name">{item.name}</span>
          {qty && <span className="item-qty">{qty}</span>}
        </button>
      </li>
    )
  }

  const subtitle =
    shopping.length === 0 ? 'Nothing to buy right now' : inCart.length ? `${inCart.length} of ${shopping.length} in your cart` : `${shopping.length} item${shopping.length === 1 ? '' : 's'} to buy`

  return (
    <>
      <PageHead title="Shopping list" subtitle={subtitle} />
      <QuickAdd />

      {shopping.length === 0 ? (
        <Empty icon={<ShoppingBasket size={28} />} title="Your list is empty">
          Type what you need above. Try <em>“2 kg rice”</em> or <em>“milk x2”</em> and the quantity fills itself in.
        </Empty>
      ) : (
        <>
          {toBuy.length > 0 ? (
            <ul className="items">{toBuy.map(row)}</ul>
          ) : (
            <p className="all-done">
              <ListChecks size={18} /> Everything's in the cart. Check out when you're done.
            </p>
          )}
          {inCart.length > 0 && (
            <>
              <h2 className="section-title">In cart · {inCart.length}</h2>
              <ul className="items">{inCart.map(row)}</ul>
            </>
          )}
          <p className="hint">Tap the circle to put an item in your cart. Tap the name to edit it.</p>
        </>
      )}

      {inCart.length > 0 && (
        <div className="action-bar">
          <span>
            <strong>{inCart.length}</strong> in cart
          </span>
          <button className="btn btn-primary" onClick={() => setCheckingOut(true)}>
            Check out
          </button>
        </div>
      )}

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title="Edit item">
        {editing && <EditItem item={editing} onDone={() => setEditing(null)} />}
      </Sheet>
      <Sheet open={checkingOut} onClose={() => setCheckingOut(false)} title="Check out">
        <Checkout items={inCart} onDone={() => setCheckingOut(false)} />
      </Sheet>
    </>
  )
}

function QuickAdd() {
  const { shopping, pantry, purchases, addShopping } = useStore()
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const parsed = parseQuickAdd(text)
  const history = useMemo(() => buildHistory(pantry, purchases), [pantry, purchases])
  const onList = useMemo(() => new Set(shopping.map((s) => normalizeName(s.name))), [shopping])
  const stocked = useMemo(() => new Set(pantry.filter((p) => p.quantity > 0).map((p) => normalizeName(p.name))), [pantry])

  const query = parsed ? normalizeName(parsed.name) : ''
  const matches = query
    ? history.filter((h) => {
        const key = normalizeName(h.name)
        return key.includes(query) && key !== query && !onList.has(key)
      }).slice(0, 5)
    : []
  const runningOut = pantry.filter((p) => p.quantity === 0 && !onList.has(normalizeName(p.name)) && !stocked.has(normalizeName(p.name))).slice(0, 6)
  const runningOutNames = new Set(runningOut.map((p) => normalizeName(p.name)))
  const buyAgain = history
    .filter((h) => {
      const key = normalizeName(h.name)
      return !onList.has(key) && !stocked.has(key) && !runningOutNames.has(key)
    })
    .slice(0, 6)

  function add(item: { name: string; quantity: number; unit: string | null }) {
    navigator.vibrate?.(8)
    addShopping(item)
    setText('')
    inputRef.current?.focus()
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (parsed) add(parsed)
  }

  const pick = (h: HistoryEntry) => add({ name: h.name, quantity: parsed?.quantity ?? 1, unit: parsed?.unit ?? h.unit })

  return (
    <form className="quick-add" onSubmit={submit}>
      <div className="quick-add-field">
        <Plus size={20} className="quick-add-icon" aria-hidden />
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add an item, e.g. 2 kg rice"
          aria-label="Add an item to your list"
          autoComplete="off"
          enterKeyHint="done"
        />
        {parsed && (
          <button type="submit" className="btn btn-primary btn-sm">
            Add
          </button>
        )}
      </div>
      {parsed && (parsed.quantity !== 1 || parsed.unit) && (
        <p className="quick-preview">
          Adds <strong>{parsed.name}</strong> · {formatQty(parsed.quantity, parsed.unit)}
        </p>
      )}
      {matches.length > 0 && (
        <div className="chips">
          {matches.map((h) => (
            <button type="button" key={h.name} className="chip" onClick={() => pick(h)}>
              <Plus size={14} />
              {h.name}
            </button>
          ))}
        </div>
      )}
      {!text && runningOut.length > 0 && (
        <div className="chips">
          <span className="chips-label">Ran out</span>
          {runningOut.map((p) => (
            <button type="button" key={p.id} className="chip chip-warn" onClick={() => add({ name: p.name, quantity: 1, unit: p.unit })}>
              <Plus size={14} />
              {p.name}
            </button>
          ))}
        </div>
      )}
      {!text && buyAgain.length > 0 && (
        <div className="chips">
          <span className="chips-label">Buy again</span>
          {buyAgain.map((h) => (
            <button type="button" key={h.name} className="chip" onClick={() => pick(h)}>
              <Plus size={14} />
              {h.name}
            </button>
          ))}
        </div>
      )}
    </form>
  )
}

function EditItem({ item, onDone }: { item: ShoppingItem; onDone: () => void }) {
  const { updateShopping, removeShopping } = useStore()
  const [name, setName] = useState(item.name)
  const [quantity, setQuantity] = useState(item.quantity)
  const [unit, setUnit] = useState(item.unit ?? '')

  function submit(e: FormEvent) {
    e.preventDefault()
    updateShopping(item.id, { name: name.trim(), quantity: quantity > 0 ? quantity : 1, unit: unit.trim() || null })
    onDone()
  }

  return (
    <form className="form" onSubmit={submit}>
      <Field label="Name">
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>
      <div className="field-row">
        <Field label="Quantity" group>
          <Stepper value={quantity} onChange={setQuantity} label={name} min={1} editable />
        </Field>
        <Field label="Unit">
          <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="kg, pack…" />
        </Field>
      </div>
      <div className="form-actions">
        <button
          type="button"
          className="btn btn-danger-ghost"
          onClick={() => {
            removeShopping(item.id)
            onDone()
          }}
        >
          <Trash2 size={18} /> Delete
        </button>
        <button type="submit" className="btn btn-primary">
          Save
        </button>
      </div>
    </form>
  )
}

type Preset = 'none' | '3' | '7' | '14' | '30' | 'custom'
const PRESETS: [Preset, string][] = [
  ['none', 'No expiry'],
  ['3', 'In 3 days'],
  ['7', 'In 1 week'],
  ['14', 'In 2 weeks'],
  ['30', 'In 1 month'],
  ['custom', 'Pick a date…'],
]
type Line = { price: string; preset: Preset; custom: string }
const BLANK_LINE: Line = { price: '', preset: 'none', custom: '' }

function Checkout({ items, onDone }: { items: ShoppingItem[]; onDone: () => void }) {
  const { purchases, checkout } = useStore()
  const stores = useMemo(() => recentStores(purchases).slice(0, 4), [purchases])
  const [store, setStore] = useState('')
  const [date, setDate] = useState(today())
  const [toPantry, setToPantry] = useState(true)
  const [lines, setLines] = useState<Record<string, Line>>({})

  const lineFor = (id: string) => lines[id] ?? BLANK_LINE
  const setLine = (id: string, changes: Partial<Line>) => setLines((l) => ({ ...l, [id]: { ...lineFor(id), ...changes } }))
  const total = items.reduce((sum, i) => sum + (Number(lineFor(i.id).price) || 0), 0)

  function submit(e: FormEvent) {
    e.preventDefault()
    checkout(
      items.map((item) => {
        const l = lineFor(item.id)
        const expiresOn = l.preset === 'none' ? null : l.preset === 'custom' ? l.custom || null : addDays(Number(l.preset))
        return { item, price: l.price === '' ? null : Number(l.price), expiresOn }
      }),
      { store: store.trim() || null, date, toPantry },
    )
    onDone()
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="field-row">
        <Field label="Store">
          <input value={store} onChange={(e) => setStore(e.target.value)} placeholder="Where did you shop?" />
        </Field>
        <Field label="Date">
          <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value || today())} required />
        </Field>
      </div>
      {stores.length > 0 && (
        <div className="chips">
          {stores.map((s) => (
            <button type="button" key={s} className={`chip${store === s ? ' chip-on' : ''}`} onClick={() => setStore(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      <ul className="co-lines">
        {items.map((item) => {
          const l = lineFor(item.id)
          const last = lastPrice(purchases, item.name)
          const qty = formatQty(item.quantity, item.unit)
          return (
            <li key={item.id} className="co-line">
              <div className="co-info">
                <span className="item-name">{item.name}</span>
                {qty && <span className="item-qty">{qty}</span>}
              </div>
              <label className="money">
                <span aria-hidden>$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={l.price}
                  onChange={(e) => setLine(item.id, { price: e.target.value })}
                  placeholder={last !== null ? last.toFixed(2) : '0.00'}
                  aria-label={`Price for ${item.name}`}
                />
              </label>
              {toPantry && (
                <div className="co-expiry">
                  <select value={l.preset} onChange={(e) => setLine(item.id, { preset: e.target.value as Preset })} aria-label={`When ${item.name} expires`}>
                    {PRESETS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  {l.preset === 'custom' && (
                    <input type="date" min={today()} value={l.custom} onChange={(e) => setLine(item.id, { custom: e.target.value })} aria-label={`Expiry date for ${item.name}`} />
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <label className="switch-row">
        <span>
          <strong>Add to pantry</strong>
          <small>Merges with anything you already have at home.</small>
        </span>
        <input type="checkbox" className="switch" checked={toPantry} onChange={(e) => setToPantry(e.target.checked)} />
      </label>

      <button type="submit" className="btn btn-primary btn-block btn-lg">
        Finish{total > 0 ? ` · ${formatMoney(total)}` : ''}
      </button>
      <p className="hint">Items without a price aren't counted in Spending. The faded number is what you paid last time.</p>
    </form>
  )
}
