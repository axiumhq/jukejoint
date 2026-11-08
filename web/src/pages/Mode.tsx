import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { ArcanoFace, arcanoClass, romano } from '../components/Arcano';
import { CreateReason, SectionTitle } from '../components/Common';
import { FriendRow, FriendStep } from '../components/Friends';
import { Icon } from '../components/Icon';
import { LobbyCard, orderLobbies, type CardEnv } from '../components/LobbyCard';
import { ModeCover } from '../components/ModeCover';
import { Rail, useRail, useRailSignIn } from '../components/Rail';
import type { Lobby } from '../data/lobbies';
import { getMode, getModes, type Mode, type Region } from '../data/modes';
import { releases } from '../data/patches';
import { useDocumentTitle, useFriends, useLiveStats } from '../hooks';
import { useFeaturedLobby } from '../hooks/useFeatured';
import { useCreateBlocked } from '../hooks/useServerStatus';
import { useNow } from '../hooks/useNow';
import { formatDate, formatNumber, formatShortDate, t } from '../i18n';
import { live as L } from '../i18n/live';
import { modosPagina as P } from '../i18n/modos-pagina';
import { EMPTY_FILTERS, filterLobbies, lobbyState, modeArcana, REGIONS } from '../lib/lobbies';
import { useSession } from '../state/session';
import { NotFound } from './NotFound';
import '../styles/modes.css';

/**
 * /modos e /modos/:slug no v8. O índice é a vitrine dos seis modos com as contagens ao vivo;
 * a página do modo abre com a capa larga e a barra de dados, depois regras, lobbies do modo e
 * outros modos. O trilho da página do modo traz o que é só dele: regiões, amigos, ranking e mudanças.
 * Todas as contagens saem de `useLiveStats()` (a mesma fonte do topo e da home).
 */

const EMPTY = { players: 0, lobbies: 0, withRoom: 0 };

/** Menor ping entre os lobbies do modo (com a região), para a barra de dados. */
function bestPing(list: Lobby[]) {
  return list.reduce<Lobby | undefined>((best, l) => (!best || l.ping < best.ping ? l : best), undefined);
}

/** Do modo mais cheio ao mais calmo (empate: a ordem do catálogo). */
function byPlayers(list: Mode[], byMode: Record<string, { players: number } | undefined>) {
  return [...list].sort((a, b) => (byMode[b.slug]?.players ?? 0) - (byMode[a.slug]?.players ?? 0) || modeArcana(a.slug) - modeArcana(b.slug));
}

/** A linha de baixo do arcano: "4 lobbies · 38 jogando", ou "nenhum lobby". */
function ArcanoVivo({ lobbies, players }: { lobbies: number; players: number }) {
  if (!lobbies) return <>{P.lobbies(0)}</>;
  return (
    <>
      <em>{P.lobbies(lobbies)}</em>
      <span className="arc-play"> · {P.playing(players)}</span>
    </>
  );
}

/* ───────── Trilho da página do modo ───────── */

function RegionsNow({ list }: { list: Lobby[] }) {
  const rows = REGIONS.map((r: Region) => {
    const inR = list.filter((l) => l.region === r);
    const ps = inR.map((l) => l.ping);
    return { r, lobbies: inR.length, players: inR.reduce((n, l) => n + l.players, 0), min: Math.min(...ps), max: Math.max(...ps) };
  }).filter((x) => x.lobbies > 0);
  return (
    <section className="rail-sec mr-sec" aria-labelledby="mr-regions">
      <div className="rail-h">
        <h2 className="cap" id="mr-regions">
          {t.modes.regionsTitle}
        </h2>
      </div>
      {rows.length ? (
        <ul className="mr-regions">
          {rows.map((x) => (
            <li key={x.r}>
              <b>{t.regions[x.r]}</b>
              <span>{t.modes.regionRow(x.lobbies, x.players)}</span>
              <span className="num">{x.min === x.max ? t.lobbies.ping(x.min) : `${x.min}–${t.lobbies.ping(x.max)}`}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rail-empty">{t.modes.regionsEmpty}</p>
      )}
    </section>
  );
}

function FriendsHere({ mode, list }: { mode: Mode; list: Lobby[] }) {
  const { user, signIn } = useSession();
  const friends = useFriends();
  // sem login, este bloco mostra o botão: a barra superior não repete (só vale quando não há conta)
  useRailSignIn();
  const ids = new Set(list.map((l) => l.id));
  const here = friends.filter((f) => f.lobbyId && ids.has(f.lobbyId));
  return (
    <section className="rail-sec" aria-labelledby="mr-friends">
      <div className="rail-h">
        <h2 className="cap" id="mr-friends">
          {t.modes.friendsTitle}
          {user && (
            <>
              {' '}
              · <b>{here.length}</b>
            </>
          )}
        </h2>
      </div>
      {!user ? (
        <div className="mr-out">
          <p className="rail-empty">{t.modes.friendsOut}</p>
          <button type="button" className="btn btn-s btn-sm" onClick={signIn}>
            <Icon name="user" />
            {t.account.signIn}
          </button>
        </div>
      ) : here.length ? (
        <ul>
          {here.map((f) => (
            <FriendRow key={f.name} friend={f}>
              <FriendStep friend={f} called={false} onCall={() => undefined} />
            </FriendRow>
          ))}
        </ul>
      ) : (
        <p className="rail-empty">{t.modes.friendsEmpty(mode.name)}</p>
      )}
    </section>
  );
}

function Leaderboard({ mode }: { mode: Mode }) {
  if (!mode.leaderboard.length) return null;
  return (
    <section className="rail-sec" aria-labelledby="mr-rank">
      <div className="rail-h">
        <h2 className="cap" id="mr-rank">
          {t.modes.leaderboard}
        </h2>
      </div>
      <table className="mr-rank">
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
                <span className="mr-p">
                  <span className="mr-pn">{e.player}</span>
                  <span className="mr-reg">{t.regions[e.region]}</span>
                </span>
              </th>
              <td className="num">{formatNumber(e.wins)}</td>
              <td className="num">{formatNumber(e.rating)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function RecentChanges({ mode }: { mode: Mode }) {
  const recent = releases
    .flatMap((r) => r.changes.filter((ch) => ch.scope === mode.slug).map((ch) => ({ ...ch, version: r.version, date: r.date })))
    .slice(0, 4);
  return (
    <section className="rail-sec" aria-labelledby="mr-changes">
      <div className="rail-h">
        <h2 className="cap" id="mr-changes">
          {t.modes.changelog}
        </h2>
      </div>
      {recent.length ? (
        <ul className="mr-changes">
          {recent.map((ch) => (
            <li key={ch.text}>
              <span className="lbl">
                {t.categories[ch.category]} · <span className="num">{ch.version}</span> ·{' '}
                <time dateTime={ch.date} className="num">
                  {formatShortDate(ch.date)}
                </time>
              </span>
              <p>{ch.text}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rail-empty">{t.modes.changelogEmpty}</p>
      )}
      <Link to={`/novidades?modo=${mode.slug}`} className="link mr-more">
        {t.modes.changelogLink}
        <Icon name="arrow" />
      </Link>
    </section>
  );
}

/** Abaixo de 960 px o trilho vira folha: este cartão abre (como o "Amigos" da home). */
function SheetCard({ friends, regions, signedIn }: { friends: number; regions: number; signedIn: boolean }) {
  const { openSheet } = useRail();
  return (
    <button type="button" className="md-sheet" aria-haspopup="dialog" onClick={(e) => openSheet(e.currentTarget)}>
      <Icon name="users" />
      <span className="t">
        <b>{t.modes.sheetOpen}</b>
        <span>{signedIn ? t.modes.sheetOpenSub(friends, regions) : P.sheetOut(regions)}</span>
      </span>
      <Icon name="chev" />
    </button>
  );
}

/* ───────── /modos/:slug ───────── */

export function ModePage() {
  const modes = getModes();
  const { slug } = useParams();
  const mode = getMode(slug);
  const { lobbies, requestJoin, openHost, lobbyCtx, user } = useSession();
  const createBlocked = useCreateBlocked();
  const friends = useFriends();
  const stats = useLiveStats();
  const now = useNow(5000);
  useDocumentTitle(mode ? t.meta.mode(mode.name) : t.meta.notFound);
  const featured = useFeaturedLobby(lobbies, mode?.slug ?? '__none__', now);
  const modeLobbies = useMemo(
    () => (mode ? filterLobbies(lobbies, { ...EMPTY_FILTERS, mode: mode.slug }, !!user, lobbyCtx, now).filter((l) => l.modeSlug === mode.slug) : []),
    [lobbies, mode, user, lobbyCtx, now],
  );
  const all = useMemo(() => (mode ? lobbies.filter((l) => l.modeSlug === mode.slug) : []), [lobbies, mode]);

  if (!mode) return <NotFound title={t.modes.notFoundTitle} body={t.modes.notFoundBody} toModes />;

  const c = stats.byMode[mode.slug] ?? EMPTY;
  const others = byPlayers(
    modes.filter((m) => m.slug !== mode.slug),
    stats.byMode,
  );
  // o lobby em que você está (entrou ou abriu) não conta como "com vaga" nem entra no menor ping
  const here = lobbyCtx.hereId ? all.find((l) => l.id === lobbyCtx.hereId) : undefined;
  const open = all.filter((l) => l.id !== here?.id && !l.mine && lobbyState(l, lobbyCtx, now).canJoin);
  const ping = bestPing(open);
  const env: CardEnv = { ctx: lobbyCtx, signedIn: !!user, me: user?.name ?? t.lobbies.you, friends, now };
  const ordered = orderLobbies(modeLobbies, lobbyCtx, featured);
  const ids = new Set(all.map((l) => l.id));
  const friendsHere = user ? friends.filter((f) => f.lobbyId && ids.has(f.lobbyId)).length : 0;
  const regionCount = new Set(all.map((l) => l.region)).size;

  return (
    <>
      <section className="md-hero" aria-labelledby="mode-title">
        <ModeCover slug={mode.slug} wide />
        <div className="md-shade" aria-hidden="true" />
        <div className="md-hb">
          <Link to="/modos" className="md-back">
            <Icon name="back" />
            {t.modes.back}
          </Link>
          <h1 className="display" id="mode-title">
            {mode.name}
          </h1>
          <p className="md-tag">{mode.tagline}</p>
          <ul className="md-chips" aria-label={t.modes.facts.format}>
            <li className="md-chip">{mode.format}</li>
            <li className="md-chip">{t.modes.sizeValue(mode.minPlayers, mode.maxPlayers)}</li>
            <li className="md-chip">{t.modes.durationValue(mode.durationMin)}</li>
            <li className="md-by">
              {t.modes.by} {mode.author}
            </li>
          </ul>
        </div>
      </section>

      <div className="md-bar">
        <dl className="md-facts">
          <div>
            <dt>{t.modes.facts.players}</dt>
            <dd className="num">{formatNumber(c.players)}</dd>
          </div>
          <div>
            <dt>{t.modes.facts.lobbies}</dt>
            <dd className="num">{formatNumber(c.lobbies)}</dd>
          </div>
          <div>
            <dt>{t.modes.withRoomLabel}</dt>
            <dd className="num">{formatNumber(open.length)}</dd>
          </div>
          <div>
            <dt>{P.bestPing}</dt>
            <dd className="num">
              {ping ? (
                <>
                  {ping.ping} ms <span className="md-sub">{t.regions[ping.region]}</span>
                </>
              ) : (
                P.noRoom
              )}
            </dd>
          </div>
        </dl>
        <div className="md-act">
          {featured && (
            <button
              type="button"
              className="btn btn-p btn-lg"
              onClick={() => requestJoin({ kind: 'lobby', lobby: featured })}
              aria-describedby="mode-join-hint"
            >
              <Icon name="bolt" />
              <span className="t-long">{t.modes.playNow}</span>
              <span className="t-short">{t.modes.playNowShort}</span>
            </button>
          )}
          <button
            type="button"
            className={featured ? 'btn btn-s btn-lg' : 'btn btn-p btn-lg'}
            aria-disabled={createBlocked || undefined}
            title={createBlocked ? L.createBlocked : undefined}
            onClick={() => !createBlocked && openHost(mode.slug)}
          >
            <Icon name="plus" />
            <span className="t-long">{t.modes.hostHere}</span>
            <span className="t-short">{t.modes.hostShort}</span>
            <CreateReason blocked={createBlocked} />
          </button>
        </div>
      </div>
      <p id="mode-join-hint" className="md-hint">
        {here ? (
          <>
            {P.here(here.name)}{' '}
            <Link to={`/sala/${encodeURIComponent(here.id)}`} className="link">
              {P.hereOpen}
            </Link>
          </>
        ) : featured ? (
          <>
            {P.playTarget(featured.name, t.regions[featured.region], featured.ping)}
            {P.playAmong(open.length)}
          </>
        ) : (
          t.modes.noLobbies
        )}
        {!user && <> {P.signInToCreate}</>}
      </p>

      <SheetCard friends={friendsHere} regions={regionCount} signedIn={!!user} />

      <div className="md-cols">
        <section className="sec md-sec" aria-labelledby="mode-how">
          <SectionTitle id="mode-how" words={t.modes.howWords} />
          <div className="md-prose">
            {mode.description.map((p) => (
              <p key={p}>{p}</p>
            ))}
            <p className="md-upd">
              {t.modes.facts.updated} <time dateTime={mode.updatedAt}>{formatDate(mode.updatedAt)}</time>
            </p>
          </div>
        </section>
        <section className="sec md-sec" aria-labelledby="mode-rules">
          <SectionTitle id="mode-rules" words={t.modes.rulesWords} meta={t.modes.rulesMeta(mode.rules.length)} />
          <ol className="md-rules">
            {mode.rules.map((r, i) => (
              <li key={r}>
                <span className="md-n" aria-hidden="true">
                  {romano(i + 1)}
                </span>
                <span>{r}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section className="sec md-sec" aria-labelledby="mode-lobbies">
        <SectionTitle id="mode-lobbies" words={t.modes.lobbiesWords} meta={t.modes.lobbiesMeta(c.lobbies, open.length)}>
          <Link to={`/?modo=${mode.slug}#lobbies`} className="link">
            {t.modes.lobbiesAll}
            <Icon name="arrow" />
          </Link>
        </SectionTitle>
        <div className="lgrid md-lgrid">
          {ordered.map((l) => (
            <LobbyCard key={l.id} lobby={l} env={env} featured={featured?.id === l.id} inMode />
          ))}
        </div>
        {ordered.length === 0 && <p className="md-empty">{t.lobbies.modeListEmpty(mode.name)}</p>}
      </section>

      <nav className="sec md-sec" aria-labelledby="mode-others">
        <SectionTitle id="mode-others" words={t.modes.othersWords} meta={P.othersMeta} />
        <ul className="md-arcanos">
          {others.map((m) => {
            const oc = stats.byMode[m.slug] ?? EMPTY;
            return (
              <li key={m.slug}>
                <Link to={`/modos/${m.slug}`} className={arcanoClass(m.slug, { quiet: !oc.lobbies })}>
                  <ArcanoFace slug={m.slug} name={m.name} format={m.format} vivo={<ArcanoVivo lobbies={oc.lobbies} players={oc.players} />} sr={m.line} />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <Rail title={t.modes.sheet}>
        <RegionsNow list={all} />
        <FriendsHere mode={mode} list={all} />
        <Leaderboard mode={mode} />
        <RecentChanges mode={mode} />
      </Rail>
    </>
  );
}

/* ───────── /modos ───────── */

export function ModesIndex() {
  const modes = getModes();
  useDocumentTitle(t.meta.modes);
  const stats = useLiveStats();
  const [top, ...rest] = byPlayers(modes, stats.byMode);
  if (!top) return null;
  const tc = stats.byMode[top.slug] ?? EMPTY;
  return (
    <div className="mi">
      <header className="mi-h">
        <div className="mi-ht">
          <h1 className="display">{t.modes.title} {t.modes.titleWords[1]}</h1>
          <span className="mi-meta">{t.modes.indexMeta(modes.length, formatNumber(stats.players), stats.lobbies)}</span>
        </div>
        <p className="mi-lead">{t.modes.lead}</p>
      </header>

      {/* o mais cheio agora: a pintura larga e os dados; o cartão inteiro abre o modo */}
      <article className="mi-feat" aria-labelledby="mi-feat-n">
        <div className="mi-fcv">
          <ModeCover slug={top.slug} wide />
        </div>
        <div className="mi-fb">
          <span className="mi-kick">
            <span className="mi-rom" aria-hidden="true">
              {romano(modeArcana(top.slug))}
            </span>
            {P.busiest}
          </span>
          <h2 className="display mi-fn" id="mi-feat-n">
            <Link to={`/modos/${top.slug}`}>{top.name}</Link>
          </h2>
          <p className="mi-fl">{top.line}</p>
          <dl className="mi-d">
            <div>
              <dt>{t.modes.facts.playing}</dt>
              <dd className="num">{formatNumber(tc.players)}</dd>
            </div>
            <div>
              <dt>{t.modes.facts.lobbies}</dt>
              <dd className="num">
                {formatNumber(tc.lobbies)} · {t.modes.withRoomOf(tc.withRoom, tc.lobbies)}
              </dd>
            </div>
            <div>
              <dt>{t.modes.facts.duration}</dt>
              <dd className="num">{t.modes.durationValue(top.durationMin)}</dd>
            </div>
          </dl>
          <div className="mi-ff">
            <span className="mi-fmt">
              {top.format} · {t.modes.sizeValue(top.minPlayers, top.maxPlayers)}
            </span>
            <Link to={`/modos/${top.slug}#mode-lobbies`} className="btn btn-p">
              {P.seeLobbies(tc.lobbies)}
              <Icon name="arrow" />
            </Link>
          </div>
        </div>
      </article>

      <section className="mi-rest" aria-labelledby="mi-rest">
        <div className="mi-rh">
          <h2 className="mi-rt" id="mi-rest">
            {P.restTitle}
          </h2>
          <span className="lbl">{P.restMeta}</span>
        </div>
        <ul className="mi-arcanos">
          {rest.map((m) => {
            const c = stats.byMode[m.slug] ?? EMPTY;
            return (
              <li key={m.slug}>
                <Link to={`/modos/${m.slug}`} className={arcanoClass(m.slug, { quiet: !c.lobbies, size: 'lg' })}>
                  <ArcanoFace
                    slug={m.slug}
                    name={m.name}
                    format={`${m.format} · ${t.modes.durationValue(m.durationMin)}`}
                    vivo={<ArcanoVivo lobbies={c.lobbies} players={c.players} />}
                    sr={m.line}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
