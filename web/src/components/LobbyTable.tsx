import type { Lobby } from '../data/lobbies';
import { useFriends } from '../hooks';
import { t } from '../i18n';
import { useSession } from '../state/session';
import { LobbyCard, orderLobbies } from './LobbyCard';

interface LobbyTableProps {
  /** Já filtrados e ordenados (lib/lobbies.ts `filterLobbies`). */
  lobbies: Lobby[];
  /** O recomendado (`useFeaturedLobby`): sobe para o topo, depois dos seus. Nunca aparece duas vezes. */
  featured?: Lobby;
  now: number;
  label?: string;
  limit?: number;
}

/**
 * Compatibilidade: a página do modo (fase 2) ainda usa `LobbyTable`. Agora é a lista
 * compacta do v8, com os mesmos cartões da home.
 */
export function LobbyTable({ lobbies, featured, now, label = t.lobbies.tableLabel, limit }: LobbyTableProps) {
  const { lobbyCtx, user } = useSession();
  const friends = useFriends();
  const env = { ctx: lobbyCtx, signedIn: !!user, me: user?.name ?? t.lobbies.you, friends, now };
  const ordered = orderLobbies(lobbies, lobbyCtx, featured).slice(0, limit);
  return (
    <div className="lgrid list" role="list" aria-label={label}>
      {ordered.map((l) => (
        <div role="listitem" key={l.id} style={{ display: 'contents' }}>
          <LobbyCard lobby={l} env={env} featured={l.id === featured?.id} />
        </div>
      ))}
    </div>
  );
}
