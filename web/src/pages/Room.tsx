import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Avatar, Presence } from '../components/Avatar';
import { SectionTitle, Tag } from '../components/Common';
import { FriendRow } from '../components/Friends';
import { Icon, type IconName } from '../components/Icon';
import { LobbyAction } from '../components/LobbyAction';
import { ModeCover } from '../components/ModeCover';
import { Rail, useRail } from '../components/Rail';
import type { Lobby } from '../data/lobbies';
import { getMode, type Mode } from '../data/modes';
import { useDocumentTitle, useFriends, useMediaQuery, useReducedMotion } from '../hooks';
import { useNow } from '../hooks/useNow';
import { t } from '../i18n';
import { live as L } from '../i18n/live';
import { friendsIn } from '../lib/friends';
import { lobbyState, roundText } from '../lib/lobbies';
import { readyCount, roomPhase, roster, ruleIcon, type RoomPhaseKey, type Seat } from '../lib/room';
import { useSession } from '../state/session';

/**
 * A sala do lobby (/sala/:id), v8 (prototipos/v8/sala.html): cabeçalho com a capa do modo e a fase,
 * a grade de vagas, a barra PRONTO fixa embaixo e o trilho da sala (regras, convite, atividade).
 * A barra tem um botão principal por estado: Entrar (de fora), etapas (entrando), PRONTO com F,
 * Cancelar (contagem de 5 s), etapas do handoff, Iniciar partida (anfitrião) e Voltar para o Deadlock.
 * Quem decide a contagem e o handoff é a sessão (state/session.tsx); a tela só mostra e pede.
 */

/** As quatro etapas do app: as três da entrada e "Dentro do lobby". */
const STEPS = [...t.lobbies.joinSteps.map((s) => s.replace('…', '')), t.room.inside];

type FeedKind = 'joined' | 'confirmed' | 'countStart' | 'countCancel' | 'started';
interface FeedItem {
  id: string;
  at: number;
  kind: FeedKind;
  name?: string;
  you?: boolean;
}

const FEED_ICON: Partial<Record<FeedKind, IconName>> = { countStart: 'play', countCancel: 'x', started: 'pad' };

/* ───────── Etapas (entrada e handoff) ───────── */

function Steps({ active, done }: { active: number; done: number }) {
  return (
    <ol className="hsteps" aria-label={t.room.stepsLabel}>
      {STEPS.map((s, i) => {
        const st = i < done ? 'done' : i === active ? 'on' : 'next';
        return (
          <li key={s} className={`hstep is-${st}${i === active ? ' is-cur' : ''}`} aria-current={i === active ? 'step' : undefined}>
            <span className="n num" aria-hidden="true">
              {st === 'done' ? <Icon name="check" /> : i + 1}
            </span>
            <span className="sl">{s}</span>
          </li>
        );
      })}
    </ol>
  );
}

/* ───────── Vaga ───────── */

function SeatCard({
  seat,
  index,
  pop,
  playing,
  visitor,
  signedIn,
  onInvite,
  onKick,
}: {
  seat: Seat;
  index: number;
  pop: boolean;
  playing: boolean;
  visitor: boolean;
  signedIn: boolean;
  onInvite: (from: HTMLElement) => void;
  /** Ao vivo, para quem abriu: tirar esta pessoa da sala. */
  onKick?: () => void;
}) {
  if (!seat.name) {
    const body = (
      <>
        <span className="plus" aria-hidden="true">
          <Icon name="plus" />
        </span>
        <b>{visitor ? t.room.free : t.room.invite}</b>
        <small className="num">{t.room.seatN(index + 1)}</small>
      </>
    );
    return (
      <li className="seat-li">
        {visitor ? (
          <div className="seat is-empty is-static">{body}</div>
        ) : (
          <button type="button" className="seat is-empty" aria-label={t.room.inviteSeat(index + 1)} onClick={(e) => onInvite(e.currentTarget)}>
            {body}
          </button>
        )}
      </li>
    );
  }

  const name = seat.you && !signedIn ? t.room.act.you : seat.name;
  let tag = null;
  if (seat.you && signedIn) tag = <Tag tone="line">{t.room.you}</Tag>;
  else if (seat.host)
    tag = (
      <span className="tag line" title={t.room.hostTitle}>
        <Icon name="crown" label={t.room.hostTitle} />
      </span>
    );
  else if (seat.friend)
    tag = (
      <span className="tag soft" title={t.room.friendTitle}>
        <Icon name="users" label={t.room.friendTitle} />
      </span>
    );

  const state = playing ? (
    <>
      <Icon name="pad" />
      {t.room.inMatch}
    </>
  ) : seat.ready ? (
    <>
      <Icon name="check" />
      {t.room.confirmed}
    </>
  ) : (
    <>
      <span className="ring" aria-hidden="true" />
      {seat.you ? t.room.missingYou : t.room.notYet}
    </>
  );

  const cls = ['seat', seat.ready && 'is-ok', seat.you && 'is-me', pop && 'is-pop'].filter(Boolean).join(' ');
  return (
    <li className="seat-li">
      <div className={cls}>
        <div className="seat-top">
          <Presence name={seat.name} size={40} status="menu" />
          {tag}
        </div>
        <div className="seat-t">
          <div className="seat-n">{name}</div>
          <div className="seat-s">{state}</div>
        </div>
        {onKick && (
          <button type="button" className="seat-kick" aria-label={L.kickLabel(seat.name)} onClick={onKick}>
            {L.kick}
          </button>
        )}
      </div>
    </li>
  );
}

/* ───────── Trilho da sala ───────── */

function InviteFriends({ lobby }: { lobby: Lobby }) {
  const { user, signIn, pushToast, live, callFriend } = useSession();
  const friends = useFriends();
  const [invited, setInvited] = useState<ReadonlySet<string>>(() => new Set());
  if (!user) {
    return (
      <div className="rinv-out">
        <p>{t.room.inviteSignIn}</p>
        <button type="button" className="btn btn-s btn-sm" onClick={signIn}>
          <Icon name="user" />
          {t.account.signIn}
        </button>
      </div>
    );
  }
  const list = friends.filter((f) => f.lobbyId !== lobby.id);
  if (list.length === 0) return <p className="rail-empty">{t.room.inviteNone}</p>;
  return (
    <ul>
      {list.map((f) => {
        const done = invited.has(f.name);
        return (
          <FriendRow key={f.name} friend={f}>
            <button
              type="button"
              className={`btn btn-sm ${f.lobbyId ? 'btn-s' : 'btn-g'}`}
              disabled={done}
              aria-label={done ? undefined : t.friends.inviteLabel(f.name)}
              onClick={() => {
                // Ao vivo o convite vai pelo servidor (chega como aviso para quem foi chamado).
                if (live) {
                  void callFriend(f).then((ok) => ok && setInvited((s) => new Set(s).add(f.name)));
                  return;
                }
                setInvited((s) => new Set(s).add(f.name));
                pushToast(t.friends.invitedToast(f.name));
              }}
            >
              {done && <Icon name="check" />}
              {done ? t.friends.invited : t.friends.invite}
            </button>
          </FriendRow>
        );
      })}
    </ul>
  );
}

/** Ao vivo, para quem abriu um lobby com convite: quem bateu na porta, com Abrir e Recusar. */
function Knocks() {
  const { knocksHere, answerKnock } = useSession();
  if (knocksHere.length === 0) return null;
  return (
    <section className="rail-sec" aria-labelledby="room-knocks">
      <div className="rail-h">
        <h3 className="cap" id="room-knocks">
          {L.knocksTitle} · <b className="num">{knocksHere.length}</b>
        </h3>
      </div>
      <ul className="rknocks">
        {knocksHere.map((k) => (
          <li key={k.userId} className="rknock">
            <Avatar name={k.name} size={28} />
            <b>{k.name}</b>
            {k.message && <small>{k.message}</small>}
            <div className="rknock-act">
              <button type="button" className="btn btn-s btn-sm" aria-label={L.knockDeclineLabel(k.name)} onClick={() => answerKnock(k.userId, false)}>
                {L.knockDecline}
              </button>
              <button type="button" className="btn btn-p btn-sm" aria-label={L.knockAcceptLabel(k.name)} onClick={() => answerKnock(k.userId, true)}>
                {L.knockAccept}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RoomRail({ lobby, mode, inside, feed, now }: { lobby: Lobby; mode: Mode | undefined; inside: boolean; feed: FeedItem[]; now: number }) {
  const { inviteTo, user } = useSession();
  const free = Math.max(0, lobby.slots - lobby.players);
  const link = `${window.location.host}/sala/${encodeURIComponent(lobby.id)}`;
  return (
    <>
      {lobby.mine && <Knocks />}
      {mode && (
        <section className="rail-sec" aria-labelledby="room-rules">
          <div className="rail-h">
            <h3 className="cap" id="room-rules">
              {t.room.rules}
            </h3>
            <Link to={`/modos/${mode.slug}`} className="link" aria-label={t.room.modeLink(mode.name)}>
              {mode.name}
            </Link>
          </div>
          <ul className="rrules">
            {mode.rules.slice(0, 3).map((r) => (
              <li key={r} className="rrule">
                <span className="ri" aria-hidden="true">
                  <Icon name={ruleIcon(r)} />
                </span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rail-sec" id="room-invite" aria-labelledby="room-invite-h">
        <div className="rail-h">
          <h3 className="cap" id="room-invite-h">
            {t.room.inviteTitle}
          </h3>
          <span className="lbl">{t.room.freeN(free)}</span>
        </div>
        <div className="rinv-link">
          <code className="num" aria-label={t.room.inviteLink}>
            {link}
          </code>
          <button type="button" className="btn btn-s btn-sm" onClick={() => inviteTo(lobby)}>
            <Icon name="copy" />
            {t.room.copy}
          </button>
        </div>
        {inside || lobby.mine ? <InviteFriends lobby={lobby} /> : <p className="rail-empty">{user ? t.room.inviteOutside : t.room.inviteSignIn}</p>}
      </section>

      <section className="rail-sec" aria-labelledby="room-activity">
        <div className="rail-h">
          <h3 className="cap" id="room-activity">
            {t.room.activity}
          </h3>
        </div>
        {feed.length === 0 ? (
          <p className="rail-empty">{t.room.activityEmpty}</p>
        ) : (
          <ul className="ract">
            {feed.map((it) => {
              const who = it.you ? t.room.act.you : it.name;
              const icon = FEED_ICON[it.kind];
              return (
                <li key={it.id} className="ract-i">
                  {who && !icon ? (
                    <Avatar name={it.you ? (user?.name ?? t.lobbies.you) : who} size={20} />
                  ) : (
                    <span className="ract-ico" aria-hidden="true">
                      <Icon name={icon ?? 'info'} />
                    </span>
                  )}
                  <span className="ract-t">
                    {who && !icon && <b>{who}</b>} {t.room.act[it.kind]}
                  </span>
                  <span className="t num">{t.room.ago(Math.max(0, Math.round((now - it.at) / 1000)))}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

/* ───────── A sala ───────── */

function RoomView({ lobby }: { lobby: Lobby }) {
  const s = useSession();
  const { user, hereId, joiningId, joiningStep, ready, toggleReady, startMatch, cancelStart, kick, leaveLobby, closeLobby, inviteTo, pushToast, lobbyCtx } = s;
  const { seatsHere, confirmedAt, countdownEndsAt, handoffStep } = s;
  const now = useNow(5000);
  const friends = useFriends();
  const reduced = useReducedMotion();
  const sheet = useMediaQuery('(max-width: 960px)');
  const { openSheet, sheetOpen } = useRail();
  const mode = getMode(lobby.modeSlug);

  const here = hereId === lobby.id;
  const joining = joiningId === lobby.id;
  const playing = lobby.status === 'em-partida';
  const outsideSeats = useMemo(
    () => roster(lobby, { you: user?.name ?? t.lobbies.you, youHere: false, youReady: false, signedIn: !!user, now, friends: friendsIn(friends, lobby.id) }),
    [lobby, user, now, friends],
  );
  const seats = here && seatsHere.length > 0 ? seatsHere : outsideSeats;
  const taken = seats.filter((x) => x.name).length;
  const readyN = readyCount(seats);
  const k = lobby.minPlayers;
  const countdown = here && countdownEndsAt !== null;
  const handoff = here && handoffStep !== null && handoffStep < STEPS.length - 1;
  const inside = here && handoffStep !== null && handoffStep >= STEPS.length - 1;
  const phase = roomPhase({ players: lobby.players, minPlayers: k, playing, countdown, handoff });

  /* contagem regressiva visível (o fim vem da sessão) */
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    if (!countdown) return;
    setTick(Date.now());
    const id = window.setInterval(() => setTick(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [countdown]);
  const secs = countdownEndsAt ? Math.max(1, Math.ceil((countdownEndsAt - tick) / 1000)) : 0;

  /* atividade local + anúncio único para leitor de tela (educado, sem tagarelar) */
  const [log, setLog] = useState<FeedItem[]>([]);
  const [announce, setAnnounce] = useState('');
  const seq = useRef(0);
  const push = useCallback((kind: FeedKind, extra: Partial<FeedItem> = {}) => {
    setLog((l) => [{ id: `l${++seq.current}`, at: Date.now(), kind, ...extra }, ...l].slice(0, 12));
  }, []);

  const prevReady = useRef(ready);
  useEffect(() => {
    if (here && ready && !prevReady.current) push('confirmed', { you: true });
    prevReady.current = ready;
  }, [ready, here, push]);

  const prevCd = useRef(countdownEndsAt);
  useEffect(() => {
    const was = prevCd.current;
    prevCd.current = countdownEndsAt;
    if (!here) return;
    if (!was && countdownEndsAt) {
      push('countStart');
      setAnnounce(t.room.countdownLive(Math.round((countdownEndsAt - Date.now()) / 1000)));
    } else if (was && !countdownEndsAt && !playing) {
      push('countCancel');
      setAnnounce(t.room.cancelledLive);
    }
  }, [countdownEndsAt, here, playing, push]);

  const prevPlaying = useRef(playing);
  useEffect(() => {
    if (here && playing && !prevPlaying.current) push('started');
    prevPlaying.current = playing;
  }, [playing, here, push]);

  useEffect(() => {
    if (handoffStep === null || !here) return;
    setAnnounce(handoffStep >= STEPS.length - 1 ? t.room.insideLive : t.room.stepLive(STEPS[handoffStep]!, handoffStep + 1, STEPS.length));
  }, [handoffStep, here]);

  useEffect(() => {
    if (joining) setAnnounce(t.room.stepLive(STEPS[joiningStep] ?? STEPS[0]!, joiningStep + 1, STEPS.length));
  }, [joining, joiningStep]);

  const feed = useMemo(() => {
    const items: FeedItem[] = [
      ...lobby.joins.map((j, i) => ({ id: `j${i}:${j.name}:${j.at}`, at: j.at, kind: 'joined' as const, name: j.name, you: j.you })),
      ...(here ? [...confirmedAt].map(([name, at]) => ({ id: `c:${name}`, at, kind: 'confirmed' as const, name })) : []),
      ...log,
    ];
    return items.sort((a, b) => b.at - a.at).slice(0, 6);
  }, [lobby.joins, confirmedAt, here, log]);

  /* a vaga "estala" quando alguém confirma */
  const readyKey = seats
    .filter((x) => x.name && x.ready)
    .map((x) => x.name)
    .join('|');
  const prevReadySet = useRef<Set<string> | null>(null);
  const popTimer = useRef(0);
  const [pops, setPops] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    const cur = new Set(readyKey ? readyKey.split('|') : []);
    const prev = prevReadySet.current;
    prevReadySet.current = cur;
    if (!prev) return;
    const fresh = [...cur].filter((n) => !prev.has(n));
    if (fresh.length === 0) return;
    setPops(new Set(fresh));
    window.clearTimeout(popTimer.current);
    popTimer.current = window.setTimeout(() => setPops(new Set()), 420);
  }, [readyKey]);
  useEffect(() => () => window.clearTimeout(popTimer.current), []);

  /* vaga vazia: abre o convite (folha no celular, trilho no desktop) */
  const focusInvite = useCallback(
    (from: HTMLElement) => {
      if (sheet) {
        openSheet(from);
        window.setTimeout(() => document.getElementById('room-invite')?.scrollIntoView({ block: 'start' }), 260);
        return;
      }
      const sec = document.getElementById('room-invite');
      sec?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
      sec?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
    },
    [sheet, openSheet, reduced],
  );

  /* PRONTO e a tecla F (nunca enquanto se digita, nem com diálogo ou folha aberta) */
  const canToggle = here && !lobby.mine && !playing && !handoff;
  const onReady = useCallback(() => {
    toggleReady();
    setAnnounce(ready ? t.room.unreadyLabel : t.room.readyLive(readyN + 1, taken, k));
  }, [toggleReady, ready, readyN, taken, k]);
  useEffect(() => {
    if (!canToggle || sheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'f' && e.key !== 'F') return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (document.querySelector('dialog[open]')) return;
      e.preventDefault();
      onReady();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [canToggle, sheetOpen, onReady]);

  /* ───── cabeçalho ───── */
  const hostName = lobby.mine ? (user?.name ?? t.lobbies.you) : lobby.host;
  const round = playing ? roundText(lobby, now) : null;
  const phaseDetail = (key: RoomPhaseKey) => {
    const D = t.room.detail;
    switch (key) {
      case 'gathering':
        return D.missingPlayers(k - lobby.players);
      case 'waiting':
        if (readyN < k) return here && !ready && !lobby.mine && k - readyN === 1 ? D.you : D.missingReady(k - readyN);
        return lobby.mine ? D.host : here && !ready ? D.you : D.any;
      case 'countdown':
        return D.startsIn(secs);
      case 'opening':
        return D.keepOpen;
      case 'playing':
        return inside ? D.inside : (round ?? '');
    }
  };

  /* ───── barra PRONTO: meio e ações por estado ───── */
  const st = lobbyState(lobby, lobbyCtx, now);
  let mid;
  let act;
  if (joining) {
    mid = (
      <div className="rb-steps">
        <Steps active={joiningStep} done={joiningStep} />
        <Link to="/instalar#antivirus" className="rb-help">
          {t.room.stuck} <u>{t.room.help}</u>
        </Link>
      </div>
    );
    act = (
      <button type="button" className="btn btn-s rb-ready" aria-disabled="true">
        {t.room.joiningBtn}
      </button>
    );
  } else if (!here) {
    mid = (
      <p className="rb-hint">
        <Icon name="info" />
        <span>{st.label ? `${st.label}. ${t.room.outside}` : t.room.outside}</span>
      </p>
    );
    act = (
      <div className="rb-go">
        <LobbyAction lobby={lobby} state={st} primary />
      </div>
    );
  } else if (handoff || inside) {
    mid = <Steps active={handoff ? handoffStep! : STEPS.length - 1} done={handoff ? handoffStep! : STEPS.length} />;
    act = inside ? (
      <>
        <button type="button" className="btn btn-g" onClick={leaveLobby} aria-label={t.room.leaveLabel(lobby.name)}>
          <Icon name="exit" />
          {t.room.leave}
        </button>
        <button type="button" className="btn btn-p rb-ready" onClick={() => pushToast(t.room.reopenToast)}>
          {t.room.backToGame}
          <Icon name="arrow" />
        </button>
      </>
    ) : (
      <button type="button" className="btn btn-s rb-ready" aria-disabled="true">
        {t.room.opening}
      </button>
    );
  } else if (playing) {
    mid = (
      <p className="rb-hint">
        <Icon name="pad" />
        <span>{t.room.playingNote}</span>
      </p>
    );
    act = (
      <>
        <button type="button" className="btn btn-g" onClick={leaveLobby} aria-label={t.room.leaveLabel(lobby.name)}>
          <Icon name="exit" />
          {t.room.leave}
        </button>
        <button type="button" className="btn btn-p rb-ready" onClick={() => pushToast(t.room.reopenToast)}>
          {t.room.backToGame}
          <Icon name="arrow" />
        </button>
      </>
    );
  } else if (lobby.mine && countdown) {
    // Ao vivo, quem abriu também vê a contagem de 5 s e pode cancelar.
    mid = (
      <p className="rb-hint is-count">
        <span className="rb-cd num" aria-hidden="true">
          {secs}
        </span>
        <span>
          {t.room.countdownLead} {t.room.seconds(secs)}. {t.room.countdownTail}
        </span>
      </p>
    );
    act = (
      <>
        <button type="button" className="btn btn-g" onClick={() => closeLobby(lobby.id)} aria-label={t.room.closeLabel(lobby.name)}>
          <Icon name="x" />
          {t.room.close}
        </button>
        <button type="button" className="btn rb-ready is-on" aria-label={t.room.cancelLabel} onClick={cancelStart}>
          {t.room.cancel}
        </button>
      </>
    );
  } else if (lobby.mine) {
    const canStart = lobby.players >= k && readyN >= k;
    mid = (
      <p className="rb-hint">
        <Icon name="info" />
        <span>{lobby.players < k ? t.room.hostGathering(k - lobby.players) : canStart ? t.room.hostReady : t.room.hostWaiting(k - readyN)}</span>
      </p>
    );
    act = (
      <>
        <button type="button" className="btn btn-g" onClick={() => closeLobby(lobby.id)} aria-label={t.room.closeLabel(lobby.name)}>
          <Icon name="x" />
          {t.room.close}
        </button>
        <button type="button" className="btn btn-p rb-ready" disabled={!canStart} onClick={startMatch}>
          <Icon name="play" />
          {t.room.start}
        </button>
      </>
    );
  } else {
    mid = countdown ? (
      <p className="rb-hint is-count">
        <span className="rb-cd num" aria-hidden="true">
          {secs}
        </span>
        <span>
          {t.room.countdownLead} {t.room.seconds(secs)}. {t.room.countdownTail}
        </span>
      </p>
    ) : (
      <p className="rb-hint">
        <Icon name="info" />
        <span>{ready ? t.room.hintWaiting(Math.max(0, k - readyN)) : t.room.hint(k)}</span>
      </p>
    );
    act = (
      <>
        <button type="button" className="btn btn-g" onClick={leaveLobby} aria-label={t.room.leaveLabel(lobby.name)}>
          <Icon name="exit" />
          {t.room.leave}
        </button>
        <button
          type="button"
          className={`btn rb-ready ${ready ? 'is-on' : 'btn-p is-caps'}`}
          aria-keyshortcuts="F"
          aria-label={countdown ? t.room.cancelLabel : ready ? t.room.unreadyLabel : t.room.readyLabel}
          onClick={onReady}
        >
          {countdown ? t.room.cancel : ready ? t.room.ready : t.room.readyCta}
          {ready && !countdown && <Icon name="check" />}
          <span className="kbd" aria-hidden="true">
            F
          </span>
        </button>
      </>
    );
  }

  const ticks = Math.max(taken, k);
  const free = Math.max(0, lobby.slots - lobby.players);

  return (
    <div className="room-page">
      <section className="rh" aria-labelledby="room-title">
        <ModeCover slug={lobby.modeSlug} wide />
        <div className="rh-shade" aria-hidden="true" />
        <div className="rh-body">
          <Link to="/#lobbies" className="rh-back">
            <Icon name="back" />
            {t.room.back}
          </Link>
          <h1 className="display" id="room-title">
            {lobby.name}
            {lobby.locked && <Icon name="lock" className="rh-lock" label={t.lobbies.locked} />}
          </h1>
          <p className="rh-meta">
            <span className="who">
              <Avatar name={hostName} size={22} />
              {hostName}
              <span className="tag line">
                <Icon name="crown" />
                <span className="vh-md">{t.room.opened}</span>
              </span>
            </span>
            {mode && (
              <>
                <i className="hide-md" aria-hidden="true" />
                <span className="hide-md">{mode.name}</span>
              </>
            )}
            <i aria-hidden="true" />
            <span>
              <span className="num">
                {lobby.players}/{lobby.slots}
              </span>{' '}
              {t.room.playersWord}
            </span>
            <i className="hide-md" aria-hidden="true" />
            <span className="hide-md">
              {t.room.startsWith} <span className="num">{k}</span>
            </span>
            <i className="hide-md" aria-hidden="true" />
            <span className="hide-md">
              {t.regions[lobby.region]} · <span className="num">{t.lobbies.ping(lobby.ping)}</span>
            </span>
            {playing && (
              <Tag tone="warn" className="rh-live">
                {t.lobbyState.playing(round)}
              </Tag>
            )}
          </p>
        </div>
        <div className="rphase">
          <div className="rphase-t">
            <span className="cap">{t.room.phase}</span>
            <span className="num">{t.room.phaseOf(phase.step)}</span>
          </div>
          <div className="rphase-bar" aria-hidden="true">
            {[1, 2, 3, 4].map((i) => (
              <i key={i} className={i <= phase.step ? 'on' : undefined} />
            ))}
          </div>
          <p className="rphase-v">
            {t.room.phases[phase.key]}
            {phaseDetail(phase.key) && <span> · {phaseDetail(phase.key)}</span>}
          </p>
        </div>
      </section>

      <button type="button" className="rsheet" aria-haspopup="dialog" onClick={(e) => openSheet(e.currentTarget)}>
        <span className="ri" aria-hidden="true">
          <Icon name="users" />
        </span>
        <span className="t">
          <b>{t.room.sheetBtn}</b>
          <span>{t.room.sheetSub(Math.min(3, mode?.rules.length ?? 0), free)}</span>
        </span>
        <Icon name="chev" />
      </button>

      <section className="sec" aria-labelledby="room-players">
        <SectionTitle id="room-players" words={t.room.title} meta={t.room.seatsMeta(lobby.players, lobby.slots)}>
          <button type="button" className="link" onClick={() => inviteTo(lobby)}>
            <Icon name="link" />
            {t.room.copyInvite}
          </button>
        </SectionTitle>
        <ul className="seats">
          {seats.map((seat, i) => (
            <SeatCard
              key={seat.name ?? `free-${i}`}
              seat={seat}
              index={i}
              pop={!!seat.name && pops.has(seat.name)}
              playing={playing}
              visitor={!here && !lobby.mine}
              signedIn={!!user}
              onInvite={focusInvite}
              onKick={s.live && lobby.mine && seat.name && !seat.you && !playing ? () => kick(seat) : undefined}
            />
          ))}
        </ul>
      </section>

      <div className="rbar" role="region" aria-label={t.dock.label}>
        <div className="rb-count">
          <p className="rb-n" aria-hidden="true">
            <b className="num">{readyN}</b>
            <span>{t.room.readyOf(taken)}</span>
            <span className="rb-k">
              · {t.room.startsWith} <span className="num">{k}</span>
            </span>
          </p>
          <span className="rb-ticks" role="img" aria-label={t.room.ticksLabel(readyN, k)}>
            {Array.from({ length: ticks }, (_, i) => (
              <i key={i} className={[i < readyN && 'on', i === k - 1 && 'th', i >= taken && 'gap'].filter(Boolean).join(' ') || undefined} />
            ))}
          </span>
        </div>
        <div className="rb-mid">{mid}</div>
        <div className="rb-act">{act}</div>
        <p className="sr-only" role="status" aria-live="polite">
          {announce}
        </p>
      </div>

      <Rail title={t.room.railTitle}>
        <RoomRail lobby={lobby} mode={mode} inside={here} feed={feed} now={now} />
      </Rail>
    </div>
  );
}

export function Room() {
  const { id = '' } = useParams();
  const { lobbies, synced } = useSession();
  const lobby = lobbies.find((l) => l.id === id);
  useDocumentTitle(t.room.meta(lobby?.name ?? t.room.goneTitle));

  // Ao vivo, antes da primeira lista: ainda não dá para dizer que a sala sumiu.
  if (!lobby && !synced) {
    return (
      <div className="page route-wait" aria-busy="true">
        <div className="wrap">
          <p className="fine">{L.connecting}</p>
        </div>
      </div>
    );
  }

  if (!lobby) {
    return (
      <div className="room-gone">
        <h1 className="display two">{t.room.goneTitle}</h1>
        <p>{t.room.goneBody}</p>
        <Link to="/#lobbies" className="btn btn-p btn-lg">
          {t.room.goneLink}
          <Icon name="arrow" />
        </Link>
      </div>
    );
  }
  return <RoomView key={lobby.id} lobby={lobby} />;
}
