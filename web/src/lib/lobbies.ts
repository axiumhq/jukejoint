import type { Lobby } from '../data/lobbies';
import type { Region } from '../data/modes';

export type SortKey = 'recomendados' | 'ping' | 'vagas' | 'cheios' | 'recentes';
export const SORT_KEYS: SortKey[] = ['recomendados', 'ping', 'vagas', 'cheios', 'recentes'];
export const REGIONS: Region[] = ['BR', 'NA', 'EU'];

export interface LobbyFilters {
  q: string;
  mode: string;
  regions: Region[];
  slotsOnly: boolean;
  friendsOnly: boolean;
  sort: SortKey;
}

export const freeSlots = (l: Lobby) => Math.max(0, l.slots - l.players);

/** Dá para entrar agora (vaga livre e partida aceitando jogador). */
export const isJoinable = (l: Lobby) =>
  freeSlots(l) > 0 && (l.status === 'aberto' || (l.status === 'em-partida' && l.joinInProgress));

export const hasFriends = (l: Lobby) => l.friends > 0 || l.hostIsFriend;

/** Pontuação de "recomendados": amigos, ping baixo, lobby quase cheio (começa logo). */
function score(l: Lobby) {
  if (!isJoinable(l)) return -1000 + l.players;
  const fill = l.players / l.slots;
  return (hasFriends(l) ? 60 : 0) + (l.mine ? 100 : 0) + fill * 40 - Math.min(l.ping, 250) / 5;
}

export function filterLobbies(list: Lobby[], f: LobbyFilters, signedIn: boolean) {
  const q = f.q.trim().toLocaleLowerCase('pt-BR');
  const out = list.filter((l) => {
    // O lobby que você criou fica sempre visível, no topo.
    if (l.mine) return true;
    if (f.mode && l.modeSlug !== f.mode) return false;
    if (f.regions.length > 0 && !f.regions.includes(l.region)) return false;
    if (f.slotsOnly && !isJoinable(l)) return false;
    if (f.friendsOnly && signedIn && !hasFriends(l)) return false;
    if (q && !`${l.name} ${l.host}`.toLocaleLowerCase('pt-BR').includes(q)) return false;
    return true;
  });
  const by: Record<SortKey, (a: Lobby, b: Lobby) => number> = {
    recomendados: (a, b) => score(b) - score(a),
    ping: (a, b) => a.ping - b.ping,
    vagas: (a, b) => freeSlots(b) - freeSlots(a),
    cheios: (a, b) => b.players / b.slots - a.players / a.slots,
    recentes: (a, b) => a.minutesAgo - b.minutesAgo,
  };
  return out.sort((a, b) => Number(!!b.mine) - Number(!!a.mine) || by[f.sort](a, b));
}

export function bestLobbyForMode(list: Lobby[], slug: string) {
  return filterLobbies(list, { q: '', mode: slug, regions: [], slotsOnly: true, friendsOnly: false, sort: 'recomendados' }, false).filter(
    (l) => !l.locked && !l.mine && l.modeSlug === slug,
  )[0];
}

export function pingQuality(ms: number): 1 | 2 | 3 {
  if (ms <= 60) return 3;
  if (ms <= 150) return 2;
  return 1;
}
