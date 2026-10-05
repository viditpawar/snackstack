import { CircleCheck, Clock, ListPlus, PackageOpen, Receipt, Refrigerator, ShoppingCart, Sparkles, Trash } from 'lucide-react'
import { useStore } from '../store'
import { useSettings } from '../lib/settings'
import { daysUntil, formatMoney, greeting, monthLabel, today } from '../lib/format'
import { isLow, normalizeName, restockQuantity } from '../lib/items'
import { ExpiryPill, ItemIcon } from '../ui/bits'
import { isUseSoon } from './PantryScreen'

export default function HomeScreen() {
  const { shopping, pantry, purchases, waste, setPantryQuantity, tossPantry, addShopping, addShoppingMany } = useStore()
  const { budget } = useSettings()
  const month = today().slice(0, 7)

  const onList = new Set(shopping.map((s) => normalizeName(s.name)))
  const stocked = new Set(pantry.filter((p) => !isLow(p)).map((p) => normalizeName(p.name)))
  const useSoon = pantry
    .filter((p) => p.quantity > 0 && p.expires_on && daysUntil(p.expires_on) <= 7)
    .sort((a, b) => a.expires_on!.localeCompare(b.expires_on!))
  const urgent = pantry.filter(isUseSoon).length
  const runningLow = pantry.filter((p) => isLow(p) && !onList.has(normalizeName(p.name)) && !stocked.has(normalizeName(p.name)))
  const spent = purchases.filter((p) => p.purchased_on.startsWith(month)).reduce((s, p) => s + p.price, 0)
  const tossed = waste.filter((w) => w.logged_on.startsWith(month))
  const isNew = shopping.length === 0 && pantry.length === 0 && purchases.length === 0

  const dateline = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
  const budgetPct = budget ? Math.round((spent / budget) * 100) : null

  return (
    <>
      <header className="home-hero">
        <p className="home-hero-date">{dateline}</p>
        <h1>{greeting()}</h1>
        <p className="home-hero-sub">
          {isNew
            ? "Let's get your kitchen organised."
            : [
                shopping.length ? `${shopping.length} thing${shopping.length === 1 ? '' : 's'} to buy` : 'Nothing to buy',
                urgent ? `${urgent} to use soon` : null,
                runningLow.length ? `${runningLow.length} running low` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
        </p>
        <span className="home-hero-emoji" aria-hidden>
          🥑🥕🍋
        </span>
      </header>

      <div className="stats">
        <a href="#/list" className="stat stat-list">
          <span className="stat-icon">
            <ShoppingCart size={18} />
          </span>
          <span className="stat-value">{shopping.length}</span>
          <span className="stat-label">to buy</span>
        </a>
        <a href="#/pantry?filter=soon" className={`stat stat-pantry${urgent ? ' stat-warn' : ''}`}>
          <span className="stat-icon">
            <Clock size={18} />
          </span>
          <span className="stat-value">{urgent}</span>
          <span className="stat-label">use soon</span>
        </a>
        <a href="#/spending" className={`stat stat-spend${budgetPct !== null && budgetPct > 100 ? ' stat-danger' : budgetPct !== null && budgetPct >= 85 ? ' stat-warn' : ''}`}>
          <span className="stat-icon">
            <Receipt size={18} />
          </span>
          <span className="stat-value">{formatMoney(spent, true)}</span>
          <span className="stat-label">{budget ? `${budgetPct}% of budget` : `in ${monthLabel(month, 'short')}`}</span>
          {budget && (
            <span className="stat-meter" aria-hidden>
              <span style={{ width: `${Math.min(100, budgetPct ?? 0)}%` }} />
            </span>
          )}
        </a>
      </div>

      {isNew && (
        <section className="card welcome">
          <h2 className="card-title">
            <Sparkles size={18} /> Welcome to SnackStack
          </h2>
          <ol className="steps">
            <li>
              <a href="#/list">
                <ShoppingCart size={18} />
                <span>
                  <strong>Make a shopping list</strong>
                  <small>Type “milk, eggs, 2 kg rice”, use your voice, or scan a barcode.</small>
                </span>
              </a>
            </li>
            <li>
              <a href="#/list">
                <CircleCheck size={18} />
                <span>
                  <strong>Check off items at the store</strong>
                  <small>Then check out to log prices and fill your pantry.</small>
                </span>
              </a>
            </li>
            <li>
              <a href="#/pantry">
                <Refrigerator size={18} />
                <span>
                  <strong>Watch your pantry</strong>
                  <small>Get nudged before things expire or run low.</small>
                </span>
              </a>
            </li>
          </ol>
        </section>
      )}

      {useSoon.length > 0 && (
        <section className="card">
          <h2 className="card-title">
            <Clock size={18} /> Use soon
          </h2>
          <ul className="mini-list">
            {useSoon.slice(0, 5).map((p) => (
              <li key={p.id}>
                <span className="mini-main">
                  <ItemIcon category={p.category} />
                  <span className="item-name">{p.name}</span>
                  <ExpiryPill date={p.expires_on} />
                </span>
                <span className="row-end">
                  <button className="btn btn-sm btn-ghost" onClick={() => setPantryQuantity(p, 0)}>
                    Used up
                  </button>
                  <button className="icon-btn icon-btn-sm" onClick={() => tossPantry(p)} aria-label={`Tossed ${p.name}`} title="Tossed it">
                    <Trash size={16} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
          {useSoon.length > 5 && (
            <a href="#/pantry?filter=soon" className="card-link">
              See all {useSoon.length}
            </a>
          )}
        </section>
      )}

      {runningLow.length > 0 && (
        <section className="card">
          <h2 className="card-title">
            <PackageOpen size={18} /> Running low
          </h2>
          <ul className="mini-list">
            {runningLow.slice(0, 5).map((p) => (
              <li key={p.id}>
                <span className="mini-main">
                  <ItemIcon category={p.category} />
                  <span className="item-name">{p.name}</span>
                  <span className="muted">{p.quantity === 0 ? 'Ran out' : `${p.quantity} left · keep ${p.min_quantity}`}</span>
                </span>
                <button className="btn btn-sm btn-ghost" onClick={() => addShopping({ name: p.name, quantity: restockQuantity(p), unit: p.unit, category: p.category })}>
                  <ListPlus size={16} /> Add
                </button>
              </li>
            ))}
          </ul>
          {runningLow.length > 1 && (
            <button
              className="card-link"
              onClick={() => addShoppingMany(runningLow.map((p) => ({ name: p.name, quantity: restockQuantity(p), unit: p.unit, category: p.category })))}
            >
              Add all {runningLow.length} to your list
            </button>
          )}
        </section>
      )}

      {tossed.length > 0 && (
        <a href="#/spending" className="card waste-note">
          <Trash size={18} />
          <span>
            {tossed.length} item{tossed.length === 1 ? '' : 's'} tossed this month
            {tossed.some((w) => w.cost) && <> · {formatMoney(tossed.reduce((s, w) => s + (w.cost ?? 0), 0))}</>}
          </span>
        </a>
      )}

      {!isNew && useSoon.length === 0 && runningLow.length === 0 && (
        <section className="card calm">
          <CircleCheck size={22} />
          <div>
            <strong>All good in the kitchen</strong>
            <p>Nothing's about to expire and nothing is running low.</p>
          </div>
        </section>
      )}
    </>
  )
}
