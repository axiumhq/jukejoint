import type { CSSProperties } from 'react';
import type { Lobby } from '../data/lobbies';
import { t } from '../i18n';
import { pingQuality } from '../lib/lobbies';

export function SlotPips({ lobby }: { lobby: Lobby }) {
  const pips = Array.from({ length: lobby.slots }, (_, i) => {
    if (i < lobby.friends) return 'friend';
    if (i < lobby.players) return 'taken';
    return 'free';
  });
  return (
    <span className="slots" role="img" aria-label={t.lobbies.slots(lobby.players, lobby.slots, lobby.friends)}>
      <span className="pips" aria-hidden="true">
        {pips.map((kind, i) => (
          <span key={i} className={`pip pip-${kind}`} style={{ '--i': i } as CSSProperties} />
        ))}
      </span>
      <span className="slots-count num" aria-hidden="true">
        {lobby.players}/{lobby.slots}
      </span>
    </span>
  );
}

export function PingBars({ lobby }: { lobby: Lobby }) {
  const q = pingQuality(lobby.ping);
  return (
    <span className={`ping ping-q${q}`} role="img" aria-label={t.lobbies.pingLabel(t.regions[lobby.region], lobby.ping)}>
      <span className="region" aria-hidden="true">
        {t.regions[lobby.region]}
      </span>
      <span className="bars" aria-hidden="true">
        <span className={q >= 1 ? 'on' : ''} />
        <span className={q >= 2 ? 'on' : ''} />
        <span className={q >= 3 ? 'on' : ''} />
      </span>
      <span className="ms num" aria-hidden="true">
        {t.lobbies.ping(lobby.ping)}
      </span>
    </span>
  );
}

export function StatusBadge({ lobby }: { lobby: Lobby }) {
  return (
    <span className={`status status-${lobby.status}`}>
      <span className="status-dot" aria-hidden="true" />
      {t.lobbies.status[lobby.status]}
    </span>
  );
}
