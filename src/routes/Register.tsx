import { ArrowRight, BadgeCheck, Eye, EyeOff, KeyRound, LockKeyhole, Mail, ShieldCheck, TriangleAlert, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useApp } from '../app/AppContext'
import { useAuth } from '../app/AuthContext'
import { CaptchaField, isCaptchaBlocked } from '../components/CaptchaField'
import { Spinner } from '../components/Skeleton'
import { track } from '../lib/analytics'
import { useT } from '../i18n'

type Mode = 'signin' | 'signup' | 'magic'

export default function Register() {
  const t = useT()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [captchaToken, setCaptchaToken] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const passwordScore = !password ? 0 : Math.min(4, (password.length >= 10 ? 1 : 0) + (/[A-Z]/.test(password) && /[a-z]/.test(password) ? 1 : 0) + (/\d/.test(password) ? 1 : 0) + (/[^A-Za-z0-9]/.test(password) ? 1 : 0)) || 1
  const { notify } = useApp()
  const { user, configured } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const destination = (location.state as { from?: string } | null)?.from ?? '/dashboard'

  const copy: Record<Mode, { title: string; text: string; cta: string }> = {
    signin: { title: t('auth.signin.title'), text: t('auth.signin.text'), cta: t('auth.signin.cta') },
    signup: { title: t('auth.signup.title'), text: t('auth.signup.text'), cta: t('auth.signup.cta') },
    magic: { title: t('auth.magic.title'), text: t('auth.magic.text'), cta: t('auth.magic.cta') }
  }

  useEffect(() => { if (user) navigate(destination, { replace: true }) }, [destination, navigate, user])
  useEffect(() => { if (mode === 'signup') track('signup_started') }, [mode])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) { notify(t('auth.toast.notConfigured'), t('auth.toast.notConfiguredMsg'), 'danger'); return }
    if (isCaptchaBlocked(captchaToken)) { notify(t('auth.toast.blocked'), t('auth.toast.blockedMsg'), 'danger'); return }
    if (import.meta.env.VITE_TURNSTILE_SITE_KEY && !captchaToken) { notify(t('auth.toast.captcha'), t('auth.toast.captchaMsg'), 'danger'); return }
    setLoading(true)
    const captchaOptions = captchaToken && captchaToken !== 'blocked' ? { captchaToken } : undefined
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name }, emailRedirectTo: `${window.location.origin}/dashboard`, ...captchaOptions }
        })
        if (error) throw error
        track('signup_completed')
        if (data.session) { notify(t('auth.toast.created'), t('auth.toast.createdMsg'), 'success'); navigate(destination, { replace: true }) }
        else setSent(true)
      } else if (mode === 'magic') {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${window.location.origin}/dashboard`, shouldCreateUser: true, ...captchaOptions }
        })
        if (error) throw error
        setSent(true)
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password, options: captchaOptions })
        if (error) throw error
        notify(t('auth.toast.welcome'), t('auth.toast.welcomeMsg'), 'success')
        navigate(destination, { replace: true })
      }
    } catch (error) {
      notify(mode === 'signup' ? t('auth.toast.createFail') : t('auth.toast.signInFail'), error instanceof Error ? error.message : t('common.pleaseTryAgain'), 'danger')
    } finally {
      setLoading(false)
    }
  }

  return <div className="auth-page">
    <aside className="auth-aside">
      <div>
        <h2>{t('auth.aside.title')}</h2>
        <p>{t('auth.aside.text')}</p>
      </div>
      <div className="auth-aside-quote">
        <p>{t('auth.aside.quote')}</p>
        <span><ShieldCheck size={16} />{t('auth.aside.quoteBy')}</span>
      </div>
      <div className="auth-aside-stats">
        <div><strong>60s</strong><span>{t('auth.aside.stat1')}</span></div>
        <div><strong>0</strong><span>{t('auth.aside.stat2')}</span></div>
        <div><strong>8</strong><span>{t('auth.aside.stat3')}</span></div>
      </div>
    </aside>

    <div className="auth-main">
      <div className="auth-card">
        {sent ? <div className="auth-success">
          <span className="auth-success-icon"><Mail /></span>
          <h1>{t('auth.sent.title')}</h1>
          <p className="muted-copy">{t('auth.sent.text', { email })}</p>
          <button className="button button-secondary button-full" onClick={() => { setSent(false); setMode('signin') }}>{t('auth.sent.back')}</button>
        </div> : <>
          <div>
            <h1>{copy[mode].title}</h1>
            <p>{copy[mode].text}</p>
          </div>

          {mode !== 'magic' && <div className="segmented" role="tablist" aria-label={t('auth.tabsAria')}>
            <button type="button" role="tab" aria-selected={mode === 'signin'} className={mode === 'signin' ? 'is-active' : ''} onClick={() => setMode('signin')}>{t('auth.tab.signIn')}</button>
            <button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'is-active' : ''} onClick={() => setMode('signup')}>{t('auth.tab.signUp')}</button>
          </div>}

          {!configured && <div className="auth-config-error" role="note"><TriangleAlert />{t('auth.configError')}</div>}

          <form onSubmit={submit} className="auth-form-panel" aria-busy={loading}>
            {mode === 'signup' && <label>{t('auth.nameLabel')}
              <div className="input-with-icon"><UserRound /><input required minLength={2} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('auth.namePlaceholder')} /></div>
            </label>}
            <label>{t('auth.email')}
              <div className="input-with-icon"><Mail /><input type="email" required autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('auth.emailPlaceholder')} /></div>
            </label>
            {mode !== 'magic' && <label>{t('auth.password')}
              <div className="input-with-icon"><KeyRound /><input type={showPassword ? 'text' : 'password'} required minLength={10} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('auth.passwordPlaceholder')} />
                <button type="button" className="input-suffix" aria-pressed={showPassword} aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')} onClick={() => setShowPassword((v) => !v)}>{showPassword ? <EyeOff /> : <Eye />}</button>
              </div>
              {mode === 'signup' && password && <span className="password-meter" data-score={passwordScore} aria-hidden><i /><i /><i /><i /></span>}
            </label>}
            <CaptchaField onToken={setCaptchaToken} />
            <button className="button button-primary button-full button-lg" disabled={loading || !configured} aria-busy={loading}>
              {loading ? <><Spinner />{t('common.pleaseWait')}</> : <>{copy[mode].cta}<ArrowRight /></>}
            </button>
          </form>

          <div className="auth-divider">{t('auth.or')}</div>

          <button type="button" className="button button-secondary button-full" onClick={() => setMode(mode === 'magic' ? 'signin' : 'magic')}>
            {mode === 'magic' ? <><KeyRound />{t('auth.usePassword')}</> : <><Mail />{t('auth.useMagic')}</>}
          </button>

          <ul className="auth-benefits">
            <li><ShieldCheck />{t('auth.benefit1')}</li>
            <li><LockKeyhole />{t('auth.benefit2')}</li>
            <li><BadgeCheck />{t('auth.benefit3')}</li>
          </ul>
          <small className="legal">{t('auth.legal')}</small>
        </>}
      </div>
    </div>
  </div>
}
