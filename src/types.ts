export type ShoppingItem = {
  id: string
  name: string
  quantity: number
  unit: string | null
  note: string | null
  category: string | null
  created_at: string
}

export type PantryItem = {
  id: string
  name: string
  quantity: number
  unit: string | null
  category: string | null
  location: string | null
  min_quantity: number | null
  expires_on: string | null
  created_at: string
}

export type Purchase = {
  id: string
  name: string
  quantity: number
  unit: string | null
  price: number
  store: string | null
  category: string | null
  purchased_on: string
  created_at: string
}

export type WasteEntry = {
  id: string
  name: string
  quantity: number
  unit: string | null
  cost: number | null
  logged_on: string
  created_at: string
}
