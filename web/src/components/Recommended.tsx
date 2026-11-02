import { useEffect, useMemo } from 'react';
import { Link } from 'react-router';
import type { Lobby } from '../data/lobbies';
import { getMode } from '../data/modes';
import { useFriends } from '../hooks';
import { t } from '../i18n';
import { friendsIn } from '../lib/friends';
import { lobbyNum } from '../lib/lobbyCard';
import { freeSlots, lobbyState } from '../lib/lobbies';
import { roster } from '../lib/room';
import { useSession } from '../state/session';
import { Avatar, AvatarStack } from './Avatar';
import { Icon } from './Icon';
import { ModeCover } from './ModeCover';

/**
 * O cartão recomendado do topo da home: o mesmo lobby que o "Jogar agora" escolhe
 * (`useFeaturedLobby`), nunca fixo. Barra de dados: Anfitrião, Vagas (falta N), Dentro, Servidor.
 * "Jogar agora" é a entrada real (`requestJoin`); Enter na página faz o mesmo.
 */

const roomTo = (l: Lobby) => `/sala/${encodeURIComponent(l.id)}`;

/** Nome longo ganha um título menor (o cartão tem altura fixa no desktop). */
const LONG_NAME = 22;

export function RecommendedCard({ lobby, now, onCreate, fallbackMode }: { lobby: Lobby | undefined; now: number; onCreate: () => void; fallbackMode: string }) {
  const { user, lobbyCtx, requestJoin, hereId } = useSession();
  const friends = useFriends();
  const signedIn = !!user;

  // Enter com o foco na página (fora de campos e botões) = Jogar agora.
  useEffect(() => {
    if (!lobby) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.defaultPrevented || e.target !== document.body || document.querySelector('dialog[open]')) return;
      requestJoin({ kind: 'lobby', lobby });
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [lobby, requestJoin]);

  const friendNames = useMemo(() => (lobby && signedIn && !lobby.locked ? friendsIn(friends, lobby.id) : []), [lobby, signedIn, friends]);
  const inside = useMemo(
    () =>
      lobby
        ? roster(lobby, { you: user?.name ?? t.lobbies.you, youHere: hereId === lobby.id, youReady: false, signedIn, now: 0, friends: friendNames })
            .filter((s) => s.name)
            .map((s) => s.name!)
        : [],
    [lobby, user, hereId, signedIn, friendNames],
  );

  if (!lobby) {
    return (
      <section className="hero" aria-labelledby="hero-title">
        <ModeCover slug={fallbackMode} wide />
        <div className="hero-shade" aria-hidden="true" />
        <div className="hero-none">
          <h1 className="display" id="hero-title">
            {t.home.noneTitle}
          </h1>
          <p>{t.home.noneBody}</p>
          <button type="button" className="btn btn-p btn-lg" onClick={onCreate}>
            <Icon name="plus" />
            {t.lobbies.create}
          </button>
        </div>
      </section>
    );
  }

  const mode = getMode(lobby.modeSlug);
  const st = lobbyState(lobby, lobbyCtx, now);
  const num = lobbyNum(lobby);
  const free = freeSlots(lobby);
  // A terceira linha é o jeito do modo (o porquê da escolha já está na barra: vagas, amigos, ping).
  const line = mode?.line.replace(/.$/, '');
  const joining = st.kind === 'joining';

  return (
    <section className="hero" aria-labelledby="hero-title">
      <ModeCover slug={lobby.modeSlug} wide />
      <div className="hero-shade" aria-hidden="true" />
      <div className="hero-body">
        <p className="hero-cap cap">
          <span className="acc">{t.home.recommended}</span>
          <i aria-hidden="true" />
          {num && (
            <>
              <span className="hide-s">
                {t.home.lobbyNum} <b>{num}</b>
              </span>
              <i className="hide-s" aria-hidden="true" />
            </>
          )}
          <span>
            {t.regions[lobby.region]} · <b>{t.lobbies.ping(lobby.ping)}</b>
          </span>
        </p>
        <h1 className={lobby.name.length > LONG_NAME ? 'display is-long' : 'display'} id="hero-title">
          {lobby.name}
        </h1>
        <p className="hero-sub">
          <span className="hs-m">
            <span className="mdot" aria-hidden="true" />
            {mode?.name}
          </span>
          <span className="sep" aria-hidden="true" />
          <span>{mode?.format}</span>
          {line && (
            <>
              <span className="sep hs-x" aria-hidden="true" />
              <span className="hs-x">{line}</span>
            </>
          )}
        </p>
      </div>
      <div className="hbar">
        <dl className="hbar-dl" aria-label={t.home.statBar}>
          <div className="hg">
            <Icon name="crown" />
            <div>
              <dt className="lbl">{t.home.host}</dt>
              <dd className="hg-v">
                <Avatar name={lobby.host} size={22} ring={signedIn && lobby.hostIsFriend} />
                {lobby.host}
              </dd>
            </div>
          </div>
          <div className="hg">
            <Icon name="users" />
            <div>
              <dt className="lbl">{t.home.slots}</dt>
              <dd className="hg-v">
                <span className="hg-big">
                  {lobby.players}
                  <small>/{lobby.slots}</small>
                </span>
                <span className="ticks" aria-hidden="true">
                  {Array.from({ length: lobby.slots }, (_, i) => (
                    <i key={i} className={i < lobby.players ? undefined : i === lobby.players ? 'e next' : 'e'} />
                  ))}
                </span>
                {free > 0 && <span className="falta">{t.home.missing(free)}</span>}
              </dd>
            </div>
          </div>
          <div className="hg">
            <Icon name="lobbies" />
            <div>
              <dt className="lbl">{t.home.inside}</dt>
              <dd className="hg-v">
                <AvatarStack names={inside} size={24} total={lobby.players} friends={friendNames} />
                {signedIn && <span className="sub-mut">{friendNames.length > 0 ? t.home.fromList(friendNames.length) : t.home.nobodyFromList}</span>}
              </dd>
            </div>
          </div>
          <div className="hg hg-ping">
            <Icon name="signal" />
            <div>
              <dt className="lbl">{t.home.server}</dt>
              <dd className="hg-v">
                <span className="hg-big">
                  {lobby.ping}
                  <small> ms</small>
                </span>
                <span className="sub-mut">{t.regions[lobby.region]}</span>
              </dd>
            </div>
          </div>
        </dl>
        <div className="hg hg-act">
          <Link to={roomTo(lobby)} className="btn btn-s">
            {t.home.viewRoom}
          </Link>
          <button
            type="button"
            className="btn btn-p"
            aria-disabled={joining || !st.canJoin ? true : undefined}
            aria-keyshortcuts="Enter"
            onClick={() => st.canJoin && requestJoin({ kind: 'lobby', lobby })}
          >
            <Icon name="bolt" />
            {joining ? t.lobbyState.joining : t.home.play}
          </button>
        </div>
      </div>
    </section>
  );
}

/** Barra fixa do celular: o recomendado com "Jogar agora", ou a sua sala quando você está numa. */
export function MobilePlayBar({ lobby }: { lobby: Lobby | undefined }) {
  const { lobbies, hereId, joiningId, requestJoin, lobbyCtx } = useSession();
  const id = joiningId ?? hereId;
  const mine = id ? lobbies.find((l) => l.id === id) : undefined;

  if (mine) {
    const joining = joiningId === mine.id;
    return (
      <div className="mbar" role="region" aria-label={t.home.mobileBar}>
        <div className="mbar-cv">
          <ModeCover slug={mine.modeSlug} />
        </div>
        <div className="mbar-t">
          <b>{mine.name}</b>
          <span>
            <span className="num">{`${mine.players}/${mine.slots}`}</span> · <em>{joining ? t.lobbyState.joining : t.lobbyState.here}</em>
          </span>
        </div>
        <Link to={roomTo(mine)} className="btn btn-s">
          {t.home.backToRoom}
        </Link>
      </div>
    );
  }
  if (!lobby) return null;
  const free = freeSlots(lobby);
  const st = lobbyState(lobby, lobbyCtx);
  return (
    <div className="mbar" role="region" aria-label={t.home.mobileBar}>
      <div className="mbar-cv">
        <ModeCover slug={lobby.modeSlug} />
      </div>
      <div className="mbar-t">
        <b>{lobby.name}</b>
        <span>
          <span className="num">{`${lobby.players}/${lobby.slots} · ${lobby.ping} ms`}</span>
          {free > 0 && (
            <>
              {' · '}
              <em>{t.home.missing(free)}</em>
            </>
          )}
        </span>
      </div>
      <button
        type="button"
        className="btn btn-p"
        aria-disabled={st.canJoin ? undefined : true}
        onClick={() => st.canJoin && requestJoin({ kind: 'lobby', lobby })}
      >
        {t.home.mobilePlay}
      </button>
    </div>
  );
}
