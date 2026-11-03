import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { Lobby } from '../data/lobbies';
import { wsUrl } from '../data/source';
import { t } from '../i18n';
import { live as L } from '../i18n/live';
import { confirmations, EMPTY_LIVE, pickInvite, reduce, toLobby, toPresence, type Intent, type LiveState, type ServerMsg } from '../lib/api';
import type { FriendPresence } from '../lib/friends';
import { lobbyState, type KnockStatus, type LobbyContext } from '../lib/lobbies';
import { ApiError, devLoginUrl, fetchMe, herePath, LiveClient, logout, steamLoginUrl, type Ack } from '../lib/liveClient';
import { roster, type Seat } from '../lib/room';
import { SessionContext, type ConnectionState, type HostDraft, type JoinTarget, type MockUser, type SessionValue, type Toast } from './sessionContext';

/**
 * A sessão ao vivo (com `VITE_API_URL`): o mesmo contrato da simulada, mas o estado vem do servidor.
 * O site só manda pedidos (entrar, pronto, começar, chamar…) e mostra o que o servidor decide.
 * A conexão com o app desktop continua simulada aqui: o lançamento do jogo é do EngineAdapter, não do servidor.
 */
export function LiveSessionProvider({ api, children }: { api: string; children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState<LiveState>(EMPTY_LIVE);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [devLogin, setDevLogin] = useState(false);
  const [appConnected, setAppConnected] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [joinTarget, setJoinTarget] = useState<JoinTarget | null>(null);
  const [knockTarget, setKnockTarget] = useState<Lobby | null>(null);
  const [hostDialog, setHostDialog] = useState<{ open: boolean; modeSlug?: string }>({ open: false });
  const [notify, setNotify] = useState<Set<string>>(() => new Set());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [declinedInvites, setDeclined] = useState<ReadonlySet<string>>(() => new Set());
  const client = useRef<LiveClient | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const toastId = useRef(0);

  const dismissToast = useCallback((id: number) => setToasts((list) => list.filter((x) => x.id !== id)), []);
  const pushToast = useCallback(
    (message: string) => {
      const id = ++toastId.current;
      setToasts((list) => [...list.slice(-2), { id, message }]);
      window.setTimeout(() => dismissToast(id), 5200);
    },
    [dismissToast],
  );

  /** O que merece aviso, além de mudar o estado. */
  const onEvent = useCallback(
    (m: ServerMsg) => {
      switch (m.type) {
        case 'invite':
          pushToast(L.inviteToast(m.invite.fromName, m.invite.lobbyName));
          break;
        case 'kicked':
          pushToast(L.kickedToast(m.name));
          break;
        case 'lobby_closed':
          pushToast(L.closedByHost(m.name));
          break;
        case 'knock':
          if (m.status === 'accepted') pushToast(t.knock.acceptedToast(stateRef.current.lobbies[m.lobbyId]?.hostName ?? '', m.lobbyName));
          else if (m.status === 'declined') pushToast(L.knockDeclined(m.lobbyName));
          break;
        case 'error':
          pushToast(m.message);
          break;
      }
    },
    [pushToast],
  );

  useEffect(() => {
    const c = new LiveClient({
      url: wsUrl(api),
      onMessage: (m) => {
        setState((s) => reduce(s, m, Date.now()));
        onEvent(m);
      },
      onStatus: setConnection,
    });
    client.current = c;
    c.start();
    return () => {
      c.stop();
      client.current = null;
    };
  }, [api, onEvent]);

  // O servidor diz se aceita o login de teste; e a volta do login com falha vira um aviso.
  useEffect(() => {
    fetchMe(api)
      .then((me) => setDevLogin(me.devLogin))
      .catch(() => setDevLogin(false));
  }, [api]);
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (q.get('login') !== 'falhou') return;
    pushToast(L.loginFailed);
    q.delete('login');
    navigate({ pathname: location.pathname, search: q.toString() ? `?${q}` : '', hash: location.hash }, { replace: true });
  }, [location, navigate, pushToast]);

  const request = useCallback(
    async (intent: Intent, quiet = false): Promise<Ack | null> => {
      try {
        if (!client.current) throw new ApiError('offline', L.offlineError);
        return await client.current.request(intent);
      } catch (e) {
        if (!quiet) pushToast(e instanceof ApiError ? e.message : L.offlineError);
        return null;
      }
    },
    [pushToast],
  );

  /* ───────── Derivados ───────── */

  const meId = state.me?.id ?? null;
  const friendIds = useMemo(() => new Set(state.friends.map((f) => f.id)), [state.friends]);
  const lobbies = useMemo(() => {
    const now = Date.now();
    return Object.values(state.lobbies).map((v) => toLobby(v, { meId, friendIds, now }));
  }, [state.lobbies, meId, friendIds]);
  const lobbiesRef = useRef(lobbies);
  lobbiesRef.current = lobbies;
  const presence = useMemo<FriendPresence[]>(() => toPresence(state.friends), [state.friends]);
  const user = useMemo<MockUser | null>(
    () => (state.me ? { id: state.me.id, name: state.me.name, dev: state.me.dev, friendsOnline: state.friends.length } : null),
    [state.me, state.friends.length],
  );

  const hereId = state.hereId;
  const hereView = hereId ? state.lobbies[hereId] : undefined;
  const here = hereId ? lobbies.find((l) => l.id === hereId) : undefined;
  const seatsHere = useMemo<Seat[]>(
    () => (here ? roster(here, { you: user?.name ?? t.lobbies.you, youHere: true, youReady: false, signedIn: !!user, now: 0 }) : []),
    [here, user],
  );
  const ready = !!hereView?.seats?.find((s) => s.userId === meId)?.ready;
  const countdownEndsAt = hereView?.phase === 'countdown' ? (state.countdownEnds[hereView.id] ?? null) : null;
  const handoffStep = hereView && (hereView.phase === 'handoff' || hereView.phase === 'playing') ? (hereView.handoffStep ?? 0) : null;
  const confirmedAt = useMemo(() => confirmations(hereView, meId), [hereView, meId]);
  const knocksHere = useMemo(() => (hereView && hereView.hostId === meId ? (hereView.knocks ?? []) : []), [hereView, meId]);

  // Convite aceito abre a porta: para a interface, é como uma batida aceita.
  const knocks = useMemo(() => {
    const m = new Map<string, KnockStatus>(Object.entries(state.knocks));
    for (const inv of state.invites) m.set(inv.lobbyId, 'accepted');
    return m as ReadonlyMap<string, KnockStatus>;
  }, [state.knocks, state.invites]);
  const lobbyCtx = useMemo<LobbyContext>(() => ({ hereId, joiningId, knocks, notify }), [hereId, joiningId, knocks, notify]);
  const incoming = useMemo(() => (user ? pickInvite(state, lobbies, declinedInvites) : null), [user, state, lobbies, declinedInvites]);

  // A partida começou na sua sala: o mesmo aviso da simulação.
  const phaseRef = useRef<{ id: string | null; phase: string | null }>({ id: null, phase: null });
  useEffect(() => {
    const prev = phaseRef.current;
    const phase = hereView?.phase ?? null;
    phaseRef.current = { id: hereId, phase };
    if (!hereView || prev.id !== hereId || prev.phase !== 'countdown' || phase !== 'handoff') return;
    pushToast(hereView.hostId === meId ? t.room.startedToast(hereView.name) : t.room.hostStartedToast(hereView.hostName));
  }, [hereView, hereId, meId, pushToast]);

  /* ───────── Conta ───────── */

  const signIn = useCallback(() => window.location.assign(steamLoginUrl(api, herePath())), [api]);
  const signInDev = useCallback(() => window.location.assign(devLoginUrl(api, herePath())), [api]);
  const signOut = useCallback(() => {
    logout(api)
      .catch(() => {})
      .finally(() => {
        setState((s) => ({ ...s, me: null, friends: [], invites: [], knocks: {}, hereId: null }));
        client.current?.reconnect();
        pushToast(t.account.signedOutToast);
      });
  }, [api, pushToast]);

  /* ───────── Lobbies ───────── */

  const startJoin = useCallback(
    async (target: JoinTarget) => {
      if (target.kind === 'bots') {
        pushToast(t.lobbies.botsToast);
        return;
      }
      if (!stateRef.current.me) {
        pushToast(L.signInToJoin);
        return;
      }
      const { id, name } = target.lobby;
      setJoiningId(id);
      navigate(`/sala/${encodeURIComponent(id)}`);
      const ack = await request({ type: 'join', lobbyId: id });
      setJoiningId((cur) => (cur === id ? null : cur));
      if (ack) pushToast(t.lobbies.joinedToast(name));
    },
    [navigate, pushToast, request],
  );

  const requestJoin = useCallback(
    (target: JoinTarget) => {
      if (target.kind === 'lobby') {
        const cur = lobbiesRef.current.find((l) => l.id === target.lobby.id) ?? target.lobby;
        if (!lobbyState(cur, lobbyCtx).canJoin) return;
        if (!appConnected || (hereId && hereId !== cur.id)) {
          setJoinTarget({ kind: 'lobby', lobby: cur });
          return;
        }
        void startJoin({ kind: 'lobby', lobby: cur });
        return;
      }
      if (appConnected) void startJoin(target);
      else setJoinTarget(target);
    },
    [appConnected, hereId, lobbyCtx, startJoin],
  );

  const confirmJoin = useCallback(() => {
    setAppConnected(true);
    const target = joinTarget;
    setJoinTarget(null);
    if (target) void startJoin(target);
  }, [joinTarget, startJoin]);

  const createLobby = useCallback(
    async (d: HostDraft) => {
      const ack = await request({
        type: 'create',
        lobby: { name: d.name, modeSlug: d.modeSlug, region: d.region, slots: d.slots, minPlayers: d.minPlayers, locked: d.locked },
      });
      if (!ack?.lobbyId) return;
      setHostDialog({ open: false });
      navigate(`/sala/${encodeURIComponent(ack.lobbyId)}`);
      pushToast(t.host.createdToast(d.name));
    },
    [navigate, pushToast, request],
  );

  const closeLobby = useCallback(
    async (id: string) => {
      const l = lobbiesRef.current.find((x) => x.id === id);
      if (!l?.mine || stateRef.current.hereId !== id) return;
      if (await request({ type: 'close' })) pushToast(t.lobbies.closedToast(l.name));
    },
    [pushToast, request],
  );

  const leaveLobby = useCallback(async () => {
    const l = lobbiesRef.current.find((x) => x.id === stateRef.current.hereId);
    if (!l) return;
    if (await request({ type: 'leave' })) pushToast(t.lobbies.leftToast(l.name));
  }, [pushToast, request]);

  const inviteTo = useCallback(
    (lobby: Lobby) => {
      const link = `${window.location.origin}/sala/${encodeURIComponent(lobby.id)}`;
      navigator.clipboard?.writeText(link).catch(() => {});
      pushToast(t.lobbies.inviteCopied(lobby.name));
    },
    [pushToast],
  );

  const toggleReady = useCallback(() => void request({ type: 'ready', ready: !ready }), [request, ready]);
  const startMatch = useCallback(() => void request({ type: 'start' }), [request]);
  const cancelStart = useCallback(() => void request({ type: 'cancel_start' }), [request]);
  const kick = useCallback(
    async (seat: Seat) => {
      if (!seat.id || !seat.name) return;
      if (await request({ type: 'kick', userId: seat.id })) pushToast(L.kickedOther(seat.name));
    },
    [pushToast, request],
  );

  const sendKnock = useCallback(
    async (message: string) => {
      const l = knockTarget;
      if (!l) return;
      setKnockTarget(null);
      if (await request({ type: 'knock', lobbyId: l.id, message })) pushToast(t.knock.sentToast(l.host));
    },
    [knockTarget, pushToast, request],
  );
  const answerKnock = useCallback((userId: string, accept: boolean) => void request({ type: 'answer_knock', userId, accept }), [request]);

  const callFriend = useCallback(
    async (f: FriendPresence) => {
      if (!f.id) return false;
      if (!stateRef.current.hereId) {
        pushToast(L.callNeedsLobby);
        return false;
      }
      const ack = await request({ type: 'invite', userId: f.id });
      if (ack) pushToast(L.calledToast(f.name));
      return !!ack;
    },
    [pushToast, request],
  );

  const declineInvite = useCallback(
    (lobbyId: string) => {
      setDeclined((s) => new Set(s).add(lobbyId));
      void request({ type: 'decline_invite', lobbyId }, true);
    },
    [request],
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
      live: true,
      connection,
      synced: state.synced,
      devLogin,
      signInDev,
      user,
      signIn,
      signOut,
      appConnected,
      setAppConnected,
      lobbies: state.synced ? lobbies : [],
      hereId,
      lobbyCtx,
      createLobby: (d) => void createLobby(d),
      closeLobby: (id) => void closeLobby(id),
      leaveLobby: () => void leaveLobby(),
      inviteTo,
      ready,
      toggleReady,
      startMatch,
      cancelStart,
      kick: (s) => void kick(s),
      seatsHere,
      confirmedAt,
      countdownEndsAt,
      handoffStep,
      joiningId,
      joiningStep: 0,
      requestJoin,
      joinTarget,
      closeJoin: () => setJoinTarget(null),
      confirmJoin,
      confirmJoinWithApp: confirmJoin,
      knockTarget,
      openKnock: (lobby) => setKnockTarget(lobby),
      closeKnock: () => setKnockTarget(null),
      sendKnock: (m) => void sendKnock(m),
      knocks,
      knocksHere,
      answerKnock,
      hostDialog,
      openHost: (modeSlug) => setHostDialog({ open: true, modeSlug }),
      closeHost: () => setHostDialog({ open: false }),
      notify,
      toggleNotify,
      declinedInvites,
      declineInvite,
      presence: user ? presence : [],
      incoming,
      callFriend,
      toasts,
      pushToast,
      dismissToast,
    }),
    [
      connection,
      devLogin,
      signInDev,
      user,
      signIn,
      signOut,
      appConnected,
      state.synced,
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
      cancelStart,
      kick,
      seatsHere,
      confirmedAt,
      countdownEndsAt,
      handoffStep,
      joiningId,
      requestJoin,
      joinTarget,
      confirmJoin,
      knockTarget,
      sendKnock,
      knocks,
      knocksHere,
      answerKnock,
      hostDialog,
      notify,
      toggleNotify,
      declinedInvites,
      declineInvite,
      presence,
      incoming,
      callFriend,
      toasts,
      pushToast,
      dismissToast,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
