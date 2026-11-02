import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { LobbyTable } from '../components/LobbyTable';
import { ModeArt } from '../components/ModeArt';
import { getMode, modes } from '../data/modes';
import { releases } from '../data/patches';
import { useDocumentTitle, useLiveStats } from '../hooks';
import { useFeaturedLobby } from '../hooks/useFeatured';
import { useNow } from '../hooks/useNow';
import { formatDate, formatNumber, formatShortDate, t } from '../i18n';
import { EMPTY_FILTERS, filterLobbies } from '../lib/lobbies';
import { useSession } from '../state/session';
import { NotFound } from './NotFound';

export function ModePage() {
  const { slug } = useParams();
  const mode = getMode(slug);
  const { lobbies, requestJoin, openHost, lobbyCtx, user } = useSession();
  const stats = useLiveStats();
  const now = useNow(5000);
  useDocumentTitle(mode ? t.meta.mode(mode.name) : t.meta.notFound);
  const featured = useFeaturedLobby(lobbies, mode?.slug ?? '__none__', now);
  const modeLobbies = useMemo(
    () => (mode ? filterLobbies(lobbies, { ...EMPTY_FILTERS, mode: mode.slug }, !!user, lobbyCtx, now).filter((l) => l.modeSlug === mode.slug) : []),
    [lobbies, mode, user, lobbyCtx, now],
  );

  if (!mode) return <NotFound title={t.modes.notFoundTitle} body={t.modes.notFoundBody} />;

  const c = stats.byMode[mode.slug] ?? { players: 0, lobbies: 0, withRoom: 0 };
  const recent = releases
    .flatMap((r) => r.changes.filter((ch) => ch.scope === mode.slug).map((ch) => ({ ...ch, version: r.version, date: r.date })))
    .slice(0, 4);
  const others = modes.filter((m) => m.slug !== mode.slug);

  return (
    <div className="page mode-page">
      <div className="wrap">
        <nav aria-label={t.a11y.breadcrumb} className="crumbs">
          <ol>
            <li>
              <Link to="/modos">{t.modes.breadcrumb}</Link>
            </li>
            <li aria-current="page">{mode.name}</li>
          </ol>
        </nav>

        <header className="mode-head">
          <div className="mode-head-copy">
            <h1>{mode.name}</h1>
            <p className="lead">{mode.tagline}</p>
            <p className="fine">
              {t.modes.by} {mode.author}
            </p>
            <dl className="facts">
              <div>
                <dt>{t.modes.facts.players}</dt>
                <dd className="num">{formatNumber(c.players)}</dd>
              </div>
              <div>
                <dt>{t.modes.facts.lobbies}</dt>
                <dd className="num">{formatNumber(c.lobbies)}</dd>
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
            <div className="actions">
              {featured && (
                <button type="button" className="btn btn-primary btn-lg" onClick={() => requestJoin({ kind: 'lobby', lobby: featured })} aria-describedby="join-hint">
                  {t.modes.joinLobby}
                </button>
              )}
              <button type="button" className={`btn btn-lg ${featured ? 'btn-line' : 'btn-primary'}`} onClick={() => openHost(mode.slug)}>
                {t.modes.host}
              </button>
            </div>
            <p id="join-hint" className="fine">
              {featured ? t.modes.joinHint(c.withRoom) : t.modes.noLobbies}
            </p>
          </div>
          <ModeArt mode={mode} label={t.modes.artLabel(mode.name)} className="mode-head-art" />
        </header>

        <section className="section-tight" aria-labelledby="mode-lobbies-title">
          <header className="section-head">
            <h2 id="mode-lobbies-title">{t.lobbies.modeListTitle}</h2>
            <Link to={`/?modo=${mode.slug}#lobbies`} className="link-line">
              {t.lobbies.modeListAll}
            </Link>
          </header>
          {modeLobbies.length > 0 ? (
            <LobbyTable lobbies={modeLobbies} featured={featured} now={now} label={`${t.lobbies.modeListTitle}: ${mode.name}`} />
          ) : (
            <p className="empty-line">{t.lobbies.modeListEmpty(mode.name)}</p>
          )}
        </section>

        <div className="mode-cols">
          <div className="prose">
            <h2>{t.modes.about}</h2>
            {mode.description.map((p) => (
              <p key={p}>{p}</p>
            ))}
            <h2>{t.modes.rules}</h2>
            <ul className="rules">
              {mode.rules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>

          <aside className="mode-side">
            {mode.leaderboard.length > 0 && (
              <section aria-labelledby="rank-title">
                <h2 id="rank-title" className="h-side">
                  {t.modes.leaderboard}
                </h2>
                <table className="rank">
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
                        <td className="num">{i + 1}</td>
                        <th scope="row">
                          {e.player} <span className="fine">{t.regions[e.region]}</span>
                        </th>
                        <td className="num">{formatNumber(e.wins)}</td>
                        <td className="num">{formatNumber(e.rating)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            <section aria-labelledby="cl-title">
              <h2 id="cl-title" className="h-side">
                {t.modes.changelog}
              </h2>
              {recent.length ? (
                <ul className="digest">
                  {recent.map((ch) => (
                    <li key={ch.text}>
                      <p className="digest-meta">
                        {t.categories[ch.category]}, {ch.version}, <time dateTime={ch.date}>{formatShortDate(ch.date)}</time>
                      </p>
                      <p>{ch.text}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="fine">{t.modes.changelogEmpty}</p>
              )}
              <Link to={`/novidades?modo=${mode.slug}`} className="link-line">
                {t.modes.changelogLink}
              </Link>
            </section>
            <p className="fine">
              {t.modes.facts.updated} <time dateTime={mode.updatedAt}>{formatDate(mode.updatedAt)}</time>
            </p>
          </aside>
        </div>

        <nav className="others" aria-labelledby="others-title">
          <h2 id="others-title" className="h-side">
            {t.modes.others}
          </h2>
          <ul>
            {others.map((m) => (
              <li key={m.slug}>
                <Link to={`/modos/${m.slug}`}>{m.name}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}

export function ModesIndex() {
  useDocumentTitle(t.meta.modes);
  const stats = useLiveStats();
  return (
    <div className="page modes-page">
      <div className="wrap">
        <header className="page-head">
          <div>
            <h1>{t.modes.title}</h1>
            <p className="lead">{t.modes.lead}</p>
          </div>
        </header>
        <ul className="mi">
          {modes.map((m) => {
            const c = stats.byMode[m.slug] ?? { players: 0, lobbies: 0, withRoom: 0 };
            return (
              <li key={m.slug} className="mi-row">
                <h2 className="mi-name">
                  <Link to={`/modos/${m.slug}`}>{m.name}</Link>
                </h2>
                <p className="mi-line">{m.line}</p>
                <p className="mi-format">{t.modes.formatValue(m.format, m.minPlayers, m.maxPlayers)}</p>
                <p className="mi-count">
                  <span className="num">{formatNumber(c.players)}</span> {t.modes.playersNow}
                  <br />
                  <span className="num">{formatNumber(c.lobbies)}</span> {t.lobbies.resultsUnit(c.lobbies)}
                </p>
                <ModeArt mode={m} className="mi-art" />
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
