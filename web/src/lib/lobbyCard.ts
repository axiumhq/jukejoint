import type { Lobby } from '../data/lobbies';
import { t } from '../i18n';
import { freeSlots, roundText, type LobbyState } from './lobbies';

/*
 * O que o cartão de lobby do v8 mostra, derivado da tabela de estados (`lobbyState`):
 * a etiqueta de estado no canto da capa e o número do lobby. Puro, para testar.
 */

export type TagTone = 'acc' | 'soft' | 'plain' | 'warn' | 'lock';

export interface CardTag {
  text: string;
  tone: TagTone;
}

/** "Lobby 04": o número vem do id dos lobbies de exemplo (l04). Lobby seu não tem número. */
export function lobbyNum(l: Lobby): string | null {
  const m = /^l(\d+)$/.exec(l.id);
  return m ? m[1]!.padStart(2, '0') : null;
}

/** Quase cheio e ainda dá para entrar: o "falta N" ganha o acento. */
export const isNearFull = (l: Lobby, st: LobbyState) => st.canJoin && freeSlots(l) > 0 && freeSlots(l) <= 2;

/**
 * A etiqueta do cartão: uma só, a exceção mais importante.
 * Ordem: você > em partida > lotado > convite > amigos > falta N > iniciantes.
 * Amigos só existem para quem entrou com a Steam; lobby com convite não conta amigos.
 */
export function cardTag(l: Lobby, st: LobbyState, signedIn: boolean, now = Date.now()): CardTag | null {
  const C = t.card;
  if (st.kind === 'joining') return { text: t.lobbyState.joining, tone: 'acc' };
  if (st.you) return { text: t.lobbyState.here, tone: 'acc' };
  if (l.status === 'em-partida') {
    const r = roundText(l, now);
    if (freeSlots(l) === 0) return { text: C.playingFull, tone: 'warn' };
    return { text: r ? C.playingRound(r) : t.lobbyState.playingStamp, tone: 'warn' };
  }
  if (st.kind === 'full') return { text: t.lobbyState.full, tone: 'plain' };
  if (st.kind === 'invited') return { text: t.lobbyState.doorOpen, tone: 'soft' };
  if (st.kind === 'private' || st.kind === 'knocking') return { text: C.inviteOnly, tone: 'lock' };
  if (signedIn && l.friends > 0) return { text: C.fromList(l.friends), tone: 'soft' };
  const free = freeSlots(l);
  if (free > 0 && free <= 2) return { text: C.missing(free), tone: 'acc' };
  if (l.beginners) return { text: C.beginners, tone: 'plain' };
  return null;
}
