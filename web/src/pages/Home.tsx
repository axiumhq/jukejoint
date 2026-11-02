import { Link } from 'react-router';
import { LiveStrip, ModeCard, SectionHead } from '../components/Common';
import { LobbyRow } from '../components/LobbyRow';
import { Skyline } from '../components/Skyline';
import { modes } from '../data/modes';
import { useDocumentTitle } from '../hooks';
import { t } from '../i18n';
import { filterLobbies } from '../lib/lobbies';
import { useSession } from '../state/session';

export function Home() {
  useDocumentTitle(t.meta.home);
  const { lobbies } = useSession();
  const hot = filterLobbies(lobbies, { q: '', mode: '', regions: ['BR'], slotsOnly: true, friendsOnly: false, sort: 'cheios' }, false)
    .filter((l) => !l.locked && !l.mine && l.status === 'aberto')
    .slice(0, 4);
  const featured = modes.filter((m) => m.featured);

  return (
    <>
      <section className="hero force-night" aria-labelledby="hero-title">
        <div className="container hero-inner">
          <div className="hero-copy">
            <h1 id="hero-title" className="hero-title">
              {t.home.title}
            </h1>
            <p className="hero-lead">{t.home.lead}</p>
            <div className="hero-actions">
              <Link to="/lobbies" className="btn btn-primary btn-lg">
                {t.home.play}
              </Link>
              <Link to="/instalar" className="btn btn-ghost btn-lg">
                {t.home.howInstall}
              </Link>
            </div>
          </div>
          <LiveStrip />
        </div>
        <Skyline className="hero-skyline" />
      </section>

      <section className="section container" aria-labelledby="hot-title">
        <SectionHead id="hot-title" title={t.home.hotTitle} link={{ to: '/lobbies', label: t.home.hotLink(lobbies.length) }} />
        <ul className="lobby-list">
          {hot.map((l) => (
            <LobbyRow key={l.id} lobby={l} compact />
          ))}
        </ul>
      </section>

      <section className="section container" aria-labelledby="modes-title">
        <SectionHead id="modes-title" title={t.home.modesTitle} link={{ to: '/modos', label: t.home.modesLink }} />
        <div className="mode-grid">
          {featured.map((m) => (
            <ModeCard key={m.slug} mode={m} />
          ))}
        </div>
      </section>

      <section className="section container" aria-labelledby="how-title">
        <SectionHead id="how-title" title={t.home.howTitle} />
        <ol className="steps">
          {t.home.steps.map((s, i) => (
            <li key={s.title} className="step">
              <span className="step-num" aria-hidden="true">
                {i + 1}
              </span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
              {i === 1 && (
                <Link to="/instalar" className="text-link">
                  {t.home.stepsInstallLink}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
