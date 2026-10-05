import { useEffect, useState } from 'react'

export type Screen = 'home' | 'list' | 'pantry' | 'spending' | 'cook'

const SCREENS: Screen[] = ['home', 'list', 'pantry', 'spending', 'cook']

// Hash routes: #/, #/list, #/pantry?filter=soon, #/spending, #/cook
function parse(hash: string) {
  const [path, query] = hash.replace(/^#\/?/, '').split('?')
  const screen = SCREENS.includes(path as Screen) ? (path as Screen) : 'home'
  return { screen, params: new URLSearchParams(query) }
}

export function useRoute() {
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const onChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return parse(hash)
}
