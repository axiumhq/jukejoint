import type { Lobby } from '../data/lobbies';
import { modes } from '../data/modes';
import { isJoinable } from './lobbies';

/**
 * A única fonte de verdade das contagens (v6, bug da auditoria: "16 lobbies" no topo e
 * "18 lobbies" na lista). Tudo sai da mesma lista de lobbies da sessão:
 *  - jogando agora = soma dos jogadores em todos os lobbies;
 *  - lobbies abertos = todos os lobbies listados (é o número que a lista sem filtro mostra);
 *  - com vaga = dá para entrar direto agora (`isJoinable`).
 * Por modo, as mesmas regras; a soma dos modos é igual ao total.
 */
export interface Counts {
  players: number;
  lobbies: number;
  withRoom: number;
}

export interface LiveStats extends Counts {
  byMode: Record<string, Counts>;
}

const count = (list: Lobby[]): Counts => ({
  players: list.reduce((n, l) => n + l.players, 0),
  lobbies: list.length,
  withRoom: list.filter(isJoinable).length,
});

export function liveStats(list: Lobby[]): LiveStats {
  return {
    ...count(list),
    byMode: Object.fromEntries(modes.map((m) => [m.slug, count(list.filter((l) => l.modeSlug === m.slug))])),
  };
}

/** O modo com mais gente agora (para abrir o primeiro lobby quando não há nenhum). */
export function busiestMode(stats: LiveStats) {
  return [...modes].sort((a, b) => (stats.byMode[b.slug]?.players ?? 0) - (stats.byMode[a.slug]?.players ?? 0))[0] ?? modes[0]!;
}
