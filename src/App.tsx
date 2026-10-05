import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import Auth from './Auth'
import ShoppingList from './ShoppingList'
import Pantry from './Pantry'
import Spending from './Spending'

const TABS = [
  { id: 'shopping', label: 'Shopping list' },
  { id: 'pantry', label: 'Pantry' },
  { id: 'spending', label: 'Spending' },
] as const

type Tab = (typeof TABS)[number]['id']

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('shopping')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (loading) return null
  if (!session) return <Auth />

  return (
    <div className="app">
      <header>
        <h1>SnackStack</h1>
        <button className="link" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </header>
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
      <main>
        {tab === 'shopping' && <ShoppingList />}
        {tab === 'pantry' && <Pantry />}
        {tab === 'spending' && <Spending />}
      </main>
    </div>
  )
}
