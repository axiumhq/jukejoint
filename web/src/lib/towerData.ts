import type { Lobby } from '../data/lobbies';
import { getMode } from '../data/modes';
import type { Tier } from './tier';

/**
 * A Torre a partir dos lobbies: um andar por lobby, uma janela por vaga.
 * O mesmo cálculo alimenta a cena 3D, o esboço de carregamento e a lista em HTML,
 * então os três mostram sempre os mesmos andares, na mesma ordem.
 */

export type WindowKind = 'free' | 'lit' | 'friend';

export interface TowerFloor {
  lobby: Lobby;
  /** 1 = primeiro andar acima do saguão. */
  number: number;
  /** Índice de baixo para cima (0 = mais baixo). */
  level: number;
  windows: WindowKind[];
  /** Matiz do modo (graus): só o friso usa, nunca a janela. */
  hue: number;
  modeName: string;
  motif: string;
}

/** Quantos andares cada nível desenha (o médio desenha menos, como pede o brief). */
export const FLOOR_CAP: Record<Tier, number> = { high: 18, mid: 12, low: 18 };

/** Atividade de um lobby: gente agora pesa mais que vaga sobrando. */
const activity = (l: Lobby) => l.players + l.friends * 2 + (l.status === 'em-partida' ? 1 : 0);

export function windowKinds(l: Lobby): WindowKind[] {
  return Array.from({ length: l.slots }, (_, i) => (i < l.friends ? 'friend' : i < l.players ? 'lit' : 'free'));
}

/**
 * Escolhe os andares e empilha: os mais largos (mais vagas) embaixo, de modo que o recuo
 * escalonado dos anos 1920 saia do próprio dado. Ordem estável (vagas, depois id): quando
 * alguém entra, só a janela muda, o andar não pula.
 */
export function buildFloors(lobbies: Lobby[], cap: number): TowerFloor[] {
  const chosen = [...lobbies]
    .sort((a, b) => Number(!!b.mine) - Number(!!a.mine) || activity(b) - activity(a) || a.id.localeCompare(b.id))
    .slice(0, cap);
  const bottomUp = chosen.sort((a, b) => b.slots - a.slots || a.id.localeCompare(b.id));
  return bottomUp.map((lobby, level) => {
    const mode = getMode(lobby.modeSlug);
    return {
      lobby,
      level,
      number: level + 1,
      windows: windowKinds(lobby),
      hue: mode?.hue ?? 40,
      modeName: mode?.name ?? '',
      motif: mode?.motif ?? 'grid',
    };
  });
}

/**
 * Ordem em que as janelas acenderam: cada lobby abriu há `minutesAgo` minutos e os
 * jogadores chegaram espaçados entre a abertura e agora (o anfitrião primeiro).
 * Devolve [andar, janela] na ordem de chegada. É a ordem da abertura da cena.
 */
export function joinOrder(floors: TowerFloor[]): [number, number][] {
  const events: { at: number; f: number; w: number }[] = [];
  floors.forEach((fl, f) => {
    const taken = fl.lobby.players;
    const opened = -Math.max(0.5, fl.lobby.minutesAgo);
    for (let w = 0; w < taken; w++) {
      events.push({ at: opened * (1 - w / Math.max(1, taken)), f, w });
    }
  });
  events.sort((a, b) => a.at - b.at || a.f - b.f);
  return events.map((e) => [e.f, e.w]);
}

export type Heat = 'lotando' | 'esquentando' | 'recem' | 'quieto' | 'partida' | 'lotado';

/** Temperatura honesta do lobby, só com o que o dado tem. */
export function heatOf(l: Lobby): Heat {
  if (l.status === 'em-partida') return 'partida';
  if (l.players >= l.slots) return 'lotado';
  const free = l.slots - l.players;
  if (free <= 2) return 'lotando';
  if (l.minutesAgo <= 3) return 'recem';
  if (l.players / l.slots >= 0.55) return 'esquentando';
  return 'quieto';
}

/** Dá para entrar direto, sem convite e sem fila. (A regra completa de estados é da tela de lobbies.) */
export const canEnter = (l: Lobby) =>
  !l.mine && !l.locked && l.players < l.slots && (l.status === 'aberto' || (l.status === 'em-partida' && l.joinInProgress));

/** O lobby aberto mais perto de lotar (para o elevador e para "Jogar agora"). */
export function nearestToFull(lobbies: Lobby[]): Lobby | undefined {
  return [...lobbies]
    .filter(canEnter)
    .sort((a, b) => a.slots - a.players - (b.slots - b.players) || b.friends - a.friends || a.ping - b.ping)[0];
}
