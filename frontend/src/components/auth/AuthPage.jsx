import { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { useLocale } from '../../i18n/index.jsx'
import { sendOtp, verifyOtp, completeRegister, totpSetup, totpConfirm } from '../../api.js'

export default function AuthPage() {
  const { dispatch, toast } = useApp()
  const { t } = useLocale()
  const [step, setStep] = useState('email') // email, otp, register, totp, global
  const [email, setEmail] = useState('')
  const [regToken, setRegToken] = useState('')
  const [regForm, setRegForm] = useState({ username: '', display_name: '', is_global: false })
  const [totpData, setTotpData] = useState(null)
  const [busy, setBusy] = useState(false)

  const onEmailSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await sendOtp(email)
      setStep('otp')
      toast(t('otpSent'), 'success')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const onOtpSubmit = async (code) => {
    setBusy(true)
    try {
      const data = await verifyOtp(email, code)
      if (data.user) {
        dispatch({ type: 'SET_ME', me: data.user, requiresTotpSetup: data.requires_totp_setup })
      } else {
        setRegToken(data.registration_token)
        setStep('register')
      }
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const onRegisterSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const data = await completeRegister(regForm, regToken)
      dispatch({ type: 'SET_ME_TEMP', me: data.user }) // Keep user in state but don't finish auth yet
      setStep('totp')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const onFinish = (me, requiresTotpSetup) => {
    dispatch({ type: 'SET_ME', me, requiresTotpSetup })
  }

  return (
    <div className="auth-page">
      <div className="auth-card card">
        <div className="auth-logo">GrayHat</div>

        {step === 'email' && (
          <form className="auth-form" onSubmit={onEmailSubmit}>
            <div className="auth-tagline">{t('welcome')}</div>
            <Field label={t('emailAddress')} type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
            <button className="btn btn-primary" disabled={busy || !email}>
              {busy ? t('sending') : t('continue')}
            </button>
          </form>
        )}

        {step === 'otp' && (
          <OtpForm onSubmit={onOtpSubmit} busy={busy} t={t} onBack={() => setStep('email')} />
        )}

        {step === 'register' && (
          <form className="auth-form" onSubmit={onRegisterSubmit}>
            <div className="auth-tagline">{t('createAccount')}</div>
            <Field
              label={t('username')}
              value={regForm.username}
              onChange={(v) => setRegForm({ ...regForm, username: v.toLowerCase().replace(/[^a-z0-9._]/g, '') })}
              placeholder="lowercase, numbers, . and _"
              hint={t('usernameHint')}
            />
            <Field
              label={t('displayName')}
              value={regForm.display_name}
              onChange={(v) => setRegForm({ ...regForm, display_name: v })}
              placeholder={t('optional')}
            />
            <button className="btn btn-primary" disabled={busy || regForm.username.length < 3}>
              {busy ? t('saving') : t('continue')}
            </button>
          </form>
        )}

        {step === 'totp' && (
          <TotpChoice
            onSkip={() => setStep('global')}
            onEnable={async () => {
              try {
                const data = await totpSetup() // This might fail if we don't have the full JWT yet.
                // Re-thinking: Better to just ask if they want to.
                // Actually, the completeRegister returns a full JWT in cookies.
                setStep('totp_setup')
              } catch(err) { toast(err.message, 'error') }
            }}
            t={t}
          />
        )}

        {step === 'totp_setup' && (
           <TotpSetupFlow onFinish={() => setStep('global')} t={t} toast={toast} />
        )}

        {step === 'global' && (
          <GlobalModeStep
            value={regForm.is_global}
            onChange={(v) => setRegForm({ ...regForm, is_global: v })}
            onFinish={() => {
               // Update is_global on server if it changed, then finish
               onFinish(null, false) // null means use what's already in state or refresh
               window.location.reload() // Simplest way to re-bootstrap
            }}
            t={t}
          />
        )}
      </div>
    </div>
  )
}

function OtpForm({ onSubmit, busy, t, onBack }) {
  const [code, setCode] = useState('')
  return (
    <form className="auth-form" onSubmit={(e) => { e.preventDefault(); onSubmit(code) }}>
      <div className="auth-tagline">{t('enterOtp')}</div>
      <input
        className="field-input otp-input"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        maxLength={6}
        autoFocus
        placeholder="000000"
      />
      <button className="btn btn-primary" disabled={busy || code.length !== 6}>
        {busy ? t('verifying') : t('verify')}
      </button>
      <button type="button" className="btn btn-link" onClick={onBack}>{t('back')}</button>
    </form>
  )
}

function TotpChoice({ onSkip, onEnable, t }) {
  return (
    <div className="auth-form">
      <div className="auth-tagline">{t('enable2fa')}</div>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-2)', textAlign: 'center', marginBottom: '20px' }}>
        {t('2faDescription')}
      </p>
      <button className="btn btn-primary" onClick={onEnable}>{t('enableNow')}</button>
      <button className="btn btn-link" onClick={onSkip}>{t('skip')}</button>
    </div>
  )
}

function TotpSetupFlow({ onFinish, t, toast }) {
  const [data, setData] = useState(null)
  const [code, setCode] = useState('')

  useEffect(() => {
    totpSetup().then(setData).catch(err => toast(err.message, 'error'))
  }, [])

  if (!data) return <div className="spinner" />

  const confirm = async () => {
    try {
      await totpConfirm(code)
      onFinish()
    } catch (err) { toast(err.message, 'error') }
  }

  return (
    <div className="auth-form">
       <div className="auth-tagline">{t('scanQr')}</div>
       <img src={data.qr_code} alt="QR" style={{ width: '200px', margin: '0 auto 20px', display: 'block' }} />
       <input className="field-input" value={code} onChange={e => setCode(e.target.value)} placeholder="000000" />
       <button className="btn btn-primary" onClick={confirm} disabled={code.length !== 6}>{t('verifyAndEnable')}</button>
    </div>
  )
}

function GlobalModeStep({ value, onChange, onFinish, t }) {
  return (
    <div className="auth-form">
      <div className="auth-tagline">{t('globalMode')}</div>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-2)', textAlign: 'center', marginBottom: '20px' }}>
        {t('globalModeDescription')}
      </p>
      <div className="field-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '20px' }}>
        <input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)} id="global-toggle" />
        <label htmlFor="global-toggle">{t('enableGlobalMode')}</label>
      </div>
      <button className="btn btn-primary" onClick={onFinish}>{t('finish')}</button>
    </div>
  )
}

function Field({ label, type = 'text', value, onChange, placeholder, hint }) {
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      <input
        className="field-input"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {hint && <div className="field-hint" style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '4px' }}>{hint}</div>}
    </div>
  )
}
