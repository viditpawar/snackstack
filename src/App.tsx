import { useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { House, LogOut, Monitor, Moon, Refrigerator, RotateCw, ShoppingCart, Sun, WifiOff, Wallet } from 'lucide-react'
import { supabase } from './supabase'
import { StoreProvider, useStore } from './store'
import { useRoute, type Screen } from './lib/route'
import { getTheme, setTheme, type Theme } from './lib/theme'
import { ToastProvider } from './ui/Toast'
import { Empty, Logo, Skeleton } from './ui/bits'
import AuthScreen, { NewPasswordScreen } from './screens/AuthScreen'
import HomeScreen from './screens/HomeScreen'
import ShoppingScreen from './screens/ShoppingScreen'
import PantryScreen, { isUseSoon, type PantryFilter } from './screens/PantryScreen'
import SpendingScreen from './screens/SpendingScreen'

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
        <StoreProvider>
          <Shell email={session.user.email ?? ''} />
        </StoreProvider>
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

function Shell({ email }: { email: string }) {
  const { screen, params } = useRoute()
  const { status, shopping, pantry, refresh } = useStore()

  useEffect(() => window.scrollTo(0, 0), [screen])

  const badges: Partial<Record<Screen, number>> = {
    list: shopping.length,
    pantry: pantry.filter(isUseSoon).length,
  }

  let content
  if (status === 'loading') content = <Skeleton />
  else if (status === 'error')
    content = (
      <Empty icon={<WifiOff size={28} />} title="Couldn't load your data">
        <p>Check your connection and try again.</p>
        <button className="btn btn-primary" onClick={refresh}>
          <RotateCw size={18} /> Try again
        </button>
      </Empty>
    )
  else if (screen === 'list') content = <ShoppingScreen />
  else if (screen === 'pantry') {
    const filter = params.get('filter')
    content = <PantryScreen initialFilter={filter === 'soon' || filter === 'out' ? (filter as PantryFilter) : 'all'} />
  }
  else if (screen === 'spending') content = <SpendingScreen />
  else content = <HomeScreen />

  return (
    <div className="shell">
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
          <button className="menu-item" role="menuitem" onClick={() => supabase.auth.signOut()}>
            <LogOut size={18} /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}
