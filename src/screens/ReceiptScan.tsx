import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { AlertTriangle, Camera, CircleCheck, Plus, RotateCcw, X } from 'lucide-react'
import { useStore, type NewPantry, type NewPurchase } from '../store'
import { readReceipt, type ReadProgress } from '../lib/receipt'
import { parseReceipt } from '../lib/receiptParse'
import { recentStores } from '../lib/items'
import { guessLocation } from '../lib/categories'
import { currencySymbol, formatMoney, round, today } from '../lib/format'
import { Field } from '../ui/bits'

type Row = { key: number; name: string; price: string; include: boolean }

let nextKey = 0
const toRow = (name: string, price: number | null): Row => ({ key: nextKey++, name, price: price === null ? '' : price.toFixed(2), include: true })

// Photo of a receipt -> on-device text recognition -> editable list of purchases -> saved to Spending.
export default function ReceiptScan({ onDone }: { onDone: () => void }) {
  const { purchases } = useStore()
  const [photo, setPhoto] = useState<string | null>(null)
  const [progress, setProgress] = useState<ReadProgress | null>(null)
  const [result, setResult] = useState<ReturnType<typeof parseReceipt> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => () => void (photo && URL.revokeObjectURL(photo)), [photo])

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPhoto(URL.createObjectURL(file))
    setResult(null)
    setError(null)
    try {
      const text = await readReceipt(file, setProgress)
      setResult(parseReceipt(text, recentStores(purchases), today()))
    } catch {
      setError("Couldn't read that photo. Check your connection (the text reader downloads the first time) and try again.")
    }
    setProgress(null)
  }

  const picker = <input ref={inputRef} type="file" accept="image/*" onChange={onFile} hidden />

  if (result) {
    return (
      <>
        {picker}
        <ReviewForm parsed={result} photo={photo} onRetake={() => inputRef.current?.click()} onDone={onDone} />
      </>
    )
  }

  return (
    <div className="receipt">
      {picker}
      {progress ? (
        <div className="receipt-reading">
          {photo && <img src={photo} alt="Your receipt" className="receipt-photo receipt-photo-scanning" />}
          <div className="budget-track">
            <div className="budget-fill" style={{ width: `${Math.round(progress.progress * 100)}%` }} />
          </div>
          <p className="muted center">{progress.label}</p>
        </div>
      ) : (
        <>
          <button type="button" className="receipt-drop" onClick={() => inputRef.current?.click()}>
            <Camera size={32} />
            <strong>Take or choose a photo</strong>
            <span>of your grocery receipt</span>
          </button>
          {error && <p className="alert alert-error">{error}</p>}
          <ul className="receipt-tips">
            <li>Lay the receipt flat in good light.</li>
            <li>Fit the whole receipt in the frame, top to bottom.</li>
            <li>Everything is read on your phone. The photo isn't uploaded or saved.</li>
          </ul>
        </>
      )}
    </div>
  )
}

function ReviewForm({ parsed, photo, onRetake, onDone }: { parsed: ReturnType<typeof parseReceipt>; photo: string | null; onRetake: () => void; onDone: () => void }) {
  const { purchases, addReceipt, categoryFor } = useStore()
  const stores = useMemo(() => recentStores(purchases).slice(0, 4), [purchases])
  const [store, setStore] = useState(parsed.store ?? '')
  const [date, setDate] = useState(parsed.date ?? today())
  const [mode, setMode] = useState<'items' | 'total'>(parsed.items.length ? 'items' : 'total')
  const [rows, setRows] = useState<Row[]>(() => (parsed.items.length ? parsed.items.map((i) => toRow(i.name, i.price)) : [toRow('', null)]))
  const [tax, setTax] = useState(parsed.tax ? parsed.tax.toFixed(2) : '')
  const [totalName, setTotalName] = useState('Groceries')
  const [totalAmount, setTotalAmount] = useState(parsed.total?.toFixed(2) ?? '')
  const [toPantry, setToPantry] = useState(false)
  const symbol = currencySymbol()

  const included = rows.filter((r) => r.include && r.name.trim() && Number(r.price) > 0)
  const itemsSum = round(included.reduce((s, r) => s + Number(r.price), 0))
  const taxValue = Number(tax) > 0 ? Number(tax) : 0
  const grandTotal = mode === 'items' ? round(itemsSum + taxValue) : Number(totalAmount) || 0
  const mismatch = mode === 'items' && parsed.total !== null && Math.abs(grandTotal - parsed.total) > 0.05

  const setRow = (key: number, changes: Partial<Row>) => setRows((list) => list.map((r) => (r.key === key ? { ...r, ...changes } : r)))

  function submit(e: FormEvent) {
    e.preventDefault()
    const storeName = store.trim() || null
    const base = { store: storeName, purchased_on: date, quantity: 1, unit: null }
    let entries: NewPurchase[]
    let stock: NewPantry[] = []
    if (mode === 'total') {
      entries = [{ ...base, name: totalName.trim() || 'Groceries', price: Number(totalAmount), category: null }]
    } else {
      entries = included.map((r) => ({ ...base, name: r.name.trim(), price: Number(r.price), category: categoryFor(r.name) }))
      if (taxValue > 0) entries.push({ ...base, name: 'Tax', price: taxValue, category: null })
      if (toPantry) {
        stock = included.map((r) => {
          const category = categoryFor(r.name)
          return { name: r.name.trim(), quantity: 1, unit: null, category, location: guessLocation(category), min_quantity: null, expires_on: null }
        })
      }
    }
    if (entries.length === 0 || grandTotal <= 0) return
    addReceipt(entries, stock)
    onDone()
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="receipt-head">
        {photo && (
          <a href={photo} target="_blank" rel="noreferrer" className="receipt-thumb" aria-label="Open the photo">
            <img src={photo} alt="" />
          </a>
        )}
        <div className="receipt-summary">
          {parsed.items.length || parsed.total ? (
            <p>
              <CircleCheck size={16} /> Found {parsed.items.length} item{parsed.items.length === 1 ? '' : 's'}
              {parsed.total !== null && <> · total {formatMoney(parsed.total)}</>}
            </p>
          ) : (
            <p className="text-warn">
              <AlertTriangle size={16} /> Couldn't read much from this photo. Fill it in below or try another photo.
            </p>
          )}
          <button type="button" className="link-btn" onClick={onRetake}>
            <RotateCcw size={14} /> Use a different photo
          </button>
        </div>
      </div>

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

      <div className="segmented" role="radiogroup" aria-label="How to save">
        <button type="button" role="radio" aria-checked={mode === 'items'} onClick={() => setMode('items')}>
          Item by item
        </button>
        <button type="button" role="radio" aria-checked={mode === 'total'} onClick={() => setMode('total')}>
          Just the total
        </button>
      </div>

      {mode === 'items' ? (
        <>
          <ul className="receipt-rows">
            {rows.map((r) => (
              <li key={r.key} className={r.include ? '' : 'receipt-row-off'}>
                <input type="checkbox" checked={r.include} onChange={(e) => setRow(r.key, { include: e.target.checked })} aria-label={`Include ${r.name || 'this line'}`} />
                <input className="receipt-name" value={r.name} onChange={(e) => setRow(r.key, { name: e.target.value })} placeholder="Item" aria-label="Item name" />
                <span className="money">
                  <span aria-hidden>{symbol}</span>
                  <input type="number" inputMode="decimal" min="0" step="0.01" value={r.price} onChange={(e) => setRow(r.key, { price: e.target.value })} placeholder="0.00" aria-label={`Price for ${r.name || 'item'}`} />
                </span>
                <button type="button" className="icon-btn icon-btn-sm" onClick={() => setRows((list) => list.filter((x) => x.key !== r.key))} aria-label={`Remove ${r.name || 'line'}`}>
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn-ghost btn-sm add-line" onClick={() => setRows((list) => [...list, toRow('', null)])}>
            <Plus size={16} /> Add a line
          </button>

          <div className="field-row">
            <Field label="Tax">
              <span className="money">
                <span aria-hidden>{symbol}</span>
                <input type="number" inputMode="decimal" min="0" step="0.01" value={tax} onChange={(e) => setTax(e.target.value)} placeholder="0.00" />
              </span>
            </Field>
            <div className="receipt-total">
              <small>Total</small>
              <strong>{formatMoney(grandTotal)}</strong>
            </div>
          </div>

          {mismatch && (
            <p className="alert alert-warn">
              <AlertTriangle size={16} /> That's {formatMoney(Math.abs(grandTotal - parsed.total!))} {grandTotal > parsed.total! ? 'more' : 'less'} than the receipt's total of{' '}
              {formatMoney(parsed.total!)}. A price may have been misread. Check the photo, or switch to “Just the total”.
            </p>
          )}

          <label className="switch-row">
            <span>
              <strong>Also add to pantry</strong>
              <small>Puts these items in your pantry too. Receipt names can be cryptic, so you may want to rename them.</small>
            </span>
            <input type="checkbox" className="switch" checked={toPantry} onChange={(e) => setToPantry(e.target.checked)} />
          </label>
        </>
      ) : (
        <div className="field-row">
          <Field label="Name">
            <input value={totalName} onChange={(e) => setTotalName(e.target.value)} />
          </Field>
          <Field label="Total paid">
            <span className="money">
              <span aria-hidden>{symbol}</span>
              <input type="number" inputMode="decimal" min="0" step="0.01" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} required placeholder="0.00" />
            </span>
          </Field>
        </div>
      )}

      <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={grandTotal <= 0}>
        Save to spending · {formatMoney(grandTotal)}
      </button>
    </form>
  )
}
