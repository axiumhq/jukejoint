import { useState } from 'react';
import { Link } from 'react-router';
import type { Lobby } from '../data/lobbies';
import { useFriends } from '../hooks';
import { t } from '../i18n';
import type { FriendPresence } from '../lib/friends';
import { lobbyState } from '../lib/lobbies';
import { useSession } from '../state/session';

/**
 * O trilho de amigos (pesquisa de referências, padrão 3): só quem está online, cada um com
 * onde está e o próximo passo. Na lista: "Entrar" no lobby do amigo (ou bater na porta).
 * Na sala (`invite`): convidar quem ainda não está com você.
 */

function where(f: FriendPresence, lobby: Lobby | undefined, hereId: string | null) {
  if (!lobby) return t.friends.idle;
  if (lobby.id === hereId) return t.friends.withYou;
  return f.host ? t.friends.hosting(lobby.name) : t.friends.inLobby(lobby.name);
}

function JoinStep({ friend, lobby }: { friend: FriendPresence; lobby: Lobby | undefined }) {
  const { lobbyCtx, requestJoin, openKnock } = useSession();
  if (!lobby) return null;
  const st = lobbyState(lobby, lobbyCtx);
  if (st.action === 'join') {
    return (
      <button type="button" className="btn btn-line btn-sm fr-act" aria-label={t.friends.joinLabel(friend.name, lobby.name)} onClick={() => requestJoin({ kind: 'lobby', lobby })}>
        {t.friends.join}
      </button>
    );
  }
  if (st.action === 'knock') {
    return (
      <button type="button" className="btn btn-quiet btn-sm fr-act" onClick={() => openKnock(lobby)}>
        {t.friends.knock}
      </button>
    );
  }
  return st.label && !st.you ? <span className="fr-state">{st.label}</span> : null;
}

export function FriendsBlock({ mode = 'join', exclude }: { mode?: 'join' | 'invite'; exclude?: string }) {
  const { user, signIn, lobbies, hereId, pushToast } = useSession();
  const friends = useFriends();
  const [invited, setInvited] = useState<ReadonlySet<string>>(() => new Set());
  const list = mode === 'invite' ? friends.filter((f) => f.lobbyId !== exclude) : friends;
  const headId = mode === 'invite' ? 'fr-invite' : 'fr-title';

  return (
    <section className="rail-block fr" aria-labelledby={headId}>
      <header className="rail-head">
        <h3 id={headId}>{mode === 'invite' ? t.friends.inviteTitle : t.friends.title}</h3>
        {user && <span>{t.friends.online(friends.length)}</span>}
      </header>
      {!user ? (
        <div className="fr-out">
          <p>{t.friends.signedOut}</p>
          <button type="button" className="btn btn-line btn-sm" onClick={signIn}>
            {t.friends.signIn}
          </button>
        </div>
      ) : list.length === 0 ? (
        <p className="rail-empty">{t.friends.none}</p>
      ) : (
        <ul className="fr-list">
          {list.map((f) => {
            const lobby = f.lobbyId ? lobbies.find((l) => l.id === f.lobbyId) : undefined;
            const done = invited.has(f.name);
            return (
              <li key={f.name} className="fr-item">
                <span className="fr-name">{f.name}</span>
                <span className="fr-where">
                  {lobby && lobby.id !== hereId ? <Link to={`/sala/${encodeURIComponent(lobby.id)}`}>{where(f, lobby, hereId)}</Link> : where(f, lobby, hereId)}
                </span>
                {mode === 'invite' ? (
                  <button
                    type="button"
                    className="btn btn-quiet btn-sm fr-act"
                    disabled={done}
                    aria-label={t.friends.inviteLabel(f.name)}
                    onClick={() => {
                      setInvited((s) => new Set(s).add(f.name));
                      pushToast(t.friends.invitedToast(f.name));
                    }}
                  >
                    {done ? t.friends.invited : t.friends.invite}
                  </button>
                ) : (
                  <JoinStep friend={f} lobby={lobby} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
