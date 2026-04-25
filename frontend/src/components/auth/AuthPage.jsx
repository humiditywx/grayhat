import { useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { authLogin, authRegister, passwordReset } from '../../api.js'

export default function AuthPage() {
  const { dispatch, toast } = useApp()
  const [tab, setTab] = useState('login')

  return (
    <div className="auth-page">
      <div className="auth-card card">
        <div className="auth-logo">Pentastic</div>
        <div className="auth-tagline">Connect with friends instantly.</div>

        <div className="auth-tabs">
          {['login', 'register', 'reset'].map((t) => (
            <button key={t} className={`auth-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
              {t === 'login' ? 'Sign In' : t === 'register' ? 'Sign Up' : 'Reset'}
            </button>
          ))}
        </div>

        {tab === 'login'    && <LoginForm    dispatch={dispatch} toast={toast} />}
        {tab === 'register' && <RegisterForm dispatch={dispatch} toast={toast} />}
        {tab === 'reset'    && <ResetForm    dispatch={dispatch} toast={toast} />}
      </div>
    </div>
  )
}

function LoginForm({ dispatch, toast }) {
  const [form, setForm] = useState({ username: '', password: '' })
  const [busy, setBusy] = useState(false)

  const handle = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const data = await authLogin(form)
      dispatch({ type: 'SET_ME', me: data.user, requiresTotpSetup: data.requires_totp_setup })
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="auth-form" onSubmit={handle}>
      <Field label="Username" value={form.username} onChange={(v) => setForm({ ...form, username: v })} autoComplete="username" />
      <Field label="Password" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} autoComplete="current-password" />
      <button className="btn btn-primary" disabled={busy || !form.username || !form.password}>
        {busy ? 'Signing in…' : 'Sign In'}
      </button>
    </form>
  )
}

function RegisterForm({ dispatch, toast }) {
  const [form, setForm] = useState({ username: '', password: '', confirm: '' })
  const [busy, setBusy] = useState(false)

  const handle = async (e) => {
    e.preventDefault()
    if (form.password !== form.confirm) { toast('Passwords do not match.', 'error'); return }
    setBusy(true)
    try {
      const data = await authRegister({ username: form.username, password: form.password })
      dispatch({ type: 'SET_ME', me: data.user, requiresTotpSetup: data.requires_totp_setup })
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="auth-form" onSubmit={handle}>
      <Field label="Username" value={form.username} onChange={(v) => setForm({ ...form, username: v })} autoComplete="username" />
      <Field label="Password" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} autoComplete="new-password" />
      <Field label="Confirm Password" type="password" value={form.confirm} onChange={(v) => setForm({ ...form, confirm: v })} autoComplete="new-password" />
      <button className="btn btn-primary" disabled={busy || !form.username || !form.password}>
        {busy ? 'Creating account…' : 'Create Account'}
      </button>
    </form>
  )
}

function ResetForm({ dispatch, toast }) {
  const [form, setForm] = useState({ username: '', verification_code: '', new_password: '', confirm: '' })
  const [busy, setBusy] = useState(false)

  const handle = async (e) => {
    e.preventDefault()
    if (form.new_password !== form.confirm) { toast('Passwords do not match.', 'error'); return }
    setBusy(true)
    try {
      const data = await passwordReset({ username: form.username, verification_code: form.verification_code, new_password: form.new_password })
      dispatch({ type: 'SET_ME', me: data.user, requiresTotpSetup: data.requires_totp_setup })
      toast('Password reset successfully.', 'success')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="auth-form" onSubmit={handle}>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-2)' }}>
        Enter your username, your TOTP code or a recovery code, then a new password.
      </p>
      <Field label="Username" value={form.username} onChange={(v) => setForm({ ...form, username: v })} />
      <Field label="TOTP code or Recovery code" value={form.verification_code} onChange={(v) => setForm({ ...form, verification_code: v })} />
      <Field label="New Password" type="password" value={form.new_password} onChange={(v) => setForm({ ...form, new_password: v })} />
      <Field label="Confirm New Password" type="password" value={form.confirm} onChange={(v) => setForm({ ...form, confirm: v })} />
      <button className="btn btn-primary" disabled={busy || !form.username || !form.verification_code || !form.new_password}>
        {busy ? 'Resetting…' : 'Reset Password'}
      </button>
    </form>
  )
}

function Field({ label, type = 'text', value, onChange, autoComplete }) {
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      <input
        className="field-input"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
      />
    </div>
  )
}
