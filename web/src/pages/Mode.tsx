import { useLayoutEffect, useState, type CSSProperties } from 'react';
import { Link, useParams } from 'react-router';
import { Setback } from '../components/Deco';
import { Icon } from '../components/Icon';
import { ModeArt } from '../components/ModeArt';
import { modeTransitionName, TarotCard } from '../components/TarotCard';
import { getMode, modes } from '../data/modes';
import { releases } from '../data/patches';
import { useDocumentTitle, useReducedMotion } from '../hooks';
import { formatDate, formatNumber, formatShortDate, t } from '../i18n';
import { DaySessions, QuorumAsk } from '../components/DaySessions';
import { LobbyRow } from '../components/LobbyRow';
import { useNow } from '../hooks/useNow';
import { EMPTY_FILTERS, filterLobbies, hasRoom, pickBestLobby } from '../lib/lobbies';
import { markViewReady } from '../lib/viewTransition';
import { useSession } from '../state/session';
import { NotFound } from './NotFound';

export function ModePage() {
  const { slug } = useParams();
  const mode = getMode(slug);
  const reduced = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const { lobbies, requestJoin, openHost, lobbyCtx, user } = useSession();
  const now = useNow(5000);
  useDocumentTitle(mode ? t.meta.mode(mode.name) : t.meta.notFound);
  // Avisa a View Transition (se houver) que a página do modo já está no DOM.
  useLayoutEffect(() => {
    markViewReady();
  }, [slug]);

  if (!mode) return <NotFound title={t.modes.notFoundTitle} body={t.modes.notFoundBody} />;

  const open = lobbies.filter((l) => l.modeSlug === mode.slug && hasRoom(l));
  const best = pickBestLobby(lobbies, { mode: mode.slug, ctx: lobbyCtx, now });
  const modeLobbies = filterLobbies(lobbies, { ...EMPTY_FILTERS, mode: mode.slug }, !!user, lobbyCtx, now).filter((l) => l.modeSlug === mode.slug);
  const recent = releases
    .flatMap((r) => r.changes.filter((c) => c.scope === mode.slug).map((c) => ({ ...c, version: r.version, date: r.date })))
    .slice(0, 4);
  const others = modes.filter((m) => m.slug !== mode.slug).slice(0, 3);
  const playing = !reduced && !paused;

  return (
    <div className="container page">
      <nav aria-label={t.a11y.breadcrumb} className="breadcrumb">
        <ol>
          <li>
            <Link to="/modos">{t.modes.breadcrumb}</Link>
          </li>
          <li aria-current="page">{mode.name}</li>
        </ol>
      </nav>

      <section className="mode-hero" aria-labelledby="mode-title">
        <div className="mode-hero-art" style={{ viewTransitionName: modeTransitionName(mode.slug) } as CSSProperties}>
          <Setback className="frame-crown" />
          <ModeArt mode={mode} playing={playing} label={t.modes.artLabel(mode.name)} />
          {!reduced && (
            <button
              type="button"
              className="art-toggle"
              aria-pressed={paused}
              aria-label={paused ? t.a11y.play : t.a11y.pause}
              onClick={() => setPaused((v) => !v)}
            >
              <Icon name={paused ? 'play' : 'pause'} size={16} />
            </button>
          )}
        </div>
        <div className="mode-hero-copy">
          <h1 id="mode-title">{mode.name}</h1>
          <p className="page-lead">{mode.tagline}</p>
          <p className="mode-author">
            {t.modes.by} <strong>{mode.author}</strong>
          </p>
          <dl className="facts">
            <div>
              <dt>{t.modes.facts.players}</dt>
              <dd>
                <span className="live-dot" aria-hidden="true" />
                <span className="num">{formatNumber(mode.playersNow)}</span>
              </dd>
            </div>
            <div>
              <dt>{t.modes.facts.lobbies}</dt>
              <dd className="num">{open.length}</dd>
            </div>
            <div>
              <dt>{t.modes.facts.format}</dt>
              <dd>{t.modes.formatValue(mode.format, mode.minPlayers, mode.maxPlayers)}</dd>
            </div>
            <div>
              <dt>{t.modes.facts.duration}</dt>
              <dd>{t.modes.durationValue(mode.durationMin)}</dd>
            </div>
          </dl>
          <div className="hero-actions">
            {best ? (
              <button type="button" className="btn btn-primary btn-lg" onClick={() => requestJoin({ kind: 'lobby', lobby: best })} aria-describedby="join-hint">
                {t.modes.joinLobby}
              </button>
            ) : null}
            <button type="button" className={`btn btn-lg ${best ? 'btn-ghost' : 'btn-primary'}`} onClick={() => openHost(mode.slug)}>
              {t.modes.host}
            </button>
          </div>
          <p id="join-hint" className="hint">
            {best ? t.modes.joinHint(open.length) : t.modes.noLobbies}{' '}
            <Link to={`/lobbies?modo=${mode.slug}`} className="text-link">
              {t.modes.seeLobbies}
            </Link>
          </p>
        </div>
      </section>

      <section className="mode-lobbies" aria-labelledby="mode-lobbies-title">
        <div className="mode-lobbies-list">
          <div className="section-head">
            <h2 id="mode-lobbies-title">
              {t.lobbies.modeListTitle} <span className="section-count num">{modeLobbies.length}</span>
            </h2>
            <Link to={`/lobbies?modo=${mode.slug}`} className="text-link">
              {t.lobbies.modeListAll}
            </Link>
          </div>
          {modeLobbies.length > 0 ? (
            <ul className="lb-list is-compact">
              {modeLobbies.map((l) => (
                <LobbyRow key={l.id} lobby={l} now={now} />
              ))}
            </ul>
          ) : (
            <div className="empty lb-empty is-inline">
              <p>{t.lobbies.modeListEmpty(mode.name)}</p>
              <div className="empty-actions">
                <button type="button" className="btn btn-outline" onClick={() => openHost(mode.slug)}>
                  {t.modes.host}
                </button>
                <QuorumAsk mode={mode.slug} />
              </div>
            </div>
          )}
        </div>
        <DaySessions mode={mode.slug} headingLevel={2} />
      </section>

      <div className="mode-columns">
        <div className="mode-col-main">
          <section aria-labelledby="about-title" className="prose">
            <h2 id="about-title">{t.modes.about}</h2>
            {mode.description.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </section>
          <section aria-labelledby="rules-title" className="prose">
            <h2 id="rules-title">{t.modes.rules}</h2>
            <ul className="rules">
              {mode.rules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </section>
        </div>

        <div className="mode-col-side">
          {mode.leaderboard.length > 0 && (
            <section aria-labelledby="lb-title" className="panel">
              <h2 id="lb-title">{t.modes.leaderboard}</h2>
              <table className="leaderboard">
                <thead>
                  <tr>
                    <th scope="col">
                      <span className="sr-only">{t.modes.leaderboardCols.pos}</span>
                    </th>
                    <th scope="col">{t.modes.leaderboardCols.player}</th>
                    <th scope="col">{t.modes.leaderboardCols.wins}</th>
                    <th scope="col">{t.modes.leaderboardCols.rating}</th>
                  </tr>
                </thead>
                <tbody>
                  {mode.leaderboard.map((e, i) => (
                    <tr key={e.player}>
                      <td className="lb-pos">{i + 1}</td>
                      <th scope="row">
                        {e.player} <span className="lb-region">{t.regions[e.region]}</span>
                      </th>
                      <td className="num">{formatNumber(e.wins)}</td>
                      <td className="num">{formatNumber(e.rating)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <section aria-labelledby="cl-title" className="panel">
            <h2 id="cl-title">{t.modes.changelog}</h2>
            {recent.length ? (
              <ul className="digest">
                {recent.map((c) => (
                  <li key={c.text}>
                    <span className={`cat cat-${c.category}`}>{t.categories[c.category]}</span>
                    <p>{c.text}</p>
                    <p className="digest-meta">
                      {c.version}, <time dateTime={c.date}>{formatShortDate(c.date)}</time>
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">{t.modes.changelogEmpty}</p>
            )}
            <Link to={`/novidades?modo=${mode.slug}`} className="text-link">
              {t.modes.changelogLink}
            </Link>
          </section>
          <p className="fine">
            {t.modes.facts.updated} <time dateTime={mode.updatedAt}>{formatDate(mode.updatedAt)}</time>
          </p>
        </div>
      </div>

      <section className="section" aria-labelledby="others-title">
        <div className="section-head">
          <h2 id="others-title">{t.modes.others}</h2>
        </div>
        <div className="tarot-row">
          {others.map((m) => (
            <TarotCard key={m.slug} mode={m} size="sm" />
          ))}
        </div>
      </section>
    </div>
  );
}

export function ModesIndex() {
  useDocumentTitle(t.meta.modes);
  return (
    <div className="container page">
      <header className="page-head">
        <h1>{t.modes.title}</h1>
        <p className="page-lead">{t.modes.lead}</p>
      </header>
      <div className="tarot-grid">
        {modes.map((m) => (
          <TarotCard key={m.slug} mode={m} headingLevel={2} />
        ))}
      </div>
    </div>
  );
}
