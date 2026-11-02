import { passersby, type Lobby } from '../data/lobbies';

/**
 * A sala do lobby (/sala/:id): quem ocupa cada vaga e quem está pronto.
 * No protótipo os nomes e o "pronto" dos outros são simulados, mas estáveis:
 * a mesma sala mostra as mesmas pessoas a cada render (nada de nome trocando sozinho).
 * No produto, a lista vem do app/servidor de sinalização.
 */

export interface Seat {
  /** `null` = vaga livre. */
  name: string | null;
  you?: boolean;
  host?: boolean;
  friend?: boolean;
  ready?: boolean;
}

export interface RosterOptions {
  /** Seu nome (conta simulada ou "você"). */
  you: string;
  /** Você ocupa uma vaga nesta sala. */
  youHere: boolean;
  youReady: boolean;
  signedIn: boolean;
  now: number;
  /** Nomes dos seus amigos nesta sala (lib/friends.ts `friendsIn`). */
  friends?: string[];
}

/** Quem entrou há menos que isto ainda não marcou "pronto". */
const SETTLE_MS = 20_000;

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function roster(l: Lobby, o: RosterOptions): Seat[] {
  const seats: Seat[] = [];
  const used = new Set<string>([o.you]);
  const playing = l.status === 'em-partida';
  const joinedAt = new Map(l.joins.filter((j) => !j.you).map((j) => [j.name, j.at]));
  const friends = new Set(o.signedIn && !l.locked ? (o.friends ?? []) : []);

  const add = (name: string, host = false) => {
    used.add(name);
    const at = joinedAt.get(name);
    const settled = at === undefined || o.now - at > SETTLE_MS;
    const friend = friends.has(name);
    // Três em cada quatro já marcaram pronto; o anfitrião está sempre pronto.
    seats.push({ name, host, friend, ready: playing || host || (settled && hash(`${l.id}:${name}`) % 4 !== 0) });
  };

  if (l.mine) seats.push({ name: o.you, you: true, host: true, ready: true });
  else {
    add(l.host, true);
    if (o.youHere) seats.push({ name: o.you, you: true, ready: playing || o.youReady });
  }

  // Amigos primeiro, depois os que entraram por último (da lista "entrou agora"), depois gente da cidade.
  const pool = [...friends, ...l.joins.filter((j) => !j.you).map((j) => j.name).reverse()];
  const start = hash(l.id) % passersby.length;
  for (let i = 0; i < passersby.length; i++) pool.push(passersby[(start + i) % passersby.length]!);
  for (const name of pool) {
    if (seats.length >= l.players) break;
    if (!used.has(name)) add(name);
  }
  // Mais jogadores do que nomes conhecidos: completa com numerados, sem repetir.
  for (let n = 2; seats.length < l.players; n++) {
    const name = `${passersby[(start + n) % passersby.length]}${n}`;
    if (!used.has(name)) add(name);
  }

  while (seats.length < l.slots) seats.push({ name: null });
  return seats.slice(0, Math.max(l.slots, seats.length));
}

/** Quantos faltam para o mínimo da partida (0 quando já dá para começar). */
export function missingForQuorum(l: Lobby) {
  return Math.max(0, l.minPlayers - l.players);
}
