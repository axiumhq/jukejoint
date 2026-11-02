import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Credits, CopyField } from '../components/Common';
import { HeroMedia } from '../components/HeroMedia';
import { Icon } from '../components/Icon';
import { LobbyTable } from '../components/LobbyTable';
import { APP_RELEASE } from '../config/brand';
import { modes } from '../data/modes';
import { useDocumentTitle, useLiveStats } from '../hooks';
import { useFeaturedLobby } from '../hooks/useFeatured';
import { useNow } from '../hooks/useNow';
import { formatNumber, t } from '../i18n';
import { EMPTY_FILTERS, filterLobbies } from '../lib/lobbies';
import { useSession } from '../state/session';

/**
 * Home v6, "Minimal + cinema" (docs/design/brief-v6.md). No máximo ~4 telas:
 * herói com a arte-chave em faixas de cinema, lobbies agora, modos, confiança e rodapé.
 */

const BOARD_ROWS = 5;

function Hero() {
  const stats = useLiveStats();
  const [ready, setReady] = useState(false);
  // Um quadro com as faixas fechadas antes de abrir; o timeout cobre abas em que o rAF está parado.
  const onReady = useCallback(() => {
    requestAnimationFrame(() => setReady(true));
    window.setTimeout(() => setReady(true), 120);
  }, []);

  return (
    <section className={`hero${ready ? ' is-ready' : ''}`} aria-labelledby="hero-title">
      <div className="hero-plate">
        <HeroMedia onReady={onReady} />
        <div className="hero-scrim" aria-hidden="true" />
      </div>
      <div className="hero-bar is-top" aria-hidden="true" />
      <div className="hero-bar is-bottom">
        <div className="wrap hero-bar-in">
          <Credits counts={stats} />
        </div>
      </div>
      <div className="hero-shot">
        <div className="wrap">
          <div className="hero-copy">
            <h1 id="hero-title" className="display">
              {t.home.titleLines.map((line) => (
                <span key={line} className="hero-line">
                  {line}{' '}
                </span>
              ))}
            </h1>
            <p className="hero-lead">{t.home.lead}</p>
            <div className="hero-ctas">
              <Link to="/jogar" className="btn btn-primary btn-lg">
                {t.home.play}
                <Icon name="arrowRight" size={16} />
              </Link>
              <a href="#agora" className="link-line">
                {t.home.seeLobbies}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Board() {
  const { lobbies, user, lobbyCtx } = useSession();
  const stats = useLiveStats();
  const now = useNow(5000);
  // Só onde dá para entrar (mais o seu, que fica sempre no topo), na ordem do "Jogar agora".
  const list = useMemo(
    () => filterLobbies(lobbies, { ...EMPTY_FILTERS, slotsOnly: true, sort: 'recomendados' }, !!user, lobbyCtx, now),
    [lobbies, user, lobbyCtx, now],
  );
  const featured = useFeaturedLobby(lobbies, undefined, now);

  return (
    <section id="agora" className="section board" aria-labelledby="board-title">
      <div className="wrap">
        <header className="section-head">
          <h2 id="board-title">{t.home.board.title}</h2>
          <Link to="/lobbies" className="link-line">
            {t.home.board.all(stats.lobbies)}
          </Link>
        </header>
        {list.length > 0 ? (
          <LobbyTable lobbies={list} featured={featured} now={now} variant="board" limit={BOARD_ROWS} label={t.home.board.title} />
        ) : (
          <p className="empty-line">{t.home.board.empty}</p>
        )}
      </div>
    </section>
  );
}

function Modes() {
  const stats = useLiveStats();
  return (
    <section className="section modes-line" aria-labelledby="modes-title">
      <div className="wrap">
        <header className="section-head">
          <h2 id="modes-title">{t.home.modes.title}</h2>
          <Link to="/modos" className="link-line">
            {t.home.modes.all}
          </Link>
        </header>
        <ul className="ml">
          {modes.map((m) => {
            const c = stats.byMode[m.slug];
            return (
              <li key={m.slug} className="ml-item">
                <Link to={`/modos/${m.slug}`} className="ml-name">
                  {m.name}
                </Link>
                <p className="ml-line">{m.line}</p>
                <p className="ml-count">
                  <span className="num">{formatNumber(c?.players ?? 0)}</span> {t.modes.playersNow}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function Trust() {
  return (
    <section className="section trust" aria-labelledby="trust-title">
      <div className="wrap trust-in">
        <h2 id="trust-title">{t.home.trust.title}</h2>
        <div className="trust-body">
          <p>{t.home.trust.what}</p>
          <p>{t.home.trust.hash}</p>
          <CopyField value={APP_RELEASE.sha256} label={t.install.hashTitle} copyLabel={t.install.copyHash} />
          <p>{t.home.trust.av}</p>
          <Link to="/instalar" className="link-line">
            {t.home.trust.link}
          </Link>
        </div>
      </div>
    </section>
  );
}

export function Home() {
  useDocumentTitle(t.meta.home);
  return (
    <>
      <Hero />
      <Board />
      <Modes />
      <Trust />
    </>
  );
}
