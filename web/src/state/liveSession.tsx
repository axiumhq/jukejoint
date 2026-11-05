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
import {
  clearPending,
  challengeFor,
  clearToken,
  DEV_NAMES,
  devToken,
  exchangeCode,
  hasPending,
  loadToken,
  newVerifier,
  PENDING_TTL_MS,
  saveToken,
  startPending,
  takePending,
} from '../lib/appAuth';
import { desktop, IN_DESKTOP, onAuthCode, toEngineError } from '../lib/desktop';
import { roster, type Seat } from '../lib/room';
import { useEngineHandoff } from './engineHandoff';
import { useDesktopApp } from './useDesktopApp';
import { SessionContext, type ConnectionState, type HostDraft, type JoinTarget, type MockUser, type SessionValue, type Toast } from './sessionContext';
import { inviteLink } from '../lib/invite';

/**
 * A sessão ao vivo (com `VITE_API_URL`): o mesmo contrato da simulada, mas o estado vem do servidor.
 * O site só manda pedidos (entrar, pronto, começar, chamar…) e mostra o que o servidor decide.
 * Dentro do app desktop, a partida é de verdade (state/engineHandoff.ts): o app hospeda ou entra e
 * as etapas vêm dele. Fora do app, a conexão com o app continua simulada (botão da /instalar).
 */
export function LiveSessionProvider({ api, children }: { api: string; children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState<LiveState>(EMPTY_LIVE);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [devLogin, setDevLogin] = useState(false);
  // Um login iniciado antes de a janela recarregar continua esperando a volta do navegador.
  const [authPending, setAuthPending] = useState(() => IN_DESKTOP && hasPending());
  const [simulatedApp, setSimulatedApp] = useState(false);
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
  // No app desktop o cookie da API não viaja: a sessão é um token Bearer (lib/appAuth.ts).
  const token = useRef<string | null>(IN_DESKTOP ? loadToken() : null);

  const dismissToast = useCallback((id: number) => setToasts((list) => list.filter((x) => x.id !== id)), []);
  const pushToast = useCallback(
    (message: string) => {
      const id = ++toastId.current;
      setToasts((list) => [...list.slice(-2), { id, message }]);
      window.setTimeout(() => dismissToast(id), 5200);
    },
    [dismissToast],
  );

  // Dentro do app desktop, "app aberto" vem dele; fora, é o botão de simulação da /instalar.
  const app = useDesktopApp(pushToast);
  const appConnected = app.desktop || simulatedApp;
  const setAppConnected = useCallback((v: boolean) => {
    if (!IN_DESKTOP) setSimulatedApp(v);
  }, []);
  /** Dentro do app com a checagem ainda não pronta: o diálogo de entrar mostra o que falta. */
  const appNeedsLook = app.desktop && app.check?.status !== 'ready';

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
      protocols: () => (token.current ? ['jukejoint', `auth.${token.current}`] : undefined),
    });
    client.current = c;
    c.start();
    return () => {
      c.stop();
      client.current = null;
    };
  }, [api, onEvent]);

  // O servidor diz se aceita o login de teste; e a volta do login com falha vira um aviso.
  const refreshMe = useCallback(
    () =>
      fetchMe(api, token.current ?? undefined)
        .then((me) => {
          setDevLogin(me.devLogin);
          // Token vencido ou revogado: o servidor responde sem usuário, e guardá-lo só atrapalharia.
          if (token.current && !me.user) {
            token.current = null;
            clearToken();
          }
          return me;
        })
        .catch(() => {
          setDevLogin(false);
          return null;
        }),
    [api],
  );
  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);
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
  // A partida de verdade (dentro do app): hospedar, entrar e as etapas que o app anuncia.
  const engine = useEngineHandoff({ view: hereView, meId, request, pushToast });
  const roomStep = hereView && (hereView.phase === 'handoff' || hereView.phase === 'playing') ? (hereView.handoffStep ?? 0) : null;
  // Dentro do app, a sua etapa é a do seu app; fora, a da sala (que o servidor anda por tempo ou segue o app de quem hospeda).
  const handoffStep = roomStep !== null && engine.enabled ? engine.step : roomStep;
  const { stop: engineStop, retry: retryEngine, endMatch: engineEndMatch } = engine;
  const endMatch = useCallback(() => {
    if (IN_DESKTOP) engineEndMatch();
    else void request({ type: 'end_match' });
  }, [engineEndMatch, request]);
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

  /** Guarda o token do app, confere quem é e reabre o WebSocket já autenticado. */
  const finishAppLogin = useCallback(
    async (session: { token: string }) => {
      saveToken(session.token);
      token.current = session.token;
      const me = await refreshMe();
      client.current?.reconnect();
      if (me?.user) pushToast(L.signedInToast(me.user.name));
    },
    [pushToast, refreshMe],
  );

  const signIn = useCallback(() => {
    if (!IN_DESKTOP) {
      window.location.assign(steamLoginUrl(api, herePath()));
      return;
    }
    const verifier = newVerifier();
    startPending(verifier);
    setAuthPending(true);
    challengeFor(verifier)
      .then((challenge) => desktop.authOpenBrowser(challenge))
      .catch((e: unknown) => {
        clearPending();
        setAuthPending(false);
        pushToast(toEngineError(e).message || L.appLoginOpenFailed);
      });
  }, [api, pushToast]);
  const cancelSignIn = useCallback(() => {
    clearPending();
    setAuthPending(false);
  }, []);
  const signInDev = useCallback(
    (name?: string) => {
      if (!IN_DESKTOP) {
        window.location.assign(devLoginUrl(api, herePath()));
        return;
      }
      if (!name) return;
      devToken(api, name)
        .then(finishAppLogin)
        .catch((e: unknown) => pushToast(e instanceof ApiError ? e.message : L.appLoginFailed));
    },
    [api, finishAppLogin, pushToast],
  );

  // A volta do navegador: o app avisa com o código; sem login esperando, ele é ignorado.
  useEffect(() => {
    if (!IN_DESKTOP) return;
    return onAuthCode((code) => {
      const verifier = takePending();
      if (!verifier) return;
      setAuthPending(false);
      exchangeCode(api, code, verifier)
        .then(finishAppLogin)
        .catch((e: unknown) => pushToast(e instanceof ApiError ? e.message : L.appLoginFailed));
    });
  }, [api, finishAppLogin, pushToast]);

  // O login que o navegador não devolveu em 10 minutos vence.
  useEffect(() => {
    if (!authPending) return;
    const id = window.setTimeout(cancelSignIn, PENDING_TTL_MS);
    return () => window.clearTimeout(id);
  }, [authPending, cancelSignIn]);

  const signOut = useCallback(() => {
    logout(api, token.current ?? undefined)
      .catch(() => {})
      .finally(() => {
        if (token.current) {
          token.current = null;
          clearToken();
        }
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
        if (!appConnected || appNeedsLook || (hereId && hereId !== cur.id)) {
          setJoinTarget({ kind: 'lobby', lobby: cur });
          return;
        }
        void startJoin({ kind: 'lobby', lobby: cur });
        return;
      }
      if (appConnected && !appNeedsLook) void startJoin(target);
      else setJoinTarget(target);
    },
    [appConnected, appNeedsLook, hereId, lobbyCtx, startJoin],
  );

  // Dentro do app, o diálogo abre para mostrar a checagem (e confere de novo).
  const { recheck } = app;
  useEffect(() => {
    if (joinTarget && IN_DESKTOP) recheck();
  }, [joinTarget, recheck]);

  const confirmJoin = useCallback(() => {
    if (!IN_DESKTOP) setSimulatedApp(true);
    const target = joinTarget;
    setJoinTarget(null);
    if (target) void startJoin(target);
  }, [joinTarget, startJoin]);

  const createLobby = useCallback(
    async (d: HostDraft) => {
      const ack = await request({
        type: 'create',
        lobby: { name: d.name, modeSlug: d.modeSlug, region: d.region, slots: d.slots, minPlayers: d.minPlayers, locked: d.locked, beginners: d.beginners, joinInProgress: d.joinInProgress },
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
    // Saiu no meio da partida: o app encerra a sessão (hospedando ou entrando).
    engineStop();
    if (await request({ type: 'leave' })) pushToast(t.lobbies.leftToast(l.name));
  }, [engineStop, pushToast, request]);

  const inviteTo = useCallback(
    (lobby: Lobby) => {
      const link = inviteLink(lobby.id);
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
      devNames: IN_DESKTOP ? DEV_NAMES : [],
      authPending,
      cancelSignIn,
      user,
      signIn,
      signOut,
      appConnected,
      setAppConnected,
      desktop: app.desktop,
      desktopVersion: app.version,
      appCheck: app.check,
      recheckApp: app.recheck,
      openInstallWindow: app.openInstall,
      engineError: engine.error,
      retryEngine,
      endMatch,
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
      authPending,
      cancelSignIn,
      user,
      signIn,
      signOut,
      appConnected,
      setAppConnected,
      app.desktop,
      app.version,
      app.check,
      app.recheck,
      app.openInstall,
      engine.error,
      retryEngine,
      endMatch,
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
