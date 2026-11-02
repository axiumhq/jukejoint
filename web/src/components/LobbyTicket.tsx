import type { Lobby } from '../data/lobbies';
import { t } from '../i18n';
import { useSession } from '../state/session';
import { Icon } from './Icon';
import { LobbyAction } from './LobbyAction';
import { ActivityLine, PingBars, SlotPips } from './LobbyBits';
import { lobbyView } from './LobbyRow';
import { ModeSeal, modeHue } from './ModeSeal';

/**
 * Vista rica: o lobby como ingresso. À esquerda o ingresso (selo, nome grande, anfitrião,
 * sinal ao vivo); um picote; à direita o canhoto (janelas grandes, contagem, ação).
 * Estados viram carimbo de texto: LOTADO, COM CONVITE, EM PARTIDA, VOCÊ ESTÁ AQUI.
 * Um ornamento só (o picote). Nada de código de barras nem número de série.
 */
export function LobbyTicket({ lobby, now = Date.now() }: { lobby: Lobby; now?: number }) {
  const { lobbyCtx } = useSession();
  const v = lobbyView(lobby, lobbyCtx, now);
  const titleId = `ticket-${lobby.id}`;
  const st = v.state;
  const dim = st.kind === 'full' || st.kind === 'playing-closed';
  const countNote = v.quorum ?? (st.canJoin && v.free > 0 && v.free <= 2 ? t.lobbies.almostFull(v.free) : null);

  return (
    <li
      className={`lb-ticket has-mode${st.you ? ' is-you' : ''}${dim ? ' is-dim' : ''}${v.activity.fresh ? ' is-fresh' : ''}`}
      style={modeHue(v.mode)}
      data-kind={st.kind}
    >
      <div className="tk-body">
        <ModeSeal mode={lobby.modeSlug} size="md" state={v.seal} link className="tk-seal" />
        <div className="tk-copy">
          <p className="tk-mode">
            {v.mode?.name}
            <span className="tk-sep" aria-hidden="true" />
            <PingBars lobby={lobby} />
          </p>
          <h3 className="tk-name" id={titleId}>
            {lobby.name}
            {lobby.locked && <Icon name="lock" size={15} className="lb-lock" label={t.lobbies.locked} />}
          </h3>
          <p className="tk-host">
            <span className="sr-only">{t.lobbies.host}: </span>
            {t.lobbies.hostBy(lobby.host)}
            {lobby.mine && <span className="tag tag-quiet">{t.lobbies.you}</span>}
            {lobby.hostIsFriend && <span className="tag tag-friend">{t.lobbies.friendTag}</span>}
            {lobby.friends > 0 && !lobby.locked && <span className="friends-in">{t.lobbies.friendsIn(lobby.friends)}</span>}
          </p>
          <p className="tk-live">
            {v.heat && <span className={`lb-heat lb-heat-${v.heat}`}>{t.heat[v.heat]}</span>}
            <ActivityLine activity={v.activity} />
          </p>
        </div>
      </div>
      <div className="tk-stub">
        {st.stamp && (
          <p className={`tk-stamp tk-stamp-${st.kind}`}>
            <span>{st.stamp}</span>
          </p>
        )}
        <div className="tk-count">
          <span className="tk-num num" aria-hidden="true">
            {lobby.players}
            <span className="tk-of">/{lobby.slots}</span>
          </span>
          {countNote && <span className="tk-note">{countNote}</span>}
        </div>
        <SlotPips lobby={lobby} you={st.you} heat={v.heat} flashKey={v.flashKey} size="lg" hideCount />
        <div className="tk-action">
          <LobbyAction lobby={lobby} state={st} describedBy={titleId} className={st.kind === 'invited' ? 'btn-primary' : 'btn-outline'} />
        </div>
      </div>
    </li>
  );
}
