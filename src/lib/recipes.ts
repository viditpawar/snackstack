import { useEffect, useState } from 'react'
import type { PantryItem } from '../types'
import { daysUntil } from './format'
import { INDIAN_RECIPES } from './indianRecipes'

// Recipe ideas come from two places:
// - SnackStack's own collection of everyday Indian recipes (indianRecipes.ts), always available.
// - TheMealDB (https://www.themealdb.com), a free recipe database. Its free API can search only one
//   ingredient at a time, so we search for each pantry item (expiring ones first).
// Both are ranked the same way: by how much of each recipe you already have.

const API = 'https://www.themealdb.com/api/json/v1/1'

export type Cuisine = 'all' | 'indian' | 'veg'

export type MealSummary = { id: string; name: string; thumb: string }
export type Meal = {
  id: string
  name: string
  thumb: string | null
  emoji?: string
  category: string | null
  area: string | null
  minutes?: number
  // true = vegetarian, false = has meat or fish, null = unknown.
  veg: boolean | null
  aka?: string[]
  instructions: string
  stepList?: string[]
  youtube: string | null
  source: string | null
  local?: boolean
  ingredients: { name: string; measure: string }[]
}

export type RecipeMatch = {
  meal: Meal
  have: { name: string; measure: string; item: PantryItem | null }[]
  missing: { name: string; measure: string }[]
  // Spices, oil and other basics, which we assume you have and don't count either way.
  staples: { name: string; measure: string }[]
  usesSoon: PantryItem[]
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(API + path)
  if (!res.ok) throw new Error(`Recipe service error ${res.status}`)
  return res.json()
}

type RawMeal = Record<string, string | null>

const MEAT = new Set(['Beef', 'Chicken', 'Lamb', 'Pork', 'Seafood', 'Goat'])

function toMeal(raw: RawMeal): Meal {
  const ingredients: Meal['ingredients'] = []
  for (let i = 1; i <= 20; i++) {
    const name = raw[`strIngredient${i}`]?.trim()
    if (name) ingredients.push({ name, measure: raw[`strMeasure${i}`]?.trim() ?? '' })
  }
  const category = raw.strCategory ?? null
  return {
    id: raw.idMeal!,
    name: raw.strMeal!,
    thumb: raw.strMealThumb!,
    category,
    area: (raw.strArea || raw.strCountry || null)?.replace(/^India$/, 'Indian') ?? null,
    veg: category === 'Vegetarian' || category === 'Vegan' ? true : category && MEAT.has(category) ? false : null,
    instructions: raw.strInstructions ?? '',
    youtube: raw.strYoutube || null,
    source: raw.strSource || null,
    ingredients,
  }
}

const LOCAL_MEALS: Meal[] = INDIAN_RECIPES.map((r) => ({
  id: `local-${r.slug}`,
  name: r.name,
  thumb: null,
  emoji: r.emoji,
  category: r.course,
  area: 'Indian',
  minutes: r.minutes,
  veg: r.veg,
  aka: r.aka,
  instructions: r.steps.join('\n'),
  stepList: r.steps,
  youtube: null,
  source: null,
  local: true,
  ingredients: r.ingredients.map(([name, measure]) => ({ name, measure })),
}))

// ---- Ingredient name matching ----

// "Chicken Thighs" -> "chicken thigh", "GV MILK 2%" -> "gv milk"
export function words(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length > 3 && w.endsWith('ies') ? w.slice(0, -3) + 'y' : w.length > 3 && w.endsWith('oes') ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))
    .map((w) => SPELLINGS[w] ?? w)
    .join(' ')
}

// Spelling variants that should read as the same word (after plurals are removed).
const SPELLINGS: Record<string, string> = { chilli: 'chili', chilly: 'chili', chily: 'chili', chile: 'chili', chillie: 'chili', chilie: 'chili', yoghurt: 'yogurt' }

const contains = (haystack: string, needle: string) => needle.length > 0 && ` ${haystack} `.includes(` ${needle} `)

// Words that describe preparation or form, not a different ingredient.
const DESCRIPTORS = new Set(
  'minced chopped fresh large small medium sliced diced grated whole dried raw cooked boneless skinless free range organic ripe beaten softened melted unsalted salted finely roughly thinly peeled crushed shredded room temperature extra virgin frozen canned boiled soaked'.split(
    ' ',
  ),
)

const core = (w: string) =>
  w
    .split(' ')
    .filter((x) => !DESCRIPTORS.has(x))
    .join(' ')

// Names that mean the same thing for cooking: US/UK differences and common Hindi names.
const SYNONYMS = [
  ['pasta', 'spaghetti', 'penne rigate', 'penne', 'linguine', 'fusilli', 'macaroni', 'tagliatelle', 'farfalle', 'rigatoni'],
  ['minced beef', 'ground beef', 'beef mince', 'mince', 'minced meat', 'ground meat', 'keema', 'ground lamb', 'minced lamb', 'ground chicken', 'minced chicken'],
  ['coriander', 'cilantro', 'coriander leaves', 'dhania', 'fresh coriander'],
  ['spring onion', 'scallion', 'green onion'],
  ['red pepper', 'bell pepper', 'capsicum', 'green pepper', 'yellow pepper', 'shimla mirch'],
  ['aubergine', 'eggplant', 'brinjal', 'baingan'],
  ['courgette', 'zucchini'],
  ['king prawn', 'prawn', 'shrimp'],
  ['greek yogurt', 'yogurt', 'yoghurt', 'curd', 'dahi', 'plain yogurt'],
  ['double cream', 'heavy cream', 'whipping cream', 'cream', 'fresh cream', 'malai'],
  ['plain flour', 'all purpose flour', 'flour', 'maida'],
  ['potato', 'aloo', 'baby potato'],
  ['cauliflower', 'gobi', 'gobhi', 'phool gobi'],
  ['cabbage', 'patta gobi', 'band gobi'],
  ['okra', 'bhindi', 'lady finger', 'ladyfinger'],
  ['pea', 'green pea', 'matar', 'mutter', 'garden pea'],
  ['spinach', 'palak'],
  ['chickpea', 'chana', 'kabuli chana', 'garbanzo bean', 'garbanzo', 'chole'],
  ['kidney bean', 'red kidney bean', 'rajma'],
  ['paneer', 'cottage cheese', 'indian cottage cheese'],
  ['onion', 'red onion', 'pyaz', 'pyaaz', 'kanda'],
  ['tomato', 'tamatar'],
  ['ginger', 'adrak'],
  ['garlic', 'lehsun', 'lasun', 'garlic clove'],
  ['green chili', 'green chilli', 'hari mirch', 'chili', 'chilli', 'green chile', 'serrano'],
  ['bottle gourd', 'lauki', 'dudhi', 'ghiya'],
  ['whole wheat flour', 'atta', 'wheat flour', 'chapati flour'],
  ['gram flour', 'besan', 'chickpea flour'],
  ['toor dal', 'arhar dal', 'tuvar dal', 'pigeon pea', 'split pigeon pea'],
  ['moong dal', 'mung dal', 'yellow moong dal', 'split mung bean', 'mung bean'],
  ['red lentil', 'masoor dal', 'lentil', 'red lentils'],
  ['chana dal', 'split chickpea', 'bengal gram'],
  ['urad dal', 'black gram', 'split urad dal'],
  ['flattened rice', 'poha', 'beaten rice', 'chivda'],
  ['semolina', 'sooji', 'suji', 'rava'],
  ['sago', 'sabudana', 'tapioca pearl'],
  ['rice', 'basmati rice', 'white rice', 'basmati', 'sona masoori', 'long grain rice', 'jasmine rice'],
  ['cooked rice', 'leftover rice', 'steamed rice'],
  ['mint', 'mint leaves', 'pudina', 'fresh mint'],
  ['curry leaves', 'curry leaf', 'kadi patta', 'kari patta'],
  ['coconut', 'grated coconut', 'desiccated coconut', 'fresh coconut', 'nariyal'],
  ['carrot', 'gajar'],
  ['cucumber', 'kheera', 'kakdi'],
  ['peanut', 'groundnut', 'moongphali'],
  ['cashew', 'cashew nut', 'kaju'],
  ['almond', 'badam'],
  ['tamarind', 'imli', 'tamarind paste'],
  ['lemon', 'lime', 'nimbu'],
  ['fish', 'white fish', 'cod', 'tilapia', 'basa', 'pomfret', 'kingfish'],
  ['milk', 'whole milk', 'doodh'],
  ['butter', 'unsalted butter', 'makhan'],
  ['tea', 'black tea', 'chai patti', 'tea leaves'],
  ['mixed vegetables', 'mixed veg', 'frozen mixed vegetables', 'stir fry vegetables'],
].map((group) => group.map(words))

function synonymGroup(name: string): number {
  const w = words(name)
  const c = core(w)
  return SYNONYMS.findIndex((group) => group.includes(w) || group.includes(c))
}

// Spice box and basics: assumed to be in every kitchen, so they're never "missing".
const STAPLES = new Set(
  [
    'salt', 'sea salt', 'pepper', 'black pepper', 'ground black pepper', 'water', 'ice', 'boiling water', 'cold water', 'warm water', 'hot water',
    'oil', 'vegetable oil', 'cooking oil', 'sunflower oil', 'ghee', 'sugar',
    'turmeric', 'turmeric powder', 'haldi', 'cumin', 'cumin seeds', 'ground cumin', 'jeera', 'cumin powder',
    'mustard seeds', 'rai', 'red chili powder', 'chili powder', 'chilli powder', 'kashmiri red chili powder', 'lal mirch',
    'coriander powder', 'ground coriander', 'coriander seeds', 'dhania powder', 'garam masala', 'asafoetida', 'hing',
    'bay leaf', 'bay leaves', 'cloves', 'cardamom', 'green cardamom', 'cardamom pods', 'elaichi', 'cinnamon', 'cinnamon stick',
    'kasuri methi', 'fenugreek seeds', 'methi seeds', 'dried red chilies', 'dried red chili', 'whole red chilies',
  ].map(words),
)

const isStaple = (name: string) => STAPLES.has(words(name))

// Does a pantry item cover a recipe ingredient?
// Yes if the recipe is more general ("chicken" vs your "chicken thighs"), only adds descriptive words
// ("minced garlic" vs your "garlic"), or they're synonyms ("aloo" and "potato"). Not "coconut milk" vs your "milk".
export function sameIngredient(pantryName: string, recipeName: string): boolean {
  const have = words(pantryName)
  const need = words(recipeName)
  if (!have || !need) return false
  if (have === need || contains(have, need)) return true
  if (contains(need, have)) {
    const extra = need.split(' ').filter((w) => !have.split(' ').includes(w))
    if (extra.every((w) => DESCRIPTORS.has(w))) return true
  }
  const group = synonymGroup(have)
  return group !== -1 && group === synonymGroup(need)
}

let ingredientNames: Promise<string[]> | null = null
const NAMES_KEY = 'snackstack.mealdb.ingredients'

function loadIngredientNames(): Promise<string[]> {
  if (!ingredientNames) {
    ingredientNames = (async () => {
      try {
        const cached = JSON.parse(localStorage.getItem(NAMES_KEY) ?? 'null')
        if (cached && Date.now() - cached.at < 7 * 86_400_000) return cached.names as string[]
      } catch {
        // No cache; fetch below.
      }
      const data = await get<{ meals: { strIngredient: string }[] }>('/list.php?i=list')
      const names = data.meals.map((m) => m.strIngredient)
      try {
        localStorage.setItem(NAMES_KEY, JSON.stringify({ at: Date.now(), names }))
      } catch {
        // Storage full or blocked; we'll just fetch again next time.
      }
      return names
    })()
    ingredientNames.catch(() => (ingredientNames = null))
  }
  return ingredientNames
}

// Finds the recipe-database ingredient that best matches a pantry item name.
function toDbIngredient(name: string, names: string[]): string | null {
  const target = words(name)
  if (!target) return null
  let best: string | null = null
  for (const n of names) {
    const w = words(n)
    if (w === target) return n
    if (contains(target, w) && (!best || w.length > words(best).length)) best = n
  }
  if (best) return best
  const group = synonymGroup(target)
  if (group === -1) return null
  return names.find((n) => SYNONYMS[group].includes(words(n))) ?? null
}

// ---- Fetching, with an in-memory cache for the session ----

const byIngredient = new Map<string, Promise<MealSummary[]>>()
const byId = new Map<string, Promise<Meal>>()
let indianIds: Promise<string[]> | null = null

function mealsWith(ingredient: string): Promise<MealSummary[]> {
  let p = byIngredient.get(ingredient)
  if (!p) {
    p = get<{ meals: { idMeal: string; strMeal: string; strMealThumb: string }[] | null }>(`/filter.php?i=${encodeURIComponent(ingredient)}`).then(
      (d) => (d.meals ?? []).map((m) => ({ id: m.idMeal, name: m.strMeal, thumb: m.strMealThumb })),
    )
    p.catch(() => byIngredient.delete(ingredient))
    byIngredient.set(ingredient, p)
  }
  return p
}

function mealById(id: string): Promise<Meal> {
  let p = byId.get(id)
  if (!p) {
    p = get<{ meals: RawMeal[] | null }>(`/lookup.php?i=${id}`).then((d) => {
      if (!d.meals?.[0]) throw new Error('Recipe not found')
      return toMeal(d.meals[0])
    })
    p.catch(() => byId.delete(id))
    byId.set(id, p)
  }
  return p
}

// TheMealDB's handful of Indian recipes.
function dbIndianMeals(): Promise<Meal[]> {
  if (!indianIds) {
    indianIds = get<{ meals: { idMeal: string }[] | null }>('/filter.php?a=india').then((d) => (d.meals ?? []).map((m) => m.idMeal))
    indianIds.catch(() => (indianIds = null))
  }
  return indianIds.then(async (ids) => (await Promise.allSettled(ids.map(mealById))).flatMap((r) => (r.status === 'fulfilled' ? [r.value] : [])))
}

const fitsCuisine = (meal: Meal, cuisine: Cuisine) => (cuisine === 'indian' ? meal.local || /india/i.test(meal.area ?? '') : cuisine === 'veg' ? meal.veg === true : true)

export async function searchMeals(query: string, cuisine: Cuisine): Promise<Meal[]> {
  const q = words(query)
  const local = LOCAL_MEALS.filter((m) => [m.name, ...(m.aka ?? [])].some((n) => contains(words(n), q) || words(n).includes(q)))
  let remote: Meal[] = []
  try {
    const d = await get<{ meals: RawMeal[] | null }>(`/search.php?s=${encodeURIComponent(query)}`)
    remote = (d.meals ?? []).map(toMeal)
  } catch {
    if (local.length === 0) throw new Error('Recipe search failed')
  }
  return [...local, ...remote].filter((m) => fitsCuisine(m, cuisine))
}

// ---- Ranking ----

const isSoon = (p: PantryItem) => p.expires_on !== null && daysUntil(p.expires_on) <= 3

export function matchMeal(meal: Meal, stocked: PantryItem[]): RecipeMatch {
  const have: RecipeMatch['have'] = []
  const missing: RecipeMatch['missing'] = []
  const staples: RecipeMatch['staples'] = []
  const usesSoon = new Set<PantryItem>()
  for (const ing of meal.ingredients) {
    const item = stocked.find((p) => sameIngredient(p.name, ing.name)) ?? null
    if (item) {
      have.push({ ...ing, item })
      if (isSoon(item)) usesSoon.add(item)
    } else if (isStaple(ing.name)) staples.push(ing)
    else missing.push(ing)
  }
  return { meal, have, missing, staples, usesSoon: [...usesSoon] }
}

// Best first: recipes that use up expiring food, then the ones you have the most for.
export function rankMatches(matches: RecipeMatch[]): RecipeMatch[] {
  // Desserts and drinks rank a little lower, so meals come first.
  const course = (m: RecipeMatch) => (/dessert|drink|beverage/i.test(m.meal.category ?? '') ? -15 : 0)
  const score = (m: RecipeMatch) => (m.have.length / Math.max(1, m.have.length + m.missing.length)) * 100 + m.usesSoon.length * 25 - m.missing.length * 2 + course(m)
  return [...matches].sort((a, b) => score(b) - score(a))
}

const MAX_INGREDIENTS = 6
const MAX_CANDIDATES = 30
const MAX_RECIPES = 24

// A stable pseudo-random number per recipe per day, so ties shuffle daily instead of sorting A-Z.
function dailyJitter(id: string): number {
  let h = 2166136261
  for (const c of id + new Date().toDateString()) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return ((h >>> 0) % 1000) / 1000
}

// Recipes from TheMealDB that use what's in the pantry.
async function dbMealsFor(stocked: PantryItem[], focus: string | null): Promise<{ meals: Meal[]; searchedWith: PantryItem[] }> {
  const names = await loadIngredientNames()
  const ordered = [...stocked].sort((a, b) => (a.expires_on ?? '9999').localeCompare(b.expires_on ?? '9999'))
  const picks: { item: PantryItem; ingredient: string }[] = []
  for (const item of focus ? ordered.filter((p) => p.id === focus) : ordered) {
    const ingredient = toDbIngredient(item.name, names)
    if (ingredient && !picks.some((p) => p.ingredient === ingredient)) picks.push({ item, ingredient })
    if (picks.length === MAX_INGREDIENTS) break
  }
  // Recipes that show up for several of your ingredients (or for expiring ones) come first.
  const lists = await Promise.allSettled(picks.map((p) => mealsWith(p.ingredient)))
  const votes = new Map<string, number>()
  lists.forEach((r, i) => {
    if (r.status !== 'fulfilled') return
    for (const m of r.value) votes.set(m.id, (votes.get(m.id) ?? 0) + 10 + (isSoon(picks[i].item) ? 5 : 0) + dailyJitter(m.id) * 4)
  })
  const top = [...votes.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_CANDIDATES)
  const meals = (await Promise.allSettled(top.map(([id]) => mealById(id)))).flatMap((m) => (m.status === 'fulfilled' ? [m.value] : []))
  return { meals, searchedWith: picks.map((p) => p.item) }
}

export type Suggestions =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'empty' }
  | { status: 'ready'; recipes: RecipeMatch[]; searchedWith: PantryItem[] }

// What can I cook with what's in the pantry right now?
export function useRecipeSuggestions(pantry: PantryItem[], focus: string | null, cuisine: Cuisine): Suggestions {
  const stocked = pantry.filter((p) => p.quantity > 0)
  const key = stocked.map((p) => `${p.name}|${p.expires_on}`).sort().join(',') + `#${focus ?? ''}#${cuisine}`
  const [state, setState] = useState<Suggestions>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    ;(async () => {
      let remote: Meal[] = []
      let searchedWith = focus ? stocked.filter((p) => p.id === focus) : stocked.slice(0, MAX_INGREDIENTS)
      let remoteFailed = false
      try {
        if (cuisine === 'indian') remote = await dbIndianMeals()
        else if (stocked.length) {
          const found = await dbMealsFor(stocked, focus)
          remote = found.meals
          if (found.searchedWith.length) searchedWith = found.searchedWith
        }
      } catch {
        remoteFailed = true
      }

      const focusItem = focus ? stocked.find((p) => p.id === focus) : null
      const candidates = [...LOCAL_MEALS, ...remote].filter((m) => fitsCuisine(m, cuisine))
      let matches = candidates.map((m) => matchMeal(m, stocked))
      if (focusItem) matches = matches.filter((m) => m.have.some((h) => h.item?.id === focusItem.id))
      const recipes = rankMatches(matches).slice(0, MAX_RECIPES)

      if (cancelled) return
      if (recipes.length) setState({ status: 'ready', recipes, searchedWith })
      else setState({ status: remoteFailed ? 'error' : 'empty' })
    })()
    return () => {
      cancelled = true
    }
    // `key` captures everything about the pantry and filters that affects the results.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return state
}

// Recipe instructions arrive as one blob; split into readable steps.
export function steps(meal: Meal): string[] {
  if (meal.stepList) return meal.stepList
  return meal.instructions
    .split(/\r?\n+/)
    .map((s) => s.replace(/^\s*(step\s*\d+[:.)]?|\d+[.)])\s*/i, '').trim())
    .filter((s) => s.length > 2)
}
