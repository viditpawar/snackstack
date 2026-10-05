import { createContext, useContext, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { setCurrencyCode } from './format'

// Settings live in the user's Supabase profile metadata, so they follow you across devices.

export type Settings = { currency: string; budget: number | null }

export const CURRENCIES = [
  ['USD', 'US dollar'],
  ['INR', 'Indian rupee'],
  ['EUR', 'Euro'],
  ['GBP', 'British pound'],
  ['CAD', 'Canadian dollar'],
  ['AUD', 'Australian dollar'],
  ['MXN', 'Mexican peso'],
  ['JPY', 'Japanese yen'],
  ['SGD', 'Singapore dollar'],
  ['AED', 'UAE dirham'],
] as const

type SettingsValue = Settings & { save: (changes: Partial<Settings>) => Promise<string | null> }

const SettingsContext = createContext<SettingsValue | null>(null)

export function SettingsProvider({ user, children }: { user: User; children: ReactNode }) {
  const meta = user.user_metadata ?? {}
  const settings: Settings = {
    currency: typeof meta.currency === 'string' ? meta.currency : 'USD',
    budget: typeof meta.budget === 'number' && meta.budget > 0 ? meta.budget : null,
  }
  setCurrencyCode(settings.currency)

  async function save(changes: Partial<Settings>) {
    const { error } = await supabase.auth.updateUser({ data: changes })
    return error?.message ?? null
  }

  return <SettingsContext.Provider value={{ ...settings, save }}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsValue {
  const value = useContext(SettingsContext)
  if (!value) throw new Error('useSettings must be used inside <SettingsProvider>')
  return value
}
