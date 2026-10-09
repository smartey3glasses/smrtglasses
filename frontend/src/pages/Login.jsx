import { useState } from 'react'
import { ArrowUpRight, Eye, EyeOff, Glasses, LoaderCircle, MoveRight, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

const ROLE_OPTIONS = [
  { value: 'family_member', label: 'Family member' },
  { value: 'caregiver', label: 'Caregiver' },
  { value: 'visually_impaired_user', label: 'Device wearer' }
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

  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setNotice(''); setSubmitting(true)
    try {
      if (mode === 'signin') {
        const { error } = await signIn(email, password)
        if (error) setError(error.message)
      } else {
        const { error, needsConfirmation } = await signUp(email, password, name, role)
        if (error) setError(error.message)
        else if (needsConfirmation) {
          setNotice('Your account is registered. Confirm your email using the link we sent, then come back to sign in.')
          setMode('signin')
        } else setNotice('Account created. You’re signed in and ready to go.')
      }
    } catch (err) { setError(err.message || 'Something went wrong. Please try again.') }
    finally { setSubmitting(false) }
  }

  async function handleReset() {
    setError('')
    setNotice('')
    if (!email.trim()) {
      setError('Enter your email address first, then choose “Forgot password?”.')
      return
    }
    setSubmitting(true)
    try {
      const { error } = await resetPassword(email)
      if (error) setError(error.message)
      else setNotice('If an account exists for this email, a password reset link is on its way.')
    } catch (err) {
      setError(err.message || 'Unable to send a reset link. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return <main className="auth-shell">
    <section className="auth-story" aria-label="Smart Glasses Monitoring System">
      <header className="brand-lockup"><span className="brand-mark"><Glasses size={23} strokeWidth={1.8}/></span><span><strong>Smart Glasses</strong><small>CAREGIVER MONITORING SYSTEM</small></span></header>
      <div className="story-copy"><p className="kicker"><span className="live-dot"/> Caregiver device monitor</p><h1>Stay informed<br/>about the <em>wearer.</em></h1><p className="story-description">A monitoring system for caregivers to review obstacle alerts, wearer location, and smart-glasses status.</p><div className="story-line"><span>01</span><span>Awareness, without getting in the way.</span><MoveRight size={18}/></div></div>
      <div className="illustration" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="lens lens-left"/><div className="bridge"/><div className="lens lens-right"/><span className="coordinate coordinate-a">14°35′ N</span><span className="coordinate coordinate-b">121°00′ E</span><span className="illustration-caption">DEVICE / UNIT 001</span></div>
    </section>
    <section className="auth-panel"><div className="auth-mobile-brand"><span className="brand-mark"><Glasses size={22}/></span><strong>Smart Glasses</strong></div><div className="auth-form-wrap">
      <div className="form-heading"><p className="kicker">CAREGIVER MONITORING SYSTEM</p><h2>{mode === 'signin' ? 'Welcome back.' : 'Let’s get started.'}</h2><p>{mode === 'signin' ? 'Sign in to see what’s happening with your device.' : 'Create an account to monitor your connected smart glasses.'}</p></div>
      <div className="mode-switch" role="tablist" aria-label="Account access"><button type="button" role="tab" aria-selected={mode === 'signin'} onClick={() => {setMode('signin');setError('');setNotice('')}}>Sign in</button><button type="button" role="tab" aria-selected={mode === 'signup'} onClick={() => {setMode('signup');setError('');setNotice('')}}>Create account</button></div>
      <form onSubmit={handleSubmit} className="auth-form">
        {mode === 'signup' && <label>Full name<input autoComplete="name" type="text" required value={name} onChange={e=>setName(e.target.value)} placeholder="How should we call you?"/></label>}
        <label>Email address<input autoComplete="email" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>
        <label>Password<span className="password-field"><input autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} type={showPassword?'text':'password'} required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 6 characters"/><button type="button" className="password-toggle" onClick={()=>setShowPassword(!showPassword)} aria-label={showPassword?'Hide password':'Show password'}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></span></label>
        {mode === 'signup' && <label>I’m here as<select value={role} onChange={e=>setRole(e.target.value)}>{ROLE_OPTIONS.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>}
        {mode === 'signin' && <button type="button" className="forgot-link" onClick={handleReset} disabled={submitting}>Forgot password?</button>}
        {error && <p className="form-message error-message" role="alert">{error}</p>}{notice && <p className="form-message success-message" role="status">{notice}</p>}
        <button className="submit-button" type="submit" disabled={submitting}>{submitting?<LoaderCircle size={17} className="spin"/>: <>{mode==='signin'?'Sign in to the monitoring system':'Create my account'} <ArrowUpRight size={17}/></>}</button>
      </form>
      <p className="privacy-note"><ShieldCheck size={16}/> Your account and device information are private.</p>
    </div><footer className="panel-footer"><span> meow:3 </span></section>
  </main>
}
