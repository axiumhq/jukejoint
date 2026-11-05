import { useEffect, useId, useMemo } from 'react';
import { Link } from 'react-router';
import type { Lobby } from '../data/lobbies';
import { getMode } from '../data/modes';
import { useFriends } from '../hooks';
import { useServerStatus } from '../hooks/useServerStatus';
import { t } from '../i18n';
import { live as L } from '../i18n/live';
import { friendsIn } from '../lib/friends';
import { HERO_ASPECT, HERO_VIEWBOX, heroScene } from '../lib/hero';
import { isNearFull } from '../lib/lobbyCard';
import { freeSlots, lobbyState } from '../lib/lobbies';
import { roster } from '../lib/room';
import { useSession } from '../state/session';
import { AvatarStack } from './Avatar';
import { CreateReason, SlotMeter } from './Common';
import { Icon } from './Icon';

/**
 * O destaque do topo da home (Main / Home-1366 do Claude Design): a cena da avenida com o slogan
 * e, embaixo, a barra do lobby recomendado. O lobby é o mesmo que o "Jogar agora" escolhe
 * (`useFeaturedLobby`), nunca fixo: nome, "Modo, de quem abriu", quem está dentro, as lâmpadas
 * com "N de M na sala, falta N", região e ping, "Ver sala" e "Jogar agora" (Enter na página faz o mesmo).
 */

const roomTo = (l: Lobby) => `/sala/${encodeURIComponent(l.id)}`;

/**
 * A cena do destaque (lib/hero.ts): a avenida de três pistas e a faixa tracejada que sai dela até a
 * porta acesa do juke joint, à direita. Pintada com os tokens do tema (trocar o tema repinta), as
 * lâmpadas estáticas. Decorativa; ids e classes ganham o prefixo da instância.
 */
function HeroScene() {
  const prefix = `jjh${useId().replace(/[^\w-]/g, '')}_`;
  const scene = useMemo(() => heroScene(prefix), [prefix]);
  return (
    <svg className="hero-scene" viewBox={HERO_VIEWBOX} preserveAspectRatio={HERO_ASPECT} aria-hidden="true" focusable="false">
      <style>{scene.css}</style>
      <g dangerouslySetInnerHTML={{ __html: scene.body }} />
    </svg>
  );
}

export function RecommendedCard({ lobby, now, onCreate }: { lobby: Lobby | undefined; now: number; onCreate: () => void }) {
  const { user, lobbyCtx, requestJoin, hereId } = useSession();
  const friends = useFriends();
  const signedIn = !!user;
  const { status, retry, createBlocked } = useServerStatus();

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
        <HeroScene />
        <h1 className="display hero-t" id="hero-title">
          {t.home.heroTitle}
        </h1>
        <div className="hbar hbar-none">
          <div className="hb-who">
            {status === 'ok' ? (
              <>
                <b className="hb-n">{t.home.noneTitle}</b>
                <span className="hb-m">{t.home.noneBody}</span>
              </>
            ) : status === 'failed' ? (
              <>
                <b className="hb-n">{L.serverFail}</b>
                <span className="hb-m">{L.serverFailBody}</span>
              </>
            ) : (
              <>
                <b className="hb-n">{L.loadingLobbies}</b>
              </>
            )}
          </div>
          <div className="hb-act">
            {status === 'failed' && (
              <button type="button" className="btn btn-o" onClick={retry}>
                {L.retry}
              </button>
            )}
            <button
              type="button"
              className="btn btn-p btn-lg"
              aria-disabled={createBlocked || undefined}
              title={createBlocked ? L.createBlocked : undefined}
              onClick={() => !createBlocked && onCreate()}
            >
              <Icon name="plus" />
              {t.lobbies.create}
              <CreateReason blocked={createBlocked} />
            </button>
          </div>
        </div>
      </section>
    );
  }

  const mode = getMode(lobby.modeSlug);
  const st = lobbyState(lobby, lobbyCtx, now);
  const free = freeSlots(lobby);
  const joining = st.kind === 'joining';
  const host = lobby.mine ? (user?.name ?? t.lobbies.you) : lobby.host;

  return (
    <section className="hero" aria-labelledby="hero-title">
      <HeroScene />
      <h1 className="display hero-t" id="hero-title">
        {t.home.heroTitle}
      </h1>
      <div className="hbar" role="group" aria-label={t.home.statBar}>
        <div className="hb-who">
          <div className="hb-id">
            <b className="hb-n" title={lobby.name}>
              <span className="sr-only">{t.home.recommended}: </span>
              {lobby.name}
            </b>
            <span className="hb-m">
              {mode?.name}, {t.browse.from} {host}
            </span>
          </div>
          {inside.length > 0 && <AvatarStack names={inside} size={24} total={lobby.players} friends={friendNames} />}
        </div>
        <div className="hb-slots">
          <SlotMeter taken={lobby.players} total={lobby.slots} pulse={isNearFull(lobby, st)} />
          <span className="hb-cnt">
            <b>
              {t.lobbies.inRoom(lobby.players, lobby.slots)}
              {free > 0 && `, ${t.home.missing(free)}`}
            </b>
            <span className="lbl">
              {t.regions[lobby.region]} {t.lobbies.ping(lobby.ping)}
            </span>
          </span>
        </div>
        <div className="hb-act">
          <Link to={roomTo(lobby)} className="btn btn-o">
            {t.home.viewRoom}
          </Link>
          <button
            type="button"
            className="btn btn-p btn-lg"
            aria-disabled={joining || !st.canJoin ? true : undefined}
            aria-keyshortcuts="Enter"
            onClick={() => st.canJoin && requestJoin({ kind: 'lobby', lobby })}
          >
            {joining ? t.lobbyState.joining : t.home.play}
            {!joining && <kbd aria-hidden="true">{t.home.playHint}</kbd>}
          </button>
        </div>
      </div>
    </section>
  );
}

/**
 * Barra fixa do celular, logo acima das abas de baixo (o .fxb do Celular-390): o recomendado com
 * "Jogar agora", ou a sua sala ("Você está aqui · 2 de 6") com "Abrir a sala" quando você está numa.
 */
export function MobilePlayBar({ lobby }: { lobby: Lobby | undefined }) {
  const { lobbies, hereId, joiningId, requestJoin, lobbyCtx } = useSession();
  const id = joiningId ?? hereId;
  const mine = id ? lobbies.find((l) => l.id === id) : undefined;

  if (mine) {
    const joining = joiningId === mine.id;
    return (
      <div className="mbar" role="region" aria-label={t.home.mobileBar}>
        <div className="mbar-t">
          <b>{mine.name}</b>
          <span>
            {joining ? t.lobbyState.joining : t.lobbyState.here} · <span className="num">{`${mine.players} de ${mine.slots}`}</span>
          </span>
        </div>
        <Link to={roomTo(mine)} className="btn btn-p">
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
      <div className="mbar-t">
        <b>{lobby.name}</b>
        <span>
          <span className="num">{`${lobby.players} de ${lobby.slots} · ${t.lobbies.ping(lobby.ping)}`}</span>
          {free > 0 && ` · ${t.home.missing(free)}`}
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
