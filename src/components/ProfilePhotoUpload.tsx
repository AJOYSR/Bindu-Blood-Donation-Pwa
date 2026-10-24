import { Camera, Upload } from 'lucide-react'
import { useRef, type ChangeEvent } from 'react'
import { useT } from '../i18n'
import { Spinner } from './Skeleton'

interface Props {
  photoUrl: string | null
  name: string
  uploading: boolean
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
}

export function ProfilePhotoUpload({ photoUrl, name, uploading, onChange }: Props) {
  const t = useT()
  const inputRef = useRef<HTMLInputElement>(null)
  const initials = name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()

  return <section className="card photo-editor" aria-labelledby="photo-title" aria-busy={uploading}>
    <div className="photo-editor-main">
      <div className="photo-editor-preview">
        {photoUrl ? <img src={photoUrl} alt={name} /> : <span>{initials || <Camera />}</span>}
        {uploading
          ? <span className="photo-editor-progress" aria-hidden="true"><Spinner /></span>
          : <span className="photo-editor-camera" aria-hidden="true"><Camera /></span>}
      </div>
      <div className="photo-editor-content">
        <h2 id="photo-title">{t('profile.photo.title')}</h2>
        <p>{t('profile.photo.public')}</p>
        <div className="photo-editor-actions">
          <button type="button" className="button button-secondary button-sm" disabled={uploading}
            aria-describedby="photo-help" onClick={() => inputRef.current?.click()}>
            {uploading ? <Spinner /> : <Upload />}
            {uploading ? t('profile.uploading') : photoUrl ? t('profile.photo.change') : t('profile.photo.upload')}
          </button>
          <span id="photo-help">{t('profile.photo.help')}</span>
        </div>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden
          aria-label={t('profile.photo.choose')} disabled={uploading} onChange={onChange} />
        <span className="sr-only" role="status">{uploading ? t('profile.uploading') : ''}</span>
      </div>
    </div>
  </section>
}
