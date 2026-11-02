import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import { CityScene } from '../components/City';
import { SectionHead } from '../components/Common';
import { LobbyRow } from '../components/LobbyRow';
import { TarotCard } from '../components/TarotCard';
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
      <section className="hero" aria-labelledby="hero-title">
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
                {t.home.stepsInstallLink}
              </Link>
            </div>
          </div>
          <CityScene lobbies={lobbies} />
        </div>
      </section>

      <section className="section container filling" aria-labelledby="filling-title">
        <SectionHead id="filling-title" title={t.home.liveTitle} link={{ to: '/lobbies', label: t.home.hotLink }} />
        <ul className="lobby-list is-mini filling-list">
          {hot.map((l) => (
            <LobbyRow key={l.id} lobby={l} mini />
          ))}
        </ul>
      </section>

      <section className="section container" aria-labelledby="modes-title">
        <SectionHead id="modes-title" title={t.home.modesTitle} link={{ to: '/modos', label: t.home.modesLink }} />
        <div className="spread" style={{ '--n': featured.length } as CSSProperties}>
          {featured.map((m, i) => {
            const off = i - (featured.length - 1) / 2;
            const fan = { '--rot': `${off * 3}deg`, '--drop': `${Math.abs(off) * 0.6}rem` } as CSSProperties;
            return <TarotCard key={m.slug} mode={m} style={fan} />;
          })}
        </div>
      </section>

      <section className="section container" aria-labelledby="how-title">
        <SectionHead id="how-title" title={t.home.howTitle} />
        <ol className="route">
          {t.home.steps.map((s, i) => (
            <li key={s.title} className="route-stop">
              <span className="route-num num" aria-hidden="true">
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
