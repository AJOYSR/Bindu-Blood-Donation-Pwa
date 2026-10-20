import { BadgeCheck, BellRing, Download, Eye, HeartPulse, LockKeyhole, Moon, LogOut, MapPin, Phone, Save, ShieldCheck, Trash2, Upload, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../app/AppContext'
import { useAuth } from '../app/AuthContext'
import { DateTimePicker } from '../components/DateTimePicker'
import { useReasonDialog } from '../components/ReasonDialog'
import { Skeleton, Spinner } from '../components/Skeleton'
import { useT } from '../i18n'
import { track } from '../lib/analytics'
import { reportError } from '../lib/monitoring'
import { bloodGroups, districts } from '../lib/mock-data'
import { exportMyData, fetchMemberProfile, persistAvailability, recordConsent, requestAccountDeletion, saveMemberProfile, saveNotificationPreferences, submitVerification, type MemberProfile } from '../lib/api'
import { registerPushSubscription } from '../lib/push'
import { flushAvailabilityQueue, queueAvailabilityUpdate } from '../lib/offline-queue'
import type { BloodGroup } from '../types'

type Tab = 'profile' | 'privacy' | 'notifications' | 'verification'

interface Prefs { critical: boolean; responses: boolean; reminders: boolean }

export default function Profile() {
  const { notify } = useApp()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const t = useT()
  const [tab, setTab] = useState<Tab>('profile')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [profile, setProfile] = useState<MemberProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [availabilitySaving, setAvailabilitySaving] = useState(false)
  const [lastDonation, setLastDonation] = useState('')
  const [prefs, setPrefs] = useState<Prefs>({ critical: true, responses: true, reminders: true })
  const { ask, dialog } = useReasonDialog()

  const tabs: { value: Tab; label: string; icon: typeof Eye }[] = [
    { value: 'profile', label: t('profile.tab.profile'), icon: UserRound },
    { value: 'notifications', label: t('profile.tab.alerts'), icon: BellRing },
    { value: 'privacy', label: t('profile.tab.privacy'), icon: LockKeyhole },
    { value: 'verification', label: t('profile.tab.verify'), icon: BadgeCheck }
  ]

  useEffect(() => {
    let active = true
    void fetchMemberProfile()
      .then((data) => {
        if (!active) return
        setProfile(data)
        setLastDonation(data?.lastDonation ?? '')
      })
      .catch((error) => notify(t('profile.toast.loadFail'), error instanceof Error ? error.message : t('common.pleaseTryAgain'), 'danger'))
      .finally(() => { if (active) setLoading(false) })
    void flushAvailabilityQueue(persistAvailability).then((flushed) => {
      if (flushed) notify(t('profile.toast.offlineSync'), t('profile.toast.offlineSyncMsg'), 'success')
    }).catch(() => undefined)
    return () => { active = false }
  }, [notify, t])

  const displayName = profile?.displayName || String(user?.user_metadata?.display_name || user?.email?.split('@')[0] || t('common.member'))
  const initials = displayName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    const data = new FormData(event.currentTarget)
    const next = {
      displayName: String(data.get('displayName')),
      phone: String(data.get('phone')),
      bloodGroup: String(data.get('bloodGroup')) as BloodGroup,
      district: String(data.get('district')),
      area: String(data.get('area')),
      lastDonation: lastDonation || null,
      searchable: data.get('searchable') === 'on',
      showMaskedPhone: data.get('showMaskedPhone') === 'on'
    }
    try {
      await saveMemberProfile(next)
      await recordConsent('donor_directory_visibility', next.searchable)
      setLastDonation(next.lastDonation ?? '')
      setProfile((current) => current ? { ...current, ...next } : current)
      notify(t('profile.toast.saved'), t('profile.toast.savedMsg'), 'success')
    } catch (error) {
      reportError(error, { source: 'profile', action: 'save' })
      notify(t('profile.toast.saveFail'), error instanceof Error ? error.message : t('common.pleaseTryAgain'), 'danger')
    } finally {
      setSaving(false)
    }
  }

  const toggleAvailability = async () => {
    if (!profile) return
    setAvailabilitySaving(true)
    const next = !profile.available
    try {
      if (!navigator.onLine) {
        queueAvailabilityUpdate(next)
        setProfile({ ...profile, available: next })
        track('availability_changed', { available: next, offline: true })
        notify(t('profile.toast.queued'), t('profile.toast.queuedMsg'), 'success')
        return
      }
      await persistAvailability(next)
      setProfile({ ...profile, available: next })
      track('availability_changed', { available: next, offline: false })
      notify(
        next ? t('profile.toast.availableOn') : t('profile.toast.availableOff'),
        next ? t('profile.toast.availableOnMsg') : t('profile.toast.availableOffMsg'),
        'success'
      )
    } catch (error) {
      reportError(error, { source: 'profile', action: 'availability' })
      notify(t('profile.toast.availabilityFail'), error instanceof Error ? error.message : t('common.pleaseTryAgain'), 'danger')
    } finally {
      setAvailabilitySaving(false)
    }
  }

  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setUploading(true)
    track('verification_upload_started')
    try {
      await submitVerification(file)
      track('verification_upload_completed')
      notify(t('profile.toast.verifyOk'), t('profile.toast.verifyOkMsg'), 'success')
    } catch (error) {
      reportError(error, { source: 'profile', action: 'verification_upload' })
      notify(t('profile.toast.uploadFail'), error instanceof Error ? error.message : t('common.pleaseTryAgain'), 'danger')
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  const exportData = async () => {
    try {
      const payload = await exportMyData()
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `bindu-export-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(url)
      track('data_exported')
      notify(t('profile.toast.exportOk'), t('profile.toast.exportOkMsg'), 'success')
    } catch (error) {
      reportError(error, { source: 'profile', action: 'export' })
      notify(t('profile.toast.exportFail'), error instanceof Error ? error.message : t('common.pleaseTryAgain'), 'danger')
    }
  }

  const deleteAccount = async () => {
    const reason = await ask({
      title: t('profile.deleteTitle'),
      description: t('profile.deleteDesc'),
      label: t('profile.deleteLabel'),
      placeholder: t('profile.deletePlaceholder'),
      presets: [
        t('profile.preset.noDonate'),
        t('profile.preset.notifications'),
        t('profile.preset.privacy'),
        t('profile.preset.second')
      ],
      confirmLabel: t('profile.deleteConfirm'),
      footnote: t('profile.deleteFootnote'),
      tone: 'danger'
    })
    if (!reason) return
    try {
      await requestAccountDeletion(reason)
      track('account_deletion_requested')
      notify(t('profile.toast.deleteOk'), t('profile.toast.deleteOkMsg'), 'success')
    } catch (error) {
      reportError(error, { source: 'profile', action: 'delete_account' })
      notify(t('profile.toast.deleteFail'), error instanceof Error ? error.message : t('common.pleaseTryAgain'), 'danger')
    }
  }

  const enablePush = async () => {
    try {
      await registerPushSubscription()
      notify(t('profile.toast.pushOk'), t('profile.toast.pushOkMsg'), 'success')
    } catch (error) {
      notify(t('profile.toast.pushFail'), error instanceof Error ? error.message : 'Configure VITE_VAPID_PUBLIC_KEY.', 'danger')
    }
  }

  const updatePref = async (key: keyof Prefs, value: boolean) => {
    const next = { ...prefs, [key]: value }
    setPrefs(next)
    try {
      await saveNotificationPreferences({ critical_matches: next.critical, response_updates: next.responses, eligibility_reminders: next.reminders })
    } catch (error) {
      setPrefs(prefs)
      notify(t('profile.toast.prefsFail'), error instanceof Error ? error.message : t('common.pleaseTryAgain'), 'danger')
    }
  }

  const logout = async () => { await signOut(); navigate('/', { replace: true }) }

  return <div className="page">
    <div className="container narrow">
      <header className="profile-head">
        <span className="avatar-lg">{initials}</span>
        <div><h1>{displayName}</h1><p>{profile?.email || user?.email}</p></div>
        <button className="icon-button" aria-label={t('profile.signOut')} title={t('profile.signOut')} onClick={() => void logout()}><LogOut /></button>
      </header>

      <div className="segmented is-scroll settings-tabs" role="tablist" aria-label={t('profile.tabsAria')}>
        {tabs.map(({ value, label, icon: Icon }) => <button
          key={value}
          type="button"
          role="tab"
          aria-selected={tab === value}
          className={tab === value ? 'is-active' : ''}
          onClick={() => setTab(value)}
        ><Icon />{label}</button>)}
      </div>

      {loading ? <div className="profile-loading" role="status" aria-busy="true" aria-label={t('profile.loading')}>
          <Skeleton height={86} radius={24} />
          <div className="card" style={{ display: 'grid', gap: 16 }}>
            <Skeleton width="40%" height={18} />
            <div className="form-grid">{Array.from({ length: 6 }, (_, i) => <div key={i} style={{ display: 'grid', gap: 8 }}><Skeleton width="35%" height={12} /><Skeleton height={50} radius={12} /></div>)}</div>
            <Skeleton height={54} radius={14} />
          </div>
        </div>
        : tab === 'profile' && profile ? <div className="settings-card">
          <div className={profile.available ? 'status-card is-on' : 'status-card'}>
            <span className="status-card-icon">{profile.available ? <HeartPulse /> : <Moon />}</span>
            <div className="status-copy">
              <strong>{profile.available ? t('profile.available') : t('profile.unavailable')}</strong>
              <small>{t('profile.availableHint')}</small>
            </div>
            <button type="button" role="switch" aria-checked={profile.available} aria-label={t('profile.available')} className="switch-button" disabled={availabilitySaving} onClick={() => void toggleAvailability()}>
              <span className={profile.available ? 'switch-ui is-on' : 'switch-ui'} />
            </button>
          </div>

          <form className="card settings-card" onSubmit={save}>
            <header><h2>{t('profile.detailsTitle')}</h2><p>{t('profile.detailsLead')}</p></header>
            <div className="form-grid">
              <label>{t('profile.displayName')}<input name="displayName" defaultValue={profile.displayName} required minLength={2} autoComplete="name" /></label>
              <label>{t('profile.bloodGroup')}<select name="bloodGroup" defaultValue={profile.bloodGroup}>{bloodGroups.map((group) => <option key={group}>{group}</option>)}</select></label>
              <label>{t('profile.phone')}
                <div className="input-with-icon"><Phone /><input name="phone" type="tel" defaultValue={profile.phone} placeholder={t('profile.phonePlaceholder')} inputMode="tel" autoComplete="tel" /></div>
                <span className="field-help">{t('profile.phoneHelp')}</span>
              </label>
              <label>{t('profile.email')}<input value={profile.email || user?.email || ''} disabled /><span className="field-help">{t('profile.emailHelp')}</span></label>
              <label>{t('profile.district')}<select name="district" defaultValue={profile.district}>{districts.map((district) => <option key={district}>{district}</option>)}</select></label>
              <label>{t('profile.area')}<input name="area" defaultValue={profile.area} placeholder={t('profile.areaPlaceholder')} required /></label>
              <div className="span-2 field">
                <span className="field-label">{t('profile.lastDonation')}</span>
                <DateTimePicker
                  mode="date"
                  value={lastDonation}
                  onChange={setLastDonation}
                  max={new Date()}
                  placeholder={t('profile.lastDonationPlaceholder')}
                  hint={t('profile.lastDonationHint')}
                />
              </div>
            </div>

            <div>
              <label className="setting-row">
                <div><strong>{t('profile.searchable')}</strong><small>{t('profile.searchableHint')}</small></div>
                <input type="checkbox" name="searchable" defaultChecked={profile.searchable} />
                <span className="switch-ui" aria-hidden />
              </label>
              <label className="setting-row">
                <div><strong>{t('profile.maskedPhone')}</strong><small>{t('profile.maskedPhoneHint')}</small></div>
                <input type="checkbox" name="showMaskedPhone" defaultChecked={profile.showMaskedPhone} />
                <span className="switch-ui" aria-hidden />
              </label>
            </div>

            <button className="button button-primary button-full button-lg" disabled={saving} aria-busy={saving}>{saving ? <Spinner /> : <Save />}{saving ? t('profile.saving') : t('profile.save')}</button>
          </form>
        </div>

        : tab === 'notifications' ? <section className="card settings-card">
          <header><h2>{t('profile.alertsTitle')}</h2><p>{t('profile.alertsLead')}</p></header>
          <div>
            <PreferenceRow title={t('profile.pref.critical')} text={t('profile.pref.criticalHint')} checked={prefs.critical} onChange={(on) => void updatePref('critical', on)} />
            <PreferenceRow title={t('profile.pref.responses')} text={t('profile.pref.responsesHint')} checked={prefs.responses} onChange={(on) => void updatePref('responses', on)} />
            <PreferenceRow title={t('profile.pref.reminders')} text={t('profile.pref.remindersHint')} checked={prefs.reminders} onChange={(on) => void updatePref('reminders', on)} />
          </div>
          <button className="button button-secondary button-full" type="button" onClick={() => void enablePush()}><BellRing />{t('profile.push')}</button>
        </section>

        : tab === 'privacy' ? <section className="card settings-card">
          <header><h2>{t('profile.privacyTitle')}</h2><p>{t('profile.privacyLead')}</p></header>
          <div className="privacy-list">
            <div><Eye /><span><strong>{t('profile.public')}</strong><p>{t('profile.publicText')}</p></span></div>
            <div><LockKeyhole /><span><strong>{t('profile.private')}</strong><p>{t('profile.privateText')}</p></span></div>
            <div><MapPin /><span><strong>{t('profile.location')}</strong><p>{t('profile.locationText')}</p></span></div>
          </div>
          <div className="privacy-actions">
            <button className="button button-secondary" type="button" onClick={() => void exportData()}><Download />{t('profile.export')}</button>
            <button className="button button-secondary" type="button" onClick={() => void recordConsent('marketing_contact', false).then(() => notify(t('profile.toast.consentWithdrawn'), t('profile.toast.consentWithdrawnMsg'), 'success'))}><LockKeyhole />{t('profile.withdrawMarketing')}</button>
            <button className="button button-secondary danger-button" type="button" onClick={() => void deleteAccount()}><Trash2 />{t('profile.delete')}</button>
          </div>
        </section>

        : <section className="card verify-panel">
          <span className="verify-icon"><BadgeCheck /></span>
          <h2>{t('profile.verifyTitle')}</h2>
          <p>{t('profile.verifyText')}</p>
          <label className="button button-primary button-lg">
            {uploading ? <Spinner /> : <Upload />}{uploading ? t('profile.uploading') : t('profile.upload')}
            <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" hidden disabled={uploading} onChange={upload} />
          </label>
          <span><ShieldCheck />{t('profile.docsPrivate')}</span>
        </section>}
    </div>
    {dialog}
  </div>
}

function PreferenceRow({ title, text, checked, onChange }: { title: string; text: string; checked: boolean; onChange: (on: boolean) => void }) {
  return <label className="setting-row">
    <div><strong>{title}</strong><small>{text}</small></div>
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <span className="switch-ui" aria-hidden />
  </label>
}
