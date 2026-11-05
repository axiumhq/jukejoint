import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { Presence } from '../components/Avatar';
import { Tag } from '../components/Common';
import { FriendRow } from '../components/Friends';
import { Icon } from '../components/Icon';
import { LobbyAction } from '../components/LobbyAction';
import { ModeMedallion } from '../components/ModeCover';
import { Rail, useRail, useRailSignIn } from '../components/Rail';
import type { Lobby } from '../data/lobbies';
import { getMode, type Mode } from '../data/modes';
import { useDocumentTitle, useFriends, useMediaQuery, useReducedMotion } from '../hooks';
import { useNow } from '../hooks/useNow';
import { t } from '../i18n';
import { desktop as D } from '../i18n/desktop';
import { live as L } from '../i18n/live';
import type { EngineError } from '../lib/desktop';
import { friendsIn } from '../lib/friends';
import { lobbyState, roundText } from '../lib/lobbies';
import { handoffState, readyCount, roomPhase, roster, type RoomPhaseKey, type Seat } from '../lib/room';
import { useSession } from '../state/session';
import { inviteLink, inviteLinkLabel } from '../lib/invite';

/**
 * A sala do lobby (/sala/:id), do Claude Design (Sala, Sala-Barras, Sala-Mobile): cabeçalho com o
 * medalhão do modo, a fase em quatro passos, a grade de vagas, a barra de ação fixa embaixo e o
 * painel da sala (pedidos, regras, convite, atividade).
 * A barra tem um estado por vez: de fora (Entrar), o app trabalhando (entrada e handoff, em etapas),
 * PRONTO com F, contagem de 5 s (Cancelar), Iniciar partida (quem abriu), em partida e falha do app.
 * Quem decide a contagem e o handoff é a sessão (state/session.tsx); a tela só mostra e pede.
 */

/** O que o app faz em cada etapa (entrada e handoff têm as mesmas três). */
const APP_STEPS = t.lobbies.joinSteps;

type FeedKind = 'joined' | 'confirmed' | 'countStart' | 'countCancel' | 'started';
interface FeedItem {
  id: string;
  at: number;
  kind: FeedKind;
  name?: string;
  you?: boolean;
}

type BarState = 'joining' | 'visitor' | 'fail' | 'opening' | 'playing' | 'countdown' | 'host' | 'member';

/* ───────── Barra: as etapas do app ───────── */

/** As três etapas do app em pílulas: feita (presença), atual (acento), por vir (apagada). */
function AppSteps({ step, test }: { step: number; test?: string | null }) {
  return (
    <ol className="rb-steps">
      {APP_STEPS.map((s, i) => (
        <li key={s} className={i < step ? 'is-done' : i === step ? 'is-on' : undefined} aria-current={i === step ? 'step' : undefined}>
          {i < step && <Icon name="check" />}
          {s}
        </li>
      ))}
      {test && (
        <li className="rb-test" title={test}>
          {D.testTag}
        </li>
      )}
    </ol>
  );
}

/** Dentro do app: o detalhe técnico da falha, aberto pelo botão "Detalhes técnicos" da barra. */
function FailDetails({ error, id, open }: { error: EngineError; id: string; open: boolean }) {
  return (
    <div className="rb-tech" id={id} hidden={!open}>
      <p>{error.message}</p>
      {error.detail && <code>{error.detail}</code>}
    </div>
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
        <b>{visitor ? t.room.free : t.room.invite}</b>
        <small>{t.room.seatN(index + 1)}</small>
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

  const state = playing ? (
    <>
      <Icon name="pad" />
      {t.room.inMatch}
    </>
  ) : seat.ready ? (
    <>
      {t.room.confirmed}
      <Icon name="check" />
    </>
  ) : seat.you ? (
    t.room.missingYou
  ) : (
    t.room.notYet
  );

  const cls = ['seat', seat.ready && !playing && 'is-ok', seat.you && 'is-me', pop && 'is-pop'].filter(Boolean).join(' ');
  return (
    <li className="seat-li">
      <div className={cls}>
        <Presence name={seat.name} size={56} status="lobby" />
        <div className="seat-t">
          <span className="seat-n">
            <b>{name}</b>
            {seat.host && <Icon name="crown" className="seat-crown" label={t.room.hostTitle} />}
            {seat.you && signedIn && <span className="mk is-you">{t.room.act.you}</span>}
            {seat.friend && !seat.you && (
              <span className="mk" title={t.room.friendTitle}>
                {t.room.friendMark}
              </span>
            )}
          </span>
          <span className="seat-s">{state}</span>
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

/* ───────── Painel da sala ───────── */

function InviteFriends({ lobby }: { lobby: Lobby }) {
  const { user, signIn, pushToast, live, callFriend } = useSession();
  const friends = useFriends();
  const [invited, setInvited] = useState<ReadonlySet<string>>(() => new Set());
  // sem login, o convite mostra o botão de login: a barra superior não repete (só vale quando não há conta)
  useRailSignIn();
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
    <ul className="rinv-list">
      {list.map((f) => {
        const done = invited.has(f.name);
        return (
          <FriendRow key={f.name} friend={f}>
            <button
              type="button"
              className={`btn btn-sm ${done ? 'btn-done' : 'btn-s'}`}
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
        <h2 className="cap" id="room-knocks">
          {L.knocksTitle} · <span className="num">{knocksHere.length}</span>
        </h2>
      </div>
      <ul className="rknocks">
        {knocksHere.map((k) => (
          <li key={k.userId} className="rknock">
            <p>
              <b>{k.name}</b> {k.message && <span>{k.message}</span>}
            </p>
            <div className="rknock-act">
              <button type="button" className="btn btn-s btn-sm" aria-label={L.knockAcceptLabel(k.name)} onClick={() => answerKnock(k.userId, true)}>
                {L.knockAccept}
              </button>
              <button type="button" className="btn btn-g btn-sm" aria-label={L.knockDeclineLabel(k.name)} onClick={() => answerKnock(k.userId, false)}>
                {L.knockDecline}
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
  const link = inviteLinkLabel(inviteLink(lobby.id));
  return (
    <>
      <h2 className="display rroom-h">{t.room.railTitle}</h2>
      {lobby.mine && <Knocks />}
      {mode && (
        <section className="rail-sec" aria-labelledby="room-rules">
          <div className="rail-h">
            <h2 className="cap" id="room-rules">
              {t.room.rules}
            </h2>
          </div>
          <ul className="rrules">
            {mode.rules.slice(0, 3).map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <Link to={`/modos/${mode.slug}`} className="link rrules-all">
            {t.room.allRules}
          </Link>
        </section>
      )}

      <section className="rail-sec" id="room-invite" aria-labelledby="room-invite-h">
        <div className="rail-h">
          <h2 className="cap" id="room-invite-h">
            {t.room.inviteTitle} · {t.room.freeN(free)}
          </h2>
        </div>
        <div className="rinv-link">
          <input className="rinv-in num" readOnly value={link} aria-label={t.room.inviteLink} onFocus={(e) => e.currentTarget.select()} />
          <button type="button" className="btn btn-s" onClick={() => inviteTo(lobby)}>
            {t.room.copy}
          </button>
        </div>
        {inside || lobby.mine ? <InviteFriends lobby={lobby} /> : <p className="rail-empty">{user ? t.room.inviteOutside : t.room.inviteSignIn}</p>}
      </section>

      <section className="rail-sec" aria-labelledby="room-activity">
        <div className="rail-h">
          <h2 className="cap" id="room-activity">
            {t.room.activity}
          </h2>
        </div>
        {feed.length === 0 ? (
          <p className="rail-empty">{t.room.activityEmpty}</p>
        ) : (
          <ul className="ract">
            {feed.map((it) => {
              const who = it.you ? t.room.act.you : it.name;
              const named = it.kind === 'joined' || it.kind === 'confirmed';
              return (
                <li key={it.id} className="ract-i">
                  <span className="ract-t">
                    {named && who && <b>{who}</b>} {t.room.act[it.kind]}
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
  // Ao vivo e na simulação a sala vira "em-partida" quando o handoff começa; para você ela só está
  // em partida depois que o app terminou de abrir o jogo.
  const hs = here ? handoffState(handoffStep, APP_STEPS.length) : null;
  const handoff = hs === 'opening';
  const inside = hs === 'inside';
  const playing = lobby.status === 'em-partida';
  const inMatch = playing && !handoff;
  const outsideSeats = useMemo(
    () => roster(lobby, { you: user?.name ?? t.lobbies.you, youHere: false, youReady: false, signedIn: !!user, now, friends: friendsIn(friends, lobby.id) }),
    [lobby, user, now, friends],
  );
  const seats = here && seatsHere.length > 0 ? seatsHere : outsideSeats;
  const taken = seats.filter((x) => x.name).length;
  const readyN = readyCount(seats);
  const k = lobby.minPlayers;
  const countdown = here && countdownEndsAt !== null;
  const phase = roomPhase({ players: lobby.players, minPlayers: k, ready: readyN, playing, countdown, handoff });

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
    setAnnounce(handoffStep >= APP_STEPS.length ? t.room.insideLive : (APP_STEPS[handoffStep] ?? ''));
  }, [handoffStep, here]);

  useEffect(() => {
    if (joining) setAnnounce(APP_STEPS[joiningStep] ?? APP_STEPS[0]!);
  }, [joining, joiningStep]);

  const feed = useMemo(() => {
    const items: FeedItem[] = [
      ...lobby.joins.map((j, i) => ({ id: `j${i}:${j.name}:${j.at}`, at: j.at, kind: 'joined' as const, name: j.name, you: j.you })),
      ...(here ? [...confirmedAt].map(([name, at]) => ({ id: `c:${name}`, at, kind: 'confirmed' as const, name })) : []),
      ...log,
    ];
    return items.sort((a, b) => b.at - a.at).slice(0, 6);
  }, [lobby.joins, confirmedAt, here, log]);

  /* a vaga "pula" quando alguém confirma */
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

  /* a barra cresce no celular e com o detalhe da falha: os avisos sobem junto (--rbar-h no root) */
  const barRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = barRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const root = document.documentElement.style;
    const ro = new ResizeObserver(() => root.setProperty('--rbar-h', `${Math.ceil(el.getBoundingClientRect().height)}px`));
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.removeProperty('--rbar-h');
    };
  }, []);

  /* vaga vazia: abre o convite (folha no celular, painel no desktop) */
  const focusInvite = useCallback(
    (from: HTMLElement) => {
      if (sheet) {
        openSheet(from);
        window.setTimeout(() => document.getElementById('room-invite')?.scrollIntoView({ block: 'start' }), 260);
        return;
      }
      const sec = document.getElementById('room-invite');
      sec?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
      sec?.querySelector<HTMLElement>('input, button')?.focus({ preventScroll: true });
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

  /* o detalhe técnico da falha (só dentro do app) */
  const [techOpen, setTechOpen] = useState(false);
  useEffect(() => {
    if (!s.engineError) setTechOpen(false);
  }, [s.engineError]);

  /* ───── cabeçalho ───── */
  const round = playing ? roundText(lobby, now) : null;
  const phaseDetail = (key: RoomPhaseKey) => {
    const P = t.room.detail;
    switch (key) {
      case 'gathering':
        return P.missingPlayers(k - lobby.players);
      case 'waiting':
        return P.missingReady(k - readyN);
      case 'quorum':
        return lobby.mine ? P.host : P.any;
      case 'countdown':
        return P.startsIn(secs);
      case 'opening':
        return P.opening;
      case 'playing':
        return inside ? P.inside : (round ?? t.room.phases.playing);
    }
  };

  /* ───── barra de ação: um estado por vez ───── */
  const st = lobbyState(lobby, lobbyCtx, now);
  // O aviso vale para o modo desta sala: um app mais antigo, sem a lista, só diz se todos são teste.
  const modes = s.appCheck?.modes;
  const isTestMode = modes ? (modes.testSlugs ? modes.testSlugs.includes(lobby.modeSlug) : modes.testMode) : false;
  const testNote = s.desktop && modes && isTestMode ? D.testMode(modes.testProject) : null;
  const countText = `${readyN} ${t.room.readyOf(taken)} · ${t.room.minimum} ${k}`;
  const helpLink = (
    <Link to="/instalar#antivirus" className="btn btn-g rb-help">
      {t.room.stuck} <u>{t.room.help}</u>
    </Link>
  );
  const exitBtn =
    lobby.mine && s.live && s.desktop ? (
      <button type="button" className="btn btn-g" onClick={s.endMatch} aria-label={D.endMatchLabel(lobby.name)}>
        {D.endMatch}
      </button>
    ) : (
      <button type="button" className="btn btn-g" onClick={leaveLobby} aria-label={t.room.leaveLabel(lobby.name)}>
        {t.room.leave}
      </button>
    );

  let bar: BarState;
  let num: number | null = null;
  let tx: ReactNode;
  let sub: ReactNode = null;
  let extra: ReactNode = null;
  let meter = false;
  let act: ReactNode = null;

  if (joining) {
    bar = 'joining';
    tx = t.room.keepOpen;
    extra = <AppSteps step={joiningStep} />;
    act = helpLink;
  } else if (!here) {
    bar = 'visitor';
    tx = t.room.outside;
    sub = st.label || null;
    act = (
      <div className="rb-go">
        <LobbyAction lobby={lobby} state={st} primary />
      </div>
    );
  } else if (s.engineError && (handoff || playing)) {
    // Dentro do app: hospedar ou entrar falhou. A frase do app, o detalhe recolhido e tentar de novo.
    bar = 'fail';
    tx = lobby.mine ? D.failedHost : D.failedJoin;
    extra = <FailDetails error={s.engineError} id="rb-tech" open={techOpen} />;
    act = (
      <>
        <button type="button" className="btn btn-g" aria-expanded={techOpen} aria-controls="rb-tech" onClick={() => setTechOpen((v) => !v)}>
          {D.details}
        </button>
        {lobby.mine ? (
          <button type="button" className="btn btn-g" onClick={s.endMatch} aria-label={D.endMatchLabel(lobby.name)}>
            {D.endMatch}
          </button>
        ) : (
          <button type="button" className="btn btn-g" onClick={leaveLobby} aria-label={t.room.leaveLabel(lobby.name)}>
            {t.room.leave}
          </button>
        )}
        <button type="button" className="btn btn-p btn-xl rb-main-btn" onClick={s.retryEngine}>
          {D.retry}
        </button>
      </>
    );
  } else if (handoff) {
    bar = 'opening';
    tx = t.room.keepOpen;
    extra = <AppSteps step={handoffStep!} test={testNote} />;
    act = helpLink;
  } else if (playing) {
    bar = 'playing';
    tx = t.room.playingTitle;
    sub = t.room.playingNote;
    act = (
      <>
        {exitBtn}
        <button type="button" className="btn btn-p btn-xl rb-main-btn" onClick={() => pushToast(t.room.reopenToast)}>
          {t.room.backToGame}
        </button>
      </>
    );
  } else if (countdown) {
    // A contagem de 5 s: cancelável. Para quem abriu (ao vivo) é cancelar o início; para o resto, desmarcar o pronto.
    bar = 'countdown';
    num = secs;
    tx = `${t.room.countdownLead} ${t.room.seconds(secs)}.`;
    sub = t.room.countdownTail;
    act = lobby.mine ? (
      <button type="button" className="btn btn-o btn-lg" aria-label={t.room.cancelLabel} onClick={cancelStart}>
        {t.room.cancel}
      </button>
    ) : (
      <button type="button" className="btn btn-o btn-lg" aria-keyshortcuts="F" aria-label={t.room.cancelLabel} onClick={onReady}>
        {t.room.cancel}
        <span className="kbd" aria-hidden="true">
          F
        </span>
      </button>
    );
  } else if (lobby.mine) {
    bar = 'host';
    const canStart = lobby.players >= k && readyN >= k;
    tx = lobby.players < k ? t.room.hostGathering(k - lobby.players) : canStart ? countText : t.room.hostWaiting(k - readyN);
    meter = true;
    act = (
      <>
        <button type="button" className="btn btn-o" onClick={() => closeLobby(lobby.id)} aria-label={t.room.closeLabel(lobby.name)}>
          {t.room.close}
        </button>
        <button type="button" className="btn btn-p btn-xl rb-main-btn" aria-disabled={!canStart} onClick={() => canStart && startMatch()}>
          {t.room.start}
        </button>
      </>
    );
  } else {
    bar = 'member';
    tx = countText;
    meter = true;
    act = (
      <>
        <button type="button" className="btn btn-g" onClick={leaveLobby} aria-label={t.room.leaveLabel(lobby.name)}>
          {t.room.leave}
        </button>
        <button
          type="button"
          className={`btn btn-xl rb-main-btn rb-ready ${ready ? 'is-on' : 'btn-p is-caps'}`}
          aria-keyshortcuts="F"
          aria-label={ready ? t.room.unreadyLabel : t.room.readyLabel}
          onClick={onReady}
        >
          {ready ? t.room.ready : t.room.readyCta}
          {ready ? (
            <Icon name="check" />
          ) : (
            <span className="kbd" aria-hidden="true">
              F
            </span>
          )}
        </button>
      </>
    );
  }

  const ticks = Math.max(taken, k);
  const free = Math.max(0, lobby.slots - lobby.players);
  const hostName = lobby.mine ? null : lobby.host;

  return (
    <div className="room-page">
      <header className="rh" aria-labelledby="room-title">
        <span className="rh-art" aria-hidden="true">
          <ModeMedallion slug={lobby.modeSlug} />
        </span>
        <div className="rh-t">
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
              <Icon name="crown" label={t.room.hostTitle} />
              {hostName ? t.room.by(hostName) : t.room.byYou}
            </span>
            {mode && <span className="hide-sm">{mode.name}</span>}
            <span>{t.lobbies.inRoom(lobby.players, lobby.slots)}</span>
            <span className="hide-sm">
              {t.room.minimum} {k}
            </span>
            <span className="num">
              {t.regions[lobby.region]} · {t.lobbies.ping(lobby.ping)}
            </span>
            {inMatch && (
              <Tag tone="warn" className="rh-live">
                {t.lobbyState.playing(round)}
              </Tag>
            )}
          </p>
        </div>
      </header>

      <section className="rphase" role="group" aria-label={`${t.room.phase} ${t.room.phaseOf(phase.step)}: ${t.room.phases[phase.key]}`}>
        <div className="rphase-h">
          <span className="rphase-n">
            {t.room.phase} {t.room.phaseOf(phase.step)}
          </span>
          <span className="rphase-v">{phaseDetail(phase.key)}</span>
        </div>
        <ol className="rphase-steps">
          {t.room.phaseSteps.map((label, i) => (
            <li key={label} className={[i < phase.step && 'on', i === phase.step - 1 && 'at'].filter(Boolean).join(' ') || undefined} aria-current={i === phase.step - 1 ? 'step' : undefined}>
              <i aria-hidden="true" />
              <span>
                {i + 1} {label}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="rseats" aria-labelledby="room-players">
        <div className="rseats-h">
          <h2 id="room-players">
            {t.room.title.join(' ')} · {t.room.seatsMeta(lobby.players, lobby.slots)}
          </h2>
          <button type="button" className="btn btn-g btn-sm" onClick={() => inviteTo(lobby)}>
            {t.room.copyInvite}
          </button>
        </div>
        <ul className="seats">
          {seats.map((seat, i) => (
            <SeatCard
              key={seat.name ?? `free-${i}`}
              seat={seat}
              index={i}
              pop={!!seat.name && pops.has(seat.name)}
              playing={inMatch}
              visitor={!here && !lobby.mine}
              signedIn={!!user}
              onInvite={focusInvite}
              onKick={s.live && lobby.mine && seat.name && !seat.you && !playing ? () => kick(seat) : undefined}
            />
          ))}
        </ul>
      </section>

      <button type="button" className="rsheet" aria-haspopup="dialog" onClick={(e) => openSheet(e.currentTarget)}>
        <span className="t">
          <b>{t.room.sheetBtn}</b>
          <span>{t.room.sheetSub(Math.min(3, mode?.rules.length ?? 0), free)}</span>
        </span>
        <Icon name="chev" />
      </button>

      <div className={bar === 'fail' ? 'rbar is-fail' : 'rbar'} data-state={bar} role="region" aria-label={t.dock.label} ref={barRef}>
        <div className="rb-main">
          {num !== null && (
            <span className="rb-cd display" aria-hidden="true">
              {num}
            </span>
          )}
          <div className="rb-txt">
            <p className="rb-tx">{tx}</p>
            {sub && <p className="rb-sub">{sub}</p>}
            {meter && (
              <span className="rb-ticks" role="img" aria-label={t.room.ticksLabel(readyN, k)}>
                {Array.from({ length: ticks }, (_, i) => (
                  <i key={i} className={[i < readyN && 'on', i === k - 1 && 'th', i >= taken && 'gap'].filter(Boolean).join(' ') || undefined} />
                ))}
              </span>
            )}
            {bar !== 'fail' && extra}
          </div>
        </div>
        <div className="rb-act">{act}</div>
        {bar === 'fail' && extra}
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
      <div className="room-wait" aria-busy="true">
        <h1 className="display">{L.connecting}</h1>
        <div className="seats" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="skel room-skel" />
          ))}
        </div>
      </div>
    );
  }

  if (!lobby) {
    return (
      <div className="room-gone">
        <h1 className="display">{t.room.goneTitle}</h1>
        <p>{t.room.goneBody}</p>
        <Link to="/#lobbies" className="btn btn-p">
          {t.room.goneLink}
        </Link>
      </div>
    );
  }
  return <RoomView key={lobby.id} lobby={lobby} />;
}
