import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Download, House, Keyboard, LogOut, Monitor, Moon, Refrigerator, RotateCw, Settings as SettingsIcon, ShoppingCart, Sun, WifiOff, Wallet } from 'lucide-react'
import { supabase } from './supabase'
import { StoreProvider, useStore } from './store'
import { useRoute, type Screen } from './lib/route'
import { getTheme, setTheme, type Theme } from './lib/theme'
import { CURRENCIES, SettingsProvider, useSettings } from './lib/settings'
import { currencySymbol } from './lib/format'
import { downloadCSV, useOnline } from './lib/device'
import { ToastProvider, useToast } from './ui/Toast'
import { Sheet } from './ui/Sheet'
import { Empty, Field, Logo, Skeleton } from './ui/bits'
import AuthScreen, { NewPasswordScreen } from './screens/AuthScreen'
import HomeScreen from './screens/HomeScreen'
import ShoppingScreen from './screens/ShoppingScreen'
import PantryScreen, { isUseSoon, type PantryFilter } from './screens/PantryScreen'
import SpendingScreen from './screens/SpendingScreen'
import CookScreen from './screens/CookScreen'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [recovering, setRecovering] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  if (!ready) return null

  return (
    <ToastProvider>
      {!session ? (
        <AuthScreen />
      ) : recovering ? (
        <NewPasswordScreen onDone={() => setRecovering(false)} />
      ) : (
        <SettingsProvider user={session.user}>
          <StoreProvider>
            <Shell email={session.user.email ?? ''} />
          </StoreProvider>
        </SettingsProvider>
      )}
    </ToastProvider>
  )
}

const NAV: { screen: Screen; href: string; label: string; Icon: typeof House }[] = [
  { screen: 'home', href: '#/', label: 'Home', Icon: House },
  { screen: 'list', href: '#/list', label: 'List', Icon: ShoppingCart },
  { screen: 'pantry', href: '#/pantry', label: 'Pantry', Icon: Refrigerator },
  { screen: 'spending', href: '#/spending', label: 'Spending', Icon: Wallet },
]

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
}

function Shell({ email }: { email: string }) {
  const { screen, params } = useRoute()
  const { status, loadError, shopping, pantry, refresh } = useStore()
  const online = useOnline()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [screen])

  // Keyboard shortcuts: 1-4 switch tabs, / focuses the search or add box, n adds something new.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target) || document.querySelector('dialog[open]')) return
      const tab = NAV[Number(e.key) - 1]
      if (tab) window.location.hash = tab.href
      else if (e.key === '/') {
        e.preventDefault()
        document.querySelector<HTMLElement>('[data-shortcut="focus"]')?.focus()
      } else if (e.key === 'n') document.querySelector<HTMLElement>('[data-shortcut="new"]')?.click()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const badges: Partial<Record<Screen, number>> = {
    list: shopping.length,
    pantry: pantry.filter(isUseSoon).length,
  }

  let content
  if (status === 'loading') content = <Skeleton />
  else if (status === 'error') {
    const needsUpdate = /does not exist|could not find|schema cache/i.test(loadError ?? '')
    content = needsUpdate ? (
      <Empty icon={<RotateCw size={28} />} title="Your database needs a quick update">
        <p>
          Open Supabase → SQL Editor, run the newest file in <code>supabase/migrations/</code>, then reload this page.
        </p>
        <button className="btn btn-primary" onClick={refresh}>
          <RotateCw size={18} /> I've run it, try again
        </button>
      </Empty>
    ) : (
      <Empty icon={<WifiOff size={28} />} title="Couldn't load your data">
        <p>Check your connection and try again.</p>
        <button className="btn btn-primary" onClick={refresh}>
          <RotateCw size={18} /> Try again
        </button>
      </Empty>
    )
  } else if (screen === 'list') content = <ShoppingScreen />
  else if (screen === 'pantry') {
    const filter = params.get('filter')
    content = <PantryScreen initialFilter={filter === 'soon' || filter === 'low' ? (filter as PantryFilter) : 'all'} />
  } else if (screen === 'spending') content = <SpendingScreen />
  else if (screen === 'cook') content = <CookScreen />
  else content = <HomeScreen />

  return (
    <div className="shell" data-screen={screen}>
      {!online && (
        <div className="offline-banner" role="status">
          <WifiOff size={16} /> You're offline. Changes won't save until you reconnect.
        </div>
      )}
      <header className="topbar">
        <a href="#/" className="brand">
          <Logo />
          <span>SnackStack</span>
        </a>
        <nav className="nav" aria-label="Main">
          {NAV.map(({ screen: s, href, label, Icon }) => (
            <a key={s} href={href} className={`nav-link${screen === s ? ' nav-on' : ''}`} aria-current={screen === s ? 'page' : undefined}>
              <span className="nav-icon">
                <Icon size={22} />
              </span>
              <span className="nav-label">{label}</span>
              {!!badges[s] && <span className={`nav-badge${s === 'pantry' ? ' nav-badge-warn' : ''}`}>{badges[s]}</span>}
            </a>
          ))}
        </nav>
        <AccountMenu email={email} />
      </header>
      <main className="page" key={screen}>
        {content}
      </main>
    </div>
  )
}

const THEMES: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: 'system', label: 'Auto', Icon: Monitor },
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
]

function AccountMenu({ email }: { email: string }) {
  const [open, setOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [theme, setThemeState] = useState(getTheme)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="account" ref={ref}>
      <button className="avatar" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu" aria-label="Account and settings">
        {(email[0] ?? '?').toUpperCase()}
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu-email">
            <small>Signed in as</small>
            {email}
          </div>
          <div className="menu-section">
            <small>Theme</small>
            <div className="segmented" role="radiogroup" aria-label="Theme">
              {THEMES.map(({ value, label, Icon }) => (
                <button
                  key={value}
                  role="radio"
                  aria-checked={theme === value}
                  onClick={() => {
                    setTheme(value)
                    setThemeState(value)
                  }}
                >
                  <Icon size={16} /> {label}
                </button>
              ))}
            </div>
          </div>
          <button
            className="menu-item menu-item-plain"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              setSettingsOpen(true)
            }}
          >
            <SettingsIcon size={18} /> Settings
          </button>
          <button className="menu-item" role="menuitem" onClick={() => supabase.auth.signOut()}>
            <LogOut size={18} /> Sign out
          </button>
        </div>
      )}
      <Sheet open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Settings">
        <SettingsForm onDone={() => setSettingsOpen(false)} />
      </Sheet>
    </div>
  )
}

function SettingsForm({ onDone }: { onDone: () => void }) {
  const settings = useSettings()
  const { pantry, purchases, waste } = useStore()
  const toast = useToast()
  const [currency, setCurrency] = useState(settings.currency)
  const [budget, setBudget] = useState(settings.budget ? String(settings.budget) : '')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    const error = await settings.save({ currency, budget: Number(budget) > 0 ? Number(budget) : null })
    setBusy(false)
    if (error) toast(`Couldn't save settings (${error})`, { tone: 'error' })
    else {
      toast('Settings saved')
      onDone()
    }
  }

  const stamp = new Date().toISOString().slice(0, 10)

  return (
    <form className="form" onSubmit={submit}>
      <Field label="Currency">
        <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
          {CURRENCIES.map(([code, name]) => (
            <option key={code} value={code}>
              {code} · {name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Monthly grocery budget">
        <span className="money">
          <span aria-hidden>{currencySymbol()}</span>
          <input type="number" inputMode="decimal" min="0" step="1" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="Optional, e.g. 400" />
        </span>
      </Field>
      <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
        Save settings
      </button>

      <div className="settings-section">
        <h3>
          <Download size={16} /> Export your data
        </h3>
        <div className="chips">
          <button
            type="button"
            className="chip"
            onClick={() => downloadCSV(`snackstack-purchases-${stamp}.csv`, ['purchased_on', 'name', 'quantity', 'unit', 'price', 'store', 'category'], purchases)}
          >
            Purchases ({purchases.length})
          </button>
          <button
            type="button"
            className="chip"
            onClick={() => downloadCSV(`snackstack-pantry-${stamp}.csv`, ['name', 'quantity', 'unit', 'category', 'location', 'min_quantity', 'expires_on'], pantry)}
          >
            Pantry ({pantry.length})
          </button>
          <button type="button" className="chip" onClick={() => downloadCSV(`snackstack-waste-${stamp}.csv`, ['logged_on', 'name', 'quantity', 'unit', 'cost'], waste)}>
            Food waste ({waste.length})
          </button>
        </div>
        <p className="hint hint-left">CSV files open in Excel, Google Sheets or Numbers.</p>
      </div>

      <div className="settings-section">
        <h3>
          <Keyboard size={16} /> Keyboard shortcuts
        </h3>
        <dl className="shortcuts">
          <dt>
            <kbd>1</kbd>–<kbd>4</kbd>
          </dt>
          <dd>Switch tabs</dd>
          <dt>
            <kbd>/</kbd>
          </dt>
          <dd>Jump to the add or search box</dd>
          <dt>
            <kbd>n</kbd>
          </dt>
          <dd>Add a pantry item or purchase</dd>
          <dt>
            <kbd>Esc</kbd>
          </dt>
          <dd>Close a panel</dd>
        </dl>
      </div>
    </form>
  )
}
