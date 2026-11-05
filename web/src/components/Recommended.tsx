import { Fragment, useEffect, useMemo, type ReactNode, type Ref } from 'react';
import { Link } from 'react-router';
import type { Lobby } from '../data/lobbies';
import { getMode } from '../data/modes';
import { useFriends } from '../hooks';
import { useServerStatus } from '../hooks/useServerStatus';
import { t } from '../i18n';
import { live as L } from '../i18n/live';
import { mesa as M } from '../i18n/mesa';
import { friendsIn } from '../lib/friends';
import { freeSlots, lobbyState } from '../lib/lobbies';
import { isTeamFormat } from '../lib/lobbyCard';
import { roster, type Seat } from '../lib/room';
import { useSession } from '../state/session';
import { Avatar } from './Avatar';
import { CreateReason } from './Common';
import { Icon } from './Icon';

/**
 * A placa da mesa, logo abaixo da cena do topo da Home (v4): o melhor lobby para você, o mesmo que o
 * "Jogar agora" escolhe (`useFeaturedLobby`), nunca fixo. Placa de latão rebitado com o único leque
 * art déco da tela e três colunas: o texto (vagas, nome, modo, quem abriu, região e ping, amigos),
 * as cadeiras (as vagas da sala, `roster()`) e as ações ("Ver sala" e "Jogar agora"; Enter na
 * página faz o mesmo). Sem lobby, a mesma placa convida a abrir o primeiro.
 */

const roomTo = (l: Lobby) => `/sala/${encodeURIComponent(l.id)}`;

/** O leque art déco encaixado no meio da borda de cima da placa. */
function Leque() {
  return (
    <svg className="leque" viewBox="0 0 72 36" aria-hidden="true" focusable="false">
      <path d="M2 36a34 34 0 0 1 68 0z" fill="var(--fundo)" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1" />
      <g stroke="currentColor" strokeWidth="1" strokeOpacity="0.7" fill="none">
        <path d="M36 36V8M36 36 22.6 11.2M36 36 49.4 11.2M36 36 13 18.6M36 36 59 18.6M36 36 7.4 28.4M36 36 64.6 28.4" />
        <path d="M24 36a12 12 0 0 1 24 0" />
      </g>
      <circle cx="36" cy="36" r="5" fill="currentColor" fillOpacity="0.85" />
    </svg>
  );
}

/**
 * As cadeiras: quem ocupa cada vaga (foto da Steam ou silhueta, com o anel de amigo); as vazias são
 * círculos tracejados e a primeira delas é a sua. Decorativas: o número de pessoas vai em texto.
 */
function Cadeiras({ seats }: { seats: Seat[] }) {
  let yours = !seats.some((s) => s.you);
  return (
    <div className="cadeiras" aria-hidden="true">
      {seats.map((s, i) => {
        if (!s.name && !s.hidden) {
          if (yours) {
            yours = false;
            return (
              <span key={i} className="cadeira sua">
                {M.you}
              </span>
            );
          }
          return <span key={i} className="cadeira vazia" />;
        }
        const name = s.hidden || !s.name ? L.hiddenSeat : s.name;
        return (
          <span key={i} className={s.you ? 'cadeira sua' : 'cadeira'}>
            <Avatar name={name} size={36} src={s.avatar} ring={!!s.friend && !s.hidden} />
          </span>
        );
      })}
    </div>
  );
}

const EMPTY_TABLE: Seat[] = Array.from({ length: 12 }, () => ({ name: null }));

/** A moldura: a placa com o leque, os quatro rebites e a grade da mesa. */
function Placa({
  children,
  label,
  labelledBy,
  placaRef,
  busy,
  cols = 3,
}: {
  children: ReactNode;
  label?: string;
  labelledBy?: string;
  placaRef?: Ref<HTMLElement>;
  busy?: boolean;
  cols?: 2 | 3;
}) {
  return (
    <section ref={placaRef} className="placa" aria-label={label} aria-labelledby={labelledBy} aria-busy={busy || undefined}>
      <Leque />
      <span className="rebite e" aria-hidden="true" />
      <span className="rebite d" aria-hidden="true" />
      <div className={cols === 2 ? 'mesa mesa-2' : 'mesa'}>{children}</div>
    </section>
  );
}

export function RecommendedCard({
  lobby,
  now,
  onCreate,
  placaRef,
}: {
  lobby: Lobby | undefined;
  now: number;
  onCreate: () => void;
  /** A placa, para a barra fixa do celular saber quando ela sai da tela. */
  placaRef?: Ref<HTMLElement>;
}) {
  const { user, lobbies, lobbyCtx, requestJoin, hereId } = useSession();
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
  const seats = useMemo(
    () =>
      lobby
        ? roster(lobby, { you: user?.name ?? t.lobbies.you, youHere: hereId === lobby.id, youReady: false, signedIn, now: 0, friends: friendNames })
        : [],
    [lobby, user, hereId, signedIn, friendNames],
  );

  const create = (primary: boolean) => (
    <button
      type="button"
      className={primary ? 'btn btn-p btn-lg' : 'btn btn-o btn-lg'}
      aria-disabled={createBlocked || undefined}
      title={createBlocked ? L.createBlocked : undefined}
      onClick={() => !createBlocked && onCreate()}
    >
      <Icon name="plus" />
      {t.lobbies.create}
      <CreateReason blocked={createBlocked} />
    </button>
  );

  if (!lobby) {
    // A cidade vazia: ninguém abriu lobby ainda (e a lista chegou).
    if (status === 'ok' && lobbies.length === 0) {
      return (
        <Placa placaRef={placaRef} labelledBy="mesa-t">
          <div className="mesa-txt">
            <p className="marq">{M.emptyMarquee}</p>
            <h2 className="mesa-t" id="mesa-t">
              {M.emptyTitle}
            </h2>
            <p className="mesa-copy">{M.emptyBody}</p>
          </div>
          <div className="mesa-cad">
            <Cadeiras seats={EMPTY_TABLE} />
          </div>
          <div className="mesa-act p-first">
            {create(true)}
            <button type="button" className="btn btn-o btn-lg" onClick={() => requestJoin({ kind: 'bots' })}>
              {t.lobbies.emptyBots}
            </button>
          </div>
        </Placa>
      );
    }
    // Há lobbies, mas nenhum com vaga; ou a lista ainda está chegando; ou o servidor não respondeu.
    const failed = status === 'failed';
    return (
      <Placa placaRef={placaRef} labelledBy="mesa-t" busy={status === 'loading'} cols={2}>
        <div className="mesa-txt">
          <h2 className="mesa-t" id="mesa-t">
            {status === 'ok' ? t.home.noneTitle : failed ? L.serverFail : L.loadingLobbies}
          </h2>
          {status === 'ok' && <p className="mesa-copy">{t.home.noneBody}</p>}
          {failed && <p className="mesa-copy">{L.serverFailBody}</p>}
        </div>
        <div className="mesa-act">
          {failed && (
            <button type="button" className="btn btn-o btn-lg" onClick={retry}>
              {L.retry}
            </button>
          )}
          {create(true)}
        </div>
      </Placa>
    );
  }

  const mode = getMode(lobby.modeSlug);
  const st = lobbyState(lobby, lobbyCtx, now);
  const free = freeSlots(lobby);
  const joining = st.kind === 'joining';
  const host = lobby.mine ? (user?.name ?? t.lobbies.you) : lobby.host;
  const teams = isTeamFormat(mode?.format);
  const others = Math.max(0, lobby.players - friendNames.length);
  const meta = [mode?.name, mode?.format, M.openedBy(host)].filter(Boolean).join(' · ');

  return (
    <Placa placaRef={placaRef} label={M.label}>
      <div className="mesa-txt">
        <p className="marq">
          <b>{free === 0 ? M.full : free === 1 ? M.lastSlot : M.missing(free)}</b> · {M.bestForYou}
        </p>
        <h2 className="mesa-t">{lobby.name}</h2>
        <p className="mesa-meta">
          {meta} · <span className="num">{`${t.regions[lobby.region]} ${t.lobbies.ping(lobby.ping)}`}</span>
        </p>
        {friendNames.length > 0 && (
          <p className="mesa-who">
            {friendNames.map((n, i) => (
              <Fragment key={n}>
                {i > 0 && (i === friendNames.length - 1 ? ` ${M.and} ` : ', ')}
                <b>{n}</b>
              </Fragment>
            ))}
            {M.friendsTail(friendNames.length, others)}
          </p>
        )}
      </div>
      <div className="mesa-cad">
        {teams && (
          <div className="lados">
            <p className="lados-t">
              <span className="amb">{M.amber}</span> <span aria-hidden="true">{M.versus}</span> <span className="saf">{M.sapphire}</span>
            </p>
            <p className="lados-m">
              {mode?.format} · {M.sidesDrawn}
            </p>
          </div>
        )}
        <Cadeiras seats={seats} />
        <p className="sr-only">{t.lobbies.inRoom(lobby.players, lobby.slots)}</p>
      </div>
      <div className="mesa-act">
        <Link to={roomTo(lobby)} className="btn btn-o btn-lg">
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
    </Placa>
  );
}

/**
 * Barra fixa do celular, logo acima das abas de baixo: o recomendado com "Jogar agora", ou a sua
 * sala ("Você está aqui · 2 de 6") com "Abrir a sala" quando você está numa. O recomendado só
 * aparece quando a placa sai da tela (`placaOnScreen`), para não repetir o que já está à vista.
 */
export function MobilePlayBar({ lobby, placaOnScreen = false }: { lobby: Lobby | undefined; placaOnScreen?: boolean }) {
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
            {joining ? t.lobbyState.joining : t.lobbyState.here} · <span className="num">{t.lobbies.ofCount(mine.players, mine.slots)}</span>
          </span>
        </div>
        <Link to={roomTo(mine)} className="btn btn-p">
          {t.home.backToRoom}
        </Link>
      </div>
    );
  }
  if (!lobby || placaOnScreen) return null;
  const free = freeSlots(lobby);
  const st = lobbyState(lobby, lobbyCtx);
  return (
    <div className="mbar" role="region" aria-label={t.home.mobileBar}>
      <div className="mbar-t">
        <b>{lobby.name}</b>
        <span>
          <span className="num">{`${t.lobbies.ofCount(lobby.players, lobby.slots)} · ${t.lobbies.ping(lobby.ping)}`}</span>
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
