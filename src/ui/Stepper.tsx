import { Minus, Plus } from 'lucide-react'
import { round } from '../lib/format'

type Props = {
  value: number
  onChange: (value: number) => void
  label: string
  unit?: string | null
  min?: number
  editable?: boolean
}

export function Stepper({ value, onChange, label, unit, min = 0, editable }: Props) {
  const canDecrease = round(value - 1) >= min
  return (
    <div className="stepper">
      <button type="button" className="stepper-btn" onClick={() => onChange(round(value - 1))} disabled={!canDecrease} aria-label={`One less ${label}`}>
        <Minus size={16} />
      </button>
      {editable ? (
        <input
          className="stepper-input"
          type="number"
          inputMode="decimal"
          min={min}
          step="any"
          value={Number.isFinite(value) ? value : ''}
          onChange={(e) => onChange(e.target.value === '' ? NaN : Number(e.target.value))}
          aria-label={`${label} quantity`}
        />
      ) : (
        <span className="stepper-value">
          {value}
          {unit && <small>{unit}</small>}
        </span>
      )}
      <button type="button" className="stepper-btn" onClick={() => onChange(round((Number.isFinite(value) ? value : 0) + 1))} aria-label={`One more ${label}`}>
        <Plus size={16} />
      </button>
    </div>
  )
}
