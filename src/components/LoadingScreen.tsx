import { useT } from '../i18n'
import { BrandMark } from './Brand'

export function LoadingScreen({ label }: { label?: string }) {
  const t = useT()
  return <div className="loading-screen" role="status" aria-live="polite">
    <div className="loading-mark">
      <span className="loading-ring" aria-hidden />
      <span className="loading-ring is-delayed" aria-hidden />
      <BrandMark size={52} />
    </div>
    <p>{label ?? t('common.loading')}</p>
  </div>
}
