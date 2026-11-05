import type { ConnectionState } from '../state/sessionContext';

/**
 * O que a tela pode afirmar sobre a lista de lobbies, dado o estado da conexão.
 * Só o modo ao vivo falha: o simulado ('mock') está sempre "ok".
 * - `ok`: a lista chegou (ou é simulada); vazio quer dizer vazio de verdade.
 * - `loading`: ainda esperando a primeira lista, dentro do prazo.
 * - `failed`: sem conexão, ou a lista não chegou no prazo. Nada de "nenhum lobby".
 */
export type ListStatus = 'ok' | 'loading' | 'failed';

/** Quanto tempo o esqueleto espera a primeira lista antes de virar falha. */
export const LIST_TIMEOUT_MS = 8000;
/** Quanto tempo a sala espera antes de virar falha. */
export const ROOM_TIMEOUT_MS = 8000;

export function listStatus(o: { live: boolean; connection: ConnectionState; synced: boolean; timedOut: boolean }): ListStatus {
  if (!o.live || o.synced) return 'ok'; // já temos uma lista (a faixa de reconexão avisa o resto)
  if (o.connection === 'offline') return 'failed';
  return o.timedOut ? 'failed' : 'loading';
}

/** Criar lobby precisa do servidor: bloqueado enquanto o modo ao vivo não está online. */
export function createBlocked(o: { live: boolean; connection: ConnectionState }): boolean {
  return o.live && o.connection !== 'online';
}
