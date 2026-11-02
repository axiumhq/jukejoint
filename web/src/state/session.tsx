import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { lobbies as seedLobbies, passersby, type Lobby } from '../data/lobbies';
import { getMode, type Region } from '../data/modes';
import { t } from '../i18n';
import { lobbyState, type KnockStatus, type LobbyContext } from '../lib/lobbies';
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
  const toastId = useRef(0);
  const hereRef = useRef(hereId);
  hereRef.current = hereId;
  const lobbiesRef = useRef(lobbies);
  lobbiesRef.current = lobbies;
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
              ? { ...x, players: Math.max(0, x.players - 1), status: x.status === 'cheio' ? 'aberto' : x.status, joins: x.joins.filter((j) => !j.you), fullSince: undefined }
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
    [pushToast, vacate, user],
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
      pushToast(t.host.createdToast(d.name));
    },
    [pushToast, user, vacate],
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
      const link = `${window.location.origin}/lobbies?convite=${encodeURIComponent(lobby.id)}`;
      navigator.clipboard?.writeText(link).catch(() => {
        /* sem permissão de área de transferência: o aviso continua valendo para o protótipo */
      });
      pushToast(t.lobbies.inviteCopied(lobby.name));
    },
    [pushToast],
  );

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
      toasts,
      pushToast,
      dismissToast,
    }),
    [user, signIn, signOut, appConnected, lobbies, hereId, lobbyCtx, createLobby, closeLobby, leaveLobby, inviteTo, joiningId, joiningStep, requestJoin, joinTarget, confirmJoin, knockTarget, sendKnock, knocks, hostDialog, notify, toggleNotify, toasts, pushToast, dismissToast],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession precisa estar dentro de <SessionProvider>');
  return ctx;
}
