import { KeyRound, LoaderCircle, ShieldCheck, Smartphone, X } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { enrollTotp, getVerifiedTotpFactor, hasAal2, verifyTotp, type TotpEnrollment } from '../lib/mfa'
import { useAuth } from './AuthContext'
import { usePermissions } from '../lib/permissions'

interface AdminMfaState {
  verified: boolean
  /** Resolves true once the session is at AAL2, prompting for a code if needed. */
  ensureVerified: () => Promise<boolean>
}

const AdminMfaContext = createContext<AdminMfaState | null>(null)

export function AdminMfaProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const { isSuperAdmin } = usePermissions()
  const [verified, setVerified] = useState(false)
  const [open, setOpen] = useState(false)
  const pending = useRef<((ok: boolean) => void)[]>([])

  useEffect(() => {
    if (isSuperAdmin) { setVerified(true); return }
    let active = true
    void hasAal2().then((ok) => { if (active) setVerified(ok) }).catch(() => undefined)
    return () => { active = false }
  }, [isSuperAdmin, session])

  const finish = useCallback((ok: boolean) => {
    setOpen(false)
    if (ok) setVerified(true)
    pending.current.splice(0).forEach((resolve) => resolve(ok))
  }, [])

  const ensureVerified = useCallback(async () => {
    if (isSuperAdmin) { setVerified(true); return true }
    if (await hasAal2().catch(() => false)) { setVerified(true); return true }
    setOpen(true)
    return new Promise<boolean>((resolve) => { pending.current.push(resolve) })
  }, [isSuperAdmin])

  const value = useMemo(() => ({ verified, ensureVerified }), [ensureVerified, verified])

  return <AdminMfaContext.Provider value={value}>
    {children}
    {open && <MfaDialog onDone={finish} />}
  </AdminMfaContext.Provider>
}

export function useAdminMfa() {
  const value = useContext(AdminMfaContext)
  if (!value) throw new Error('useAdminMfa must be used inside AdminMfaProvider')
  return value
}

type Step = { kind: 'loading' } | { kind: 'enroll'; enrollment: TotpEnrollment } | { kind: 'verify'; factorId: string } | { kind: 'error'; message: string }

function MfaDialog({ onDone }: { onDone: (ok: boolean) => void }) {
  const [step, setStep] = useState<Step>({ kind: 'loading' })
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [showSecret, setShowSecret] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const titleId = useId()

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const factorId = await getVerifiedTotpFactor()
        if (!active) return
        if (factorId) setStep({ kind: 'verify', factorId })
        else {
          const enrollment = await enrollTotp()
          if (active) setStep({ kind: 'enroll', enrollment })
        }
      } catch (err) {
        if (active) setStep({ kind: 'error', message: err instanceof Error ? err.message : 'Could not start verification.' })
      }
    })()
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (step.kind === 'verify' || step.kind === 'enroll') inputRef.current?.focus()
  }, [step.kind])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onDone(false) }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', onKey) }
  }, [onDone])

  const factorId = step.kind === 'enroll' ? step.enrollment.factorId : step.kind === 'verify' ? step.factorId : null

  const submit = async (value = code) => {
    if (!factorId || value.length !== 6 || submitting) return
    setSubmitting(true)
    setError('')
    try {
      await verifyTotp(factorId, value)
      onDone(true)
    } catch (err) {
      setError(err instanceof Error && /invalid/i.test(err.message) ? 'That code is incorrect or expired. Try the current one.' : err instanceof Error ? err.message : 'Verification failed.')
      setCode('')
      inputRef.current?.focus()
    } finally {
      setSubmitting(false)
    }
  }

  const onCodeChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 6)
    setCode(digits)
    if (digits.length === 6) void submit(digits)
  }

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onDone(false) }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <span className="modal-grabber" aria-hidden />
        <header className="modal-head">
          <h2 id={titleId}>{step.kind === 'enroll' ? 'Set up two-step verification' : 'Confirm it’s you'}</h2>
          <button type="button" className="icon-button" aria-label="Close" onClick={() => onDone(false)}><X /></button>
        </header>

        {step.kind === 'loading' && <div className="mfa-loading"><LoaderCircle /><span>Preparing verification…</span></div>}

        {step.kind === 'error' && <>
          <div className="notice notice-warn"><ShieldCheck /><p><strong>Two-step verification is unavailable</strong>{step.message}. Make sure TOTP MFA is enabled in Supabase Auth settings.</p></div>
          <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => onDone(false)}>Close</button></div>
        </>}

        {step.kind === 'enroll' && <>
          <p className="modal-description">Admin actions need a second step. Scan this QR code with Google Authenticator, Microsoft Authenticator, 1Password or a similar app. You only do this once.</p>
          <div className="mfa-qr">
            <img src={step.enrollment.qrCode} alt="QR code for your authenticator app" width={184} height={184} />
            <button type="button" className="text-button" onClick={() => setShowSecret((value) => !value)}>
              <KeyRound />{showSecret ? 'Hide setup key' : 'Can’t scan? Enter a key instead'}
            </button>
            {showSecret && <code className="mfa-secret">{step.enrollment.secret}</code>}
          </div>
        </>}

        {step.kind === 'verify' && <div className="modal-subject">
          <span className="info-icon"><Smartphone /></span>
          <div><strong>Open your authenticator app</strong><small>Enter the 6-digit code for Bindu.</small></div>
        </div>}

        {(step.kind === 'enroll' || step.kind === 'verify') && <form className="modal-body" onSubmit={(event) => { event.preventDefault(); void submit() }}>
          <label>6-digit code
            <input
              ref={inputRef}
              className="mfa-code"
              value={code}
              onChange={(event) => onCodeChange(event.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="000000"
              aria-invalid={Boolean(error)}
              disabled={submitting}
            />
          </label>
          {error && <span className="field-error" role="alert">{error}</span>}
          <div className="modal-meta"><span>You stay verified for this session.</span></div>
          <div className="modal-actions">
            <button type="button" className="button button-secondary" onClick={() => onDone(false)}>Cancel</button>
            <button type="submit" className="button button-primary" disabled={code.length !== 6 || submitting}>{submitting ? 'Verifying…' : 'Verify'}</button>
          </div>
        </form>}
      </div>
    </div>,
    document.body
  )
}
