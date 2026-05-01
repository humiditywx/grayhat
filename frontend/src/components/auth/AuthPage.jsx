import { useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { useLocale } from '../../i18n/index.jsx'
import { authLogin, authRegister, passwordReset } from '../../api.js'

export default function AuthPage() {
  const { dispatch, toast } = useApp()
  const { t } = useLocale()
  const [tab, setTab] = useState('login')

  return (
    <div className="auth-page">
      <div className="auth-card card">
        <div className="auth-logo">GrayHat</div>
        <div className="auth-tagline">{t('tagline')}</div>

        <div className="auth-tabs">
          {['login', 'register', 'reset'].map((t2) => (
            <button key={t2} className={`auth-tab${tab === t2 ? ' active' : ''}`} onClick={() => setTab(t2)}>
              {t2 === 'login' ? t('signIn') : t2 === 'register' ? t('signUp') : t('reset')}
            </button>
          ))}
        </div>

        {tab === 'login'    && <LoginForm    dispatch={dispatch} toast={toast} t={t} />}
        {tab === 'register' && <RegisterForm dispatch={dispatch} toast={toast} t={t} />}
        {tab === 'reset'    && <ResetForm    dispatch={dispatch} toast={toast} t={t} />}
      </div>
    </div>
  )
}

function LoginForm({ dispatch, toast, t }) {
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
      <Field label={t('username')} value={form.username} onChange={(v) => setForm({ ...form, username: v })} autoComplete="username" />
      <Field label={t('password')} type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} autoComplete="current-password" />
      <button className="btn btn-primary" disabled={busy || !form.username || !form.password}>
        {busy ? t('signingIn') : t('signIn')}
      </button>
    </form>
  )
}

function RegisterForm({ dispatch, toast, t }) {
  const [form, setForm] = useState({ username: '', password: '', confirm: '' })
  const [busy, setBusy] = useState(false)

  const handle = async (e) => {
    e.preventDefault()
    if (form.password !== form.confirm) { toast(t('passwordsNoMatch'), 'error'); return }
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
      <Field label={t('username')} value={form.username} onChange={(v) => setForm({ ...form, username: v })} autoComplete="username" />
      <Field label={t('password')} type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} autoComplete="new-password" />
      <Field label={t('confirmPassword')} type="password" value={form.confirm} onChange={(v) => setForm({ ...form, confirm: v })} autoComplete="new-password" />
      <button className="btn btn-primary" disabled={busy || !form.username || !form.password}>
        {busy ? t('creatingAccount') : t('createAccount')}
      </button>
    </form>
  )
}

function ResetForm({ dispatch, toast, t }) {
  const [form, setForm] = useState({ username: '', verification_code: '', new_password: '', confirm: '' })
  const [busy, setBusy] = useState(false)

  const handle = async (e) => {
    e.preventDefault()
    if (form.new_password !== form.confirm) { toast(t('passwordsNoMatch'), 'error'); return }
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
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-2)' }}>{t('resetInstructions')}</p>
      <Field label={t('username')} value={form.username} onChange={(v) => setForm({ ...form, username: v })} />
      <Field label={t('totpOrRecovery')} value={form.verification_code} onChange={(v) => setForm({ ...form, verification_code: v })} />
      <Field label={t('newPassword')} type="password" value={form.new_password} onChange={(v) => setForm({ ...form, new_password: v })} />
      <Field label={t('confirmNewPassword')} type="password" value={form.confirm} onChange={(v) => setForm({ ...form, confirm: v })} />
      <button className="btn btn-primary" disabled={busy || !form.username || !form.verification_code || !form.new_password}>
        {busy ? t('resetting') : t('resetPassword')}
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
