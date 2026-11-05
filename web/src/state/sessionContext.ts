import { createContext, useContext } from 'react';
import type { Lobby } from '../data/lobbies';
import type { Region } from '../data/modes';
import type { KnockView } from '../lib/api';
import type { EngineError } from '../lib/desktop';
import type { FriendPresence } from '../lib/friends';
import type { KnockStatus, LobbyContext } from '../lib/lobbies';
import type { Seat } from '../lib/room';

/**
 * O contrato da sessão que as telas usam. Duas implementações: a simulada (state/session.tsx,
 * a demo) e a ao vivo (state/liveSession.tsx, a API real com `VITE_API_URL`). As telas não sabem qual.
 */

export interface MockUser {
  name: string;
  friendsOnline: number;
  /** Ao vivo: a foto da Steam (https). */
  avatar?: string;
  /** Ao vivo: o ID da conta (SteamID64 ou `dev:nome`). */
  id?: string;
  /** Ao vivo: conta de teste do login de desenvolvimento. */
  dev?: boolean;
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
  /** "Iniciantes ok". */
  beginners: boolean;
  /** "Aceita entrar no meio da partida". */
  joinInProgress: boolean;
}

export type JoinTarget = { kind: 'lobby'; lobby: Lobby } | { kind: 'bots' };

/** `mock` = dados simulados; os outros são o estado do WebSocket da API. */
export type ConnectionState = 'mock' | 'connecting' | 'online' | 'offline';

/** A checagem do motor (`engine_check`) quando o site está dentro do app desktop. */
export interface AppCheck {
  status: 'checking' | 'ready' | 'problems';
  /** Já em duas camadas: `message` para quem joga, `detail` técnico. */
  problems: EngineError[];
  modes?: { testMode: boolean; testSlugs?: string[]; testProject: string; testProjectOk: boolean };
}

export interface SessionValue {
  /** `true` com a API real. */
  live: boolean;
  connection: ConnectionState;
  /** Ao vivo: tenta conectar de novo agora ("Tentar de novo"). Simulado: não faz nada. */
  reconnect: () => void;
  /** Já chegou a lista de lobbies (simulado: sempre). Antes disso, lista vazia não quer dizer "0 lobbies". */
  synced: boolean;
  /** O servidor aceita o login de teste (DEV_LOGIN=1, só de localhost). */
  devLogin: boolean;
  /** No navegador, `name` é ignorado (vai para a página de login de teste da API). No app, entra com esse nome de `devNames`. */
  signInDev: (name?: string) => void;
  /** No app desktop: os nomes de teste oferecidos (o cookie não viaja, então não há página de login). Fora dele, vazio. */
  devNames: readonly string[];
  /** No app desktop: o login da Steam foi aberto no navegador e o app espera a volta. */
  authPending: boolean;
  /** Desiste do login que está esperando o navegador. */
  cancelSignIn: () => void;
  user: MockUser | null;
  signIn: () => void;
  signOut: () => void;
  /** O app está aberto. Dentro do app desktop vem dele (sempre `true`); fora, é a simulação da /instalar. */
  appConnected: boolean;
  setAppConnected: (v: boolean) => void;
  /** O site está rodando dentro do app desktop (lib/desktop.ts). */
  desktop: boolean;
  /** Versão do app desktop, dentro dele. */
  desktopVersion: string | null;
  /** Dentro do app: a checagem do motor. Fora: `null`. */
  appCheck: AppCheck | null;
  recheckApp: () => void;
  /** Abre (ou traz para frente) a tela Instalação do app. */
  openInstallWindow: () => void;
  /** Ao vivo, dentro do app: o app não conseguiu hospedar ou entrar na partida da sua sala. */
  engineError: EngineError | null;
  /** Tenta de novo hospedar ou entrar (depois de `engineError`). */
  retryEngine: () => void;
  /** Ao vivo, só o anfitrião: encerra a partida (dentro do app, também fecha a sessão do app) e reabre a sala. */
  endMatch: () => void;
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
  /** Só o anfitrião, com o mínimo de jogadores: começa a partida (ao vivo, com a contagem de 5 s). */
  startMatch: () => void;
  /** Só o anfitrião: cancela a contagem. */
  cancelStart: () => void;
  /** Só o anfitrião: tira alguém da sala. */
  kick: (seat: Seat) => void;
  /** As vagas da sala em que você está (mesma conta que decide a contagem). Vazio fora de sala. */
  seatsHere: Seat[];
  /** Quem confirmou depois de você, com a hora (alimenta a atividade da sala). */
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
  /** Quem bateu na porta do lobby que você abriu (ao vivo). */
  knocksHere: KnockView[];
  answerKnock: (userId: string, accept: boolean) => void;
  hostDialog: { open: boolean; modeSlug?: string };
  openHost: (modeSlug?: string) => void;
  closeHost: () => void;
  notify: Set<string>;
  toggleNotify: (key: string, label: string) => void;
  /** Convites recebidos que você recusou (id do lobby); o trilho não mostra de novo. */
  declinedInvites: ReadonlySet<string>;
  declineInvite: (lobbyId: string) => void;
  /** Ao vivo: amigos online vindos do servidor. `undefined` = simulado (lib/friends.ts). */
  presence?: FriendPresence[];
  /** Ao vivo: o convite recebido. `undefined` = simulado (lib/friends.ts `incomingInvite`). */
  incoming?: { from: string; lobby: Lobby } | null;
  /** "Chamar": convida um amigo para o lobby em que você está. Resolve `true` se o convite saiu. */
  callFriend: (friend: FriendPresence) => Promise<boolean>;
  toasts: Toast[];
  pushToast: (message: string) => void;
  dismissToast: (id: number) => void;
}

export const SessionContext = createContext<SessionValue | null>(null);

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession precisa estar dentro de <SessionProvider>');
  return ctx;
}
