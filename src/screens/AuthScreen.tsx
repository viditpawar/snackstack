import { useState, type FormEvent } from 'react'
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

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

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
