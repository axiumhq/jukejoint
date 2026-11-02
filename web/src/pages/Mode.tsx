import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ModeCard } from '../components/Common';
import { Setback } from '../components/Deco';
import { Icon } from '../components/Icon';
import { ModeArt } from '../components/ModeArt';
import { getMode, modes } from '../data/modes';
import { releases } from '../data/patches';
import { useDocumentTitle, useReducedMotion } from '../hooks';
import { formatDate, formatNumber, formatShortDate, t } from '../i18n';
import { bestLobbyForMode, isJoinable } from '../lib/lobbies';
import { useSession } from '../state/session';
import { NotFound } from './NotFound';

export function ModePage() {
  const { slug } = useParams();
  const mode = getMode(slug);
  const reduced = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const { lobbies, requestJoin, openHost } = useSession();
  useDocumentTitle(mode ? t.meta.mode(mode.name) : t.meta.notFound);

  if (!mode) return <NotFound title={t.modes.notFoundTitle} body={t.modes.notFoundBody} />;

  const open = lobbies.filter((l) => l.modeSlug === mode.slug && isJoinable(l));
  const best = bestLobbyForMode(lobbies, mode.slug);
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
        <div className="mode-hero-art">
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
        <div className="mode-rows">
          {others.map((m) => (
            <ModeCard key={m.slug} mode={m} layout="row" />
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
      <div className="mode-grid">
        {modes.map((m) => (
          <ModeCard key={m.slug} mode={m} headingLevel={2} />
        ))}
      </div>
    </div>
  );
}
