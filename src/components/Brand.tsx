import { Link } from 'react-router-dom'
import { useT } from '../i18n'

export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id="bindu-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff4d63" />
          <stop offset="1" stopColor="#c01431" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="12" fill="url(#bindu-mark)" />
      <path d="M20 7.5c-4.6 6.2-8.5 10.6-8.5 15.4a8.5 8.5 0 0 0 17 0c0-4.8-3.9-9.2-8.5-15.4Z" fill="#fff" />
      <path d="M14.2 23.4h3l1.6-3.4 2.4 6 1.7-2.6h3" fill="none" stroke="#e0243c" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Brand({ compact = false, tone = 'dark' }: { compact?: boolean; tone?: 'dark' | 'light' }) {
  const t = useT()
  return (
    <Link to="/" className={tone === 'light' ? 'brand is-light' : 'brand'} aria-label={t('shell.brandHome')}>
      <BrandMark />
      {!compact && <span className="brand-word">{t('common.brand')}<i aria-hidden>.</i></span>}
    </Link>
  )
}
