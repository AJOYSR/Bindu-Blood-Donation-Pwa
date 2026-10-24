import { MessageCircle, Phone } from 'lucide-react'
import { useT } from '../i18n'

export default function Contacts() {
  const t = useT()

  return <div className="page">
    <header className="container page-header">
      <h1>{t('contacts.title')}</h1>
      <p>{t('contacts.lead')}</p>
    </header>
    <section className="container narrow">
      <article className="card detail-main">
        <h2>{t('contacts.phoneLabel')}</h2>
        <a className="text-link" href="tel:+8801734842381" dir="ltr">01734842381</a>
        <a className="button button-primary button-full button-lg" href="tel:+8801734842381">
          <Phone />{t('contacts.call')}
        </a>
        <a className="button button-secondary button-full button-lg" href="https://wa.me/8801734842381" target="_blank" rel="noopener noreferrer">
          <MessageCircle />{t('contacts.whatsapp')}
        </a>
      </article>
    </section>
  </div>
}
