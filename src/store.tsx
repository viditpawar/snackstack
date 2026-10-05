import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import type { PantryItem, Purchase, ShoppingItem, WasteEntry } from './types'
import { useToast } from './ui/Toast'
import { earliest, formatMoney, formatQty, round, today } from './lib/format'
import { isLow, lastPrice, restockQuantity, sameItem } from './lib/items'
import { guessCategory, guessLocation, knownCategories } from './lib/categories'

// All of the user's data lives here. Changes show up instantly (optimistic updates),
// are saved to Supabase in the background, and resync from the server if a save fails.

type Tables = { shopping_items: ShoppingItem; pantry_items: PantryItem; purchases: Purchase; waste_log: WasteEntry }
type TableName = keyof Tables
type Rows = { [K in TableName]: Tables[K][] }
type Op = PromiseLike<{ error: { message: string } | null }>

export type NewShopping = Pick<ShoppingItem, 'name' | 'quantity' | 'unit'> & Partial<Pick<ShoppingItem, 'note' | 'category'>>
export type NewPantry = Pick<PantryItem, 'name' | 'quantity' | 'unit' | 'category' | 'location' | 'min_quantity' | 'expires_on'>
export type NewPurchase = Pick<Purchase, 'name' | 'quantity' | 'unit' | 'price' | 'store' | 'category' | 'purchased_on'>
export type CheckoutLine = { item: ShoppingItem; price: number | null; expiresOn: string | null }

const TABLES: TableName[] = ['shopping_items', 'pantry_items', 'purchases', 'waste_log']
const EMPTY: Rows = { shopping_items: [], pantry_items: [], purchases: [], waste_log: [] }

function newRow<T extends object>(fields: T) {
  return { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...fields }
}

const num = (v: unknown) => Number(v)
const numOrNull = (v: unknown) => (v === null || v === undefined ? null : Number(v))

// Supabase returns at most 1000 rows per request, so page through.
async function fetchAll(table: TableName) {
  const PAGE = 1000
  const out: Record<string, unknown>[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select('*').order('created_at').range(from, from + PAGE - 1)
    if (error) throw error
    out.push(...data)
    if (data.length < PAGE) return out
  }
}

function useStoreValue() {
  const toast = useToast()
  const [rows, setRows] = useState<Rows>(EMPTY)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const rowsRef = useRef(rows)
  rowsRef.current = rows
  const pending = useRef(0)

  const refresh = useCallback(async () => {
    try {
      const [shopping, pantry, purchases, waste] = await Promise.all(TABLES.map(fetchAll))
      // Don't clobber optimistic changes that are still being saved.
      if (pending.current > 0) return
      setRows({
        shopping_items: shopping.map((r) => ({ ...r, quantity: num(r.quantity) }) as ShoppingItem),
        pantry_items: pantry.map((r) => ({ ...r, quantity: num(r.quantity), min_quantity: numOrNull(r.min_quantity) }) as PantryItem),
        purchases: purchases.map((r) => ({ ...r, quantity: num(r.quantity), price: num(r.price) }) as Purchase),
        waste_log: waste.map((r) => ({ ...r, quantity: num(r.quantity), cost: numOrNull(r.cost) }) as WasteEntry),
      })
      setStatus('ready')
      setLoadError(null)
    } catch (e) {
      setLoadError((e as { message?: string }).message ?? null)
      setStatus((s) => (s === 'ready' ? s : 'error'))
    }
  }, [])

  useEffect(() => {
    refresh()
    // Pick up changes made on another device when you come back to the app.
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refresh])

  const sync = useCallback(
    async (ops: Op[]) => {
      pending.current++
      let message: string | null = null
      try {
        const results = await Promise.all(ops)
        message = results.find((r) => r.error)?.error?.message ?? null
      } catch {
        message = 'no connection'
      }
      pending.current--
      if (message) {
        toast(`Couldn't save that change (${message}).`, { tone: 'error' })
        refresh()
      }
    },
    [toast, refresh],
  )

  return useMemo(() => {
    const patch = <K extends TableName>(table: K, fn: (list: Rows[K]) => Rows[K]) => setRows((r) => ({ ...r, [table]: fn(r[table]) }))

    const insert = <K extends TableName>(table: K, items: Rows[K]): Op => {
      patch(table, (list) => [...list, ...items] as Rows[K])
      return supabase.from(table).insert(items)
    }
    const update = <K extends TableName>(table: K, id: string, changes: Partial<Tables[K]>): Op => {
      patch(table, (list) => list.map((r) => (r.id === id ? { ...r, ...changes } : r)) as Rows[K])
      return supabase.from(table).update(changes as Record<string, unknown>).eq('id', id)
    }
    const remove = <K extends TableName>(table: K, ids: string[]): Op => {
      patch(table, (list) => list.filter((r) => !ids.includes(r.id)) as Rows[K])
      return supabase.from(table).delete().in('id', ids)
    }

    function removeWithUndo<K extends TableName>(table: K, id: string) {
      const row = rowsRef.current[table].find((r) => r.id === id)
      if (!row) return
      sync([remove(table, [id])])
      toast(`Removed ${row.name}`, { action: { label: 'Undo', onClick: () => sync([insert(table, [row] as Rows[K])]) } })
    }

    function categoryFor(name: string) {
      const r = rowsRef.current
      return guessCategory(name, knownCategories([...r.purchases, ...r.pantry_items, ...r.shopping_items]))
    }

    // Adds to the list, or bumps the quantity if the item is already on it. Returns a message for the toast.
    function upsertShopping(input: NewShopping): string {
      const existing = rowsRef.current.shopping_items.find((i) => sameItem(i, input))
      if (existing) {
        const quantity = round(existing.quantity + input.quantity)
        sync([update('shopping_items', existing.id, { quantity })])
        return `${existing.name} was already on your list, so now it's ${formatQty(quantity, existing.unit) || `×${quantity}`}`
      }
      const row = newRow({ note: null, ...input, category: input.category ?? categoryFor(input.name) })
      sync([insert('shopping_items', [row])])
      // Keep rowsRef current so several adds in a row see each other.
      rowsRef.current = { ...rowsRef.current, shopping_items: [...rowsRef.current.shopping_items, row] }
      return `Added ${input.name}`
    }

    function addShopping(input: NewShopping, quiet = false) {
      const message = upsertShopping(input)
      if (!quiet || message.includes('already')) toast(message)
    }

    function addShoppingMany(inputs: NewShopping[]) {
      if (inputs.length === 1) return addShopping(inputs[0], true)
      for (const input of inputs) upsertShopping(input)
      toast(`Added ${inputs.length} items to your list`)
    }

    function setPantryQuantity(item: PantryItem, quantity: number) {
      sync([update('pantry_items', item.id, { quantity })])
      const after = { ...item, quantity }
      if (!isLow(after) || isLow(item)) return
      const onList = rowsRef.current.shopping_items.some((s) => sameItem(s, item))
      const message = quantity === 0 ? `You're out of ${item.name}` : `Running low on ${item.name}`
      toast(
        message,
        onList ? {} : { action: { label: 'Add to list', onClick: () => addShopping({ name: item.name, quantity: restockQuantity(after), unit: item.unit, category: item.category }) } },
      )
    }

    // Logs what was thrown away (with its estimated cost) and empties the pantry item.
    function tossPantry(item: PantryItem) {
      if (item.quantity <= 0) return
      const r = rowsRef.current
      const price = lastPrice(r.purchases, item.name)
      const lastBought = r.purchases.filter((p) => sameItem(p, item)).sort((a, b) => b.purchased_on.localeCompare(a.purchased_on))[0]
      const cost = price === null ? null : round(price * Math.min(1, item.quantity / (lastBought?.quantity || item.quantity)))
      const entry = newRow({ name: item.name, quantity: item.quantity, unit: item.unit, cost, logged_on: today() })
      sync([insert('waste_log', [entry]), update('pantry_items', item.id, { quantity: 0 })])
      toast(`Logged ${item.name} as tossed${cost ? ` (${formatMoney(cost)})` : ''}`, {
        action: { label: 'Undo', onClick: () => sync([remove('waste_log', [entry.id]), update('pantry_items', item.id, { quantity: item.quantity })]) },
      })
    }

    // Turns the cart into purchases and pantry stock in one go, with a single undo.
    function checkout(lines: CheckoutLine[], opts: { store: string | null; date: string; toPantry: boolean }) {
      const current = rowsRef.current
      const purchases: Purchase[] = lines
        .filter((l) => l.price !== null)
        .map((l) =>
          newRow({
            name: l.item.name,
            quantity: l.item.quantity,
            unit: l.item.unit,
            price: l.price!,
            store: opts.store,
            category: l.item.category,
            purchased_on: opts.date,
          }),
        )

      const created: PantryItem[] = []
      const merged = new Map<string, { before: PantryItem; after: PantryItem }>()
      if (opts.toPantry) {
        for (const { item, expiresOn } of lines) {
          const fresh = created.find((p) => sameItem(p, item))
          const existing = current.pantry_items.find((p) => sameItem(p, item))
          if (fresh) {
            fresh.quantity = round(fresh.quantity + item.quantity)
            fresh.expires_on = earliest(fresh.expires_on, expiresOn)
          } else if (existing) {
            const entry = merged.get(existing.id) ?? { before: existing, after: { ...existing } }
            entry.after = {
              ...entry.after,
              quantity: round(entry.after.quantity + item.quantity),
              // Restocking an empty item starts its expiry over; otherwise keep the soonest date.
              expires_on: entry.after.quantity > 0 ? earliest(entry.after.expires_on, expiresOn) : expiresOn,
            }
            merged.set(existing.id, entry)
          } else {
            created.push(
              newRow({
                name: item.name,
                quantity: item.quantity,
                unit: item.unit,
                category: item.category,
                location: guessLocation(item.category),
                min_quantity: null,
                expires_on: expiresOn,
              }),
            )
          }
        }
      }

      const ops: Op[] = []
      if (purchases.length) ops.push(insert('purchases', purchases))
      if (created.length) ops.push(insert('pantry_items', created))
      for (const { after } of merged.values()) ops.push(update('pantry_items', after.id, { quantity: after.quantity, expires_on: after.expires_on }))
      ops.push(remove('shopping_items', lines.map((l) => l.item.id)))
      sync(ops)

      const total = purchases.reduce((sum, p) => sum + p.price, 0)
      toast(`Checked out ${lines.length} item${lines.length === 1 ? '' : 's'}${total ? ` · ${formatMoney(total)}` : ''}`, {
        action: {
          label: 'Undo',
          onClick: () => {
            const undo: Op[] = []
            if (purchases.length) undo.push(remove('purchases', purchases.map((p) => p.id)))
            if (created.length) undo.push(remove('pantry_items', created.map((p) => p.id)))
            for (const { before } of merged.values()) undo.push(update('pantry_items', before.id, { quantity: before.quantity, expires_on: before.expires_on }))
            undo.push(insert('shopping_items', lines.map((l) => l.item)))
            sync(undo)
          },
        },
      })
    }

    return {
      status,
      loadError,
      refresh,
      shopping: rows.shopping_items,
      pantry: rows.pantry_items,
      purchases: rows.purchases,
      waste: rows.waste_log,
      categoryFor,

      addShopping,
      addShoppingMany,
      updateShopping: (id: string, changes: Partial<ShoppingItem>) => sync([update('shopping_items', id, changes)]),
      removeShopping: (id: string) => removeWithUndo('shopping_items', id),
      checkout,

      addPantry: (input: NewPantry) => sync([insert('pantry_items', [newRow(input)])]),
      updatePantry: (id: string, changes: Partial<PantryItem>) => sync([update('pantry_items', id, changes)]),
      removePantry: (id: string) => removeWithUndo('pantry_items', id),
      setPantryQuantity,
      tossPantry,

      addPurchase: (input: NewPurchase) => sync([insert('purchases', [newRow(input)])]),
      updatePurchase: (id: string, changes: Partial<Purchase>) => sync([update('purchases', id, changes)]),
      removePurchase: (id: string) => removeWithUndo('purchases', id),

      removeWaste: (id: string) => removeWithUndo('waste_log', id),
    }
  }, [rows, status, loadError, refresh, sync, toast])
}

type Store = ReturnType<typeof useStoreValue>

const StoreContext = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  return <StoreContext.Provider value={useStoreValue()}>{children}</StoreContext.Provider>
}

export function useStore(): Store {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore must be used inside <StoreProvider>')
  return store
}
