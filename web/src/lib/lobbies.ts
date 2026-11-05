import type { Lobby } from '../data/lobbies';
import { modes, type Region } from '../data/modes';
import { t } from '../i18n';

/*
 * Regras de lobby num lugar só: estado (rótulo + verbo), calor, sinal ao vivo,
 * quórum, filtros com contagem e a escolha do "Jogar agora".
 * Tudo aqui é puro (recebe `now` quando depende do relógio) para poder ser testado.
 */

export type SortKey = 'ativos' | 'recomendados' | 'ping' | 'vagas' | 'cheios' | 'recentes';
/** Ordens oferecidas na interface. "recomendados" e "cheios" seguem válidas na URL e para a home. */
export const SORT_KEYS: SortKey[] = ['ativos', 'ping', 'vagas', 'recentes'];
const ALL_SORT_KEYS: SortKey[] = ['ativos', 'recomendados', 'ping', 'vagas', 'cheios', 'recentes'];
export const isSortKey = (v: string | null): v is SortKey => !!v && (ALL_SORT_KEYS as string[]).includes(v);
export const REGIONS: Region[] = ['BR', 'NA', 'EU'];

export interface LobbyFilters {
  q: string;
  mode: string;
  regions: Region[];
  slotsOnly: boolean;
  friendsOnly: boolean;
  /** v8: chips da home (Iniciantes ok, Em partida, Ping < 30). */
  beginners: boolean;
  playing: boolean;
  lowPing: boolean;
  sort: SortKey;
}

export const EMPTY_FILTERS: LobbyFilters = {
  q: '',
  mode: '',
  regions: [],
  slotsOnly: false,
  friendsOnly: false,
  beginners: false,
  playing: false,
  lowPing: false,
  sort: 'ativos',
};

/** O chip "Ping < 30". */
export const LOW_PING_MS = 30;

const MIN = 60_000;
/** Janela do "entrou agora". */
export const FRESH_MS = 8_000;

export const freeSlots = (l: Lobby) => Math.max(0, l.slots - l.players);

/** Tem lugar e a partida aceita gente agora (aberto, ou em partida que deixa entrar no meio). */
export const hasRoom = (l: Lobby) => freeSlots(l) > 0 && (l.status === 'aberto' || (l.status === 'em-partida' && l.joinInProgress));

/**
 * Dá para ENTRAR DIRETO: tem lugar e não é só com convite.
 * (v3 ignorava `locked` e deixava entrar em lobby privado.)
 */
export const isJoinable = (l: Lobby) => hasRoom(l) && !l.locked;

export const hasFriends = (l: Lobby) => l.friends > 0 || l.hostIsFriend;

/** Abaixo do quórum: a partida ainda não pode começar. */
export const belowQuorum = (l: Lobby) => l.status === 'aberto' && l.players < l.minPlayers;

/** Número do arcano do modo (posição em `modes`, a partir de 1). */
export const modeArcana = (slug: string) => modes.findIndex((m) => m.slug === slug) + 1;

/* ───────── Estado ───────── */

export type KnockStatus = 'pending' | 'accepted';

export interface LobbyContext {
  /** Lobby em que a conta simulada está agora (entrou ou abriu). */
  hereId?: string | null;
  joiningId?: string | null;
  knocks?: ReadonlyMap<string, KnockStatus>;
  notify?: ReadonlySet<string>;
}

export type LobbyKind = 'open' | 'joining' | 'mine' | 'joined' | 'private' | 'knocking' | 'invited' | 'full' | 'playing-open' | 'playing-closed';

/** `open`: você já está no lobby (seu ou em que entrou): a ação é ir para a sala, não entrar de novo. */
export type LobbyActionKind = 'join' | 'joining' | 'open' | 'knock' | 'knock-pending' | 'notify-slot' | 'notify-end';

export interface LobbyState {
  kind: LobbyKind;
  /** Rótulo de estado; `null` no estado normal (aberto não grita). */
  label: string | null;
  /** Carimbo do ingresso (LOTADO, COM CONVITE, VOCÊ ESTÁ AQUI, EM PARTIDA). */
  stamp: string | null;
  /** Texto do botão principal. */
  verb: string;
  action: LobbyActionKind;
  /** Segunda ação, discreta, ao lado de "Abrir a sala": fechar (o seu lobby) ou sair (o que você entrou). */
  secondary: 'close' | 'leave' | null;
  /** O clique principal leva para dentro do lobby. */
  canJoin: boolean;
  /** A conta simulada está dentro. */
  you: boolean;
  /** Aviso ligado (para cheio / em partida). */
  notifyOn: boolean;
}

export const notifyKey = (l: Lobby) => `lobby:${l.id}`;

/** Texto da rodada: "rodada 3 de 5" ou, sem rodadas, "há 7 min". */
export function roundText(l: Lobby, now = Date.now()) {
  if (!l.round) return null;
  if (l.round.total) return t.lobbyState.round(l.round.current, l.round.total);
  return t.lobbyState.elapsed(Math.max(0, Math.round((now - l.round.startedAt) / MIN)));
}

/**
 * A única fonte de verdade sobre o que um lobby é para quem está olhando.
 * Ordem: entrando > seu > já entrou > cheio > em partida > privado > aberto.
 */
export function lobbyState(l: Lobby, ctx: LobbyContext = {}, now = Date.now()): LobbyState {
  const notifyOn = ctx.notify?.has(notifyKey(l)) ?? false;
  const base = { secondary: null, canJoin: false, you: false, notifyOn } as const;
  const S = t.lobbyState;

  if (ctx.joiningId === l.id) {
    return { ...base, kind: 'joining', label: null, stamp: null, verb: S.joining, action: 'joining' };
  }
  if (l.mine) {
    return { ...base, kind: 'mine', label: S.here, stamp: S.here, verb: S.open, action: 'open', secondary: 'close', you: true };
  }
  if (ctx.hereId === l.id) {
    return { ...base, kind: 'joined', label: S.here, stamp: S.here, verb: S.open, action: 'open', secondary: 'leave', you: true };
  }
  if (l.status === 'cheio' || (l.status === 'aberto' && freeSlots(l) === 0)) {
    return { ...base, kind: 'full', label: S.full, stamp: S.full, verb: notifyOn ? S.notifyOn : S.notifySlot, action: 'notify-slot' };
  }
  if (l.status === 'em-partida') {
    const label = S.playing(roundText(l, now));
    if (hasRoom(l) && !l.locked) {
      return { ...base, kind: 'playing-open', label, stamp: S.playingStamp, verb: S.joinMid, action: 'join', canJoin: true };
    }
    return { ...base, kind: 'playing-closed', label, stamp: S.playingStamp, verb: notifyOn ? S.notifyOn : S.notifyEnd, action: 'notify-end' };
  }
  if (l.locked) {
    const knock = ctx.knocks?.get(l.id);
    if (knock === 'accepted') {
      return { ...base, kind: 'invited', label: S.doorOpen, stamp: S.invite_stamp, verb: S.join, action: 'join', canJoin: true };
    }
    if (knock === 'pending') {
      return { ...base, kind: 'knocking', label: S.inviteOnly, stamp: S.invite_stamp, verb: S.knockPending, action: 'knock-pending' };
    }
    return { ...base, kind: 'private', label: S.inviteOnly, stamp: S.invite_stamp, verb: S.knock, action: 'knock' };
  }
  return { ...base, kind: 'open', label: null, stamp: null, verb: S.join, action: 'join', canJoin: true };
}

/* ───────── Calor ───────── */

export type Heat = 'lotando' | 'esquentando' | 'recem' | 'quieto';

const lastJoinAt = (l: Lobby) => l.joins.at(-1)?.at ?? l.openedAt;

/**
 * Calor com regra explícita (pública no README):
 *  - Lotando: 80% ou mais ocupado e alguém entrou nos últimos 2 min.
 *  - Esquentando: 3 ou mais entradas nos últimos 2 min.
 *  - Recém-aberto: aberto há menos de 2 min.
 *  - Quieto: ninguém entra há 10 min ou mais.
 * Só para lobby aberto e público: cheio e em partida têm rótulo próprio; privado não mostra calor.
 */
export function heat(l: Lobby, now = Date.now()): Heat | null {
  if (l.locked || l.status !== 'aberto' || freeSlots(l) === 0) return null;
  const recent = l.joins.filter((j) => now - j.at <= 2 * MIN).length;
  const last = lastJoinAt(l);
  if (l.players / l.slots >= 0.8 && now - last <= 2 * MIN) return 'lotando';
  if (recent >= 3) return 'esquentando';
  if (now - l.openedAt < 2 * MIN) return 'recem';
  if (now - last >= 10 * MIN) return 'quieto';
  return null;
}

/** Intensidade da luz nas janelas (0 apagado a 3 aceso), redundante com o rótulo. */
export const heatLevel = (h: Heat | null) => (h === 'lotando' ? 3 : h === 'esquentando' ? 2 : h === 'quieto' ? 0 : 1);

/* ───────── Sinal ao vivo ───────── */

export interface Activity {
  text: string;
  /** Evento acabou de acontecer (pisca o pip e destaca a linha). */
  fresh: boolean;
  /** Quem entrou é amigo (nome em verdete). */
  friend: boolean;
  /** Nome a destacar no texto, se houver. */
  name?: string;
}

const minutesSince = (from: number, now: number) => Math.max(0, Math.floor((now - from) / MIN));

/** A linha de atividade de um lobby: uma coisa só, a mais recente e verdadeira. */
export function activity(l: Lobby, state: LobbyState, now = Date.now()): Activity {
  const A = t.activity;
  const last = l.joins.at(-1);
  const plain = (text: string): Activity => ({ text, fresh: false, friend: false });

  if (state.kind === 'mine') {
    const others = l.joins.filter((j) => !j.you && j.at >= l.openedAt).length;
    return plain(others === 0 ? A.mineNobody : A.mineSince(others));
  }
  if (state.kind === 'full' && l.fullSince) return plain(A.fullSince(minutesSince(l.fullSince, now)));
  if (l.status === 'em-partida' && l.round) {
    const r = l.round.total ? t.lobbyState.round(l.round.current, l.round.total) : null;
    return plain(A.playingSince(r, minutesSince(l.round.startedAt, now)));
  }
  // Privado: só a contagem, sem nomes.
  if (!l.locked && last && !last.you && now - last.at <= FRESH_MS) {
    return { text: A.justJoined(last.name), fresh: true, friend: !!last.friend, name: last.name };
  }
  return plain(A.openedAgo(minutesSince(l.openedAt, now)));
}

/** "Começa com 6: faltam 2". `null` quando o quórum já foi atingido ou não se aplica. */
export function quorumText(l: Lobby) {
  if (!belowQuorum(l)) return null;
  return t.lobbyState.quorum(l.minPlayers, l.minPlayers - l.players);
}

/* ───────── Jogar agora ───────── */

export interface PickOptions {
  mode?: string;
  region?: Region;
  ctx?: LobbyContext;
  now?: number;
}

/** Pontuação do "Jogar agora" e de "Em cartaz agora": amigos, lobby que vai começar logo, calor e ping. */
export function score(l: Lobby, now = Date.now()) {
  const fill = l.players / l.slots;
  const h = heat(l, now);
  const heatBonus = h === 'lotando' ? 12 : h === 'esquentando' ? 10 : h === 'recem' ? 4 : h === 'quieto' ? -15 : 0;
  // Ajudar a fechar o quórum vale: é a sua entrada que faz a partida começar.
  const quorumBonus = belowQuorum(l) && l.minPlayers - l.players <= 2 ? 8 : 0;
  return (
    (l.friends > 0 ? 60 : 0) +
    (l.hostIsFriend ? 20 : 0) +
    fill * 40 +
    heatBonus +
    quorumBonus -
    Math.min(l.ping, 250) / 5 -
    (l.status === 'em-partida' ? 20 : 0)
  );
}

/**
 * O lobby que "Jogar agora" escolhe. Usa o MESMO pool da lista (nada de fila paralela):
 * só lobbies em que dá para entrar direto, que não são seus e em que você ainda não está.
 */
export function pickBestLobby(list: Lobby[], opts: PickOptions = {}): Lobby | undefined {
  const now = opts.now ?? Date.now();
  const ctx = opts.ctx ?? {};
  let best: Lobby | undefined;
  let bestScore = -Infinity;
  for (const l of list) {
    if (opts.mode && l.modeSlug !== opts.mode) continue;
    if (opts.region && l.region !== opts.region) continue;
    if (l.mine || l.id === ctx.hereId) continue;
    const st = lobbyState(l, ctx, now);
    if (!st.canJoin || st.kind === 'invited') continue;
    const s = score(l, now);
    if (s > bestScore) {
      best = l;
      bestScore = s;
    }
  }
  return best;
}

/** O porquê da escolha, em texto curto (até 3 motivos). */
export function pickReasons(l: Lobby, now = Date.now()): string[] {
  const R = t.featured.reasons;
  const out: string[] = [];
  if (l.friends > 0) out.push(R.friends(l.friends));
  else if (l.hostIsFriend) out.push(R.hostFriend);
  const free = freeSlots(l);
  if (belowQuorum(l)) out.push(R.quorum(l.minPlayers - l.players));
  else if (free <= 2) out.push(R.almostFull(free));
  const h = heat(l, now);
  if (h && h !== 'quieto' && out.length < 2) out.push(t.heat[h].toLocaleLowerCase());
  out.push(R.ping(l.ping));
  return out.slice(0, 3);
}

/* ───────── Filtros e ordem ───────── */

function stateRank(l: Lobby, ctx: LobbyContext) {
  if (l.mine || l.id === ctx.hereId || l.id === ctx.joiningId) return 0;
  if (isJoinable(l)) return 1;
  if (l.locked && hasRoom(l)) return 2;
  return 3;
}

function matches(l: Lobby, f: LobbyFilters, signedIn: boolean) {
  const q = f.q.trim().toLocaleLowerCase();
  if (f.mode && l.modeSlug !== f.mode) return false;
  if (f.regions.length > 0 && !f.regions.includes(l.region)) return false;
  if (f.slotsOnly && !hasRoom(l)) return false;
  if (f.friendsOnly && signedIn && !hasFriends(l)) return false;
  if (f.beginners && !l.beginners) return false;
  if (f.playing && l.status !== 'em-partida') return false;
  if (f.lowPing && l.ping >= LOW_PING_MS) return false;
  if (q && !`${l.name} ${l.host}`.toLocaleLowerCase().includes(q)) return false;
  return true;
}

export function filterLobbies(list: Lobby[], f: LobbyFilters, signedIn: boolean, ctx: LobbyContext = {}, now = Date.now()) {
  // O lobby que você abriu (ou em que está) fica sempre visível, no topo.
  const out = list.filter((l) => l.mine || l.id === ctx.hereId || l.id === ctx.joiningId || matches(l, f, signedIn));
  const by: Record<SortKey, (a: Lobby, b: Lobby) => number> = {
    // Jogadores ativos: dá para entrar primeiro, depois quem tem mais gente, depois ping.
    ativos: (a, b) => stateRank(a, ctx) - stateRank(b, ctx) || b.players - a.players || a.ping - b.ping,
    recomendados: (a, b) => stateRank(a, ctx) - stateRank(b, ctx) || (isJoinable(b) ? score(b, now) : b.players) - (isJoinable(a) ? score(a, now) : a.players),
    ping: (a, b) => a.ping - b.ping,
    vagas: (a, b) => freeSlots(b) - freeSlots(a),
    cheios: (a, b) => b.players / b.slots - a.players / a.slots,
    recentes: (a, b) => b.openedAt - a.openedAt,
  };
  const here = (l: Lobby) => Number(!!l.mine || l.id === ctx.hereId || l.id === ctx.joiningId);
  return out.sort((a, b) => here(b) - here(a) || by[f.sort](a, b));
}

export interface FilterCounts {
  modes: Record<string, number>;
  all: number;
  regions: Record<Region, number>;
  slotsOnly: number;
  friendsOnly: number;
}

/** Quantos lobbies cada opção de filtro devolveria, mantidas as outras escolhas. */
export function filterCounts(list: Lobby[], f: LobbyFilters, signedIn: boolean): FilterCounts {
  const count = (patch: Partial<LobbyFilters>) => list.filter((l) => !l.mine && matches(l, { ...f, ...patch }, signedIn)).length;
  return {
    modes: Object.fromEntries(modes.map((m) => [m.slug, count({ mode: m.slug })])),
    all: count({ mode: '' }),
    regions: { BR: count({ regions: ['BR'] }), NA: count({ regions: ['NA'] }), EU: count({ regions: ['EU'] }) },
    slotsOnly: count({ slotsOnly: true }),
    friendsOnly: count({ friendsOnly: true }),
  };
}

export interface Suggestion {
  patch: Partial<LobbyFilters>;
  label: string;
}

/**
 * Vazio filtrado: o vizinho mais próximo. Afrouxa um filtro por vez e diz o que aparece,
 * ex.: "Em BR/SA tem 1 (12 ms)". Devolve no máximo 2 sugestões, da mais útil para a menos.
 */
export function nearestAlternatives(list: Lobby[], f: LobbyFilters, signedIn: boolean): Suggestion[] {
  const pool = list.filter((l) => !l.mine);
  const out: Suggestion[] = [];
  const S = t.lobbies.suggest;
  if (f.regions.length > 0) {
    const elsewhere = pool.filter((l) => matches(l, { ...f, regions: [] }, signedIn) && !f.regions.includes(l.region));
    const byRegion = REGIONS.map((r) => {
      const inR = elsewhere.filter((l) => l.region === r);
      return { r, n: inR.length, ping: inR.length ? Math.min(...inR.map((l) => l.ping)) : Infinity };
    })
      .filter((x) => x.n > 0)
      .sort((a, b) => a.ping - b.ping);
    for (const x of byRegion) out.push({ patch: { regions: [x.r] }, label: S.region(t.regions[x.r], x.n, x.ping) });
  }
  const relax: [Partial<LobbyFilters>, (n: number) => string][] = [
    [{ mode: '' }, S.anyMode],
    [{ slotsOnly: false }, S.anySlots],
    [{ friendsOnly: false }, S.anyFriends],
    [{ beginners: false }, S.anyBeginners],
    [{ playing: false }, S.anyPlaying],
    [{ lowPing: false }, S.anyPing],
    [{ q: '' }, S.anyQuery],
  ];
  for (const [patch, label] of relax) {
    const key = Object.keys(patch)[0] as keyof LobbyFilters;
    if (!f[key] || (Array.isArray(f[key]) && (f[key] as unknown[]).length === 0)) continue;
    const n = pool.filter((l) => matches(l, { ...f, ...patch }, signedIn)).length;
    if (n > 0) out.push({ patch, label: label(n) });
  }
  return out.slice(0, 2);
}

/** Compatibilidade com a home/cidade v3: o melhor lobby de um modo. */
export function bestLobbyForMode(list: Lobby[], slug: string) {
  return pickBestLobby(list, { mode: slug });
}

export function pingQuality(ms: number): 1 | 2 | 3 {
  if (ms <= 60) return 3;
  if (ms <= 150) return 2;
  return 1;
}
