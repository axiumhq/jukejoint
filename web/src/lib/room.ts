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
  /** Ao vivo: o ID da conta (para remover da sala). */
  id?: string;
  /** Ao vivo: vaga de lobby com convite vista de fora (sem nome de verdade). */
  hidden?: boolean;
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
  /** Quem já confirmou nesta sala depois de você (simulado): fica pronto de vez. Chave = nome. */
  confirmed?: { has(name: string): boolean };
}

/** Quem entrou há menos que isto ainda não marcou "pronto". */
const SETTLE_MS = 20_000;

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function roster(l: Lobby, o: RosterOptions): Seat[] {
  // Ao vivo, as vagas vêm do servidor: nada de simular.
  if (l.seats) {
    const live = l.seats.map((s) => ({ ...s }));
    while (live.length < l.slots) live.push({ name: null });
    return live;
  }
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
    const forced = o.confirmed?.has(name) ?? false;
    // Três em cada quatro já marcaram pronto; o anfitrião está sempre pronto.
    seats.push({ name, host, friend, ready: playing || host || forced || (settled && hash(`${l.id}:${name}`) % 4 !== 0) });
  };

  if (l.mine) seats.push({ name: o.you, you: true, host: true, ready: true });
  else {
    add(l.host, true);
    if (o.youHere) seats.push({ name: o.you, you: true, ready: playing || o.youReady });
  }

  // Amigos primeiro, depois os que entraram por último (da lista "entrou agora"), depois gente da cidade.
  const pool = [
    ...friends,
    ...l.joins
      .filter((j) => !j.you)
      .map((j) => j.name)
      .reverse(),
  ];
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

/** Quantos já confirmaram (vagas ocupadas e prontas, você incluído). */
export function readyCount(seats: Seat[]) {
  return seats.filter((s) => s.name && s.ready).length;
}

/** Quem confirma em seguida na simulação: a primeira vaga ocupada que ainda não marcou pronto (você não conta). */
export function nextToConfirm(seats: Seat[]): string | null {
  return seats.find((s) => s.name && !s.you && !s.ready)?.name ?? null;
}

/**
 * O único modelo de progresso da sala, em quatro fases: 1 Juntando gente (falta gente para o mínimo),
 * 2 Confirmando (ou Mínimo confirmado: aí quem abriu a sala é quem começa), 3 Contagem (cancelável)
 * e 4 Abrindo o jogo (o app trabalhando). "Em partida" é o fim da fase 4: só depois do handoff.
 */
export type RoomPhaseKey = 'gathering' | 'waiting' | 'quorum' | 'countdown' | 'opening' | 'playing';

export interface PhaseInput {
  players: number;
  minPlayers: number;
  /** Quantos confirmaram (`readyCount`). */
  ready: number;
  playing: boolean;
  countdown: boolean;
  /** O app ainda está abrindo o jogo para você (etapas do handoff). */
  handoff: boolean;
}

export function roomPhase(o: PhaseInput): { step: 1 | 2 | 3 | 4; key: RoomPhaseKey } {
  if (o.handoff) return { step: 4, key: 'opening' };
  if (o.playing) return { step: 4, key: 'playing' };
  if (o.countdown) return { step: 3, key: 'countdown' };
  if (o.players < o.minPlayers) return { step: 1, key: 'gathering' };
  return { step: 2, key: o.ready >= o.minPlayers ? 'quorum' : 'waiting' };
}

/** Em que pé está o handoff de quem está na sala: ainda abrindo, já dentro, ou nenhum. */
export function handoffState(step: number | null, steps: number): 'opening' | 'inside' | null {
  if (step === null) return null;
  return step < steps ? 'opening' : 'inside';
}

/** Ícone de uma regra do modo, pelo assunto da frase (sorteio, tempo, área, combate, gente). */
export type RuleIcon = 'dice' | 'clock' | 'shrink' | 'swords' | 'users' | 'info';

const RULE_ICONS: [RegExp, RuleIcon][] = [
  [/aleat|sortead|sorteio/i, 'dice'],
  [/círculo|encolhe|visão|metros/i, 'shrink'],
  [/contra|abate|ataque|atacante|defens|caçador|times de/i, 'swords'],
  [/segundo|minuto|relógio|rodada/i, 'clock'],
  [/jogador|fila|pessoa/i, 'users'],
];

export function ruleIcon(rule: string): RuleIcon {
  return RULE_ICONS.find(([re]) => re.test(rule))?.[1] ?? 'info';
}
