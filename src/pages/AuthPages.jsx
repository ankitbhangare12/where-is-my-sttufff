import { useState } from 'react'
import { ArrowLeft, ArrowRight, LockKeyhole, Mail } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import Brand from '../components/Brand.jsx'
import { supabase } from '../lib/supabase.js'

function AuthShell({ title, description, children, footer }) {
  return <main className="simple-auth">
    <header className="simple-auth-header"><Brand /><Link to="/" className="simple-auth-back"><ArrowLeft size={15} />Home</Link></header>
    <section className="simple-auth-card"><span className="simple-eyebrow">WHERE IS MY STUFF?</span><h1>{title}</h1><p>{description}</p>{children}<div className="simple-auth-footer">{footer}</div></section>
  </main>
}

function SupabaseNotice({ configured }) {
  return configured ? null : <div className="auth-setup-hint" role="status">Add your Supabase URL and anon key to `.env` before using your account.</div>
}

export function LoginPage({ configured }) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    if (!supabase) return
    setBusy(true)
    setError('')
    const form = new FormData(event.currentTarget)
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: form.get('email'),
      password: form.get('password'),
    })
    setBusy(false)
    if (authError) setError(authError.message)
    else navigate('/app', { replace: true })
  }

  return <AuthShell title="Welcome back" description="Sign in to find your way around your things." footer={<>New here? <Link to="/signup">Create an account <ArrowRight size={14} /></Link></>}>
    <SupabaseNotice configured={configured} />
    <form className="simple-auth-form" onSubmit={submit}><label className="simple-field"><span>Email address</span><div><Mail size={16} /><input name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></div></label><label className="simple-field"><span>Password</span><div><LockKeyhole size={16} /><input name="password" type="password" autoComplete="current-password" placeholder="Your password" required /></div></label><div className="simple-form-extra"><span /><Link to="/forgot-password">Forgot password?</Link></div>{error && <p className="simple-form-error" role="alert">{error}</p>}<button disabled={!configured || busy} className="simple-primary-button simple-auth-submit">{busy ? 'Signing in…' : 'Sign in'} <ArrowRight size={16} /></button></form>
  </AuthShell>
}

export function SignupPage({ configured }) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    if (!supabase) return
    const form = new FormData(event.currentTarget)
    const password = form.get('password')
    if (password.length < 8) {
      setError('Use at least 8 characters for your password.')
      return
    }
    setBusy(true)
    setError('')
    const { data, error: authError } = await supabase.auth.signUp({
      email: form.get('email'),
      password,
      options: {
        data: { full_name: form.get('name') },
        emailRedirectTo: window.location.origin,
      },
    })
    setBusy(false)
    if (authError) setError(authError.message)
    else if (data.session) navigate('/app', { replace: true })
    else toast.success('Check your email to confirm your account.')
  }

  return <AuthShell title="Make yourself at home" description="Create an account to save your belongings and their places." footer={<>Already have an account? <Link to="/login">Sign in <ArrowRight size={14} /></Link></>}>
    <SupabaseNotice configured={configured} />
    <form className="simple-auth-form" onSubmit={submit}><label className="simple-field"><span>Your name</span><div><input name="name" type="text" autoComplete="name" placeholder="Your name" required /></div></label><label className="simple-field"><span>Email address</span><div><Mail size={16} /><input name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></div></label><label className="simple-field"><span>Password</span><div><LockKeyhole size={16} /><input name="password" type="password" autoComplete="new-password" placeholder="At least 8 characters" required /></div></label>{error && <p className="simple-form-error" role="alert">{error}</p>}<button disabled={!configured || busy} className="simple-primary-button simple-auth-submit">{busy ? 'Creating account…' : 'Create account'} <ArrowRight size={16} /></button></form>
  </AuthShell>
}

export function ForgotPasswordPage({ configured }) {
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    if (!supabase) return
    const email = new FormData(event.currentTarget).get('email')
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` })
    if (resetError) setError(resetError.message)
    else setMessage('If an account exists for that email, a password reset link is on its way.')
  }

  return <AuthShell title="Forgot your password?" description="Enter your email and we’ll send you a link to reset it." footer={<>Remembered it? <Link to="/login">Sign in <ArrowRight size={14} /></Link></>}>
    <SupabaseNotice configured={configured} />
    {message ? <p className="simple-form-success" role="status">{message}</p> : <form className="simple-auth-form" onSubmit={submit}><label className="simple-field"><span>Email address</span><div><Mail size={16} /><input name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></div></label>{error && <p className="simple-form-error" role="alert">{error}</p>}<button disabled={!configured} className="simple-primary-button simple-auth-submit">Send reset link <ArrowRight size={16} /></button></form>}
  </AuthShell>
}

export function ResetPasswordPage({ configured }) {
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    if (!supabase) return
    const form = new FormData(event.currentTarget)
    const password = form.get('password')
    if (password.length < 8 || password !== form.get('confirmPassword')) {
      setError(password.length < 8 ? 'Use at least 8 characters for your password.' : 'The passwords do not match.')
      return
    }
    setBusy(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (updateError) setError(updateError.message)
    else {
      toast.success('Your password has been updated.')
      navigate('/app', { replace: true })
    }
  }

  return <AuthShell title="Choose a new password" description="Pick a new password for your account." footer={<>Back to <Link to="/login">sign in <ArrowRight size={14} /></Link></>}>
    <SupabaseNotice configured={configured} />
    <form className="simple-auth-form" onSubmit={submit}><label className="simple-field"><span>New password</span><div><LockKeyhole size={16} /><input name="password" type="password" autoComplete="new-password" placeholder="At least 8 characters" required /></div></label><label className="simple-field"><span>Confirm new password</span><div><LockKeyhole size={16} /><input name="confirmPassword" type="password" autoComplete="new-password" placeholder="Enter it again" required /></div></label>{error && <p className="simple-form-error" role="alert">{error}</p>}<button disabled={!configured || busy} className="simple-primary-button simple-auth-submit">{busy ? 'Updating…' : 'Update password'} <ArrowRight size={16} /></button></form>
  </AuthShell>
}
