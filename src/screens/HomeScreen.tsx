import { CircleCheck, Clock, ListPlus, PackageOpen, Receipt, Refrigerator, ShoppingCart, Sparkles } from 'lucide-react'
import { useStore } from '../store'
import { daysUntil, formatMoney, greeting, monthLabel, today } from '../lib/format'
import { normalizeName } from '../lib/items'
import { ExpiryPill, PageHead } from '../ui/bits'
import { isUseSoon } from './PantryScreen'

export default function HomeScreen() {
  const { shopping, pantry, purchases, setPantryQuantity, addShopping } = useStore()
  const month = today().slice(0, 7)

  const onList = new Set(shopping.map((s) => normalizeName(s.name)))
  const stocked = new Set(pantry.filter((p) => p.quantity > 0).map((p) => normalizeName(p.name)))
  const useSoon = pantry
    .filter((p) => p.quantity > 0 && p.expires_on && daysUntil(p.expires_on) <= 7)
    .sort((a, b) => a.expires_on!.localeCompare(b.expires_on!))
  const urgent = pantry.filter(isUseSoon).length
  const ranOut = pantry.filter((p) => p.quantity === 0 && !onList.has(normalizeName(p.name)) && !stocked.has(normalizeName(p.name)))
  const spent = purchases.filter((p) => p.purchased_on.startsWith(month)).reduce((s, p) => s + p.price, 0)
  const isNew = shopping.length === 0 && pantry.length === 0 && purchases.length === 0

  const dateline = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <>
      <PageHead title={greeting()} subtitle={dateline} />

      <div className="stats">
        <a href="#/list" className="stat">
          <span className="stat-icon">
            <ShoppingCart size={18} />
          </span>
          <span className="stat-value">{shopping.length}</span>
          <span className="stat-label">to buy</span>
        </a>
        <a href="#/pantry?filter=soon" className={`stat${urgent ? ' stat-warn' : ''}`}>
          <span className="stat-icon">
            <Clock size={18} />
          </span>
          <span className="stat-value">{urgent}</span>
          <span className="stat-label">use soon</span>
        </a>
        <a href="#/spending" className="stat">
          <span className="stat-icon">
            <Receipt size={18} />
          </span>
          <span className="stat-value">{formatMoney(spent, true)}</span>
          <span className="stat-label">in {monthLabel(month, 'short')}</span>
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
                  <small>Type things like “2 kg rice”.</small>
                </span>
              </a>
            </li>
            <li>
              <a href="#/list">
                <CircleCheck size={18} />
                <span>
                  <strong>Check off items at the store</strong>
                  <small>Then check out to log prices.</small>
                </span>
              </a>
            </li>
            <li>
              <a href="#/pantry">
                <Refrigerator size={18} />
                <span>
                  <strong>Watch your pantry</strong>
                  <small>Get nudged before things expire.</small>
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
                  <span className="item-name">{p.name}</span>
                  <ExpiryPill date={p.expires_on} />
                </span>
                <button className="btn btn-sm btn-ghost" onClick={() => setPantryQuantity(p, 0)}>
                  Used up
                </button>
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

      {ranOut.length > 0 && (
        <section className="card">
          <h2 className="card-title">
            <PackageOpen size={18} /> Ran out
          </h2>
          <ul className="mini-list">
            {ranOut.slice(0, 5).map((p) => (
              <li key={p.id}>
                <span className="mini-main">
                  <span className="item-name">{p.name}</span>
                </span>
                <button className="btn btn-sm btn-ghost" onClick={() => addShopping({ name: p.name, quantity: 1, unit: p.unit })}>
                  <ListPlus size={16} /> Add to list
                </button>
              </li>
            ))}
          </ul>
          {ranOut.length > 1 && (
            <button className="card-link" onClick={() => ranOut.forEach((p) => addShopping({ name: p.name, quantity: 1, unit: p.unit }))}>
              Add all {ranOut.length} to your list
            </button>
          )}
        </section>
      )}

      {!isNew && useSoon.length === 0 && ranOut.length === 0 && (
        <section className="card calm">
          <CircleCheck size={22} />
          <div>
            <strong>All good in the kitchen</strong>
            <p>Nothing's about to expire and nothing has run out.</p>
          </div>
        </section>
      )}
    </>
  )
}
