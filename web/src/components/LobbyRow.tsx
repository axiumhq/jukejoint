import { Link } from 'react-router';
import type { Lobby } from '../data/lobbies';
import { getMode } from '../data/modes';
import { t } from '../i18n';
import { Icon } from './Icon';
import { AlmostFull, LobbyAction } from './LobbyAction';
import { PingBars, SlotPips, StatusBadge } from './LobbyBits';

interface LobbyRowProps {
  lobby: Lobby;
  /** Versão enxuta para a home: sem anfitrião nem status. */
  mini?: boolean;
}

export function LobbyRow({ lobby, mini = false }: LobbyRowProps) {
  const mode = getMode(lobby.modeSlug);
  const titleId = `lobby-${lobby.id}`;

  return (
    <li className={`lobby-row${mini ? ' is-mini' : ''}${lobby.mine ? ' is-mine' : ''}`}>
      <div className="lobby-main">
        {mode && (
          <Link to={`/modos/${mode.slug}`} className="lobby-mode">
            {mode.name}
          </Link>
        )}
        <h3 className="lobby-name" id={titleId}>
          {lobby.name}
          {lobby.locked && <Icon name="lock" size={15} className="lobby-lock" label={t.lobbies.locked} />}
        </h3>
        {!mini && (
          <p className="lobby-host">
            <span className="sr-only">{t.lobbies.host}: </span>
            <span className="avatar" aria-hidden="true">
              {lobby.host.slice(0, 1).toUpperCase()}
            </span>
            {lobby.host}
            {lobby.mine && <span className="tag tag-quiet">{t.lobbies.you}</span>}
            {lobby.hostIsFriend && <span className="tag tag-friend">{t.lobbies.friendTag}</span>}
          </p>
        )}
      </div>
      <div className="lobby-ping">
        <PingBars lobby={lobby} />
      </div>
      <div className="lobby-slots">
        <SlotPips lobby={lobby} />
        <AlmostFull lobby={lobby} />
        {lobby.friends > 0 && <span className="friends-in">{t.lobbies.friendsIn(lobby.friends)}</span>}
      </div>
      {!mini && (
        <div className="lobby-status">
          <StatusBadge lobby={lobby} />
          {lobby.status === 'em-partida' && lobby.joinInProgress && <span className="status-note">{t.lobbies.joinInProgress}</span>}
        </div>
      )}
      <div className="lobby-action">
        <LobbyAction lobby={lobby} describedBy={titleId} />
      </div>
    </li>
  );
}
