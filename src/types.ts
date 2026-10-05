export type ShoppingItem = {
  id: string
  name: string
  quantity: number
  unit: string | null
  created_at: string
}

export type PantryItem = {
  id: string
  name: string
  quantity: number
  unit: string | null
  category: string | null
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
  purchased_on: string
  created_at: string
}
