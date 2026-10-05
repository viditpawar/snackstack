import { useMemo, useState, type FormEvent } from 'react'
import { Check, Clock, ExternalLink, Leaf, ListPlus, PlayCircle, RotateCw, Search, Sparkles, X } from 'lucide-react'
import { useStore } from '../store'
import { matchMeal, rankMatches, searchMeals, steps, useRecipeSuggestions, type Cuisine, type Meal, type RecipeMatch } from '../lib/recipes'
import { normalizeName } from '../lib/items'
import { Sheet } from '../ui/Sheet'
import { Empty, ExpiryPill, ItemIcon, PageHead } from '../ui/bits'

const CHIP_LIMIT = 10

const CUISINES: [Cuisine, string][] = [
  ['all', 'All'],
  ['indian', '🍛 Indian'],
  ['veg', '🥗 Vegetarian'],
]

export default function CookScreen() {
  const { pantry } = useStore()
  // Always opens on All; Indian and Vegetarian are filters you pick for this visit.
  const [cuisine, setCuisine] = useState<Cuisine>('all')
  const [focus, setFocus] = useState<string | null>(null)
  const [allChips, setAllChips] = useState(false)
  const [open, setOpen] = useState<RecipeMatch | null>(null)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState<{ query: string; status: 'loading' | 'error' | 'ready'; recipes: RecipeMatch[] } | null>(null)
  const suggestions = useRecipeSuggestions(pantry, focus, cuisine)
  const stocked = useMemo(() => pantry.filter((p) => p.quantity > 0), [pantry])

  async function runSearch(q: string, c: Cuisine) {
    setSearch({ query: q, status: 'loading', recipes: [] })
    try {
      const meals = await searchMeals(q, c)
      setSearch({ query: q, status: 'ready', recipes: rankMatches(meals.map((m) => matchMeal(m, stocked))) })
    } catch {
      setSearch({ query: q, status: 'error', recipes: [] })
    }
  }

  function onSearch(e: FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return setSearch(null)
    runSearch(q, cuisine)
  }

  function pickCuisine(c: Cuisine) {
    setCuisine(c)
    setFocus(null)
    if (search) runSearch(search.query, c)
  }

  const focusItem = focus ? pantry.find((p) => p.id === focus) : null

  return (
    <>
      <PageHead title="What can I cook?" subtitle="Recipes using what's in your pantry, starting with what expires soonest" />

      <form className="search" onSubmit={onSearch}>
        <Search size={18} aria-hidden />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search recipes, e.g. dal, paneer, curry" aria-label="Search recipes" enterKeyHint="search" data-shortcut="focus" />
        {query && (
          <button
            type="button"
            className="icon-btn"
            onClick={() => {
              setQuery('')
              setSearch(null)
            }}
            aria-label="Clear search"
          >
            <X size={16} />
          </button>
        )}
      </form>

      <div className="chips cook-cuisines" role="radiogroup" aria-label="Cuisine">
        {CUISINES.map(([id, label]) => (
          <button key={id} role="radio" aria-checked={cuisine === id} className={`chip${cuisine === id ? ' chip-on' : ''}`} onClick={() => pickCuisine(id)}>
            {label}
          </button>
        ))}
      </div>

      {search ? (
        <section className="cook-section">
          <h2 className="section-title">Results for “{search.query}”</h2>
          {search.status === 'loading' && <RecipeSkeletons />}
          {search.status === 'error' && <p className="alert alert-error">Couldn't reach the recipe service. Check your connection and try again.</p>}
          {search.status === 'ready' && search.recipes.length === 0 && <p className="muted center pad">No recipes found. Try a simpler word like “dal”, “chicken” or “soup”.</p>}
          {search.status === 'ready' && <RecipeGrid recipes={search.recipes} onOpen={setOpen} />}
        </section>
      ) : (
        <section className="cook-section">
          {stocked.length === 0 && (
            <p className="cook-hint">
              <Sparkles size={16} /> Add what you have to your pantry and these will be ranked by what you can make right now.
            </p>
          )}
          {suggestions.status === 'ready' && suggestions.searchedWith.length > 0 && (
            <div className="chips cook-using">
              <span className="chips-label">Cooking with</span>
              {focusItem ? (
                <button className="chip chip-on" onClick={() => setFocus(null)}>
                  {focusItem.name} <X size={14} />
                </button>
              ) : (
                <>
                  {(allChips ? suggestions.searchedWith : suggestions.searchedWith.slice(0, CHIP_LIMIT)).map((p) => (
                    <button key={p.id} className="chip" onClick={() => setFocus(p.id)} title={`Only recipes with ${p.name}`}>
                      {p.name}
                    </button>
                  ))}
                  {suggestions.searchedWith.length > CHIP_LIMIT && (
                    <button className="chip chip-more" onClick={() => setAllChips(!allChips)}>
                      {allChips ? 'Show less' : `+${suggestions.searchedWith.length - CHIP_LIMIT} more`}
                    </button>
                  )}
                </>
              )}
            </div>
          )}
          {suggestions.status === 'loading' && <RecipeSkeletons />}
          {suggestions.status === 'error' && (
            <Empty icon={<RotateCw size={28} />} title="Couldn't load recipes">
              <p>Check your connection, then reopen this page.</p>
            </Empty>
          )}
          {suggestions.status === 'empty' && (
            <p className="muted center pad">{focusItem ? `No recipes use ${focusItem.name} yet.` : 'No recipes match this filter yet. Try another one.'}</p>
          )}
          {suggestions.status === 'ready' && <RecipeGrid recipes={suggestions.recipes} onOpen={setOpen} />}
          <p className="hint">Recipes from SnackStack's own Indian collection and TheMealDB, a free recipe database.</p>
        </section>
      )}

      <Sheet open={open !== null} onClose={() => setOpen(null)} title={open?.meal.name ?? 'Recipe'}>
        {open && <RecipeDetail match={open} onDone={() => setOpen(null)} />}
      </Sheet>
    </>
  )
}

// Our own recipes have no photo, so they get a colourful tile with their emoji.
const ART = [
  'linear-gradient(135deg, #f97316, #db2777)',
  'linear-gradient(135deg, #f59e0b, #ef4444)',
  'linear-gradient(135deg, #22c55e, #0d9488)',
  'linear-gradient(135deg, #8b5cf6, #db2777)',
  'linear-gradient(135deg, #eab308, #f97316)',
  'linear-gradient(135deg, #06b6d4, #6366f1)',
]

function RecipeImage({ meal, className }: { meal: Meal; className: string }) {
  if (meal.thumb) return <img className={className} src={`${meal.thumb}/medium`} alt="" loading="lazy" />
  const hue = [...meal.id].reduce((h, c) => h + c.charCodeAt(0), 0) % ART.length
  return (
    <span className={`${className} recipe-art`} style={{ background: ART[hue] }} aria-hidden>
      <span>{meal.emoji ?? '🍽️'}</span>
    </span>
  )
}

const metaLine = (meal: Meal) =>
  [meal.area, meal.category, meal.minutes ? `${meal.minutes} min` : null].filter(Boolean).join(' · ')

function RecipeSkeletons() {
  return (
    <div className="recipe-grid" aria-label="Loading recipes" role="status">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="recipe-card recipe-card-skeleton">
          <div className="skeleton recipe-img" />
          <div className="skeleton" style={{ height: 18, margin: 12, borderRadius: 8 }} />
        </div>
      ))}
    </div>
  )
}

function RecipeGrid({ recipes, onOpen }: { recipes: RecipeMatch[]; onOpen: (r: RecipeMatch) => void }) {
  return (
    <div className="recipe-grid">
      {recipes.map((r) => {
        const total = r.have.length + r.missing.length
        const pct = Math.round((r.have.length / Math.max(1, total)) * 100)
        return (
          <button key={r.meal.id} className="recipe-card" onClick={() => onOpen(r)}>
            <span className="recipe-img-wrap">
              <RecipeImage meal={r.meal} className="recipe-img" />
              {r.usesSoon.length > 0 && (
                <span className="recipe-badge">
                  <Sparkles size={12} /> Uses up {r.usesSoon[0].name}
                </span>
              )}
              {r.meal.veg && (
                <span className="recipe-veg" title="Vegetarian" aria-label="Vegetarian">
                  <Leaf size={12} />
                </span>
              )}
            </span>
            <span className="recipe-body">
              <span className="recipe-name">{r.meal.name}</span>
              <span className="recipe-meta">{metaLine(r.meal)}</span>
              <span className="recipe-match">
                <span className="recipe-match-track">
                  <span style={{ width: `${pct}%` }} />
                </span>
                <span>{r.missing.length === 0 ? 'You have everything!' : r.have.length === 0 ? `${total} ingredients` : `Have ${r.have.length} of ${total} · ${r.missing.length} to buy`}</span>
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

function RecipeDetail({ match, onDone }: { match: RecipeMatch; onDone: () => void }) {
  const { shopping, addShoppingMany } = useStore()
  const { meal, have, missing, staples } = match
  const onList = new Set(shopping.map((s) => normalizeName(s.name)))
  const toBuy = missing.filter((m) => !onList.has(normalizeName(m.name)))
  const titleCase = (s: string) => s.replace(/(^|\s)\S/g, (c) => c.toUpperCase())

  return (
    <div className="recipe-detail">
      <RecipeImage meal={meal} className="recipe-hero" />
      <div className="recipe-tags">
        {meal.area && <span className="pill">{meal.area}</span>}
        {meal.category && <span className="pill">{meal.category}</span>}
        {meal.minutes && (
          <span className="pill">
            <Clock size={12} /> {meal.minutes} min
          </span>
        )}
        {meal.veg && (
          <span className="pill pill-good">
            <Leaf size={12} /> Vegetarian
          </span>
        )}
        <span className={`pill ${missing.length ? 'pill-soon' : 'pill-good'}`}>{missing.length ? `${missing.length} to buy` : 'You have everything'}</span>
      </div>
      {meal.aka && meal.aka.length > 0 && <p className="muted recipe-aka">Also called {meal.aka.join(', ')}</p>}

      {match.usesSoon.length > 0 && (
        <div className="recipe-uses">
          <Sparkles size={16} />
          <span>
            Uses up{' '}
            {match.usesSoon.map((p, i) => (
              <span key={p.id}>
                {i > 0 && ', '}
                <strong>{p.name}</strong> <ExpiryPill date={p.expires_on} />
              </span>
            ))}
          </span>
        </div>
      )}

      <h3 className="recipe-h">Ingredients</h3>
      <ul className="recipe-ingredients">
        {have.map((i) => (
          <li key={`h-${i.name}`} className="ing-have">
            <span className="ing-mark">
              <Check size={14} strokeWidth={3} />
            </span>
            {i.item ? <ItemIcon category={i.item.category} /> : <span className="ing-spacer" />}
            <span className="ing-name">{i.name}</span>
            <span className="ing-measure">{i.measure}</span>
          </li>
        ))}
        {missing.map((i) => (
          <li key={`m-${i.name}`} className="ing-missing">
            <span className="ing-mark" />
            <span className="ing-spacer" />
            <span className="ing-name">{i.name}</span>
            <span className="ing-measure">{i.measure}</span>
          </li>
        ))}
      </ul>

      {staples.length > 0 && (
        <div className="recipe-staples">
          <span className="recipe-staples-title">🧂 From your spice box</span>
          <span>{staples.map((s) => (s.measure ? `${s.name} (${s.measure})` : s.name)).join(' · ')}</span>
        </div>
      )}

      {toBuy.length > 0 && (
        <button
          className="btn btn-primary btn-block"
          onClick={() => {
            addShoppingMany(toBuy.map((m) => ({ name: titleCase(m.name), quantity: 1, unit: null })))
            onDone()
          }}
        >
          <ListPlus size={18} /> Add {toBuy.length} missing to my list
        </button>
      )}
      {missing.length > 0 && toBuy.length === 0 && <p className="hint">Everything missing is already on your list.</p>}

      <h3 className="recipe-h">Method</h3>
      <ol className="recipe-steps">
        {steps(meal).map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>

      {(meal.youtube || meal.source) && (
        <div className="recipe-links">
          {meal.youtube && (
            <a className="btn btn-ghost btn-sm" href={meal.youtube} target="_blank" rel="noreferrer">
              <PlayCircle size={16} /> Watch video
            </a>
          )}
          {meal.source && (
            <a className="btn btn-ghost btn-sm" href={meal.source} target="_blank" rel="noreferrer">
              <ExternalLink size={16} /> Original recipe
            </a>
          )}
        </div>
      )}
      {meal.local && <p className="hint">A SnackStack kitchen recipe.</p>}
    </div>
  )
}
