import { ArrowLeft, ArrowRight, Check, Send, ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../app/AppContext'
import { bloodGroups, districts } from '../lib/mock-data'
import { DateTimePicker } from '../components/DateTimePicker'
import { Spinner } from '../components/Skeleton'
import { pluralKey, useT } from '../i18n'

type FormValues = {
  bloodGroup: 'A+' | 'A-' | 'B+' | 'B-' | 'O+' | 'O-' | 'AB+' | 'AB-'
  units: number
  hospital: string
  district: string
  area: string
  neededBy: string
  urgency: 'critical' | 'urgent' | 'standard'
  note: string
  consent: true
}

export default function NewRequest() {
  const { addRequest, notify } = useApp()
  const navigate = useNavigate()
  const t = useT()
  const [step, setStep] = useState(1)

  const schema = useMemo(() => z.object({
    bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'], { message: t('form.validation.bloodGroup') }),
    units: z.number().min(1).max(10),
    hospital: z.string().min(3, t('form.validation.hospital')),
    district: z.string().min(1, t('form.validation.district')),
    area: z.string().min(2, t('form.validation.area')),
    neededBy: z.string().min(1, t('form.validation.neededBy')),
    urgency: z.enum(['critical', 'urgent', 'standard']),
    note: z.string().min(10, t('form.validation.note')).max(500),
    consent: z.literal(true, { message: t('form.validation.consent') })
  }), [t])

  const urgencyOptions = [
    { value: 'critical' as const, label: t('form.urgency.critical'), hint: t('form.urgency.criticalHint') },
    { value: 'urgent' as const, label: t('form.urgency.urgent'), hint: t('form.urgency.urgentHint') },
    { value: 'standard' as const, label: t('form.urgency.standard'), hint: t('form.urgency.standardHint') }
  ]

  const { register, handleSubmit, control, watch, trigger, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { units: 1, urgency: 'urgent', consent: true, district: '' }
  })
  const urgency = watch('urgency')
  const noteLength = (watch('note') ?? '').length

  const next = async () => {
    const ok = await trigger(['bloodGroup', 'units', 'hospital', 'district', 'area'])
    if (ok) { setStep(2); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  }

  const submit = async (values: FormValues) => {
    try {
      const id = `BR-${Math.floor(2100 + Math.random() * 700)}`
      const saved = await addRequest({
        id,
        patientName: t('form.patientProtected'),
        bloodGroup: values.bloodGroup,
        units: values.units,
        hospital: values.hospital,
        district: values.district,
        area: values.area,
        urgency: values.urgency,
        status: 'open',
        neededBy: new Date(values.neededBy).toISOString(),
        createdAt: new Date().toISOString(),
        responses: 0,
        note: values.note
      })
      notify(t('form.toast.ok'), t('form.toast.okMsg'), 'success')
      navigate(`/requests/${saved.id}`)
    } catch (error) {
      notify(t('form.toast.fail'), error instanceof Error ? error.message : t('common.pleaseTryAgain'), 'danger')
    }
  }

  return (
    <div className="page">
      <div className="container form-shell">
        {step === 1
          ? <Link to="/requests" className="back-link"><ArrowLeft />{t('form.cancel')}</Link>
          : <button type="button" className="back-link text-button" onClick={() => setStep(1)}><ArrowLeft />{t('form.back')}</button>}

        <header className="page-header is-tight">
          <h1>{t('form.title')}</h1>
          <p>{t('form.lead')}</p>
        </header>

        <div className="progress-steps" aria-label={t('form.stepOf', { step })}>
          <div className={step === 1 ? 'is-done is-current' : 'is-done'} aria-current={step === 1 ? 'step' : undefined}><i>{step > 1 ? <Check aria-label={t('form.stepDone')} /> : '1'}</i><span>{t('form.step1')}</span></div>
          <div className={step === 2 ? 'is-done is-current' : ''} aria-current={step === 2 ? 'step' : undefined}><i>2</i><span>{t('form.step2')}</span></div>
        </div>

        <form onSubmit={handleSubmit(submit)} noValidate>
          {step === 1 ? <div className="form-card" key="step-1">
            <div className="field">
              <span className="field-label">{t('form.bloodGroup')}</span>
              <Controller
                name="bloodGroup"
                control={control}
                render={({ field }) => <div className="group-picker" role="radiogroup" aria-label={t('form.bloodGroupAria')}>
                  {bloodGroups.map((group) => <button
                    key={group}
                    type="button"
                    role="radio"
                    aria-checked={field.value === group}
                    className={field.value === group ? 'group-option is-active' : 'group-option'}
                    onClick={() => field.onChange(group)}
                  >{group}</button>)}
                </div>}
              />
              {errors.bloodGroup && <small className="field-error">{errors.bloodGroup.message}</small>}
            </div>

            <div className="field">
              <span className="field-label">{t('form.units')}</span>
              <Controller
                name="units"
                control={control}
                render={({ field }) => <div className="qty">
                  <button type="button" aria-label={t('form.fewer')} disabled={field.value <= 1} onClick={() => field.onChange(field.value - 1)}>−</button>
                  <output aria-live="polite">{field.value} {t(pluralKey('form.unit', field.value))}</output>
                  <button type="button" aria-label={t('form.more')} disabled={field.value >= 10} onClick={() => field.onChange(field.value + 1)}>+</button>
                </div>}
              />
            </div>

            <label>{t('form.hospital')}
              <input placeholder={t('form.hospitalPlaceholder')} autoComplete="off" aria-invalid={Boolean(errors.hospital)} {...register('hospital')} />
              {errors.hospital && <small className="field-error">{errors.hospital.message}</small>}
            </label>

            <div className="form-grid">
              <label>{t('form.district')}
                <select aria-invalid={Boolean(errors.district)} {...register('district')}>
                  <option value="" disabled>{t('form.selectDistrict')}</option>
                  {districts.map((d) => <option key={d}>{d}</option>)}
                </select>
                {errors.district && <small className="field-error">{errors.district.message}</small>}
              </label>
              <label>{t('form.area')}
                <input placeholder={t('form.areaPlaceholder')} autoComplete="off" aria-invalid={Boolean(errors.area)} {...register('area')} />
                {errors.area && <small className="field-error">{errors.area.message}</small>}
              </label>
            </div>

            <div className="form-actions">
              <button type="button" className="button button-primary button-lg" onClick={() => void next()}>{t('form.continue')}<ArrowRight /></button>
            </div>
          </div> : <div className="form-card" key="step-2">
            <div className="field">
              <span className="field-label">{t('form.urgency')}</span>
              <Controller
                name="urgency"
                control={control}
                render={({ field }) => <div className="option-cards" role="radiogroup" aria-label={t('form.urgencyAria')}>
                  {urgencyOptions.map((option) => <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={field.value === option.value}
                    className={field.value === option.value ? 'option-card is-active' : 'option-card'}
                    onClick={() => field.onChange(option.value)}
                  >
                    <i className={`tone-${option.value}`} />
                    <span><strong>{option.label}</strong><small>{option.hint}</small></span>
                  </button>)}
                </div>}
              />
            </div>

            <div className="field">
              <span className="field-label">{t('form.neededBy')}</span>
              <Controller
                name="neededBy"
                control={control}
                render={({ field }) => (
                  <DateTimePicker
                    mode="datetime"
                    value={field.value}
                    onChange={field.onChange}
                    urgency={urgency}
                    min={new Date()}
                    placeholder={t('form.neededPlaceholder')}
                    error={errors.neededBy?.message}
                  />
                )}
              />
            </div>

            <label>{t('form.note')}
              <textarea rows={4} maxLength={500} placeholder={t('form.notePlaceholder')} aria-invalid={Boolean(errors.note)} {...register('note')} />
              <span className="field-help" style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span>{t('form.noteHelp')}</span><span className="char-count">{noteLength}/500</span></span>
              {errors.note && <small className="field-error">{errors.note.message}</small>}
            </label>

            <label className="check-row">
              <input type="checkbox" {...register('consent')} />
              <span><strong>{t('form.consentTitle')}</strong><small>{t('form.consentHint')}</small></span>
            </label>
            {errors.consent && <small className="field-error">{errors.consent.message}</small>}

            <div className="notice notice-info">
              <ShieldCheck />
              <p>{t('form.notice')}</p>
            </div>

            <div className="form-actions">
              <button type="button" className="button button-secondary button-lg" onClick={() => setStep(1)}><ArrowLeft />{t('form.back')}</button>
              <button className="button button-primary button-lg" disabled={isSubmitting} aria-busy={isSubmitting}>{isSubmitting ? <><Spinner />{t('form.submitting')}</> : <><Send />{t('form.submit')}</>}</button>
            </div>
          </div>}
        </form>
      </div>
    </div>
  )
}
