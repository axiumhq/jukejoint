import { useEffect, useId, useMemo } from 'react';
import { Link } from 'react-router';
import type { Lobby } from '../data/lobbies';
import { getMode } from '../data/modes';
import { useFriends } from '../hooks';
import { t } from '../i18n';
import { friendsIn } from '../lib/friends';
import { isNearFull } from '../lib/lobbyCard';
import { freeSlots, lobbyState } from '../lib/lobbies';
import { roster } from '../lib/room';
import { useSession } from '../state/session';
import { AvatarStack } from './Avatar';
import { SlotMeter } from './Common';
import { Icon } from './Icon';

/**
 * O destaque do topo da home (Main / Home-1366 do Claude Design): a cena da cidade com o slogan
 * e, embaixo, a barra do lobby recomendado. O lobby é o mesmo que o "Jogar agora" escolhe
 * (`useFeaturedLobby`), nunca fixo: nome, "Modo, de quem abriu", quem está dentro, as lâmpadas
 * com "N de M na sala, falta N", região e ping, "Ver sala" e "Jogar agora" (Enter na página faz o mesmo).
 */

const roomTo = (l: Lobby) => `/sala/${encodeURIComponent(l.id)}`;

/**
 * A cena do destaque: céu, halo e lua, prédios com janelas acesas e o chão. Pintada só com os
 * tokens do tema (trocar o tema repinta). Decorativa; os ids dos gradientes são únicos por instância.
 */
function HeroScene() {
  const u = useId().replace(/:/g, '');
  const id = (k: string) => `hs-${k}-${u}`;
  const url = (k: string) => `url(#${id(k)})`;
  return (
    <svg className="hero-scene" viewBox="0 0 1128 220" preserveAspectRatio="xMaxYMax slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={id('sky')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--sky-1)' }} />
          <stop offset="1" style={{ stopColor: 'var(--sky-2)' }} />
        </linearGradient>
        <radialGradient id={id('halo')}>
          <stop offset="0" style={{ stopColor: 'var(--bulb)', stopOpacity: 0.34 }} />
          <stop offset=".45" style={{ stopColor: 'var(--brass)', stopOpacity: 0.1 }} />
          <stop offset="1" style={{ stopColor: 'var(--brass)', stopOpacity: 0 }} />
        </radialGradient>
        <radialGradient id={id('moon')} cx="40%" cy="35%">
          <stop offset="0" style={{ stopColor: 'var(--moon-hi)' }} />
          <stop offset="1" style={{ stopColor: 'var(--moon-lo)' }} />
        </radialGradient>
        <linearGradient id={id('mist')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--sky-2)', stopOpacity: 0 }} />
          <stop offset="1" style={{ stopColor: 'var(--sky-2)', stopOpacity: 0.55 }} />
        </linearGradient>
        <filter id={id('grain')}>
          <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .06 0" />
        </filter>
      </defs>
      <rect width="1128" height="220" fill={url('sky')} />
      <circle cx="800" cy="74" r="170" fill={url('halo')} />
      <path
        d="M800 170L560 170M800 170L590 92M800 170L640 32M800 170L716 -14M800 170L884 -14M800 170L960 32M800 170L1010 92M800 170L1040 170"
        style={{ stroke: 'var(--brass)' }}
        strokeWidth="1"
        opacity=".22"
        fill="none"
      />
      <circle cx="800" cy="72" r="36" fill={url('moon')} />
      <path
        d="M380 220V128h34v-26h26v-24h22v24h24v26h30v-42h36v-20h18v20h36v42h30V96l14-22 14 22v46h34v-34h44v-26h26v-34h16v34h26v26h44v34h28V92h30v-22h22v22h30v50h44v-30h52v-24h30v24h26v108z"
        style={{ fill: 'var(--bldg)' }}
      />
      <rect x="0" y="120" width="1128" height="100" fill={url('mist')} />
      <path
        d="M520 220v-58h40v-22h26v-30h10v-22h6v22h10v30h26v22h30v58zM700 220v-96h20v-20h18v-18h14V52l8-16 8 16v34h14v18h18v20h20v96zM880 220v-70h44v-20h34v20h30v-36h36v36h38v70z"
        style={{ fill: 'var(--bldg-2)' }}
      />
      <path
        d="M716 132h6v8h-6zM730 132h6v8h-6zM760 118h6v8h-6zM774 118h6v8h-6zM788 132h6v8h-6zM802 132h6v8h-6zM730 152h6v8h-6zM788 152h6v8h-6zM552 150h5v7h-5zM574 150h5v7h-5zM602 124h5v7h-5zM618 124h5v7h-5zM904 162h5v7h-5zM944 142h5v7h-5zM1002 130h5v7h-5zM1018 130h5v7h-5zM1036 164h5v7h-5z"
        style={{ fill: 'var(--bulb)' }}
        opacity=".85"
      />
      <path d="M430 220v-44h60v-20h44v20h50v-14h60v18h56v-10h70v14h66v-16h50v18h60v-14h50v18h132v30z" style={{ fill: 'var(--ground)' }} />
      <rect width="1128" height="220" filter={url('grain')} opacity=".7" />
    </svg>
  );
}

export function RecommendedCard({ lobby, now, onCreate }: { lobby: Lobby | undefined; now: number; onCreate: () => void }) {
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
        <HeroScene />
        <h1 className="display hero-t" id="hero-title">
          {t.home.heroTitle}
        </h1>
        <div className="hbar hbar-none">
          <div className="hb-who">
            <b className="hb-n">{t.home.noneTitle}</b>
            <span className="hb-m">{t.home.noneBody}</span>
          </div>
          <div className="hb-act">
            <button type="button" className="btn btn-p btn-lg" onClick={onCreate}>
              <Icon name="plus" />
              {t.lobbies.create}
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
