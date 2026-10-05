import { useEffect, useState } from 'react'
import type { PantryItem } from '../types'
import { daysUntil } from './format'

// Recipe ideas from TheMealDB (https://www.themealdb.com), a free recipe database.
// The free API can only search one ingredient at a time, so we search for each pantry item
// (expiring ones first) and rank recipes by how much of each one you already have.

const API = 'https://www.themealdb.com/api/json/v1/1'

export type MealSummary = { id: string; name: string; thumb: string }
export type Meal = MealSummary & {
  category: string | null
  area: string | null
  instructions: string
  youtube: string | null
  source: string | null
  ingredients: { name: string; measure: string }[]
}

export type RecipeMatch = {
  meal: Meal
  have: { name: string; measure: string; item: PantryItem | null }[]
  missing: { name: string; measure: string }[]
  usesSoon: PantryItem[]
}

// Things nearly every kitchen has, so they don't count as "missing".
const BASICS = new Set(['salt', 'pepper', 'black pepper', 'water', 'sea salt', 'ice', 'boiling water', 'cold water', 'warm water', 'hot water'])

async function get<T>(path: string): Promise<T> {
  const res = await fetch(API + path)
  if (!res.ok) throw new Error(`Recipe service error ${res.status}`)
  return res.json()
}

type RawMeal = Record<string, string | null>

function toMeal(raw: RawMeal): Meal {
  const ingredients: Meal['ingredients'] = []
  for (let i = 1; i <= 20; i++) {
    const name = raw[`strIngredient${i}`]?.trim()
    if (name) ingredients.push({ name, measure: raw[`strMeasure${i}`]?.trim() ?? '' })
  }
  return {
    id: raw.idMeal!,
    name: raw.strMeal!,
    thumb: raw.strMealThumb!,
    category: raw.strCategory ?? null,
    area: raw.strArea ?? null,
    instructions: raw.strInstructions ?? '',
    youtube: raw.strYoutube || null,
    source: raw.strSource || null,
    ingredients,
  }
}

// ---- Ingredient name matching ----

// "Chicken Thighs" -> "chicken thigh", "GV MILK 2%" -> "gv milk"
export function words(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length > 3 && w.endsWith('ies') ? w.slice(0, -3) + 'y' : w.length > 3 && w.endsWith('oes') ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))
    .join(' ')
}

const contains = (haystack: string, needle: string) => needle.length > 0 && ` ${haystack} `.includes(` ${needle} `)

// Names that mean the same thing for cooking purposes (including US/UK differences).
const SYNONYMS = [
  ['pasta', 'spaghetti', 'penne rigate', 'penne', 'linguine', 'fusilli', 'macaroni', 'tagliatelle', 'farfalle', 'rigatoni'],
  ['minced beef', 'ground beef', 'beef mince', 'mince'],
  ['coriander', 'cilantro'],
  ['spring onion', 'scallion', 'green onion'],
  ['red pepper', 'bell pepper', 'capsicum', 'green pepper', 'yellow pepper'],
  ['aubergine', 'eggplant', 'brinjal'],
  ['courgette', 'zucchini'],
  ['king prawn', 'prawn', 'shrimp'],
  ['greek yogurt', 'yogurt', 'yoghurt', 'curd'],
  ['double cream', 'heavy cream', 'whipping cream'],
  ['plain flour', 'all purpose flour', 'flour'],
  ['caster sugar', 'sugar', 'granulated sugar'],
].map((group) => group.map(words))

function synonymGroup(name: string): number {
  const w = words(name)
  return SYNONYMS.findIndex((group) => group.some((g) => w === g || contains(w, g)))
}

// Words that describe preparation, not a different ingredient.
const DESCRIPTORS = new Set(
  'minced chopped fresh large small medium sliced diced grated whole dried raw cooked boneless skinless free range organic ripe beaten softened melted unsalted salted finely roughly thinly peeled crushed shredded room temperature extra virgin'.split(
    ' ',
  ),
)

// Does a pantry item cover a recipe ingredient?
// Yes if the recipe is more general ("chicken" vs your "chicken thighs"), only adds descriptive words
// ("minced garlic" vs your "garlic"), or they're synonyms. Not "coconut milk" vs your "milk".
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

export async function searchMeals(query: string): Promise<Meal[]> {
  const d = await get<{ meals: RawMeal[] | null }>(`/search.php?s=${encodeURIComponent(query)}`)
  return (d.meals ?? []).map(toMeal)
}

// ---- Ranking ----

const isSoon = (p: PantryItem) => p.expires_on !== null && daysUntil(p.expires_on) <= 3

export function matchMeal(meal: Meal, stocked: PantryItem[]): RecipeMatch {
  const have: RecipeMatch['have'] = []
  const missing: RecipeMatch['missing'] = []
  const usesSoon = new Set<PantryItem>()
  for (const ing of meal.ingredients) {
    const item = stocked.find((p) => sameIngredient(p.name, ing.name)) ?? null
    if (item || BASICS.has(words(ing.name))) {
      have.push({ ...ing, item })
      if (item && isSoon(item)) usesSoon.add(item)
    } else missing.push(ing)
  }
  return { meal, have, missing, usesSoon: [...usesSoon] }
}

// Best first: recipes that use up expiring food, then the ones you have the most for.
export function rankMatches(matches: RecipeMatch[]): RecipeMatch[] {
  const score = (m: RecipeMatch) => (m.have.length / Math.max(1, m.meal.ingredients.length)) * 100 + m.usesSoon.length * 25 - m.missing.length * 2
  return [...matches].sort((a, b) => score(b) - score(a))
}

const MAX_INGREDIENTS = 6
const MAX_CANDIDATES = 30
const MAX_RECIPES = 16

// A stable pseudo-random number per recipe per day, so ties shuffle daily instead of sorting A-Z.
function dailyJitter(id: string): number {
  let h = 2166136261
  for (const c of id + new Date().toDateString()) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return ((h >>> 0) % 1000) / 1000
}

export type Suggestions =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'empty' }
  | { status: 'ready'; recipes: RecipeMatch[]; searchedWith: PantryItem[] }

// What can I cook with what's in the pantry right now?
export function useRecipeSuggestions(pantry: PantryItem[], focus: string | null): Suggestions {
  const stocked = pantry.filter((p) => p.quantity > 0)
  const key = stocked.map((p) => `${p.name}|${p.expires_on}`).sort().join(',') + `#${focus ?? ''}`
  const [state, setState] = useState<Suggestions>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    ;(async () => {
      try {
        const names = await loadIngredientNames()
        const ordered = [...stocked].sort((a, b) => (a.expires_on ?? '9999').localeCompare(b.expires_on ?? '9999'))
        const picks: { item: PantryItem; ingredient: string }[] = []
        for (const item of focus ? ordered.filter((p) => p.id === focus) : ordered) {
          const ingredient = toDbIngredient(item.name, names)
          if (ingredient && !picks.some((p) => p.ingredient === ingredient)) picks.push({ item, ingredient })
          if (picks.length === MAX_INGREDIENTS) break
        }
        if (picks.length === 0) {
          if (!cancelled) setState({ status: 'empty' })
          return
        }

        // Recipes that show up for several of your ingredients (or for expiring ones) come first.
        const lists = await Promise.allSettled(picks.map((p) => mealsWith(p.ingredient)))
        const votes = new Map<string, number>()
        lists.forEach((r, i) => {
          if (r.status !== 'fulfilled') return
          for (const m of r.value) votes.set(m.id, (votes.get(m.id) ?? 0) + 10 + (isSoon(picks[i].item) ? 5 : 0) + dailyJitter(m.id) * 4)
        })
        const top = [...votes.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_CANDIDATES)
        const meals = await Promise.allSettled(top.map(([id]) => mealById(id)))
        const recipes = rankMatches(meals.flatMap((m) => (m.status === 'fulfilled' ? [matchMeal(m.value, stocked)] : []))).slice(0, MAX_RECIPES)
        if (!cancelled) setState(recipes.length ? { status: 'ready', recipes, searchedWith: picks.map((p) => p.item) } : { status: 'empty' })
      } catch {
        if (!cancelled) setState({ status: 'error' })
      }
    })()
    return () => {
      cancelled = true
    }
    // `key` captures everything about the pantry that affects the results.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return state
}

// Recipe instructions arrive as one blob; split into readable steps.
export function steps(instructions: string): string[] {
  return instructions
    .split(/\r?\n+/)
    .map((s) => s.replace(/^\s*(step\s*\d+[:.)]?|\d+[.)])\s*/i, '').trim())
    .filter((s) => s.length > 2)
}
