import { useState, useRef } from 'react'
import Avatar from '../common/Avatar.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { useLocale, SUPPORTED_LOCALES } from '../../i18n/index.jsx'
import { uploadAvatar, passwordChange, authLogout, totpSetup, totpConfirm } from '../../api.js'
import { useTheme } from '../../hooks/useTheme.js'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'

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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </div>
          </div>
          <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={pickAvatar} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 'var(--text-lg)', color: 'var(--text)' }}>{me?.username}</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)', fontFamily: 'monospace', marginTop: 2 }}>{me?.id}</div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-1"
              onClick={() => navigator.clipboard.writeText(me?.id || '').then(() => toast('UUID copied!', 'success'))}
            >
              {t('copyUUID')}
            </Button>
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-title">{t('appearance')}</div>
          <div className="settings-row" onClick={toggleTheme} style={{ cursor: 'pointer' }}>
            <div className="settings-row-icon">
              {isDark
                ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
                : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
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
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/>
              </svg>
            </div>
            <div className="settings-row-info">
              <div className="settings-row-label">{t('language')}</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {SUPPORTED_LOCALES.map((l) => (
                <Button
                  key={l.code}
                  type="button"
                  variant={locale === l.code ? 'default' : 'outline'}
                  size="xs"
                  onClick={() => setLocale(l.code)}
                >
                  {l.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-title">{t('account')}</div>

          <div className="settings-row" onClick={() => setSection(section === 'password' ? null : 'password')}>
            <div className="settings-row-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
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
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
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
          <Button type="button" variant="destructive" className="mt-3 w-full" onClick={logout}>
            {t('signOut')}
          </Button>
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
    <form onSubmit={handle} className="flex flex-col gap-2.5 py-3">
      {[[t('currentPassword'), 'current_password'], [t('newPassword'), 'new_password'], [t('confirmNewPassword'), 'confirm']].map(([label, key]) => (
        <div className="flex flex-col gap-1.5" key={key}>
          <Label>{label}</Label>
          <Input type="password" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
        </div>
      ))}
      <Button type="submit" size="sm" disabled={busy}>
        {busy ? t('saving') : t('updatePassword')}
      </Button>
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
        <Button type="button" size="sm" onClick={setup} disabled={busy}>
          {busy ? t('loadingDots') : t('setupTwoFa')}
        </Button>
      </div>
    )
  }

  return (
    <div style={{ padding: '8px 0 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <img src={data.qr_code} alt="QR" style={{ width: 160, height: 160, borderRadius: 12 }} />
      <div className="flex flex-col gap-1.5">
        <Label>{t('confirmCode')}</Label>
        <Input type="text" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
      </div>
      <Button type="button" size="sm" onClick={confirm} disabled={busy || code.length !== 6}>
        {busy ? t('verifying') : t('enableTwoFa')}
      </Button>
    </div>
  )
}
