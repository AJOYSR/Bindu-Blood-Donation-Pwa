import { useEffect, useMemo, useRef, useState } from 'react'
import {
  addDays,
  addHours,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  setHours,
  setMinutes,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths
} from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Droplet } from 'lucide-react'

type Mode = 'date' | 'datetime'

interface DateTimePickerProps {
  mode?: Mode
  value?: string
  onChange: (value: string) => void
  min?: Date
  max?: Date
  placeholder?: string
  /** Visual cue for blood-request urgency */
  urgency?: 'critical' | 'urgent' | 'standard'
  /** Extra helper under the field */
  hint?: string
  error?: string
  id?: string
}

function toLocalDateValue(date: Date) {
  return format(date, 'yyyy-MM-dd')
}

function toLocalDateTimeValue(date: Date) {
  return format(date, "yyyy-MM-dd'T'HH:mm")
}

function parseValue(value: string | undefined, mode: Mode): Date | null {
  if (!value) return null
  try {
    const parsed = parseISO(value.length === 10 && mode === 'date' ? `${value}T12:00:00` : value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  } catch {
    return null
  }
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const TIME_SLOTS = [
  { label: 'Morning', hour: 9, minute: 0 },
  { label: 'Midday', hour: 12, minute: 0 },
  { label: 'Afternoon', hour: 15, minute: 0 },
  { label: 'Evening', hour: 18, minute: 0 },
  { label: 'Night', hour: 21, minute: 0 }
]

export function DateTimePicker({
  mode = 'datetime',
  value,
  onChange,
  min,
  max,
  placeholder = 'Choose a date',
  urgency = 'urgent',
  hint,
  error,
  id
}: DateTimePickerProps) {
  const selected = parseValue(value, mode)
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => startOfMonth(selected ?? new Date()))
  const [draftTime, setDraftTime] = useState(() => ({
    hour: selected?.getHours() ?? (urgency === 'critical' ? new Date().getHours() + 2 : 18),
    minute: selected?.getMinutes() ?? 0
  }))
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (selected) setMonth(startOfMonth(selected))
  }, [selected])

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('touchstart', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('touchstart', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month))
    const end = endOfWeek(endOfMonth(month))
    return eachDayOfInterval({ start, end })
  }, [month])

  const isDisabled = (day: Date) => {
    const dayStart = startOfDay(day)
    if (min && isBefore(dayStart, startOfDay(min))) return true
    if (max && isAfter(dayStart, startOfDay(max))) return true
    return false
  }

  function commitDateTime(date: Date, hour = draftTime.hour, minute = draftTime.minute) {
    const next = setMinutes(setHours(date, hour), minute)
    onChange(toLocalDateTimeValue(next))
    setDraftTime({ hour: next.getHours(), minute: next.getMinutes() })
    setOpen(false)
  }

  const now = new Date()
  const presets = mode === 'date'
    ? [
        { id: 'clear', label: 'Never donated', apply: () => { onChange(''); setOpen(false) } },
        { id: '8w', label: '8 weeks ago', apply: () => { onChange(toLocalDateValue(addDays(now, -56))); setOpen(false) } },
        { id: '3m', label: '3 months ago', apply: () => { onChange(toLocalDateValue(addDays(now, -90))); setOpen(false) } },
        { id: '6m', label: '6 months ago', apply: () => { onChange(toLocalDateValue(addDays(now, -180))); setOpen(false) } }
      ]
    : [
        { id: '2h', label: 'In 2 hours', apply: () => { const target = addHours(now, 2); commitDateTime(target, target.getHours(), target.getMinutes()) } },
        { id: 'today', label: 'Today evening', apply: () => commitDateTime(now, 18, 0) },
        { id: 'tomorrow', label: 'Tomorrow 9 AM', apply: () => commitDateTime(addDays(startOfDay(now), 1), 9, 0) },
        { id: '2d', label: 'In 2 days', apply: () => commitDateTime(addDays(startOfDay(now), 2), 12, 0) }
      ]

  function selectDay(day: Date) {
    if (isDisabled(day)) return
    if (mode === 'date') {
      onChange(toLocalDateValue(day))
      setOpen(false)
      return
    }
    commitDateTime(day)
  }

  function applyTime(hour: number, minute: number) {
    setDraftTime({ hour, minute })
    const base = selected ?? addHours(new Date(), urgency === 'critical' ? 2 : 6)
    const next = setMinutes(setHours(base, hour), minute)
    onChange(toLocalDateTimeValue(next))
  }

  const display = selected
    ? mode === 'date'
      ? format(selected, 'd MMM yyyy')
      : format(selected, "EEE, d MMM · h:mm a")
    : placeholder

  const urgencyTone = urgency === 'critical' ? 'critical' : urgency === 'standard' ? 'standard' : 'urgent'

  return (
    <div className={`hemora-cal ${open ? 'is-open' : ''}`} ref={rootRef} data-urgency={urgencyTone}>
      <button
        type="button"
        id={id}
        className={`hemora-cal-trigger ${error ? 'has-error' : ''} ${selected ? 'has-value' : ''}`}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span className="hemora-cal-trigger-icon">{mode === 'date' ? <CalendarDays /> : <Clock3 />}</span>
        <span className="hemora-cal-trigger-copy">
          <strong>{display}</strong>
          {selected && mode === 'datetime' && <small>Hospital need time</small>}
          {selected && mode === 'date' && <small>Last recorded donation</small>}
          {!selected && <small>{mode === 'date' ? 'Optional for new donors' : 'When should donors aim to arrive?'}</small>}
        </span>
        <span className="hemora-cal-chevron" aria-hidden>{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="hemora-cal-panel" role="dialog" aria-label={mode === 'date' ? 'Choose donation date' : 'Choose needed-by time'}>
          <div className="hemora-cal-presets" role="list">
            {presets.map((preset) => (
              <button key={preset.id} type="button" className="hemora-cal-chip" onClick={preset.apply}>
                {preset.label}
              </button>
            ))}
          </div>

          <div className="hemora-cal-monthbar">
            <button type="button" className="hemora-cal-nav" aria-label="Previous month" onClick={() => setMonth((m) => subMonths(m, 1))}>
              <ChevronLeft />
            </button>
            <strong>{format(month, 'MMMM yyyy')}</strong>
            <button type="button" className="hemora-cal-nav" aria-label="Next month" onClick={() => setMonth((m) => addMonths(m, 1))}>
              <ChevronRight />
            </button>
          </div>

          <div className="hemora-cal-weekdays">
            {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
          </div>

          <div className="hemora-cal-grid">
            {days.map((day) => {
              const disabled = isDisabled(day)
              const inMonth = isSameMonth(day, month)
              const active = selected ? isSameDay(day, selected) : false
              const today = isToday(day)
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  disabled={disabled}
                  className={[
                    'hemora-cal-day',
                    inMonth ? 'in-month' : 'out-month',
                    active ? 'is-selected' : '',
                    today ? 'is-today' : '',
                    disabled ? 'is-disabled' : ''
                  ].filter(Boolean).join(' ')}
                  onClick={() => selectDay(day)}
                  aria-pressed={active}
                  aria-label={format(day, 'EEEE, d MMMM yyyy')}
                >
                  {format(day, 'd')}
                </button>
              )
            })}
          </div>

          {mode === 'datetime' && (
            <div className="hemora-cal-times">
              <div className="hemora-cal-times-label"><Clock3 /><span>Preferred arrival window</span></div>
              <div className="hemora-cal-times-scroll">
                {TIME_SLOTS.map((slot) => {
                  const active = draftTime.hour === slot.hour && draftTime.minute === slot.minute
                  return (
                    <button
                      key={slot.label}
                      type="button"
                      className={`hemora-cal-time ${active ? 'is-selected' : ''}`}
                      onClick={() => applyTime(slot.hour, slot.minute)}
                    >
                      <strong>{slot.label}</strong>
                      <small>{format(setMinutes(setHours(new Date(), slot.hour), slot.minute), 'h:mm a')}</small>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {mode === 'date' && (
            <div className="hemora-cal-footnote">
              <Droplet />
              <p>Whole-blood donors usually wait about 8 weeks between donations. Exact eligibility is confirmed by the hospital.</p>
            </div>
          )}

          {mode === 'datetime' && (
            <div className="hemora-cal-footnote">
              <Droplet />
              <p>
                {urgency === 'critical'
                  ? 'Critical needs work best with a time within the next few hours.'
                  : urgency === 'urgent'
                    ? 'Urgent requests usually need a clear time in the next day.'
                    : 'Choose a realistic hospital window so donors can plan travel.'}
              </p>
            </div>
          )}
        </div>
      )}

      {hint && !error && <span className="field-help">{hint}</span>}
      {error && <small className="field-error">{error}</small>}
    </div>
  )
}
