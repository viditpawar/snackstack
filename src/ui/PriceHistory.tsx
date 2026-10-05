import { TrendingDown } from 'lucide-react'
import { useStore } from '../store'
import { formatDate, formatMoney, formatQty, relativeDay } from '../lib/format'
import { priceStats } from '../lib/items'

// What you've paid for an item over time, and where it was cheapest.
export function PriceHistory({ name }: { name: string }) {
  const { purchases } = useStore()
  const stats = priceStats(purchases, name)
  if (!stats) return <p className="muted">You haven't logged a price for {name} yet.</p>

  return (
    <div className="price-history">
      <div className="price-stats">
        <div>
          <small>Last paid</small>
          <strong>{formatMoney(stats.last.price)}</strong>
        </div>
        <div>
          <small>Average</small>
          <strong>{formatMoney(stats.average)}</strong>
        </div>
        <div>
          <small>Lowest</small>
          <strong>{formatMoney(stats.cheapest.price)}</strong>
        </div>
      </div>
      {stats.cheapest.store && stats.history.length > 1 && (
        <p className="price-tip">
          <TrendingDown size={16} /> Cheapest at <strong>{stats.cheapest.store}</strong> on {formatDate(stats.cheapest.purchased_on)}
        </p>
      )}
      <ul className="mini-list">
        {stats.history.slice(0, 8).map((p) => (
          <li key={p.id}>
            <span className="mini-main">
              <span>{relativeDay(p.purchased_on)}</span>
              <span className="muted">{[p.store, formatQty(p.quantity, p.unit)].filter(Boolean).join(' · ')}</span>
            </span>
            <strong className="tabular">{formatMoney(p.price)}</strong>
          </li>
        ))}
      </ul>
      <p className="hint">
        Bought {stats.history.length} time{stats.history.length === 1 ? '' : 's'} · {formatMoney(stats.total)} total
      </p>
    </div>
  )
}
