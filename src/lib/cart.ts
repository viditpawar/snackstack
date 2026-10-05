import { useCallback, useEffect, useMemo, useState } from 'react'

// Which shopping-list items are "in the cart". Kept per device, since you shop with one phone.
const KEY = 'snackstack.cart'

function load(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]'))
  } catch {
    return new Set()
  }
}

export function useCart(items: { id: string }[]) {
  const [ids, setIds] = useState(load)
  const cart = useMemo(() => new Set(items.map((i) => i.id).filter((id) => ids.has(id))), [items, ids])

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify([...ids]))
    } catch {
      // Storage unavailable (private mode); the cart just won't survive a reload.
    }
  }, [ids])

  const toggle = useCallback((id: string) => {
    setIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  return { cart, toggle }
}
