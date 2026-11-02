import { useEffect, useState } from 'react';
import type { Lobby } from '../data/lobbies';
import { lobbyState, pickBestLobby } from '../lib/lobbies';
import { useSession } from '../state/session';

/**
 * O lobby em destaque ("Em cartaz agora" da v4, agora a primeira linha da tabela).
 * É exatamente o que `pickBestLobby()` escolhe, o mesmo do "Jogar agora". Fica no mesmo lobby
 * enquanto der para entrar (a linha não pula a cada tique do ao vivo); quando ele lota ou começa,
 * troca pelo próximo. Depois que você entra, ele vira "Você está aqui" no topo e o próximo recomendado
 * assume a linha destacada (o mesmo que o "Jogar agora" escolheria agora).
 */
export function useFeaturedLobby(pool: Lobby[], mode: string | undefined, now: number): Lobby | undefined {
  const { lobbyCtx } = useSession();
  const [heldId, setHeldId] = useState<string | null>(null);
  const held = heldId ? pool.find((l) => l.id === heldId) : undefined;
  const heldSt = held ? lobbyState(held, lobbyCtx, now) : null;
  const keep = !!held && !!heldSt && (heldSt.canJoin || heldSt.kind === 'joining') && (!mode || held.modeSlug === mode);
  const lobby = keep ? held : pickBestLobby(pool, { mode, ctx: lobbyCtx, now });

  useEffect(() => {
    const next = lobby?.id ?? null;
    if (next !== heldId) setHeldId(next);
  }, [lobby?.id, heldId]);

  return lobby;
}
