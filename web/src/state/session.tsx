import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { lobbies as seedLobbies, type Lobby } from '../data/lobbies';
import type { Region } from '../data/modes';
import { t } from '../i18n';
import { dayPeriod } from '../lib/time';

/**
 * Estado simulado da sessão. Nada aqui fala com servidor:
 * login, conexão com o app e criação de lobby são só estado local.
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
  locked: boolean;
}

type JoinTarget = { kind: 'lobby'; lobby: Lobby } | { kind: 'bots' };

interface SessionValue {
  user: MockUser | null;
  signIn: () => void;
  signOut: () => void;
  appConnected: boolean;
  setAppConnected: (v: boolean) => void;
  lobbies: Lobby[];
  createLobby: (draft: HostDraft) => void;
  joiningId: string | null;
  /** Etapa simulada da entrada (índice em t.lobbies.joinSteps). */
  joiningStep: number;
  /** Pede para entrar. Abre o diálogo do app se ele não estiver conectado. */
  requestJoin: (target: JoinTarget) => void;
  joinTarget: JoinTarget | null;
  closeJoin: () => void;
  confirmJoinWithApp: () => void;
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

/**
 * Um tique do ao vivo simulado. Na maioria das vezes alguém entra num lobby com vaga
 * (uma janela acende); às vezes alguém sai. Lobbies em partida e o seu não mudam.
 */
function liveTick(list: Lobby[]): Lobby[] {
  const pool = list.filter((l) => !l.mine && l.status !== 'em-partida');
  if (pool.length === 0) return list;
  const taken = pool.reduce((n, l) => n + l.players, 0);
  const total = pool.reduce((n, l) => n + l.slots, 0);
  // Quanto mais cheia a cidade, mais gente sai: mantém o movimento em volta de ~70%.
  const leaveChance = taken / total > 0.74 ? 0.55 : 0.2;
  const leaving = Math.random() < leaveChance;
  const candidates = pool.filter((l) => (leaving ? l.players > l.friends + 1 : l.players < l.slots));
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  if (!pick) return list;
  return list.map((l) => {
    if (l.id !== pick.id) return l;
    const players = l.players + (leaving ? -1 : 1);
    const status = players >= l.slots ? 'cheio' : 'aberto';
    return { ...l, players, status, minutesAgo: l.minutesAgo };
  });
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MockUser | null>(null);
  const [appConnected, setAppConnected] = useState(false);
  const [created, setCreated] = useState<Lobby[]>([]);
  const [seeded, setSeeded] = useState<Lobby[]>(seedLobbies);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [joiningStep, setJoiningStep] = useState(0);
  const [joinTarget, setJoinTarget] = useState<JoinTarget | null>(null);
  const [hostDialog, setHostDialog] = useState<{ open: boolean; modeSlug?: string }>({ open: false });
  const [notify, setNotify] = useState<Set<string>>(() => new Set());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

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
      setSeeded(liveTick);
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

  const startJoin = useCallback(
    (target: JoinTarget) => {
      if (target.kind === 'bots') {
        pushToast(t.lobbies.botsToast);
        return;
      }
      const id = target.lobby.id;
      setJoiningId(id);
      setJoiningStep(0);
      pushToast(t.join.joiningToast(target.lobby.name));
      // Etapas simuladas; no produto, cada troca vem de um evento do app.
      window.setTimeout(() => setJoiningStep(1), 1300);
      window.setTimeout(() => setJoiningStep(2), 2600);
      window.setTimeout(() => setJoiningId((cur) => (cur === id ? null : cur)), 4000);
    },
    [pushToast],
  );

  const requestJoin = useCallback(
    (target: JoinTarget) => {
      if (appConnected) startJoin(target);
      else setJoinTarget(target);
    },
    [appConnected, startJoin],
  );

  const confirmJoinWithApp = useCallback(() => {
    setAppConnected(true);
    const target = joinTarget;
    setJoinTarget(null);
    if (target) startJoin(target);
  }, [joinTarget, startJoin]);

  const createLobby = useCallback(
    (d: HostDraft) => {
      const lobby: Lobby = {
        id: `meu-${Date.now()}`,
        name: d.name,
        modeSlug: d.modeSlug,
        host: user?.name ?? MOCK_USER.name,
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
        mine: true,
      };
      setCreated((list) => [lobby, ...list]);
      setHostDialog({ open: false });
      pushToast(t.host.createdToast(d.name));
    },
    [pushToast, user],
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
      lobbies: [...created, ...seeded],
      createLobby,
      joiningId,
      joiningStep,
      requestJoin,
      joinTarget,
      closeJoin: () => setJoinTarget(null),
      confirmJoinWithApp,
      hostDialog,
      openHost: (modeSlug?: string) => setHostDialog({ open: true, modeSlug }),
      closeHost: () => setHostDialog({ open: false }),
      notify,
      toggleNotify,
      toasts,
      pushToast,
      dismissToast,
    }),
    [user, signIn, signOut, appConnected, created, seeded, createLobby, joiningId, joiningStep, requestJoin, joinTarget, confirmJoinWithApp, hostDialog, notify, toggleNotify, toasts, pushToast, dismissToast],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession precisa estar dentro de <SessionProvider>');
  return ctx;
}
