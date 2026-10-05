import { useMemo, useState, type FormEvent } from 'react'
import { Check, ChefHat, ExternalLink, ListPlus, PlayCircle, RotateCw, Search, Sparkles, X } from 'lucide-react'
import { useStore } from '../store'
import { matchMeal, rankMatches, searchMeals, steps, useRecipeSuggestions, type RecipeMatch } from '../lib/recipes'
import { normalizeName } from '../lib/items'
import { Sheet } from '../ui/Sheet'
import { Empty, ExpiryPill, ItemIcon, PageHead } from '../ui/bits'

export default function CookScreen() {
  const { pantry } = useStore()
  const [focus, setFocus] = useState<string | null>(null)
  const [open, setOpen] = useState<RecipeMatch | null>(null)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState<{ query: string; status: 'loading' | 'error' | 'ready'; recipes: RecipeMatch[] } | null>(null)
  const suggestions = useRecipeSuggestions(pantry, focus)
  const stocked = useMemo(() => pantry.filter((p) => p.quantity > 0), [pantry])

  async function runSearch(e: FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return setSearch(null)
    setSearch({ query: q, status: 'loading', recipes: [] })
    try {
      const meals = await searchMeals(q)
      setSearch({ query: q, status: 'ready', recipes: rankMatches(meals.map((m) => matchMeal(m, stocked))) })
    } catch {
      setSearch({ query: q, status: 'error', recipes: [] })
    }
  }

  const focusItem = focus ? pantry.find((p) => p.id === focus) : null

  return (
    <>
      <PageHead title="What can I cook?" subtitle="Recipes using what's in your pantry, starting with what expires soonest" />

      <form className="search" onSubmit={runSearch}>
        <Search size={18} aria-hidden />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Or search any recipe, e.g. curry" aria-label="Search recipes" enterKeyHint="search" data-shortcut="focus" />
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

      {search ? (
        <section className="cook-section">
          <h2 className="section-title">Results for “{search.query}”</h2>
          {search.status === 'loading' && <RecipeSkeletons />}
          {search.status === 'error' && <p className="alert alert-error">Couldn't reach the recipe service. Check your connection and try again.</p>}
          {search.status === 'ready' && search.recipes.length === 0 && <p className="muted center pad">No recipes found. Try a simpler word like “chicken” or “soup”.</p>}
          {search.status === 'ready' && <RecipeGrid recipes={search.recipes} onOpen={setOpen} />}
        </section>
      ) : stocked.length === 0 ? (
        <Empty icon={<ChefHat size={28} />} title="Your pantry is empty">
          Add what you have at home, or check out from your shopping list, and recipe ideas will show up here. You can still search for any recipe above.
        </Empty>
      ) : (
        <section className="cook-section">
          {suggestions.status === 'ready' && (
            <div className="chips cook-using">
              <span className="chips-label">Cooking with</span>
              {focusItem ? (
                <button className="chip chip-on" onClick={() => setFocus(null)}>
                  {focusItem.name} <X size={14} />
                </button>
              ) : (
                suggestions.searchedWith.map((p) => (
                  <button key={p.id} className="chip" onClick={() => setFocus(p.id)} title={`Only recipes with ${p.name}`}>
                    {p.name}
                  </button>
                ))
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
            <Empty icon={<ChefHat size={28} />} title="No matches yet">
              We couldn't match your pantry items to recipes. Basics like chicken, eggs, rice, pasta or vegetables work best. Or search for a dish above.
            </Empty>
          )}
          {suggestions.status === 'ready' && <RecipeGrid recipes={suggestions.recipes} onOpen={setOpen} />}
          <p className="hint">Recipes from TheMealDB, a free recipe database.</p>
        </section>
      )}

      <Sheet open={open !== null} onClose={() => setOpen(null)} title={open?.meal.name ?? 'Recipe'}>
        {open && <RecipeDetail match={open} onDone={() => setOpen(null)} />}
      </Sheet>
    </>
  )
}

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
        const total = r.meal.ingredients.length
        const pct = Math.round((r.have.length / Math.max(1, total)) * 100)
        return (
          <button key={r.meal.id} className="recipe-card" onClick={() => onOpen(r)}>
            <span className="recipe-img-wrap">
              <img className="recipe-img" src={`${r.meal.thumb}/medium`} alt="" loading="lazy" />
              {r.usesSoon.length > 0 && (
                <span className="recipe-badge">
                  <Sparkles size={12} /> Uses up {r.usesSoon[0].name}
                </span>
              )}
            </span>
            <span className="recipe-body">
              <span className="recipe-name">{r.meal.name}</span>
              <span className="recipe-meta">{[r.meal.area, r.meal.category].filter(Boolean).join(' · ')}</span>
              <span className="recipe-match">
                <span className="recipe-match-track">
                  <span style={{ width: `${pct}%` }} />
                </span>
                <span>
                  {r.missing.length === 0 ? 'You have everything!' : `Have ${r.have.length} of ${total} · ${r.missing.length} to buy`}
                </span>
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
  const { meal, have, missing } = match
  const onList = new Set(shopping.map((s) => normalizeName(s.name)))
  const toBuy = missing.filter((m) => !onList.has(normalizeName(m.name)))
  const titleCase = (s: string) => s.replace(/(^|\s)\S/g, (c) => c.toUpperCase())

  return (
    <div className="recipe-detail">
      <img className="recipe-hero" src={`${meal.thumb}/medium`} alt="" />
      <div className="recipe-tags">
        {meal.area && <span className="pill">{meal.area}</span>}
        {meal.category && <span className="pill">{meal.category}</span>}
        <span className={`pill ${missing.length ? 'pill-soon' : 'pill-good'}`}>
          {missing.length ? `${missing.length} to buy` : 'You have everything'}
        </span>
      </div>

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
        {steps(meal.instructions).map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>

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
    </div>
  )
}
