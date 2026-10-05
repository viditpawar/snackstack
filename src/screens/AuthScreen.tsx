import { useEffect, useState, type FormEvent } from 'react'
import { Clock, Eye, EyeOff, Loader2, ShoppingCart, Wallet } from 'lucide-react'
import { supabase } from '../supabase'
import { Field, Logo } from '../ui/bits'

type Mode = 'signin' | 'signup' | 'reset'

function friendly(message: string): string {
  if (/invalid login credentials/i.test(message)) return "That email and password don't match."
  if (/email not confirmed/i.test(message)) return 'Confirm your email first. Check your inbox for the link.'
  if (/already registered/i.test(message)) return 'There’s already an account with that email. Try signing in.'
  return message
}

// Google's multicolour "G" mark, as their sign-in button guidelines ask for.
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  // If Google sign-in failed, Supabase sends you back with the reason in the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1) || window.location.search.slice(1))
    const description = params.get('error_description')
    if (description) {
      setError(/provider is not enabled/i.test(description) ? "Google sign-in isn't set up yet. Use email and password for now." : description.replace(/\+/g, ' '))
      history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  async function signInWithGoogle() {
    setError(null)
    setBusy(true)
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
    // On success the browser leaves for Google, so we only get here on failure.
    if (error) {
      setError(friendly(error.message))
      setBusy(false)
    }
  }

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setMessage(null)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setMessage(null)
    const redirectTo = window.location.origin
    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(friendly(error.message))
    } else if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } })
      if (error) setError(friendly(error.message))
      else if (!data.session) setMessage(`Almost there. We sent a confirmation link to ${email}.`)
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
      if (error) setError(friendly(error.message))
      else setMessage(`If there's an account for ${email}, a reset link is on its way.`)
    }
    setBusy(false)
  }

  const submitLabel = mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="auth-brand">
          <Logo size={52} />
          <h1>SnackStack</h1>
          <p>Your groceries, pantry and spending in one place.</p>
        </div>

        {mode === 'reset' ? (
          <p className="auth-note">Enter your email and we'll send you a link to choose a new password.</p>
        ) : (
          <div className="segmented segmented-full" role="tablist">
            <button role="tab" aria-selected={mode === 'signin'} onClick={() => switchMode('signin')}>
              Sign in
            </button>
            <button role="tab" aria-selected={mode === 'signup'} onClick={() => switchMode('signup')}>
              Create account
            </button>
          </div>
        )}

        {mode !== 'reset' && (
          <>
            <button type="button" className="btn btn-google btn-block btn-lg" onClick={signInWithGoogle} disabled={busy}>
              <GoogleIcon /> Continue with Google
            </button>
            <div className="divider">
              <span>or with email</span>
            </div>
          </>
        )}

        <form className="form" onSubmit={submit}>
          <Field label="Email">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="you@example.com" />
          </Field>
          {mode !== 'reset' && (
            <Field label="Password">
              <span className="input-with-btn">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  placeholder={mode === 'signup' ? 'At least 6 characters' : ''}
                />
                <button type="button" className="icon-btn" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </Field>
          )}
          {error && <p className="alert alert-error">{error}</p>}
          {message && <p className="alert alert-ok">{message}</p>}
          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy}>
            {busy && <Loader2 size={18} className="spin" />}
            {submitLabel}
          </button>
        </form>

        {mode === 'signin' && (
          <button className="link-btn" onClick={() => switchMode('reset')}>
            Forgot your password?
          </button>
        )}
        {mode === 'reset' && (
          <button className="link-btn" onClick={() => switchMode('signin')}>
            Back to sign in
          </button>
        )}
      </div>

      <ul className="auth-features">
        <li>
          <ShoppingCart size={18} /> Smart shopping list
        </li>
        <li>
          <Clock size={18} /> Expiry reminders
        </li>
        <li>
          <Wallet size={18} /> Spending by month
        </li>
      </ul>
    </div>
  )
}

export function NewPasswordScreen({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) setError(error.message)
    else onDone()
  }

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="auth-brand">
          <Logo size={52} />
          <h1>Choose a new password</h1>
        </div>
        <form className="form" onSubmit={submit}>
          <Field label="New password">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
          </Field>
          {error && <p className="alert alert-error">{error}</p>}
          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy}>
            {busy && <Loader2 size={18} className="spin" />}
            Save password
          </button>
        </form>
      </div>
    </div>
  )
}
