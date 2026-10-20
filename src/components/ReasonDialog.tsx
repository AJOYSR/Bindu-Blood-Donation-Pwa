import { X } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '../i18n'

export interface ReasonRequest {
  title: string
  description?: ReactNode
  subject?: ReactNode
  label?: string
  placeholder?: string
  confirmLabel?: string
  tone?: 'default' | 'danger'
  minLength?: number
  maxLength?: number
  presets?: string[]
  footnote?: string
}

interface ReasonDialogProps extends ReasonRequest {
  onClose: (value: string | null) => void
}

const focusableSelector = 'button:not([disabled]), textarea, input, select, a[href], [tabindex]:not([tabindex="-1"])'

export function ReasonDialog({
  title,
  description,
  subject,
  label,
  placeholder,
  confirmLabel,
  tone = 'default',
  minLength = 5,
  maxLength = 500,
  presets = [],
  footnote,
  onClose
}: ReasonDialogProps) {
  const t = useT()
  const resolvedLabel = label ?? t('dialog.reason')
  const resolvedPlaceholder = placeholder ?? t('dialog.reasonPlaceholder')
  const resolvedConfirm = confirmLabel ?? t('dialog.confirm')
  const resolvedFootnote = footnote ?? t('dialog.footnote')
  const [value, setValue] = useState('')
  const [touched, setTouched] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const errorId = useId()
  const trimmed = value.trim()
  const tooShort = trimmed.length < minLength

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    textareaRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus()
    }
  }, [])

  const submit = () => {
    setTouched(true)
    if (!tooShort) onClose(trimmed)
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') { event.stopPropagation(); onClose(null); return }
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); submit(); return }
    if (event.key !== 'Tab' || !dialogRef.current) return
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector))
    if (!focusable.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(null) }}>
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        onKeyDown={onKeyDown}
      >
        <span className="modal-grabber" aria-hidden />
        <header className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-button" aria-label={t('dialog.close')} onClick={() => onClose(null)}><X /></button>
        </header>

        {subject && <div className="modal-subject">{subject}</div>}
        {description && <p id={descriptionId} className="modal-description">{description}</p>}

        <form className="modal-body" onSubmit={(event) => { event.preventDefault(); submit() }}>
          <label>{resolvedLabel}
            <textarea
              ref={textareaRef}
              rows={4}
              value={value}
              maxLength={maxLength}
              placeholder={resolvedPlaceholder}
              aria-invalid={touched && tooShort}
              aria-describedby={touched && tooShort ? errorId : undefined}
              onChange={(event) => setValue(event.target.value)}
            />
          </label>

          {presets.length > 0 && <div className="modal-presets" role="group" aria-label={t('dialog.presetsAria')}>
            {presets.map((preset) => <button
              key={preset}
              type="button"
              className={value === preset ? 'chip is-active' : 'chip'}
              onClick={() => { setValue(preset); textareaRef.current?.focus() }}
            >{preset}</button>)}
          </div>}

          <div className="modal-meta">
            {touched && tooShort
              ? <span id={errorId} className="field-error">{t('dialog.tooShort', { count: minLength })}</span>
              : <span>{resolvedFootnote}</span>}
            <span>{value.length}/{maxLength}</span>
          </div>

          <div className="modal-actions">
            <button type="button" className="button button-secondary" onClick={() => onClose(null)}>{t('dialog.cancel')}</button>
            <button type="submit" className={tone === 'danger' ? 'button button-danger' : 'button button-primary'}>{resolvedConfirm}</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

export function useReasonDialog() {
  const [request, setRequest] = useState<(ReasonRequest & { resolve: (value: string | null) => void }) | null>(null)

  const ask = useCallback((options: ReasonRequest) => new Promise<string | null>((resolve) => {
    setRequest({ ...options, resolve })
  }), [])

  const dialog = request ? <ReasonDialog
    {...request}
    onClose={(value) => { request.resolve(value); setRequest(null) }}
  /> : null

  return { ask, dialog }
}
