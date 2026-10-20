import { Globe } from 'lucide-react'
import { useI18n } from '../i18n'

/** Two-option pill with a sliding thumb. `full` shows full language names. */
export function LanguageSwitcher({ compact = false, full = false, tone = 'light' }: { compact?: boolean; full?: boolean; tone?: 'light' | 'dark' }) {
  const { locale, setLocale, t } = useI18n()
  const classes = ['lang-switch', compact ? 'is-compact' : '', full ? 'is-full' : '', tone === 'dark' ? 'is-dark' : ''].filter(Boolean).join(' ')

  return (
    <div className={classes} role="group" aria-label={t('lang.switch')} data-locale={locale}>
      {full && <Globe className="lang-globe" aria-hidden />}
      <div className="lang-track">
        <span className="lang-thumb" aria-hidden />
        <button type="button" lang="en" aria-pressed={locale === 'en'} aria-label={t('lang.switchToEn')} onClick={() => setLocale('en')}>
          {full ? 'English' : 'EN'}
        </button>
        <button type="button" lang="bn" aria-pressed={locale === 'bn'} aria-label={t('lang.switchToBn')} onClick={() => setLocale('bn')}>
          {full ? 'বাংলা' : 'বাং'}
        </button>
      </div>
    </div>
  )
}
