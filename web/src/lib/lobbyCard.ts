import type { Lobby } from '../data/lobbies';
import { t } from '../i18n';
import { cartao as K } from '../i18n/cartao';
import { freeSlots, roundText, type LobbyState } from './lobbies';

/*
 * O que o cartão de lobby ("ingresso + cartaz", Home v4) mostra, derivado da tabela de estados
 * (`lobbyState`): a etiqueta de estado no alto da arte, o número carimbado, o rótulo do placar
 * (Âmbar × Safira ou o formato do modo) e o aviso do canhoto quando não há botão. Puro, para testar.
 */

export type TagTone = 'acc' | 'soft' | 'plain' | 'warn' | 'lock';

export interface CardTag {
  text: string;
  tone: TagTone;
}

/** "04": o número vem do id dos lobbies de exemplo (l04). Lobby seu (ou ao vivo) não tem número. */
export function lobbyNum(l: Lobby): string | null {
  const m = /^l(\d+)$/.exec(l.id);
  return m ? m[1]!.padStart(2, '0') : null;
}

/** Quase cheio e ainda dá para entrar (o recomendado usa para as lâmpadas). */
export const isNearFull = (l: Lobby, st: LobbyState) => st.canJoin && freeSlots(l) > 0 && freeSlots(l) <= 2;

/** "Última vaga" quando falta 1; "Faltam N" acima disso. */
export const missingText = (free: number) => (free === 1 ? K.lastSlot : K.missing(free));

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
  if (free > 0 && free <= 2) return { text: missingText(free), tone: 'acc' };
  if (l.beginners) return { text: C.beginners, tone: 'plain' };
  return null;
}

export interface CardCorner {
  /** O canto direito do alto da arte, em caixa-alta discreta. */
  text: string;
  /** Latão só no "Você está aqui" e no "Entrando…". */
  accent: boolean;
  /** As vagas não couberam no canto (a etiqueta falou outra coisa): vão para o canhoto. */
  slotsNote: string | null;
}

/**
 * O canto do cartão: a etiqueta de estado ou, sem ela, as vagas ("Faltam N", "Última vaga").
 * Lotado fora de partida diz "Sem vaga" no canto, porque o canhoto já diz "Lotado".
 * Quando o canto fala de outra coisa (em partida, iniciantes, sua lista), as vagas que restam
 * vão para o canhoto, ao lado da região. Lobby com convite não anuncia vaga.
 */
export function cardCorner(l: Lobby, st: LobbyState, signedIn: boolean, now = Date.now()): CardCorner | null {
  const tag = cardTag(l, st, signedIn, now);
  const free = freeSlots(l);
  const slots = free > 0 && !l.locked ? missingText(free) : null;
  if (!tag) return slots ? { text: slots, accent: false, slotsNote: null } : null;
  const accent = tag.tone === 'acc' && (st.you || st.kind === 'joining');
  if (st.kind === 'full') return { text: K.noSlot, accent: false, slotsNote: null };
  const aboutSlots = tag.text === slots || st.you || st.kind === 'joining';
  return { text: tag.text, accent, slotsNote: aboutSlots ? null : slots };
}

/** Nos modos de time ("6 contra 6", "5v5"), o placar diz Âmbar × Safira. "1 contra 1" é duelo, não time. */
export function isTeamFormat(format: string | undefined): boolean {
  const m = /^(\d+)\s*(?:contra|v|vs\.?)\s*(\d+)$/i.exec(format?.trim() ?? '');
  return !!m && m[1] === m[2] && Number(m[1]) >= 2;
}

/**
 * No canhoto, no lugar do botão: lobby sem vaga e sem entrada no meio.
 * Em partida, a vaga abre no fim da rodada; fora dela, está lotado. Quem está dentro sempre tem ação.
 */
export function closedNote(l: Lobby, st: LobbyState): string | null {
  if (st.you || st.kind === 'joining' || freeSlots(l) > 0) return null;
  if (l.status === 'em-partida') return K.roundEnd;
  if (st.kind === 'full') return K.full;
  return null;
}
