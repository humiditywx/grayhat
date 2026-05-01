import { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { useLocale } from '../../i18n/index.jsx'
import { totpSetup, totpConfirm } from '../../api.js'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'

export default function TotpPage() {
  const { dispatch, toast } = useApp()
  const { t } = useLocale()
  const [step, setStep] = useState('loading')
  const [qrCode, setQrCode] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState([])
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [savedCodes, setSavedCodes] = useState(false)

  useEffect(() => {
    totpSetup()
      .then((data) => {
        setQrCode(data.qr_code)
        setRecoveryCodes(data.recovery_codes)
        setStep('setup')
      })
      .catch((err) => toast(err.message, 'error'))
  }, []) // eslint-disable-line

  const confirm = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const data = await totpConfirm(code)
      dispatch({ type: 'SET_ME', me: data.user, requiresTotpSetup: false })
      toast('Two-factor authentication enabled!', 'success')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const skip = () => dispatch({ type: 'SET_REQUIRES_TOTP', value: false })

  if (step === 'loading') {
    return (
      <div className="auth-page">
        <div className="loading-screen"><div className="spinner spinner-lg" /><span>{t('loadingDots')}</span></div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card card totp-card">
        <div className="auth-logo" style={{ marginBottom: 4 }}>GrayHat</div>
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 4 }}>{t('setup2faTitle')}</h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-2)', marginBottom: 20 }}>
          {t('setup2faDesc')}
        </p>

        {qrCode && (
          <div className="totp-qr">
            <img src={qrCode} alt="TOTP QR Code" />
          </div>
        )}

        <div style={{ margin: '20px 0 8px', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-2)' }}>
          {t('recoveryCodesLabel')}
        </div>
        <div className="recovery-grid">
          {recoveryCodes.map((c) => (
            <div key={c} className="recovery-code">{c}</div>
          ))}
        </div>

        {step === 'setup' && (
          <Button
            type="button"
            variant="outline"
            className="mb-3 w-full"
            onClick={() => { navigator.clipboard.writeText(recoveryCodes.join('\n')).catch(() => {}); setSavedCodes(true) }}
          >
            {savedCodes ? t('copied') : t('copyRecoveryCodes')}
          </Button>
        )}

        {step === 'setup' && (
          <Button type="button" className="mb-2 w-full" onClick={() => setStep('confirm')}>
            {t('verify')}
          </Button>
        )}

        {step === 'confirm' && (
          <form onSubmit={confirm} className="mt-2 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>{t('enterCode')}</Label>
              <Input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                autoFocus
              />
            </div>
            <Button type="submit" disabled={busy || code.length !== 6}>
              {busy ? t('verifying') : t('enableTwoFa')}
            </Button>
          </form>
        )}

        <Button type="button" variant="ghost" className="mt-2 w-full" onClick={skip}>
          {t('skip')}
        </Button>
      </div>
    </div>
  )
}
