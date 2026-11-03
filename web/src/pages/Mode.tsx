import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { Avatar } from '../components/Avatar';
import { LiveDot, SectionTitle, Tag } from '../components/Common';
import { FriendRow, FriendStep } from '../components/Friends';
import { Icon } from '../components/Icon';
import { CreateCard, LobbyCard, orderLobbies, type CardEnv } from '../components/LobbyCard';
import { ModeCover } from '../components/ModeCover';
import { PageHead } from '../components/PageHead';
import { Rail, useRail, useRailSignIn } from '../components/Rail';
import type { Lobby } from '../data/lobbies';
import { getMode, modes, type Mode, type Region } from '../data/modes';
import { releases } from '../data/patches';
import { useDocumentTitle, useFriends, useLiveStats } from '../hooks';
import { useFeaturedLobby } from '../hooks/useFeatured';
import { useNow } from '../hooks/useNow';
import { formatDate, formatNumber, formatShortDate, t } from '../i18n';
import { EMPTY_FILTERS, filterLobbies, REGIONS } from '../lib/lobbies';
import { useSession } from '../state/session';
import { NotFound } from './NotFound';

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

/* ───────── Trilho da página do modo ───────── */

function RegionsNow({ list }: { list: Lobby[] }) {
  const rows = REGIONS.map((r: Region) => {
    const inR = list.filter((l) => l.region === r);
    const ps = inR.map((l) => l.ping);
    return { r, lobbies: inR.length, players: inR.reduce((n, l) => n + l.players, 0), min: Math.min(...ps), max: Math.max(...ps) };
  }).filter((x) => x.lobbies > 0);
  return (
    <section className="rail-sec" aria-labelledby="mr-regions">
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
                  <Avatar name={e.player} size={20} />
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
function SheetCard({ friends, regions }: { friends: number; regions: number }) {
  const { openSheet } = useRail();
  return (
    <button type="button" className="mfriends" aria-haspopup="dialog" onClick={(e) => openSheet(e.currentTarget)}>
      <Icon name="users" />
      <span className="t">
        <b>{t.modes.sheetOpen}</b>
        <span>{t.modes.sheetOpenSub(friends, regions)}</span>
      </span>
      <Icon name="chev" />
    </button>
  );
}

/* ───────── /modos/:slug ───────── */

export function ModePage() {
  const { slug } = useParams();
  const mode = getMode(slug);
  const { lobbies, requestJoin, openHost, lobbyCtx, user } = useSession();
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
  const others = modes.filter((m) => m.slug !== mode.slug);
  const ping = bestPing(all);
  const env: CardEnv = { ctx: lobbyCtx, signedIn: !!user, me: user?.name ?? t.lobbies.you, friends, now };
  const ordered = orderLobbies(modeLobbies, lobbyCtx, featured);
  const ids = new Set(all.map((l) => l.id));
  const friendsHere = user ? friends.filter((f) => f.lobbyId && ids.has(f.lobbyId)).length : 0;
  const regionCount = new Set(all.map((l) => l.region)).size;

  return (
    <>
      <section className="mh" aria-labelledby="mode-title">
        <ModeCover slug={mode.slug} wide />
        <div className="mh-shade" aria-hidden="true" />
        <div className="mh-body">
          <Link to="/modos" className="mh-back">
            <Icon name="back" />
            {t.modes.back}
          </Link>
          <h1 className="display" id="mode-title">
            {mode.name}
          </h1>
          <p className="mh-tag">{mode.tagline}</p>
          <ul className="mh-chips" aria-label={t.modes.facts.format}>
            <li>
              <Tag tone="line">{mode.format}</Tag>
            </li>
            <li>
              <Tag tone="line">{t.modes.sizeValue(mode.minPlayers, mode.maxPlayers)}</Tag>
            </li>
            <li>
              <Tag tone="line">{t.modes.durationValue(mode.durationMin)}</Tag>
            </li>
            <li className="mh-by">
              {t.modes.by} <b>{mode.author}</b>
            </li>
          </ul>
        </div>
        <div className="mh-bar">
          <dl className="dbar">
            <div className="dc">
              <dt className="lbl">{t.modes.facts.players}</dt>
              <dd>
                <LiveDot small />
                <span className="dc-big num">{formatNumber(c.players)}</span>
              </dd>
            </div>
            <div className="dc">
              <dt className="lbl">{t.modes.facts.lobbies}</dt>
              <dd>
                <span className="dc-big num">{formatNumber(c.lobbies)}</span>
                <span className="dc-sub">{t.modes.withRoom(c.withRoom)}</span>
              </dd>
            </div>
            <div className="dc dc-ping">
              <dt className="lbl">{t.modes.facts.bestPing}</dt>
              <dd>
                {ping ? (
                  <>
                    <span className="dc-big num">{ping.ping}</span>
                    <span className="dc-sub">ms · {t.regions[ping.region]}</span>
                  </>
                ) : (
                  <span className="dc-sub">{t.modes.noPing}</span>
                )}
              </dd>
            </div>
          </dl>
          <div className="mh-act">
            <button type="button" className={featured ? 'btn btn-s btn-lg' : 'btn btn-p btn-lg'} onClick={() => openHost(mode.slug)}>
              <Icon name="plus" />
              <span className="t-long">{t.modes.hostHere}</span>
              <span className="t-short">{t.modes.hostShort}</span>
            </button>
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
          </div>
        </div>
      </section>
      <p id="mode-join-hint" className="mh-hint">
        {featured ? t.modes.joinHint(c.withRoom) : t.modes.noLobbies}
      </p>

      <SheetCard friends={friendsHere} regions={regionCount} />

      <div className="mode-cols">
        <section className="sec" aria-labelledby="mode-how">
          <SectionTitle id="mode-how" words={t.modes.howWords} />
          <div className="mode-prose">
            {mode.description.map((p) => (
              <p key={p}>{p}</p>
            ))}
            <p className="mode-upd">
              {t.modes.facts.updated} <time dateTime={mode.updatedAt}>{formatDate(mode.updatedAt)}</time>
            </p>
          </div>
        </section>
        <section className="sec" aria-labelledby="mode-rules">
          <SectionTitle id="mode-rules" words={t.modes.rulesWords} meta={t.modes.rulesMeta(mode.rules.length)} />
          <ul className="rules">
            {mode.rules.map((r) => (
              <li key={r}>
                <span className="mdot" aria-hidden="true" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="sec" aria-labelledby="mode-lobbies">
        <SectionTitle id="mode-lobbies" words={t.modes.lobbiesWords} meta={t.modes.lobbiesMeta(c.lobbies, c.withRoom)}>
          <Link to={`/?modo=${mode.slug}#lobbies`} className="link">
            {t.modes.lobbiesAll}
            <Icon name="arrow" />
          </Link>
        </SectionTitle>
        <div className="lgrid">
          {ordered.map((l) => (
            <LobbyCard key={l.id} lobby={l} env={env} featured={featured?.id === l.id} />
          ))}
          <CreateCard onCreate={() => openHost(mode.slug)} />
        </div>
        {ordered.length === 0 && <p className="mode-empty">{t.lobbies.modeListEmpty(mode.name)}</p>}
      </section>

      <nav className="sec" aria-labelledby="mode-others">
        <SectionTitle id="mode-others" words={t.modes.othersWords} />
        <ul className="mode-others">
          {others.map((m) => {
            const oc = stats.byMode[m.slug] ?? EMPTY;
            return (
              <li key={m.slug}>
                <Link to={`/modos/${m.slug}`} className="mcard has-cover">
                  <ModeCover slug={m.slug} />
                  <span className="mcard-b">
                    <span className="mcard-n display">{m.name}</span>
                    <span className="mcard-c">
                      <LiveDot small />
                      <span>
                        <span className="num">{formatNumber(oc.players)}</span> {t.header.live}
                      </span>
                    </span>
                  </span>
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
  useDocumentTitle(t.meta.modes);
  const stats = useLiveStats();
  return (
    <>
      <PageHead words={t.modes.titleWords} meta={t.modes.indexMeta(modes.length, formatNumber(stats.players), stats.lobbies)} lead={t.modes.lead} />
      <ul className="mx-grid">
        {modes.map((m) => {
          const c = stats.byMode[m.slug] ?? EMPTY;
          const nameId = `mx-${m.slug}`;
          return (
            <li key={m.slug} className="mx has-cover">
              <div className="mx-cv">
                <ModeCover slug={m.slug} />
                <span className="mx-st">
                  <Tag>{t.modes.lobbiesCount(c.lobbies)}</Tag>
                </span>
              </div>
              <div className="mx-b">
                <h2 className="mx-n display" id={nameId}>
                  <Link to={`/modos/${m.slug}`}>{m.name}</Link>
                </h2>
                <p className="mx-l">{m.line}</p>
                <dl className="mx-d">
                  <div>
                    <dt className="lbl">{t.modes.facts.playing}</dt>
                    <dd>
                      <LiveDot small />
                      <span className="num">{formatNumber(c.players)}</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="lbl">{t.modes.facts.lobbies}</dt>
                    <dd>
                      <span className={c.withRoom ? 'num mx-free' : 'num'}>{formatNumber(c.withRoom)}</span>
                      <span className="mx-of">{t.modes.withRoomUnit}</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="lbl">{t.modes.facts.duration}</dt>
                    <dd>{t.modes.durationValue(m.durationMin)}</dd>
                  </div>
                </dl>
                <div className="mx-f">
                  <span className="mx-fmt">
                    {m.format} · {t.modes.rangeShort(m.minPlayers, m.maxPlayers)}
                  </span>
                  <Link to={`/?modo=${m.slug}#lobbies`} className="btn btn-s btn-sm" aria-label={t.modes.seeLobbiesLabel(m.name)}>
                    {t.modes.seeLobbies}
                    <Icon name="arrow" />
                  </Link>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
