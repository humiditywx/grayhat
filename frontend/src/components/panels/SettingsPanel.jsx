import { useState, useRef } from 'react'
import Avatar from '../common/Avatar.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { useLocale, SUPPORTED_LOCALES } from '../../i18n/index.jsx'
import { uploadAvatar, passwordChange, authLogout, totpSetup, totpConfirm } from '../../api.js'
import { useTheme } from '../../hooks/useTheme.js'
import PasswordRequirements, { isPasswordValid } from '../common/PasswordRequirements.jsx'

export default function SettingsPanel() {
  const { state, dispatch, toast } = useApp()
  const { me } = state
  const [section, setSection] = useState(null)
  const avatarRef = useRef(null)
  const { isDark, toggle: toggleTheme } = useTheme()
  const { t, locale, setLocale } = useLocale()

  const pickAvatar = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.append('avatar', file)
    try {
      await uploadAvatar(fd)
      dispatch({ type: 'UPDATE_MY_AVATAR' })
      toast('Avatar updated!', 'success')
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  const logout = async () => {
    try { await authLogout() } catch {}
    dispatch({ type: 'LOGOUT' })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="panel-header">
        <span className="panel-title">{t('settingsTitle')}</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Profile */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 16px', gap: 12 }}>
          <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => avatarRef.current?.click()}>
            <Avatar user={me} size="xl" />
            <div style={{
              position: 'absolute', bottom: 0, right: 0,
              width: 28, height: 28, borderRadius: '50%',
              background: 'var(--primary)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid #fff'
            }}>
              {/* pencil.fill */}
              <svg width="14" height="14" viewBox="0 0 24 24">
                <path
                  d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                  fill="currentColor"
                  filter="url(#icon-depth)"
                />
              </svg>
            </div>
          </div>
          <input ref={avatarRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={pickAvatar} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 'var(--text-lg)', color: 'var(--text)' }}>{me?.username}</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)', fontFamily: 'monospace', marginTop: 2 }}>{me?.id}</div>
            <button
              style={{ marginTop: 4 }}
              className="btn btn-ghost btn-sm"
              onClick={() => navigator.clipboard.writeText(me?.id || '').then(() => toast('UUID copied!', 'success'))}
            >
              {t('copyUUID')}
            </button>
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-title">{t('appearance')}</div>
          <div className="settings-row" onClick={toggleTheme} style={{ cursor: 'pointer' }}>
            <div className="settings-row-icon">
              {isDark
                ? (
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path
                      d="M12 3a9 9 0 109 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 01-4.4 2.26 5.403 5.403 0 01-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"
                      fill="currentColor"
                      filter="url(#icon-depth)"
                    />
                  </svg>
                )
                : (
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path
                      d="M12 7a5 5 0 100 10A5 5 0 0012 7zm0-5a1 1 0 011 1v2a1 1 0 11-2 0V3a1 1 0 011-1zm0 16a1 1 0 011 1v2a1 1 0 11-2 0v-2a1 1 0 011-1zM3 12a1 1 0 011-1h2a1 1 0 110 2H4a1 1 0 01-1-1zm15 0a1 1 0 011-1h2a1 1 0 110 2h-2a1 1 0 01-1-1zM5.636 5.636a1 1 0 011.414 0l1.414 1.414a1 1 0 01-1.414 1.414L5.636 7.05a1 1 0 010-1.414zm12.728 12.728a1 1 0 01-1.414 0l-1.414-1.414a1 1 0 011.414-1.414l1.414 1.414a1 1 0 010 1.414zM5.636 18.364a1 1 0 010-1.414l1.414-1.414a1 1 0 011.414 1.414l-1.414 1.414a1 1 0 01-1.414 0zM18.364 5.636a1 1 0 010 1.414l-1.414 1.414a1 1 0 01-1.414-1.414l1.414-1.414a1 1 0 011.414 0z"
                      fill="currentColor"
                      filter="url(#icon-depth)"
                    />
                  </svg>
                )
              }
            </div>
            <div className="settings-row-info">
              <div className="settings-row-label">{t('darkMode')}</div>
              <div className="settings-row-value">{isDark ? t('on') : t('off')}</div>
            </div>
            <div className={`theme-toggle${isDark ? ' on' : ''}`}>
              <div className="theme-toggle-thumb" />
            </div>
          </div>

          {/* Language */}
          <div className="settings-row" style={{ cursor: 'default' }}>
            <div className="settings-row-icon">
              {/* globe */}
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path
                  d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"
                  fill="currentColor"
                  filter="url(#icon-depth)"
                />
              </svg>
            </div>
            <div className="settings-row-info">
              <div className="settings-row-label">{t('language')}</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {SUPPORTED_LOCALES.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLocale(l.code)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 9999,
                    fontSize: 'var(--text-xs)',
                    fontWeight: 600,
                    border: '1.5px solid',
                    borderColor: locale === l.code ? 'var(--primary)' : 'var(--border)',
                    background: locale === l.code ? 'var(--primary)' : 'transparent',
                    color: locale === l.code ? '#fff' : 'var(--text-2)',
                    cursor: 'pointer',
                    transition: 'all 120ms',
                  }}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-title">{t('account')}</div>

          <div className="settings-row" onClick={() => setSection(section === 'password' ? null : 'password')}>
            <div className="settings-row-icon">
              {/* lock.fill */}
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path
                  d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"
                  fill="currentColor"
                  filter="url(#icon-depth)"
                />
              </svg>
            </div>
            <div className="settings-row-info">
              <div className="settings-row-label">{t('changePassword')}</div>
            </div>
            <span className="settings-chevron">›</span>
          </div>
          {section === 'password' && <ChangePasswordForm toast={toast} dispatch={dispatch} t={t} />}

          <div className="settings-row" onClick={() => setSection(section === 'totp' ? null : 'totp')}>
            <div className="settings-row-icon">
              {/* shield.fill */}
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path
                  d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"
                  fill="currentColor"
                  filter="url(#icon-depth)"
                />
              </svg>
            </div>
            <div className="settings-row-info">
              <div className="settings-row-label">{t('twoFactor')}</div>
              <div className="settings-row-value">{me?.totp_enabled ? t('twoFactorEnabled') : t('twoFactorNotSetUp')}</div>
            </div>
            <span className="settings-chevron">›</span>
          </div>
          {section === 'totp' && <TotpSection toast={toast} dispatch={dispatch} t={t} />}
        </div>

        <div className="settings-section">
          <div className="settings-section-title">{t('yourQr')}</div>
          <div style={{ padding: '12px 0' }}>
            <img src="/api/users/me/qr.png" alt="My QR code" style={{ width: 160, height: 160, borderRadius: 12, border: '2px solid var(--border-light)' }} />
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)', marginTop: 8 }}>{t('qrHint')}</p>
          </div>
        </div>

        <div className="settings-section" style={{ paddingBottom: 24 }}>
          <button className="btn btn-danger" style={{ width: '100%', marginTop: 12 }} onClick={logout}>
            {t('signOut')}
          </button>
        </div>
      </div>
    </div>
  )
}

function ChangePasswordForm({ toast, dispatch, t }) {
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm: '' })
  const [busy, setBusy] = useState(false)

  const handle = async (e) => {
    e.preventDefault()
    if (!isPasswordValid(form.new_password)) { toast('Password does not meet the requirements.', 'error'); return }
    if (form.new_password !== form.confirm) { toast(t('passwordsNoMatch'), 'error'); return }
    setBusy(true)
    try {
      const data = await passwordChange({ current_password: form.current_password, new_password: form.new_password })
      dispatch({ type: 'SET_ME', me: data.user, requiresTotpSetup: data.requires_totp_setup })
      toast('Password changed!', 'success')
      setForm({ current_password: '', new_password: '', confirm: '' })
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handle} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 0 12px' }}>
      {[[t('currentPassword'), 'current_password'], [t('newPassword'), 'new_password'], [t('confirmNewPassword'), 'confirm']].map(([label, key]) => (
        <div className="field" key={key}>
          <label className="field-label">{label}</label>
          <input className="field-input" type="password" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
          {key === 'new_password' && <PasswordRequirements password={form.new_password} />}
        </div>
      ))}
      <button className="btn btn-primary btn-sm" disabled={busy || !isPasswordValid(form.new_password) || form.new_password !== form.confirm}>
        {busy ? t('saving') : t('updatePassword')}
      </button>
    </form>
  )
}

function TotpSection({ toast, t }) {
  const [data, setData] = useState(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const { dispatch } = useApp()

  const setup = async () => {
    setBusy(true)
    try { setData(await totpSetup()) } catch (err) { toast(err.message, 'error') }
    setBusy(false)
  }

  const confirm = async () => {
    setBusy(true)
    try {
      const res = await totpConfirm(code)
      dispatch({ type: 'SET_ME', me: res.user, requiresTotpSetup: false })
      toast('2FA enabled!', 'success')
      setData(null)
    } catch (err) { toast(err.message, 'error') }
    setBusy(false)
  }

  if (!data) {
    return (
      <div style={{ padding: '8px 0 12px' }}>
        <button className="btn btn-primary btn-sm" onClick={setup} disabled={busy}>
          {busy ? t('loadingDots') : t('setupTwoFa')}
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: '8px 0 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <img src={data.qr_code} alt="QR" style={{ width: 160, height: 160, borderRadius: 12 }} />
      <div className="field">
        <label className="field-label">{t('confirmCode')}</label>
        <input className="field-input" type="text" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
      </div>
      <button className="btn btn-primary btn-sm" onClick={confirm} disabled={busy || code.length !== 6}>
        {busy ? t('verifying') : t('enableTwoFa')}
      </button>
    </div>
  )
}
