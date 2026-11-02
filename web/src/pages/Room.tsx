import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { FriendsBlock } from '../components/Friends';
import { Icon } from '../components/Icon';
import { LobbyAction } from '../components/LobbyAction';
import type { Lobby } from '../data/lobbies';
import { getMode } from '../data/modes';
import { useDocumentTitle, useFriends } from '../hooks';
import { useNow } from '../hooks/useNow';
import { t } from '../i18n';
import { lobbyState, roundText } from '../lib/lobbies';
import { friendsIn } from '../lib/friends';
import { missingForQuorum, roster, type Seat } from '../lib/room';
import { useSession } from '../state/session';

/**
 * A sala do lobby: o que você vê depois de clicar em "Entrar" (ou ao abrir um convite).
 * Vagas com quem está pronto, o modo, e um painel com a única ação principal da fase:
 * entrando no jogo, "Estou pronto", "Iniciar partida" (anfitrião) ou "Voltar para o Deadlock".
 */

function SeatRow({ seat, onInvite }: { seat: Seat; onInvite: () => void }) {
  if (!seat.name) {
    return (
      <li className="seat is-free">
        <i className="seat-win" aria-hidden="true" />
        <span className="seat-name">{t.room.free}</span>
        <button type="button" className="link-quiet seat-invite" onClick={onInvite}>
          {t.room.invite}
        </button>
      </li>
    );
  }
  const tags = [seat.you && seat.name !== t.lobbies.you && t.room.you, seat.host && t.room.hostTag, seat.friend && t.room.friendTag].filter(Boolean).join(', ');
  return (
    <li className={`seat${seat.ready ? ' is-ready' : ''}${seat.you ? ' is-you' : ''}`}>
      <i className="seat-win" aria-hidden="true" />
      <span className={`seat-name${seat.friend ? ' is-friend' : ''}`}>
        {seat.name}
        {tags && <span className="seat-tag">{tags}</span>}
      </span>
      <span className="seat-state">{seat.ready ? t.room.ready : t.room.notReady}</span>
    </li>
  );
}

/** As etapas da entrada no jogo. No produto, cada troca vem de um evento do app. */
function EntrySteps({ step, done }: { step: number; done: boolean }) {
  const steps = [...t.lobbies.joinSteps, t.room.inside];
  const current = done ? steps.length - 1 : step;
  return (
    <ol className="steps" aria-label={t.room.entering}>
      {steps.map((s, i) => {
        const state = i < current || (done && i === current) ? 'done' : i === current ? 'now' : 'next';
        return (
          <li key={s} className={`step is-${state}`} aria-current={state === 'now' ? 'step' : undefined}>
            <span className="step-n num">{state === 'done' ? <Icon name="check" size={13} /> : i + 1}</span>
            <span>{s.replace('…', '')}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Panel({ lobby, seats }: { lobby: Lobby; seats: Seat[] }) {
  const { lobbyCtx, joiningId, joiningStep, hereId, ready, toggleReady, startMatch, inviteTo, leaveLobby, closeLobby, pushToast } = useSession();
  const joining = joiningId === lobby.id;
  const here = hereId === lobby.id;
  const playing = lobby.status === 'em-partida';
  const missing = missingForQuorum(lobby);
  const taken = seats.filter((s) => s.name);
  const readyCount = taken.filter((s) => s.ready).length;

  let body;
  if (joining) {
    body = (
      <>
        <h2 className="panel-title">{t.room.entering}</h2>
        <EntrySteps step={joiningStep} done={false} />
        <p className="fine">
          {t.room.stuck}{' '}
          <Link to="/instalar#antivirus" className="link-quiet">
            {t.room.help}
          </Link>
        </p>
      </>
    );
  } else if (!here) {
    const st = lobbyState(lobby, lobbyCtx);
    body = (
      <>
        <p className="panel-note">{st.label ?? t.room.outside}</p>
        <LobbyAction lobby={lobby} state={st} primary />
      </>
    );
  } else if (playing) {
    body = (
      <>
        <p className="panel-note">{t.room.playingNote}</p>
        <button type="button" className="btn btn-primary btn-block" onClick={() => pushToast(t.room.reopenToast)}>
          {t.room.backToGame}
          <Icon name="arrowRight" size={16} />
        </button>
      </>
    );
  } else if (lobby.mine) {
    body = (
      <>
        <p className="panel-note">{missing > 0 ? t.room.missing(missing) : t.room.allReady(readyCount, taken.length)}</p>
        <button type="button" className="btn btn-primary btn-block" disabled={missing > 0} onClick={startMatch}>
          {t.room.start}
        </button>
      </>
    );
  } else {
    body = (
      <>
        <p className="panel-note">{ready ? (missing > 0 ? t.room.missing(missing) : t.room.waitingHost(lobby.host)) : t.room.allReady(readyCount, taken.length)}</p>
        <button type="button" className={`btn btn-block ${ready ? 'btn-line' : 'btn-primary'}`} aria-pressed={ready} onClick={toggleReady}>
          {ready ? t.room.unready : t.room.imReady}
        </button>
      </>
    );
  }

  return (
    <aside className="panel" aria-label={t.dock.label}>
      {body}
      {(here || lobby.mine) && !joining && (
        <div className="panel-more">
          <button type="button" className="btn btn-line btn-sm" onClick={() => inviteTo(lobby)}>
            <Icon name="copy" size={14} />
            {t.room.copyInvite}
          </button>
          {lobby.mine ? (
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => closeLobby(lobby.id)}>
              {t.room.close}
            </button>
          ) : (
            <button type="button" className="btn btn-quiet btn-sm" onClick={leaveLobby}>
              {t.room.leave}
            </button>
          )}
        </div>
      )}
      {(here || lobby.mine) && !joining && !playing && lobby.players < lobby.slots && <FriendsBlock mode="invite" exclude={lobby.id} />}
    </aside>
  );
}

export function Room() {
  const { id = '' } = useParams();
  const { lobbies, user, hereId, ready, inviteTo } = useSession();
  const now = useNow(5000);
  const friends = useFriends();
  const lobby = lobbies.find((l) => l.id === id);
  useDocumentTitle(t.room.meta(lobby?.name ?? t.room.goneTitle));
  const seats = useMemo(
    () => (lobby ? roster(lobby, { you: user?.name ?? t.lobbies.you, youHere: hereId === lobby.id, youReady: ready, signedIn: !!user, now, friends: friendsIn(friends, lobby.id) }) : []),
    [lobby, user, hereId, ready, now, friends],
  );

  if (!lobby) {
    return (
      <div className="page room-page">
        <div className="wrap">
          <div className="empty">
            <h1 className="room-gone">{t.room.goneTitle}</h1>
            <p>{t.room.goneBody}</p>
            <div className="empty-actions">
              <Link to="/#lobbies" className="btn btn-primary">
                {t.room.goneLink}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const mode = getMode(lobby.modeSlug);
  const round = roundText(lobby, now);
  const missing = missingForQuorum(lobby);

  return (
    <div className="page room-page">
      <div className="wrap">
        <Link to="/#lobbies" className="room-back link-quiet">
          ← {t.room.back}
        </Link>
        <header className="room-head">
          <h1>
            {lobby.name}
            {lobby.locked && <Icon name="lock" size={18} className="room-lock" label={t.lobbies.locked} />}
          </h1>
          <p className="room-meta">
            <span>{mode?.name}</span>
            <span>
              {t.regions[lobby.region]} <span className="num">{t.lobbies.ping(lobby.ping)}</span>
            </span>
            <span>{t.room.host(lobby.mine ? (user?.name ?? t.lobbies.you) : lobby.host)}</span>
            {lobby.status === 'em-partida' && <span className="room-live">{t.lobbyState.playing(round)}</span>}
          </p>
        </header>

        <div className="room-grid">
          <div className="room-main">
            <section aria-labelledby="room-players">
              <header className="room-sec-head">
                <h2 id="room-players">{t.room.players}</h2>
                <p>
                  <span className="num">
                    {lobby.players}/{lobby.slots}
                  </span>
                  {missing > 0 && lobby.status !== 'em-partida' && <span> · {t.lobbyState.quorum(lobby.minPlayers, missing)}</span>}
                </p>
              </header>
              <ul className="seats">
                {seats.map((s, i) => (
                  <SeatRow key={s.name ?? `free-${i}`} seat={s} onInvite={() => inviteTo(lobby)} />
                ))}
              </ul>
            </section>

            {mode && (
              <section className="room-mode" aria-labelledby="room-mode">
                <header className="room-sec-head">
                  <h2 id="room-mode">{t.room.aboutMode}</h2>
                </header>
                <p className="room-mode-line">{mode.tagline}</p>
                <ul className="room-rules">
                  {mode.rules.slice(0, 3).map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                <Link to={`/modos/${mode.slug}`} className="link-line">
                  {t.room.modeLink(mode.name)}
                </Link>
              </section>
            )}
          </div>

          <Panel lobby={lobby} seats={seats} />
        </div>
      </div>
    </div>
  );
}
