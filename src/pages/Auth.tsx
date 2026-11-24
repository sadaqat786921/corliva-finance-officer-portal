import { useState, ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { useStore } from '../data/store'
import { AlertBanner, Button, Field, Input, Toasts } from '../components/ui'

function AuthFrame({ children, side }: { children: ReactNode; side?: ReactNode }) {
  return (
    <div className="auth">
      <div className="auth-art">
        <img src="./images/corliva-logo-white.svg" alt="CORLIVA" style={{ height: 44, alignSelf: 'flex-start' }} />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 440 }}>
          {side ?? <>
            <div className="t-display" style={{ fontSize: 34 }}>Billing and pay, clearly organised.</div>
            <p style={{ opacity: .9, fontSize: 16, marginTop: 12 }}>Approved visits become invoices, payments are matched and timesheets go to payroll — with every change kept.</p>
          </>}
        </div>
        <img className="big-c" src="./images/corliva-symbol-light.svg" alt="" aria-hidden />
        <div className="t-caption" style={{ opacity: .8, position: 'relative' }}>© 2026 CORLIVA · Home Care Platform</div>
      </div>
      <div className="auth-panel">{children}</div>
      <Toasts />
    </div>
  )
}

export const DEMO_CODE = '246810'

export function Login() {
  const s = useStore()
  const nav = useNavigate()
  const [step, setStep] = useState<'details' | 'code'>('details')
  const [email, setEmail] = useState('omar@royalityhomecare.com')
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setErr('Please enter a valid email address.')
    if (!pw) return setErr('Please enter your password.')
    setErr(''); setStep('code')
  }
  const verify = (e: React.FormEvent) => {
    e.preventDefault()
    if (code.trim() !== DEMO_CODE) return setErr('That code isn’t right. Check the 6 numbers and try again.')
    setErr(''); s.signIn(); nav('/')
  }
  if (step === 'code') return (
    <AuthFrame>
      <form className="auth-card" onSubmit={verify} noValidate>
        <button type="button" className="link-btn row" style={{ gap: 6, alignSelf: 'flex-start' }} onClick={() => { setStep('details'); setErr(''); setCode('') }}><ArrowLeft size={16} />Back</button>
        <div><h1 className="t-h1" style={{ fontSize: 26 }}>Enter your security code</h1><p className="t-secondary" style={{ margin: '6px 0 0' }}>We sent a 6-digit code to <b>{email.trim()}</b>.</p></div>
        {err && <AlertBanner tone="danger" title="Code not accepted">{err}</AlertBanner>}
        <Field label="Security code"><Input icon={Lock} inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} placeholder="6 numbers" /></Field>
        <button className="btn btn-primary" type="submit" style={{ height: 44 }}>Verify and sign in</button>
        <p className="t-caption t-muted" style={{ textAlign: 'center', margin: 0 }}>Demo code: <b>{DEMO_CODE}</b></p>
      </form>
    </AuthFrame>
  )
  return (
    <AuthFrame>
      <form className="auth-card" onSubmit={submit} noValidate>
        <div><h1 className="t-h1" style={{ fontSize: 26 }}>Welcome back</h1><p className="t-secondary" style={{ margin: '6px 0 0' }}>Sign in to your Finance Officer workspace at {s.agency.name}.</p></div>
        {err && <AlertBanner tone="danger" title="We couldn’t sign you in">{err}</AlertBanner>}
        <Field label="Email address"><Input icon={Mail} type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></Field>
        <Field label="Password">
          <div className="control"><Lock /><input type={show ? 'text' : 'password'} autoComplete="current-password" value={pw} onChange={e => setPw(e.target.value)} placeholder="Your password" />
            <button type="button" className="link-btn" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow(!show)} style={{ color: 'var(--text-muted)' }}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
        </Field>
        <div className="row between"><label className="check"><input type="checkbox" defaultChecked />Keep me signed in</label><Link to="/forgot" className="t-small t-medium">Forgot password?</Link></div>
        <button className="btn btn-primary" type="submit" style={{ height: 44 }}>Sign in</button>
        <p className="t-caption t-muted" style={{ textAlign: 'center', margin: 0 }}>Demo: any email and password, then security code <b>{DEMO_CODE}</b>.</p>
      </form>
    </AuthFrame>
  )
}

export function Forgot() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState('')
  return (
    <AuthFrame>
      <div className="auth-card">
        <Link to="/login" className="row t-small t-medium" style={{ gap: 6 }}><ArrowLeft size={16} />Back to sign in</Link>
        {sent ? <>
          <div className="stat-icon tone-success" style={{ width: 48, height: 48, borderRadius: '50%' }}><CheckCircle2 /></div>
          <h1 className="t-h1">Check your email</h1>
          <p className="t-secondary" style={{ margin: 0 }}>If <b>{email}</b> has a CORLIVA account, we’ve sent a link to choose a new password. The link works for 1 hour.</p>
          <Button variant="secondary" onClick={() => setSent(false)}>Use a different email</Button>
        </> : <form className="col" style={{ gap: 16 }} onSubmit={e => { e.preventDefault(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setErr('Please enter a valid email address.'); return } setSent(true) }} noValidate>
          <h1 className="t-h1">Reset your password</h1>
          <p className="t-secondary" style={{ margin: 0 }}>Enter the email you use for CORLIVA. We’ll send you a link to choose a new password.</p>
          <Field label="Email address" error={err}><Input icon={Mail} type="email" value={email} onChange={e => { setEmail(e.target.value); setErr('') }} error={!!err} autoFocus /></Field>
          <button className="btn btn-primary" type="submit" style={{ height: 44 }}>Send reset link</button>
        </form>}
      </div>
    </AuthFrame>
  )
}
