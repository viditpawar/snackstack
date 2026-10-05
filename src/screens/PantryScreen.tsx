import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ListPlus, Plus, Refrigerator, Search, Trash, Trash2, X } from 'lucide-react'
import { useStore } from '../store'
import { SOON_DAYS, addDays, daysUntil, expiryInfo, formatDate } from '../lib/format'
import { isLow, normalizeName, restockQuantity, sameItem } from '../lib/items'
import { CATEGORIES, LOCATIONS, guessCategory, guessLocation } from '../lib/categories'
import type { PantryItem } from '../types'
import { Sheet } from '../ui/Sheet'
import { Stepper } from '../ui/Stepper'
import { PriceHistory } from '../ui/PriceHistory'
import { Empty, ExpiryPill, Field, PageHead } from '../ui/bits'

export type PantryFilter = 'all' | 'soon' | 'low'

const UNCATEGORIZED = 'Other'

export const isUseSoon = (p: PantryItem) => p.quantity > 0 && p.expires_on !== null && daysUntil(p.expires_on) <= SOON_DAYS

function byExpiry(a: PantryItem, b: PantryItem) {
  if (a.expires_on && b.expires_on && a.expires_on !== b.expires_on) return a.expires_on.localeCompare(b.expires_on)
  if (a.expires_on && !b.expires_on) return -1
  if (!a.expires_on && b.expires_on) return 1
  return a.name.localeCompare(b.name)
}

export default function PantryScreen({ initialFilter }: { initialFilter: PantryFilter }) {
  const { pantry, shopping, setPantryQuantity, addShoppingMany } = useStore()
  const [filter, setFilter] = useState<PantryFilter>(initialFilter)
  const [place, setPlace] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<PantryItem | 'new' | null>(null)

  useEffect(() => {
    setFilter(initialFilter)
  }, [initialFilter])

  const counts = {
    all: pantry.length,
    soon: pantry.filter(isUseSoon).length,
    low: pantry.filter(isLow).length,
  }
  const places = LOCATIONS.filter((l) => pantry.some((p) => p.location === l))

  const lowNotOnList = pantry.filter((p) => isLow(p) && !shopping.some((s) => sameItem(s, p)))

  const groups = useMemo(() => {
    const q = normalizeName(query)
    const visible = pantry
      .filter((p) => (filter === 'soon' ? isUseSoon(p) : filter === 'low' ? isLow(p) : true))
      .filter((p) => !place || p.location === place)
      .filter((p) => !q || normalizeName(p.name).includes(q) || normalizeName(p.category ?? '').includes(q))
    const map = new Map<string, PantryItem[]>()
    for (const p of visible) {
      const key = p.category?.trim() || UNCATEGORIZED
      map.set(key, [...(map.get(key) ?? []), p])
    }
    return [...map.entries()]
      .sort(([a], [b]) => (a === UNCATEGORIZED ? 1 : b === UNCATEGORIZED ? -1 : a.localeCompare(b)))
      .map(([name, items]) => ({ name, items: items.sort(byExpiry) }))
  }, [pantry, filter, place, query])

  const subtitle =
    pantry.length === 0
      ? 'What you have at home'
      : `${pantry.length} item${pantry.length === 1 ? '' : 's'}${counts.soon ? ` · ${counts.soon} to use soon` : ''}${counts.low ? ` · ${counts.low} running low` : ''}`

  const filters: [PantryFilter, string][] = [
    ['all', 'All'],
    ['soon', 'Use soon'],
    ['low', 'Running low'],
  ]

  return (
    <>
      <PageHead title="Pantry" subtitle={subtitle} />

      {pantry.length === 0 ? (
        <Empty icon={<Refrigerator size={28} />} title="Your pantry is empty">
          Check out from your shopping list and items land here automatically, or add things you already have with the + button.
        </Empty>
      ) : (
        <>
          <div className="toolbar">
            <label className="search">
              <Search size={18} aria-hidden />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search pantry" aria-label="Search pantry" data-shortcut="focus" />
              {query && (
                <button type="button" className="icon-btn" onClick={() => setQuery('')} aria-label="Clear search">
                  <X size={16} />
                </button>
              )}
            </label>
            <div className="chips" role="tablist" aria-label="Filter">
              {filters.map(([id, label]) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={filter === id}
                  className={`chip${filter === id ? ' chip-on' : ''}${id !== 'all' && counts[id] ? ' chip-attn' : ''}`}
                  onClick={() => setFilter(id)}
                >
                  {label}
                  <span className="chip-count">{counts[id]}</span>
                </button>
              ))}
            </div>
            {places.length > 0 && (
              <div className="chips" aria-label="Where">
                <span className="chips-label">Where</span>
                {places.map((l) => (
                  <button key={l} className={`chip${place === l ? ' chip-on' : ''}`} onClick={() => setPlace(place === l ? null : l)} aria-pressed={place === l}>
                    {l}
                  </button>
                ))}
              </div>
            )}
          </div>

          {filter === 'low' && lowNotOnList.length > 1 && (
            <button
              className="btn btn-ghost btn-block restock-all"
              onClick={() => addShoppingMany(lowNotOnList.map((p) => ({ name: p.name, quantity: restockQuantity(p), unit: p.unit, category: p.category })))}
            >
              <ListPlus size={18} /> Add all {lowNotOnList.length} to your list
            </button>
          )}

          {groups.length === 0 && (
            <p className="muted center pad">
              {query ? `Nothing matches “${query}”.` : filter === 'soon' ? 'Nothing is about to expire. Nice.' : filter === 'low' ? 'You’re well stocked.' : 'Nothing here.'}
            </p>
          )}

          {groups.map((g) => (
            <section key={g.name}>
              <h2 className="section-title">
                {g.name} <span>{g.items.length}</span>
              </h2>
              <ul className="items">
                {g.items.map((item) => {
                  const tone = item.quantity === 0 ? 'out' : item.expires_on ? expiryInfo(item.expires_on).tone : 'none'
                  const low = item.quantity > 0 && isLow(item)
                  return (
                    <li key={item.id} className={`item item-tone-${tone}`}>
                      <button className="item-main" onClick={() => setEditing(item)}>
                        <span className="item-name">{item.name}</span>
                        <span className="item-sub">
                          {item.quantity === 0 ? <span className="pill pill-out">Ran out</span> : <ExpiryPill date={item.expires_on} />}
                          {low && <span className="pill pill-soon">Low · keep {item.min_quantity}</span>}
                          {item.location && <span className="item-place">{item.location}</span>}
                        </span>
                      </button>
                      <Stepper value={item.quantity} unit={item.unit} label={item.name} onChange={(q) => setPantryQuantity(item, q)} />
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </>
      )}

      <button className="fab" onClick={() => setEditing('new')} aria-label="Add to pantry" data-shortcut="new">
        <Plus size={24} />
      </button>

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add to pantry' : 'Edit item'}>
        {editing && <PantryForm item={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />}
      </Sheet>
    </>
  )
}

const EXPIRY_PRESETS: [string, number][] = [
  ['3 days', 3],
  ['1 week', 7],
  ['2 weeks', 14],
  ['1 month', 30],
]

function PantryForm({ item, onDone }: { item: PantryItem | null; onDone: () => void }) {
  const { shopping, addPantry, updatePantry, removePantry, addShopping, tossPantry, categoryFor } = useStore()
  const [name, setName] = useState(item?.name ?? '')
  const [quantity, setQuantity] = useState(item?.quantity ?? 1)
  const [unit, setUnit] = useState(item?.unit ?? '')
  const [category, setCategory] = useState<string | null>(item?.category ?? null)
  const [location, setLocation] = useState<string | null>(item?.location ?? null)
  const [minQuantity, setMinQuantity] = useState(item?.min_quantity ?? NaN)
  const [expiresOn, setExpiresOn] = useState(item?.expires_on ?? '')
  const [touched, setTouched] = useState({ category: !!item, location: !!item })

  // For new items, guess the aisle and storage spot from the name until you pick one yourself.
  function onName(value: string) {
    setName(value)
    if (item) return
    const guess = categoryFor(value) ?? guessCategory(value)
    if (!touched.category) setCategory(guess)
    if (!touched.location) setLocation(guessLocation(guess))
  }

  const onList = item ? shopping.some((s) => sameItem(s, item)) : false

  function submit(e: FormEvent) {
    e.preventDefault()
    const data = {
      name: name.trim(),
      quantity: Number.isFinite(quantity) && quantity >= 0 ? quantity : 1,
      unit: unit.trim() || null,
      category,
      location,
      min_quantity: Number.isFinite(minQuantity) && minQuantity > 0 ? minQuantity : null,
      expires_on: expiresOn || null,
    }
    if (item) updatePantry(item.id, data)
    else addPantry(data)
    onDone()
  }

  return (
    <form className="form" onSubmit={submit}>
      <Field label="Name">
        <input value={name} onChange={(e) => onName(e.target.value)} required placeholder="e.g. Greek yogurt" data-autofocus={item ? undefined : true} />
      </Field>
      <div className="field-row">
        <Field label="Quantity" group>
          <Stepper value={quantity} onChange={setQuantity} label={name || 'item'} editable />
        </Field>
        <Field label="Unit">
          <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="kg, pack…" />
        </Field>
      </div>

      <Field label="Expires" group>
        <input type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} aria-label="Expiry date" />
        <div className="chips">
          {EXPIRY_PRESETS.map(([label, days]) => {
            const date = addDays(days)
            return (
              <button type="button" key={label} className={`chip${expiresOn === date ? ' chip-on' : ''}`} onClick={() => setExpiresOn(date)}>
                {label}
              </button>
            )
          })}
          {expiresOn && (
            <button type="button" className="chip" onClick={() => setExpiresOn('')}>
              <X size={14} /> No expiry
            </button>
          )}
        </div>
        {expiresOn && <span className="field-note">{formatDate(expiresOn)}</span>}
      </Field>

      <Field label="Kept in" group>
        <div className="segmented">
          {LOCATIONS.map((l) => (
            <button
              type="button"
              key={l}
              role="radio"
              aria-checked={location === l}
              onClick={() => {
                setLocation(location === l ? null : l)
                setTouched((t) => ({ ...t, location: true }))
              }}
            >
              {l}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Category" group>
        <div className="chips">
          {CATEGORIES.map((c) => (
            <button
              type="button"
              key={c}
              className={`chip${category === c ? ' chip-on' : ''}`}
              onClick={() => {
                setCategory(category === c ? null : c)
                setTouched((t) => ({ ...t, category: true }))
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Keep at least" group>
        <div className="row-between">
          <Stepper value={Number.isFinite(minQuantity) ? minQuantity : 0} onChange={(v) => setMinQuantity(v)} label="minimum" editable />
          <span className="field-note">{Number.isFinite(minQuantity) && minQuantity > 0 ? `Warns you below ${minQuantity}` : 'Off. Set it for staples you never want to run out of.'}</span>
        </div>
      </Field>

      <div className="form-actions">
        {item && (
          <button
            type="button"
            className="btn btn-danger-ghost"
            onClick={() => {
              removePantry(item.id)
              onDone()
            }}
          >
            <Trash2 size={18} /> Delete
          </button>
        )}
        {item && item.quantity > 0 && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              tossPantry(item)
              onDone()
            }}
          >
            <Trash size={18} /> Tossed it
          </button>
        )}
        {item && !onList && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              addShopping({ name: item.name, quantity: restockQuantity(item), unit: item.unit, category: item.category })
              onDone()
            }}
          >
            <ListPlus size={18} /> Add to list
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
