import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type FormEvent } from 'react'
import { Check, LayoutList, ListChecks, Mic, Plus, Share2, ShoppingBasket, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import { useCart } from '../lib/cart'
import { buildHistory, isLow, lastPrice, normalizeName, parseQuickAdd, recentStores, restockQuantity, splitItems, type HistoryEntry } from '../lib/items'
import { CATEGORIES, aisleIndex, categoryStyle } from '../lib/categories'
import { addDays, currencySymbol, formatMoney, formatQty, today } from '../lib/format'
import { canListen, listen, shareText } from '../lib/device'
import type { ShoppingItem } from '../types'
import { Sheet } from '../ui/Sheet'
import { Stepper } from '../ui/Stepper'
import { useToast } from '../ui/Toast'
import { Empty, Field, ItemIcon, PageHead } from '../ui/bits'

const GROUP_KEY = 'snackstack.groupByAisle'

function loadGrouped(): boolean {
  try {
    return localStorage.getItem(GROUP_KEY) === '1'
  } catch {
    return false
  }
}

export default function ShoppingScreen() {
  const { shopping } = useStore()
  const toast = useToast()
  const { cart, toggle } = useCart(shopping)
  const [editing, setEditing] = useState<ShoppingItem | null>(null)
  const [checkingOut, setCheckingOut] = useState(false)
  const [grouped, setGrouped] = useState(loadGrouped)

  useEffect(() => {
    try {
      localStorage.setItem(GROUP_KEY, grouped ? '1' : '0')
    } catch {
      // Preference just won't stick.
    }
  }, [grouped])

  const sorted = useMemo(() => [...shopping].sort((a, b) => a.created_at.localeCompare(b.created_at)), [shopping])
  const toBuy = sorted.filter((i) => !cart.has(i.id))
  const inCart = sorted.filter((i) => cart.has(i.id))

  const aisles = useMemo(() => {
    const map = new Map<string, ShoppingItem[]>()
    for (const item of [...toBuy].sort((a, b) => aisleIndex(a.category) - aisleIndex(b.category))) {
      const key = item.category ?? 'Other'
      map.set(key, [...(map.get(key) ?? []), item])
    }
    return [...map.entries()]
  }, [toBuy])

  async function share() {
    const lines = toBuy.map((i) => {
      const qty = formatQty(i.quantity, i.unit)
      return `• ${i.name}${qty ? ` (${qty})` : ''}${i.note ? ` - ${i.note}` : ''}`
    })
    const result = await shareText('Shopping list', `Shopping list\n${lines.join('\n')}`)
    if (result === 'copied') toast('List copied. Paste it anywhere.')
    if (result === 'failed') toast("Couldn't share the list", { tone: 'error' })
  }

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
        <ItemIcon category={item.category} />
        <button className="item-main" onClick={() => setEditing(item)}>
          <span className="item-name">{item.name}</span>
          {qty && <span className="item-qty">{qty}</span>}
          {item.note && <span className="item-note">{item.note}</span>}
        </button>
      </li>
    )
  }

  const subtitle =
    shopping.length === 0 ? 'Nothing to buy right now' : inCart.length ? `${inCart.length} of ${shopping.length} in your cart` : `${shopping.length} item${shopping.length === 1 ? '' : 's'} to buy`

  return (
    <>
      <PageHead
        title="Shopping list"
        subtitle={subtitle}
        action={
          shopping.length > 0 && (
            <div className="head-actions">
              <button className={`icon-btn${grouped ? ' icon-btn-on' : ''}`} onClick={() => setGrouped(!grouped)} aria-pressed={grouped} aria-label="Group by aisle" title="Group by aisle">
                <LayoutList size={20} />
              </button>
              {toBuy.length > 0 && (
                <button className="icon-btn" onClick={share} aria-label="Share list" title="Share list">
                  <Share2 size={20} />
                </button>
              )}
            </div>
          )
        }
      />
      <QuickAdd />

      {shopping.length === 0 ? (
        <Empty icon={<ShoppingBasket size={28} />} title="Your list is empty">
          Type what you need above. Try <em>“2 kg rice”</em>, or add several at once: <em>“milk, eggs, bread”</em>.
        </Empty>
      ) : (
        <>
          {toBuy.length === 0 ? (
            <p className="all-done">
              <ListChecks size={18} /> Everything's in the cart. Check out when you're done.
            </p>
          ) : grouped ? (
            aisles.map(([aisle, items]) => (
              <section key={aisle}>
                <h2 className="section-title">
                  {categoryStyle(items[0].category).emoji} {aisle} <span>{items.length}</span>
                </h2>
                <ul className="items">{items.map(row)}</ul>
              </section>
            ))
          ) : (
            <ul className="items">{toBuy.map(row)}</ul>
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
  const { shopping, pantry, purchases, addShopping, addShoppingMany } = useStore()
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const stopListening = useRef<(() => void) | null>(null)

  useEffect(() => () => stopListening.current?.(), [])

  const parts = splitItems(text)
  const many = parts.length > 1
  const parsed = many ? null : parseQuickAdd(text)
  const history = useMemo(() => buildHistory(pantry, purchases), [pantry, purchases])
  const onList = useMemo(() => new Set(shopping.map((s) => normalizeName(s.name))), [shopping])
  const stocked = useMemo(() => new Set(pantry.filter((p) => !isLow(p)).map((p) => normalizeName(p.name))), [pantry])

  const query = parsed ? normalizeName(parsed.name) : ''
  const matches = query
    ? history
        .filter((h) => {
          const key = normalizeName(h.name)
          return key.includes(query) && key !== query && !onList.has(key)
        })
        .slice(0, 5)
    : []
  const runningLow = pantry.filter((p) => isLow(p) && !onList.has(normalizeName(p.name)) && !stocked.has(normalizeName(p.name))).slice(0, 6)
  const lowNames = new Set(runningLow.map((p) => normalizeName(p.name)))
  const buyAgain = history
    .filter((h) => {
      const key = normalizeName(h.name)
      return !onList.has(key) && !stocked.has(key) && !lowNames.has(key)
    })
    .slice(0, 6)

  function addText(value: string, spoken = false) {
    const items = splitItems(value, spoken)
      .map((s) => parseQuickAdd(s))
      .filter((p) => p !== null)
    if (items.length === 0) return
    navigator.vibrate?.(8)
    addShoppingMany(items)
    setText('')
    inputRef.current?.focus()
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    addText(text)
  }

  // Pasting a multi-line list adds every line at once.
  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData('text')
    if (/\n/.test(pasted.trim())) {
      e.preventDefault()
      addText(pasted)
    }
  }

  function toggleVoice() {
    if (listening) return stopListening.current?.()
    setListening(true)
    stopListening.current = listen(
      (spoken) => addText(spoken, true),
      () => {
        setListening(false)
        stopListening.current = null
      },
    )
  }

  const pick = (h: HistoryEntry) => addShopping({ name: h.name, quantity: parsed?.quantity ?? 1, unit: parsed?.unit ?? h.unit }, true)

  return (
    <form className="quick-add" onSubmit={submit}>
      <div className="quick-add-field">
        <Plus size={20} className="quick-add-icon" aria-hidden />
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={onPaste}
          placeholder={listening ? 'Listening…' : 'Add items, e.g. 2 kg rice, milk'}
          aria-label="Add items to your list"
          autoComplete="off"
          enterKeyHint="done"
          data-shortcut="focus"
        />
        <div className="quick-add-tools">
          {text.trim() ? (
            <button type="submit" className="btn btn-primary btn-sm">
              Add{many ? ` ${parts.length}` : ''}
            </button>
          ) : (
            canListen && (
                <button
                  type="button"
                  className={`icon-btn${listening ? ' icon-btn-live' : ''}`}
                  onClick={toggleVoice}
                  aria-pressed={listening}
                  aria-label={listening ? 'Stop listening' : 'Add by voice'}
                  title="Add by voice"
                >
                  <Mic size={20} />
                </button>
            )
          )}
        </div>
      </div>
      {many && <p className="quick-preview">Adds {parts.length} items: {parts.join(', ')}</p>}
      {parsed && (parsed.quantity !== 1 || parsed.unit) && (
        <p className="quick-preview">
          Adds <strong>{parsed.name}</strong> · {formatQty(parsed.quantity, parsed.unit)}
        </p>
      )}
      {listening && <p className="quick-preview">Say something like “milk, eggs and two loaves of bread”.</p>}
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
      {!text && runningLow.length > 0 && (
        <div className="chips">
          <span className="chips-label">Running low</span>
          {runningLow.map((p) => (
            <button
              type="button"
              key={p.id}
              className="chip chip-warn"
              onClick={() => addShopping({ name: p.name, quantity: restockQuantity(p), unit: p.unit, category: p.category }, true)}
            >
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
  const [note, setNote] = useState(item.note ?? '')
  const [category, setCategory] = useState(item.category)

  function submit(e: FormEvent) {
    e.preventDefault()
    updateShopping(item.id, {
      name: name.trim(),
      quantity: quantity > 0 ? quantity : 1,
      unit: unit.trim() || null,
      note: note.trim() || null,
      category,
    })
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
      <Field label="Note">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. the organic one, ripe ones" />
      </Field>
      <Field label="Aisle" group>
        <div className="chips">
          {CATEGORIES.map((c) => (
            <button type="button" key={c} className={`chip${category === c ? ' chip-on' : ''}`} onClick={() => setCategory(category === c ? null : c)}>
              {categoryStyle(c).emoji} {c}
            </button>
          ))}
        </div>
      </Field>
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
  const symbol = currencySymbol()

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
                <span aria-hidden>{symbol}</span>
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
