import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { lobbies as seedLobbies, type Lobby } from '../data/lobbies';
import type { Region } from '../data/modes';
import { t } from '../i18n';

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

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MockUser | null>(null);
  const [appConnected, setAppConnected] = useState(false);
  const [created, setCreated] = useState<Lobby[]>([]);
  const [joiningId, setJoiningId] = useState<string | null>(null);
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

  const signIn = useCallback(() => {
    setUser(MOCK_USER);
    pushToast(t.account.signedInToast(MOCK_USER.name));
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
      setJoiningId(target.lobby.id);
      pushToast(t.join.joiningToast(target.lobby.name));
      window.setTimeout(() => setJoiningId((cur) => (cur === target.lobby.id ? null : cur)), 4000);
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
      lobbies: [...created, ...seedLobbies],
      createLobby,
      joiningId,
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
    [user, signIn, signOut, appConnected, created, createLobby, joiningId, requestJoin, joinTarget, confirmJoinWithApp, hostDialog, notify, toggleNotify, toasts, pushToast, dismissToast],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession precisa estar dentro de <SessionProvider>');
  return ctx;
}
