// Aisles, in the order you'd usually walk a store.
export const CATEGORIES = [
  'Produce',
  'Bakery',
  'Dairy & eggs',
  'Meat & fish',
  'Frozen',
  'Pantry',
  'Snacks',
  'Drinks',
  'Household',
  'Personal care',
]

export const LOCATIONS = ['Fridge', 'Freezer', 'Cupboard']

const KEYWORDS: Record<string, string[]> = {
  Produce: [
    'apple', 'banana', 'orange', 'lemon', 'lime', 'grape', 'berr', 'strawberr', 'blueberr', 'raspberr', 'avocado', 'tomato',
    'potato', 'onion', 'garlic', 'ginger', 'carrot', 'lettuce', 'spinach', 'kale', 'cucumber', 'pepper', 'capsicum', 'broccoli',
    'cauliflower', 'zucchini', 'mushroom', 'celery', 'cabbage', 'cilantro', 'coriander', 'parsley', 'basil', 'mint', 'mango',
    'pear', 'peach', 'plum', 'melon', 'watermelon', 'pineapple', 'kiwi', 'salad', 'corn', 'chili', 'chilli', 'okra', 'eggplant',
    'brinjal', 'fruit', 'veg', 'herbs', 'scallion', 'leek', 'squash', 'pumpkin', 'beet', 'radish', 'cherr', 'papaya', 'guava',
  ],
  Bakery: ['bread', 'bagel', 'bun', 'croissant', 'muffin', 'tortilla', 'pita', 'naan', 'cake', 'donut', 'doughnut', 'baguette', 'loaf', 'roti', 'wrap'],
  'Dairy & eggs': ['milk', 'cheese', 'yogurt', 'yoghurt', 'butter', 'cream', 'egg', 'paneer', 'curd', 'ghee', 'kefir', 'margarine', 'feta', 'mozzarella', 'cheddar', 'parmesan'],
  'Meat & fish': ['chicken', 'beef', 'pork', 'lamb', 'mutton', 'turkey', 'bacon', 'ham', 'sausage', 'salami', 'fish', 'salmon', 'tuna', 'shrimp', 'prawn', 'steak', 'mince', 'meat', 'tofu'],
  Frozen: ['frozen', 'ice cream', 'pizza', 'fries', 'popsicle'],
  Pantry: [
    'rice', 'pasta', 'spaghetti', 'noodle', 'flour', 'sugar', 'salt', 'oil', 'vinegar', 'sauce', 'ketchup', 'mayo', 'mustard',
    'spice', 'cereal', 'oat', 'lentil', 'dal', 'bean', 'chickpea', 'soup', 'honey', 'jam', 'peanut butter', 'spread', 'stock',
    'broth', 'tea', 'coffee', 'atta', 'quinoa', 'yeast', 'baking', 'cumin', 'turmeric', 'masala', 'paprika', 'cinnamon', 'maple syrup',
  ],
  Snacks: ['chip', 'crisp', 'cookie', 'biscuit', 'cracker', 'chocolate', 'candy', 'nuts', 'almond', 'cashew', 'peanut', 'popcorn', 'granola', 'pretzel', 'trail mix'],
  Drinks: ['water', 'juice', 'soda', 'cola', 'beer', 'wine', 'kombucha', 'sparkling', 'lemonade', 'drink', 'coconut water'],
  Household: ['paper towel', 'toilet', 'tissue', 'detergent', 'dish soap', 'dishwasher', 'sponge', 'trash', 'garbage bag', 'foil', 'cling', 'cleaner', 'bleach', 'napkin', 'batter', 'bulb'],
  'Personal care': ['shampoo', 'conditioner', 'toothpaste', 'toothbrush', 'deodorant', 'razor', 'lotion', 'sunscreen', 'floss', 'body wash', 'soap', 'face wash'],
}

// Longest keywords first, so "peanut butter" wins over "butter" and "ice cream" over "cream".
const RULES = Object.entries(KEYWORDS)
  .flatMap(([category, words]) => words.map((w) => [w, category] as const))
  .sort((a, b) => b[0].length - a[0].length)
  .map(([w, category]) => [new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'), category] as const)

// What you've filed an item under before beats the keyword guess.
export function guessCategory(name: string, known?: Map<string, string>): string | null {
  const learned = known?.get(name.trim().toLowerCase())
  if (learned) return learned
  for (const [re, category] of RULES) if (re.test(name)) return category
  return null
}

export function knownCategories(rows: { name: string; category: string | null }[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const r of rows) if (r.category) map.set(r.name.trim().toLowerCase(), r.category)
  return map
}

export function guessLocation(category: string | null): string | null {
  if (category === 'Frozen') return 'Freezer'
  if (category === 'Dairy & eggs' || category === 'Meat & fish' || category === 'Produce') return 'Fridge'
  if (category === 'Pantry' || category === 'Snacks' || category === 'Drinks' || category === 'Bakery') return 'Cupboard'
  return null
}

export function aisleIndex(category: string | null): number {
  const i = category ? CATEGORIES.indexOf(category) : -1
  return i === -1 ? CATEGORIES.length : i
}

// Each aisle gets an emoji and a colour, used for item tiles and section headings.
const STYLES: Record<string, { emoji: string; color: string }> = {
  Produce: { emoji: '🥦', color: '#22c55e' },
  Bakery: { emoji: '🥖', color: '#f59e0b' },
  'Dairy & eggs': { emoji: '🥛', color: '#3b82f6' },
  'Meat & fish': { emoji: '🍗', color: '#ef4444' },
  Frozen: { emoji: '🧊', color: '#06b6d4' },
  Pantry: { emoji: '🥫', color: '#f97316' },
  Snacks: { emoji: '🍪', color: '#ec4899' },
  Drinks: { emoji: '🧃', color: '#8b5cf6' },
  Household: { emoji: '🧻', color: '#64748b' },
  'Personal care': { emoji: '🧴', color: '#a855f7' },
}
const FALLBACK = { emoji: '🛒', color: '#94a3b8' }

export function categoryStyle(category: string | null | undefined) {
  return (category && STYLES[category]) || FALLBACK
}
