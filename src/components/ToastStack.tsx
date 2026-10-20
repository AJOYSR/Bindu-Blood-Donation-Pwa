import { CheckCircle2, CircleAlert, Info, X } from 'lucide-react'
import { useApp } from '../app/AppContext'
import { useT } from '../i18n'

export function ToastStack() {
  const { toasts, dismissToast } = useApp()
  const t = useT()
  return <div className="toast-stack" aria-live="polite" aria-relevant="additions">{toasts.map((toast) => {
    const Icon = toast.tone === 'success' ? CheckCircle2 : toast.tone === 'danger' ? CircleAlert : Info
    return <div className={`toast toast-${toast.tone ?? 'default'}`} key={toast.id} role={toast.tone === 'danger' ? 'alert' : 'status'}>
      <span className="toast-icon"><Icon size={18} /></span>
      <div><strong>{toast.title}</strong>{toast.message && <p>{toast.message}</p>}</div>
      <button aria-label={t('common.dismiss')} onClick={() => dismissToast(toast.id)}><X size={16} /></button>
      <span className="toast-timer" aria-hidden />
    </div>
  })}</div>
}
