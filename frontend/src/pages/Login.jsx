import { useState } from 'react'
import { ArrowUpRight, Eye, EyeOff, Glasses, LoaderCircle, MoveRight, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

const ROLE_OPTIONS = [
  { value: 'family_member', label: 'Family member' },
  { value: 'caregiver', label: 'Caregiver' },
  { value: 'visually_impaired_user', label: 'Device wearer' },
]

export default function Login() {
  const { signIn, signUp, resetPassword } = useAuth()
  const [mode, setMode] = useState('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('family_member')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  function changeMode(nextMode) {
    setMode(nextMode)
    setError('')
    setNotice('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    setSubmitting(true)

    try {
      if (mode === 'signin') {
        const { error: authError } = await signIn(email.trim(), password)
        if (authError) setError(authError.message)
        return
      }

      const { error: authError, needsConfirmation } = await signUp(
        email.trim(),
        password,
        name.trim(),
        role,
      )

      if (authError) {
        setError(authError.message)
      } else if (needsConfirmation) {
        setNotice('Check your email for a confirmation link, then sign in.')
        setMode('signin')
      } else {
        setNotice('Your account has been created.')
      }
    } catch (err) {
      setError(err?.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReset() {
    setError('')
    setNotice('')

    if (!email.trim()) {
      setError('Enter your email address first.')
      return
    }

    setSubmitting(true)
    try {
      const { error: resetError } = await resetPassword(email.trim())
      if (resetError) {
        setError(resetError.message)
      } else {
        setNotice('If an account exists for that email, a reset link will be sent.')
      }
    } catch (err) {
      setError(err?.message || 'Could not send a reset link. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-story" aria-label="Smart Glasses Monitoring System">
        <header className="brand-lockup">
          <span className="brand-mark"><Glasses size={23} strokeWidth={1.8} /></span>
          <span>
            <strong>Smart Glasses</strong>
            <small>Caregiver Monitoring System</small>
          </span>
        </header>

        <div className="story-copy">
          <p className="kicker"><span className="live-dot" /> Caregiver device monitor</p>
          <h1>Stay informed<br />about the <em>wearer.</em></h1>
          <p className="story-description">
            Check device status, location, and obstacle alerts from one place.
          </p>
          <div className="story-line">
            <span>01</span>
            <span>Useful updates, when you need them.</span>
            <MoveRight size={18} />
          </div>
        </div>

        <div className="illustration" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="lens lens-left" />
          <div className="bridge" />
          <div className="lens lens-right" />
          <span className="coordinate coordinate-a">14°35′ N</span>
          <span className="coordinate coordinate-b">121°00′ E</span>
          <span className="illustration-caption">DEVICE / UNIT 001</span>
        </div>
      </section>

      <section className="auth-panel" aria-label="Account access">
        <div className="auth-mobile-brand">
          <span className="brand-mark"><Glasses size={22} /></span>
          <strong>Smart Glasses</strong>
        </div>

        <div className="auth-form-wrap">
          <div className="form-heading">
            <p className="kicker">Caregiver Monitoring System</p>
            <h2>{mode === 'signin' ? 'Welcome back.' : 'Create an account.'}</h2>
            <p>
              {mode === 'signin'
                ? 'Sign in to check your device.'
                : 'Set up an account to get started.'}
            </p>
          </div>

          <div className="mode-switch" role="tablist" aria-label="Account access">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signin'}
              onClick={() => changeMode('signin')}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signup'}
              onClick={() => changeMode('signup')}
            >
              Create account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {mode === 'signup' && (
              <label>
                Full name
                <input
                  autoComplete="name"
                  type="text"
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name"
                />
              </label>
            )}

            <label>
              Email address
              <input
                autoComplete="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </label>

            <label>
              Password
              <span className="password-field">
                <input
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 6 characters"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
            </label>

            {mode === 'signup' && (
              <label>
                Account type
                <select value={role} onChange={(event) => setRole(event.target.value)}>
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            )}

            {mode === 'signin' && (
              <button
                type="button"
                className="forgot-link"
                onClick={handleReset}
                disabled={submitting}
              >
                Forgot password?
              </button>
            )}

            {error && <p className="form-message error-message" role="alert">{error}</p>}
            {notice && <p className="form-message success-message" role="status">{notice}</p>}

            <button className="submit-button" type="submit" disabled={submitting}>
              {submitting ? (
                <LoaderCircle size={17} className="spin" aria-label="Working" />
              ) : (
                <>
                  {mode === 'signin' ? 'Sign in' : 'Create account'}
                  <ArrowUpRight size={17} />
                </>
              )}
            </button>
          </form>

          <p className="privacy-note">
            <ShieldCheck size={16} /> Your account details are kept private.
          </p>
        </div>

        <footer className="panel-footer">
          <span>Smart Glasses Monitoring System</span>
        </footer>
      </section>
    </main>
  )
}
