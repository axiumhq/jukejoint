import type { LobbyView } from './api';
import type { SessionEvent, SessionInfo } from './desktop';

/*
 * A partida de verdade (ao vivo, dentro do app): regras puras que o state/engineHandoff.ts segue.
 * Quem hospeda chama `engine_host` com o modo do lobby e manda o código (`set_join_code`); quem entra
 * espera o código na visão do lobby e chama `engine_join`. Cada um manda a própria etapa
 * (`handoff_progress`), que só anda para frente.
 */

/** Etapa "dentro" (o índice depois das três do handoff: baixando o modo, abrindo o jogo, entrando). */
export const INSIDE_STEP = 3;

/** A partida desta sala (o servidor muda `startedAt` a cada partida). `null` fora de partida. */
export function matchKey(v: LobbyView | undefined): string | null {
  if (!v || (v.phase !== 'handoff' && v.phase !== 'playing')) return null;
  return `${v.id}:${v.startedAt ?? 0}`;
}

/** A sua etapa como o servidor guardou (o que o seu app já mandou nesta partida). */
export function seatStep(v: LobbyView | undefined, meId: string | null): number | null {
  if (!v || !meId) return null;
  const s = v.seats?.find((x) => x.userId === meId)?.step;
  return typeof s === 'number' ? s : null;
}

/** A etapa que a tela mostra para você: a mais adiantada entre o app e o servidor, começando em 0. */
export function myStep(local: number | null, server: number | null): number {
  return Math.max(0, local ?? 0, server ?? 0);
}

/** O que fazer com uma sessão que o app já tinha (página recarregada no meio da partida). */
export function adoptable(s: SessionInfo | null, role: 'host' | 'member', code: string | null): boolean {
  if (!s?.running) return false;
  if (role === 'host') return s.kind === 'host';
  return s.kind === 'join' && !!code && s.target === code;
}

/** O código de entrada que um evento `hosting` trouxe. */
export function hostingCode(e: SessionEvent): string | null {
  if (e.event?.kind !== 'hosting') return null;
  const c = e.event.joinCode;
  return typeof c === 'string' && c ? c : null;
}

/** A sessão que o site está acompanhando. `id` só se sabe quando o comando responde; `after` é o id da anterior. */
export interface Tracked {
  id: number | null;
  kind: SessionEvent['kind'];
  after: number;
}

/**
 * Os eventos de outra sessão (uma anterior que ainda fecha) não contam. Antes de o comando responder
 * o id ainda não é conhecido; os ids do app só crescem, então vale o primeiro depois do anterior.
 */
export function belongsTo(e: SessionEvent, current: Tracked | null): boolean {
  if (!current || e.kind !== current.kind) return false;
  return current.id === null ? e.session > current.after : e.session === current.id;
}
