import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { lobbies as seedLobbies, passersby, type Lobby } from '../data/lobbies';
import { getMode, type Region } from '../data/modes';
import { t } from '../i18n';
import { useNavigate } from 'react-router';
import { friendsIn, friendsOnline } from '../lib/friends';
import { lobbyState, type KnockStatus, type LobbyContext } from '../lib/lobbies';
import { nextToConfirm, readyCount, roster, type Seat } from '../lib/room';
import { dayPeriod } from '../lib/time';

/**
 * Estado simulado da sessão. Nada aqui fala com servidor:
 * login, conexão com o app, entrar, sair, bater na porta e criar lobby são só estado local.
 */

export interface MockUser {
  name: string;
  friendsOnline: number;
}

export interface Toast {
  id: number;
  message: string;
}

export interface HostDraft {
  name: string;
  modeSlug: string;
  region: Region;
  slots: number;
  minPlayers: number;
  locked: boolean;
}

export type JoinTarget = { kind: 'lobby'; lobby: Lobby } | { kind: 'bots' };

interface SessionValue {
  user: MockUser | null;
  signIn: () => void;
  signOut: () => void;
  appConnected: boolean;
  setAppConnected: (v: boolean) => void;
  lobbies: Lobby[];
  /** Lobby em que você está (entrou ou abriu). */
  hereId: string | null;
  /** Contexto para `lobbyState()`: presença, entrada em curso, portas e avisos. */
  lobbyCtx: LobbyContext;
  createLobby: (draft: HostDraft) => void;
  closeLobby: (id: string) => void;
  leaveLobby: () => void;
  inviteTo: (lobby: Lobby) => void;
  /** Você marcou "pronto" na sala em que está. */
  ready: boolean;
  toggleReady: () => void;
  /** Só o anfitrião, com o mínimo de jogadores: começa a partida. */
  startMatch: () => void;
  /** As vagas da sala em que você está (mesma conta que decide a contagem). Vazio fora de sala. */
  seatsHere: Seat[];
  /** Quem confirmou depois de você, com a hora (simulado; alimenta a atividade da sala). */
  confirmedAt: ReadonlyMap<string, number>;
  /** Fim da contagem de 5 s (epoch ms) na sala em que você está; `null` sem contagem. Desmarcar pronto cancela. */
  countdownEndsAt: number | null;
  /** Etapa do app depois que a partida começa (índice em HANDOFF_STEPS); 3 = dentro do lobby. `null` sem handoff. */
  handoffStep: number | null;
  joiningId: string | null;
  /** Etapa simulada da entrada (índice em t.lobbies.joinSteps). */
  joiningStep: number;
  /** Pede para entrar. Abre o diálogo se o app não estiver conectado ou se você já está noutro lobby. */
  requestJoin: (target: JoinTarget) => void;
  joinTarget: JoinTarget | null;
  closeJoin: () => void;
  /** Confirma a entrada do diálogo (conecta o app se precisar). */
  confirmJoin: () => void;
  /** Compatibilidade v3. */
  confirmJoinWithApp: () => void;
  knockTarget: Lobby | null;
  openKnock: (lobby: Lobby) => void;
  closeKnock: () => void;
  sendKnock: (message: string) => void;
  knocks: ReadonlyMap<string, KnockStatus>;
  hostDialog: { open: boolean; modeSlug?: string };
  openHost: (modeSlug?: string) => void;
  closeHost: () => void;
  notify: Set<string>;
  toggleNotify: (key: string, label: string) => void;
  /** Convites recebidos que você recusou (id do lobby); o trilho não mostra de novo. */
  declinedInvites: ReadonlySet<string>;
  declineInvite: (lobbyId: string) => void;
  toasts: Toast[];
  pushToast: (message: string) => void;
  dismissToast: (id: number) => void;
}

const SessionContext = createContext<SessionValue | null>(null);

const MOCK_USER: MockUser = { name: 'Corvo_Noturno', friendsOnline: 4 };

/** Intervalo do "ao vivo" simulado: alguém entra (ou sai) de um lobby a cada tique. */
const LIVE_TICK_MS = 3800;
/** Quanto o anfitrião simulado leva para abrir a porta. */
const KNOCK_ANSWER_MS = 6000;
/**
 * Na sala dos outros: com você pronto e o mínimo de confirmados, o anfitrião simulado começa depois disto.
 * É a contagem de 5 s da barra PRONTO; desmarcar pronto (ou alguém desmarcar) cancela.
 */
export const HOST_START_MS = 5000;
/** Depois que você marca pronto, quem faltava vai confirmando, um a cada intervalo. */
const CONFIRM_MS = 2600;
/** Handoff para o jogo: quanto cada etapa dura (Baixando o modo, Abrindo o Deadlock, Entrando no lobby). */
export const HANDOFF_MS = [900, 1700, 1500] as const;

/**
 * Um tique do ao vivo simulado. Na maioria das vezes alguém entra num lobby com vaga
 * (uma janela acende e vira o "entrou agora"); às vezes alguém sai.
 * Lobbies em partida não mudam; do seu lobby e daquele em que você está ninguém sai.
 */
export function liveTick(list: Lobby[], hereId: string | null, now = Date.now(), joiningId: string | null = null): Lobby[] {
  const pool = list.filter((l) => l.status !== 'em-partida');
  if (pool.length === 0) return list;
  const taken = pool.reduce((n, l) => n + l.players, 0);
  const total = pool.reduce((n, l) => n + l.slots, 0);
  // Quanto mais cheia a cidade, mais gente sai: mantém o movimento em volta de ~70%.
  const leaveChance = taken / total > 0.74 ? 0.55 : 0.2;
  const leaving = Math.random() < leaveChance;
  const candidates = pool.filter((l) =>
    // A vaga de quem está entrando fica reservada: ninguém a ocupa no meio da entrada.
    leaving ? !l.mine && l.id !== hereId && l.players > l.friends + 1 : l.players < l.slots - (l.id === joiningId ? 1 : 0),
  );
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  if (!pick) return list;
  return list.map((l) => {
    if (l.id !== pick.id) return l;
    const players = l.players + (leaving ? -1 : 1);
    const status = players >= l.slots ? 'cheio' : 'aberto';
    if (leaving) return { ...l, players, status, fullSince: undefined };
    const name = passersby[Math.floor(Math.random() * passersby.length)] ?? 'Alguém';
    const joins = [...l.joins, { name, at: now }].slice(-6);
    return { ...l, players, status, joins, fullSince: status === 'cheio' ? now : l.fullSince };
  });
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MockUser | null>(null);
  const [appConnected, setAppConnected] = useState(false);
  const [lobbies, setLobbies] = useState<Lobby[]>(seedLobbies);
  const [hereId, setHereId] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [joiningStep, setJoiningStep] = useState(0);
  const [joinTarget, setJoinTarget] = useState<JoinTarget | null>(null);
  const [knockTarget, setKnockTarget] = useState<Lobby | null>(null);
  const [knocks, setKnocks] = useState<ReadonlyMap<string, KnockStatus>>(() => new Map());
  const [hostDialog, setHostDialog] = useState<{ open: boolean; modeSlug?: string }>({ open: false });
  const [notify, setNotify] = useState<Set<string>>(() => new Set());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [ready, setReady] = useState(false);
  const [declinedInvites, setDeclined] = useState<ReadonlySet<string>>(() => new Set());
  const navigate = useNavigate();
  const toastId = useRef(0);
  const hereRef = useRef(hereId);
  hereRef.current = hereId;
  const lobbiesRef = useRef(lobbies);
  lobbiesRef.current = lobbies;
  const [clock, setClock] = useState(() => Date.now());
  const [confirmedAt, setConfirmedAt] = useState<ReadonlyMap<string, number>>(() => new Map());
  const [countdownEndsAt, setCountdownEndsAt] = useState<number | null>(null);
  const [handoff, setHandoff] = useState<{ id: string; step: number } | null>(null);
  const handoffTimers = useRef<number[]>([]);
  // Trocou de sala (ou saiu): o "pronto", as confirmações e o handoff não vão junto.
  useEffect(() => {
    setReady(false);
    setConfirmedAt(new Map());
    handoffTimers.current.forEach((id) => window.clearTimeout(id));
    handoffTimers.current = [];
    setHandoff(null);
  }, [hereId]);
  const joiningRef = useRef(joiningId);
  joiningRef.current = joiningId;

  const dismissToast = useCallback((id: number) => {
    setToasts((list) => list.filter((x) => x.id !== id));
  }, []);

  const pushToast = useCallback(
    (message: string) => {
      const id = ++toastId.current;
      setToasts((list) => [...list.slice(-2), { id, message }]);
      window.setTimeout(() => dismissToast(id), 5200);
    },
    [dismissToast],
  );

  // Ao vivo simulado: pausa com a aba oculta para não gastar bateria à toa.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.hidden) return;
      setLobbies((list) => liveTick(list, hereRef.current, Date.now(), joiningRef.current));
      setClock(Date.now());
    }, LIVE_TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  const signIn = useCallback(() => {
    setUser(MOCK_USER);
    pushToast(t.account.signedInToast(t.live.greeting[dayPeriod()], MOCK_USER.name));
  }, [pushToast]);

  const signOut = useCallback(() => {
    setUser(null);
    pushToast(t.account.signedOutToast);
  }, [pushToast]);

  /** Tira você do lobby atual: fecha o seu, ou libera a sua vaga no dos outros. */
  const vacate = useCallback(
    (silent = false) => {
      const cur = hereRef.current;
      if (!cur) return;
      const l = lobbiesRef.current.find((x) => x.id === cur);
      if (l?.mine) {
        setLobbies((list) => list.filter((x) => x.id !== cur));
        if (!silent) pushToast(t.lobbies.closedToast(l.name));
      } else if (l) {
        setLobbies((list) =>
          list.map((x) =>
            x.id === cur
              ? {
                  ...x,
                  players: Math.max(0, x.players - 1),
                  status: x.status === 'cheio' ? 'aberto' : x.status,
                  joins: x.joins.filter((j) => !j.you),
                  fullSince: undefined,
                }
              : x,
          ),
        );
        if (!silent) pushToast(t.lobbies.leftToast(l.name));
      }
      setHereId(null);
    },
    [pushToast],
  );

  const startJoin = useCallback(
    (target: JoinTarget) => {
      if (target.kind === 'bots') {
        pushToast(t.lobbies.botsToast);
        return;
      }
      const id = target.lobby.id;
      vacate(true);
      setJoiningId(id);
      setJoiningStep(0);
      navigate(`/sala/${encodeURIComponent(id)}`);
      pushToast(t.join.joiningToast(target.lobby.name));
      // Etapas simuladas; no produto, cada troca vem de um evento do app.
      window.setTimeout(() => setJoiningStep(1), 1300);
      window.setTimeout(() => setJoiningStep(2), 2600);
      window.setTimeout(() => {
        setJoiningId((cur) => (cur === id ? null : cur));
        const live = lobbiesRef.current.find((l) => l.id === id);
        if (!live || live.players >= live.slots) {
          pushToast(t.join.errorFull);
          return;
        }
        const now = Date.now();
        setLobbies((list) =>
          list.map((l) => {
            if (l.id !== id) return l;
            const players = l.players + 1;
            const status = l.status === 'em-partida' ? l.status : players >= l.slots ? 'cheio' : 'aberto';
            return { ...l, players, status, joins: [...l.joins, { name: user?.name ?? t.lobbies.you, at: now, you: true }].slice(-6) };
          }),
        );
        setHereId(id);
        pushToast(t.lobbies.joinedToast(live.name));
      }, 4000);
    },
    [pushToast, vacate, user, navigate],
  );

  const lobbyCtx = useMemo<LobbyContext>(() => ({ hereId, joiningId, knocks, notify }), [hereId, joiningId, knocks, notify]);

  const requestJoin = useCallback(
    (target: JoinTarget) => {
      if (target.kind === 'lobby') {
        const live = lobbiesRef.current.find((l) => l.id === target.lobby.id) ?? target.lobby;
        if (!lobbyState(live, lobbyCtx).canJoin) return;
        if (!appConnected || (hereRef.current && hereRef.current !== live.id)) {
          setJoinTarget({ kind: 'lobby', lobby: live });
          return;
        }
        startJoin({ kind: 'lobby', lobby: live });
        return;
      }
      if (appConnected) startJoin(target);
      else setJoinTarget(target);
    },
    [appConnected, startJoin, lobbyCtx],
  );

  const confirmJoin = useCallback(() => {
    setAppConnected(true);
    const target = joinTarget;
    setJoinTarget(null);
    if (target) startJoin(target);
  }, [joinTarget, startJoin]);

  const createLobby = useCallback(
    (d: HostDraft) => {
      vacate(true);
      const now = Date.now();
      const name = user?.name ?? MOCK_USER.name;
      const mode = getMode(d.modeSlug);
      const lobby: Lobby = {
        id: `meu-${now}`,
        name: d.name,
        modeSlug: d.modeSlug,
        host: name,
        hostIsFriend: false,
        region: d.region,
        ping: d.region === 'BR' ? 11 : d.region === 'NA' ? 124 : 196,
        players: 1,
        slots: d.slots,
        friends: 0,
        status: 'aberto',
        joinInProgress: true,
        locked: d.locked,
        minutesAgo: 0,
        openedAt: now,
        minPlayers: Math.min(d.slots, Math.max(1, d.minPlayers || mode?.minPlayers || 1)),
        joins: [{ name, at: now, you: true }],
        mine: true,
      };
      setLobbies((list) => [lobby, ...list]);
      setHereId(lobby.id);
      setHostDialog({ open: false });
      navigate(`/sala/${encodeURIComponent(lobby.id)}`);
      pushToast(t.host.createdToast(d.name));
    },
    [pushToast, user, vacate, navigate],
  );

  const closeLobby = useCallback(
    (id: string) => {
      const l = lobbiesRef.current.find((x) => x.id === id);
      if (!l?.mine) return;
      setLobbies((list) => list.filter((x) => x.id !== id));
      if (hereRef.current === id) setHereId(null);
      pushToast(t.lobbies.closedToast(l.name));
    },
    [pushToast],
  );

  const leaveLobby = useCallback(() => vacate(false), [vacate]);

  const inviteTo = useCallback(
    (lobby: Lobby) => {
      const link = `${window.location.origin}/sala/${encodeURIComponent(lobby.id)}`;
      navigator.clipboard?.writeText(link).catch(() => {
        /* sem permissão de área de transferência: o aviso continua valendo para o protótipo */
      });
      pushToast(t.lobbies.inviteCopied(lobby.name));
    },
    [pushToast],
  );

  /**
   * Handoff simulado: depois que a partida começa, o app baixa o modo, abre o Deadlock e entra no lobby.
   * No produto, cada troca de etapa vem de um evento do app.
   */
  const startHandoff = useCallback((id: string) => {
    handoffTimers.current.forEach((x) => window.clearTimeout(x));
    setHandoff({ id, step: 0 });
    let at = 0;
    handoffTimers.current = HANDOFF_MS.map((ms, i) => {
      at += ms;
      return window.setTimeout(() => setHandoff((h) => (h?.id === id ? { id, step: i + 1 } : h)), at);
    });
  }, []);

  /** Começa a partida do lobby `id` (anfitrião) e avisa. Na sala em que você está, abre o handoff. */
  const begin = useCallback(
    (id: string, toast: (l: Lobby) => string) => {
      const l = lobbiesRef.current.find((x) => x.id === id);
      if (!l || l.status === 'em-partida' || l.players < l.minPlayers) return;
      const now = Date.now();
      setLobbies((list) => list.map((x) => (x.id === id ? { ...x, status: 'em-partida', round: { current: 1, startedAt: now }, fullSince: undefined } : x)));
      if (hereRef.current === id) startHandoff(id);
      pushToast(toast(l));
    },
    [pushToast, startHandoff],
  );

  const startMatch = useCallback(() => {
    const id = hereRef.current;
    const l = lobbiesRef.current.find((x) => x.id === id);
    if (l?.mine) begin(l.id, (x) => t.room.startedToast(x.name));
  }, [begin]);

  const toggleReady = useCallback(() => setReady((v) => !v), []);

  // As vagas da sala em que você está: a mesma conta da barra PRONTO decide a contagem.
  const here = lobbies.find((l) => l.id === hereId);
  const seatsHere = useMemo(
    () =>
      here
        ? roster(here, {
            you: user?.name ?? t.lobbies.you,
            youHere: true,
            youReady: ready,
            signedIn: !!user,
            now: clock,
            friends: user ? friendsIn(friendsOnline(lobbies), here.id) : [],
            confirmed: confirmedAt,
          })
        : [],
    [here, user, ready, clock, lobbies, confirmedAt],
  );
  const seatsRef = useRef(seatsHere);
  seatsRef.current = seatsHere;
  const readyHere = readyCount(seatsHere);
  const playingHere = here?.status === 'em-partida';

  // Com você pronto (ou sendo o anfitrião), quem faltava vai confirmando, um por vez.
  const confirming = !!here && (ready || !!here.mine) && !playingHere;
  useEffect(() => {
    if (!confirming) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      const name = nextToConfirm(seatsRef.current);
      if (name) setConfirmedAt((m) => new Map(m).set(name, Date.now()));
    }, CONFIRM_MS);
    return () => window.clearInterval(id);
  }, [confirming]);

  // Na sala dos outros, o anfitrião simulado começa quando você está pronto e já há o mínimo de confirmados:
  // uma contagem de HOST_START_MS, cancelada se o pronto cair abaixo do mínimo.
  const hostCanStart = !!here && !here.mine && ready && !playingHere && here.players >= here.minPlayers && readyHere >= here.minPlayers;
  useEffect(() => {
    if (!hostCanStart || !hereId) {
      setCountdownEndsAt(null);
      return;
    }
    setCountdownEndsAt(Date.now() + HOST_START_MS);
    const id = window.setTimeout(() => begin(hereId, (x) => t.room.hostStartedToast(x.host)), HOST_START_MS);
    return () => window.clearTimeout(id);
  }, [hostCanStart, hereId, begin]);
  const handoffStep = handoff && handoff.id === hereId ? handoff.step : null;

  const sendKnock = useCallback(
    (_message: string) => {
      const l = knockTarget;
      if (!l) return;
      setKnockTarget(null);
      setKnocks((m) => new Map(m).set(l.id, 'pending'));
      pushToast(t.knock.sentToast(l.host));
      // Protótipo: o anfitrião simulado sempre abre a porta depois de alguns segundos.
      window.setTimeout(() => {
        setKnocks((m) => (m.get(l.id) === 'pending' ? new Map(m).set(l.id, 'accepted') : m));
        pushToast(t.knock.acceptedToast(l.host, l.name));
      }, KNOCK_ANSWER_MS);
    },
    [knockTarget, pushToast],
  );

  const toggleNotify = useCallback(
    (key: string, label: string) => {
      const wasOn = notify.has(key);
      setNotify((prev) => {
        const next = new Set(prev);
        if (wasOn) next.delete(key);
        else next.add(key);
        return next;
      });
      if (!wasOn) pushToast(label);
    },
    [notify, pushToast],
  );

  const declineInvite = useCallback((lobbyId: string) => setDeclined((s) => new Set(s).add(lobbyId)), []);

  const value = useMemo<SessionValue>(
    () => ({
      user,
      signIn,
      signOut,
      appConnected,
      setAppConnected,
      lobbies,
      hereId,
      lobbyCtx,
      createLobby,
      closeLobby,
      leaveLobby,
      inviteTo,
      ready,
      toggleReady,
      startMatch,
      seatsHere,
      confirmedAt,
      countdownEndsAt,
      handoffStep,
      joiningId,
      joiningStep,
      requestJoin,
      joinTarget,
      closeJoin: () => setJoinTarget(null),
      confirmJoin,
      confirmJoinWithApp: confirmJoin,
      knockTarget,
      openKnock: (lobby: Lobby) => setKnockTarget(lobby),
      closeKnock: () => setKnockTarget(null),
      sendKnock,
      knocks,
      hostDialog,
      openHost: (modeSlug?: string) => setHostDialog({ open: true, modeSlug }),
      closeHost: () => setHostDialog({ open: false }),
      notify,
      toggleNotify,
      declinedInvites,
      declineInvite,
      toasts,
      pushToast,
      dismissToast,
    }),
    [
      user,
      signIn,
      signOut,
      appConnected,
      lobbies,
      hereId,
      lobbyCtx,
      createLobby,
      closeLobby,
      leaveLobby,
      inviteTo,
      ready,
      toggleReady,
      startMatch,
      seatsHere,
      confirmedAt,
      countdownEndsAt,
      handoffStep,
      joiningId,
      joiningStep,
      requestJoin,
      joinTarget,
      confirmJoin,
      knockTarget,
      sendKnock,
      knocks,
      hostDialog,
      notify,
      toggleNotify,
      declinedInvites,
      declineInvite,
      toasts,
      pushToast,
      dismissToast,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession precisa estar dentro de <SessionProvider>');
  return ctx;
}
