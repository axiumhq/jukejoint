import { useCallback, useEffect, useState } from 'react';
import { createBlocked, LIST_TIMEOUT_MS, listStatus, type ListStatus } from '../lib/connection';
import { useSession } from '../state/session';

/**
 * O que a tela pode dizer sobre os lobbies ao vivo: `loading` (esqueleto, com prazo), `failed`
 * (sem conexão, ou a lista não chegou no prazo) ou `ok`. `retry` tenta conectar de novo e
 * recomeça o prazo. `createBlocked` vale enquanto o servidor não está online (só ao vivo).
 */
export function useServerStatus(timeoutMs = LIST_TIMEOUT_MS): { status: ListStatus; retry: () => void; createBlocked: boolean } {
  const { live, connection, synced, reconnect } = useSession();
  const [timedOut, setTimedOut] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const waiting = live && !synced;

  useEffect(() => {
    setTimedOut(false);
    if (!waiting) return;
    const id = window.setTimeout(() => setTimedOut(true), timeoutMs);
    return () => window.clearTimeout(id);
  }, [waiting, timeoutMs, attempt]);

  const retry = useCallback(() => {
    setAttempt((n) => n + 1);
    reconnect();
  }, [reconnect]);

  return { status: listStatus({ live, connection, synced, timedOut }), retry, createBlocked: createBlocked({ live, connection }) };
}

/** Só a regra de "Criar lobby" (sem prazo nem timer): bloqueado enquanto o servidor não está online. */
export function useCreateBlocked(): boolean {
  const { live, connection } = useSession();
  return createBlocked({ live, connection });
}
