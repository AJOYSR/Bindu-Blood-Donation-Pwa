import { ArrowRight, BadgeCheck, LockKeyhole, Search, ShieldCheck, Stethoscope } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useT } from '../i18n'

export default function About() {
  const t = useT()

  const principles = [
    { icon: Search, title: t('about.p1.title'), text: t('about.p1.text') },
    { icon: LockKeyhole, title: t('about.p2.title'), text: t('about.p2.text') },
    { icon: BadgeCheck, title: t('about.p3.title'), text: t('about.p3.text') },
    { icon: Stethoscope, title: t('about.p4.title'), text: t('about.p4.text') }
  ]

  return <div className="page">
    <header className="container page-header">
      <span className="kicker">{t('about.kicker')}</span>
      <h1>{t('about.title')}</h1>
      <p>{t('about.lead')}</p>
    </header>

    <section className="container">
      <div className="principles">
        {principles.map(({ icon: Icon, title, text }) => <article className="principle" key={title}>
          <span className="principle-icon"><Icon /></span>
          <div><h3>{title}</h3><p>{text}</p></div>
        </article>)}
      </div>
    </section>

    <section className="section container">
      <div className="cta">
        <div>
          <span className="kicker"><ShieldCheck size={14} />{t('about.safe.kicker')}</span>
          <h2>{t('about.safe.title')}</h2>
          <p>{t('about.safe.text')}</p>
        </div>
        <Link to="/requests" className="button button-light button-lg">{t('about.safe.cta')}<ArrowRight /></Link>
      </div>
    </section>

    <section className="container">
      <div className="story">
        <div><span className="kicker">{t('about.story.kicker')}</span><h2>{t('about.story.title')}</h2></div>
        <div className="story-body">
          <p>{t('about.story.p1')}</p>
          <p>{t('about.story.p2')}</p>
          <Link to="/register" className="text-link">{t('about.story.cta')}<ArrowRight /></Link>
        </div>
      </div>
    </section>
  </div>
}
