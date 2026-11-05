import type { Lobby, LobbyStatus } from '../data/lobbies';
import type { Region } from '../data/modes';
import { live as L } from '../i18n/live';
import type { FriendPresence } from './friends';
import type { Seat } from './room';

/*
 * O protocolo da API (server/README.md) e a ponte para os tipos que a interface já usa.
 * Tudo aqui é puro: o reducer recebe as mensagens do servidor e devolve o estado novo,
 * e `toLobby` traduz a visão do servidor para o `Lobby` da tela. Quem decide é o servidor;
 * o site só mostra e manda pedidos (intents).
 */

export interface ApiUser {
  id: string;
  name: string;
  avatar?: string;
  dev?: boolean;
}

export type Phase = 'open' | 'countdown' | 'handoff' | 'playing';

export interface SeatView {
  userId: string;
  name: string;
  /** URL do avatar da Steam, quando o login trouxe um. */
  avatar?: string;
  host?: boolean;
  ready: boolean;
  readyAt?: number;
  /** Protocolo 2: a etapa do handoff que o app desta vaga mandou (0 a 3; 3 = dentro). Só em partida. */
  step?: number;
}

export interface JoinView {
  userId: string;
  name: string;
  at: number;
}

export interface KnockView {
  userId: string;
  name: string;
  message?: string;
  at: number;
}

export interface LobbyView {
  id: string;
  name: string;
  modeSlug: string;
  region: Region;
  hostId: string;
  hostName: string;
  players: number;
  slots: number;
  minPlayers: number;
  locked: boolean;
  beginners: boolean;
  joinInProgress: boolean;
  status: LobbyStatus;
  phase: Phase;
  countdownMs?: number;
  handoffStep?: number;
  openedAt: number;
  startedAt?: number;
  fullSince?: number;
  seats?: SeatView[];
  joins?: JoinView[];
  /** Lobby com convite visto de fora: só a contagem. */
  hidden?: boolean;
  /** Código para entrar (do app do anfitrião, via EngineAdapter). Só para quem está na sala. */
  joinCode?: string;
  /** Quem bateu na porta. Só para o anfitrião. */
  knocks?: KnockView[];
}

export interface FriendView {
  id: string;
  name: string;
  lobbyId?: string;
  host?: boolean;
  /** A foto da Steam, se o servidor mandar (hoje não manda: server/internal/lobby/hub.go `FriendView`). */
  avatar?: string;
}

export interface InviteView {
  fromId: string;
  fromName: string;
  lobbyId: string;
  lobbyName: string;
  at: number;
}

export type KnockState = 'pending' | 'accepted';

export type ServerMsg =
  | {
      type: 'welcome';
      /** Versão do protocolo (server/README.md); ausente = 1. */
      protocol?: number;
      me: ApiUser | null;
      here: string | null;
      serverNow: number;
      knocks?: Record<string, KnockState>;
      invites?: InviteView[];
    }
  | { type: 'lobbies'; lobbies: LobbyView[] }
  | { type: 'lobby'; lobby: LobbyView }
  | { type: 'lobby_removed'; lobbyId: string; reason: 'closed' | 'empty' }
  | { type: 'lobby_closed'; lobbyId: string; name: string }
  | { type: 'here'; lobbyId: string | null }
  | { type: 'friends'; friends: FriendView[] }
  | { type: 'friend'; friend: FriendView }
  | { type: 'friend_gone'; id: string }
  | { type: 'invite'; invite: InviteView }
  | { type: 'invite_gone'; lobbyId: string }
  | { type: 'knock'; lobbyId: string; lobbyName: string; status: 'pending' | 'accepted' | 'declined' }
  | { type: 'kicked'; lobbyId: string; name: string }
  | { type: 'ack'; req: number; lobbyId?: string }
  | { type: 'error'; req?: number; code: string; message: string };

/** Os pedidos que o site manda. O servidor valida cada um contra o estado atual. */
export type Intent =
  | { type: 'create'; lobby: { name: string; modeSlug: string; region: Region; slots: number; minPlayers: number; locked: boolean; beginners?: boolean; joinInProgress?: boolean } }
  | { type: 'join'; lobbyId: string }
  | { type: 'leave' }
  | { type: 'ready'; ready: boolean }
  | { type: 'start' }
  | { type: 'cancel_start' }
  | { type: 'end_match' }
  | { type: 'kick'; userId: string }
  | { type: 'close' }
  | { type: 'knock'; lobbyId: string; message: string }
  | { type: 'answer_knock'; userId: string; accept: boolean }
  | { type: 'invite'; userId: string }
  | { type: 'decline_invite'; lobbyId: string }
  | { type: 'set_join_code'; code: string }
  /** Protocolo 2: a etapa do seu app na partida (só para frente); a de quem hospeda também move a sala. */
  | { type: 'handoff_progress'; step: number }
  | { type: 'ping' };

/* ───────── Estado ───────── */

export interface LiveState {
  /** Já chegou o primeiro retrato do servidor (antes disso a lista vazia não é "0 lobbies"). */
  synced: boolean;
  me: ApiUser | null;
  lobbies: Readonly<Record<string, LobbyView>>;
  /** Fim da contagem (epoch ms, relógio local) por lobby, calculado na chegada da mensagem. */
  countdownEnds: Readonly<Record<string, number>>;
  hereId: string | null;
  friends: FriendView[];
  invites: InviteView[];
  knocks: Readonly<Record<string, KnockState>>;
}

export const EMPTY_LIVE: LiveState = { synced: false, me: null, lobbies: {}, countdownEnds: {}, hereId: null, friends: [], invites: [], knocks: {} };

function withLobby(s: LiveState, v: LobbyView, now: number): LiveState {
  const countdownEnds = { ...s.countdownEnds };
  if (v.phase === 'countdown' && v.countdownMs !== undefined) countdownEnds[v.id] = now + v.countdownMs;
  else delete countdownEnds[v.id];
  return { ...s, lobbies: { ...s.lobbies, [v.id]: v }, countdownEnds };
}

function without<T>(rec: Readonly<Record<string, T>>, key: string): Record<string, T> {
  const out = { ...rec };
  delete out[key];
  return out;
}

/** Aplica uma mensagem do servidor. `now` é o relógio local (para a contagem). */
export function reduce(s: LiveState, m: ServerMsg, now: number): LiveState {
  switch (m.type) {
    case 'welcome':
      return { ...EMPTY_LIVE, me: m.me, hereId: m.here ?? null, knocks: m.knocks ?? {}, invites: m.invites ?? [] };
    case 'lobbies': {
      let next: LiveState = { ...s, synced: true, lobbies: {}, countdownEnds: {} };
      for (const v of m.lobbies) next = withLobby(next, v, now);
      return next;
    }
    case 'lobby':
      return withLobby(s, m.lobby, now);
    case 'lobby_removed':
      return {
        ...s,
        lobbies: without(s.lobbies, m.lobbyId),
        countdownEnds: without(s.countdownEnds, m.lobbyId),
        knocks: without(s.knocks, m.lobbyId),
        invites: s.invites.filter((i) => i.lobbyId !== m.lobbyId),
        hereId: s.hereId === m.lobbyId ? null : s.hereId,
      };
    case 'here':
      return { ...s, hereId: m.lobbyId };
    case 'friends':
      return { ...s, friends: m.friends };
    case 'friend': {
      const others = s.friends.filter((f) => f.id !== m.friend.id);
      return { ...s, friends: [...others, m.friend].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')) };
    }
    case 'friend_gone':
      return { ...s, friends: s.friends.filter((f) => f.id !== m.id) };
    case 'invite':
      return { ...s, invites: [...s.invites.filter((i) => i.lobbyId !== m.invite.lobbyId), m.invite] };
    case 'invite_gone':
      return { ...s, invites: s.invites.filter((i) => i.lobbyId !== m.lobbyId) };
    case 'knock':
      return { ...s, knocks: m.status === 'declined' ? without(s.knocks, m.lobbyId) : { ...s.knocks, [m.lobbyId]: m.status } };
    default:
      return s;
  }
}

/* ───────── Ponte para a interface ───────── */

/** Ping estimado pela região (jogador em São Paulo) até o app medir o de verdade. */
export const ESTIMATED_PING: Record<Region, number> = { BR: 11, NA: 124, EU: 196 };

export interface ViewContext {
  meId: string | null;
  friendIds: ReadonlySet<string>;
  now: number;
}

function seatsOf(v: LobbyView, ctx: ViewContext): Seat[] {
  if (v.hidden || !v.seats) {
    // Privado visto de fora: a contagem, sem nomes.
    return Array.from({ length: v.players }, (_, i) => ({ name: `${L.hiddenSeat} ${i + 1}`, hidden: true, ready: false }));
  }
  return v.seats.map((s) => ({
    id: s.userId,
    name: s.name,
    avatar: s.avatar,
    you: s.userId === ctx.meId || undefined,
    host: !!s.host,
    friend: ctx.friendIds.has(s.userId),
    ready: s.ready,
  }));
}

/** A visão do servidor no formato `Lobby` da interface, do ponto de vista de quem olha. */
export function toLobby(v: LobbyView, ctx: ViewContext): Lobby {
  const inMatch = v.phase === 'handoff' || v.phase === 'playing';
  const friends = (v.seats ?? []).filter((s) => ctx.friendIds.has(s.userId)).length;
  return {
    id: v.id,
    name: v.name,
    modeSlug: v.modeSlug,
    host: v.hostName,
    hostId: v.hostId,
    hostIsFriend: ctx.friendIds.has(v.hostId),
    region: v.region,
    ping: ESTIMATED_PING[v.region] ?? 200,
    players: v.players,
    slots: v.slots,
    friends,
    status: v.status,
    joinInProgress: v.joinInProgress,
    locked: v.locked,
    minutesAgo: Math.max(0, Math.floor((ctx.now - v.openedAt) / 60_000)),
    openedAt: v.openedAt,
    minPlayers: v.minPlayers,
    joins: (v.joins ?? []).map((j) => ({
      name: j.name,
      at: j.at,
      you: j.userId === ctx.meId || undefined,
      friend: ctx.friendIds.has(j.userId) || undefined,
    })),
    round: inMatch && v.startedAt ? { current: 1, startedAt: v.startedAt } : undefined,
    fullSince: v.fullSince || undefined,
    beginners: v.beginners || undefined,
    mine: (!!ctx.meId && v.hostId === ctx.meId) || undefined,
    seats: seatsOf(v, ctx),
  };
}

/** Amigos online no formato do trilho social. */
export function toPresence(friends: FriendView[]): FriendPresence[] {
  return friends.map((f) => ({ id: f.id, name: f.name, lobbyId: f.lobbyId ?? null, host: !!f.host, avatar: f.avatar }));
}

/** O convite que o trilho mostra: o mais recente para um lobby que ainda existe, fora o seu e os recusados. */
export function pickInvite(s: LiveState, lobbies: Lobby[], declined: ReadonlySet<string>): { from: string; lobby: Lobby } | null {
  for (const inv of [...s.invites].reverse()) {
    if (inv.lobbyId === s.hereId || declined.has(inv.lobbyId)) continue;
    const lobby = lobbies.find((l) => l.id === inv.lobbyId);
    if (lobby) return { from: inv.fromName, lobby };
  }
  return null;
}

/** Quem confirmou (nome → hora), para a atividade da sala. O anfitrião e você não contam. */
export function confirmations(v: LobbyView | undefined, meId: string | null): Map<string, number> {
  const out = new Map<string, number>();
  for (const s of v?.seats ?? []) if (s.ready && !s.host && s.userId !== meId && s.readyAt) out.set(s.name, s.readyAt);
  return out;
}

/** Atraso da reconexão: 0,5 s, 1 s, 2 s… até 15 s, com um pouco de folga aleatória. */
export function backoffMs(attempt: number, rand = Math.random()) {
  const base = Math.min(15_000, 500 * 2 ** Math.max(0, attempt));
  return Math.round(base * (0.8 + 0.4 * rand));
}
