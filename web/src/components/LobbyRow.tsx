import type { Lobby } from '../data/lobbies';
import { getMode } from '../data/modes';
import { t } from '../i18n';
import { activity, freeSlots, heat, lobbyState, quorumText, type LobbyContext } from '../lib/lobbies';
import { useSession } from '../state/session';
import { Icon } from './Icon';
import { LobbyAction } from './LobbyAction';
import { ActivityLine, PingBars, SlotPips, StateLabel } from './LobbyBits';
import { ModeSeal, modeHue, type SealState } from './ModeSeal';

/** Tudo o que uma apresentação de lobby precisa saber, calculado num lugar só. */
export function lobbyView(lobby: Lobby, ctx: LobbyContext, now: number) {
  const mode = getMode(lobby.modeSlug);
  const state = lobbyState(lobby, ctx, now);
  const h = heat(lobby, now);
  const act = activity(lobby, state, now);
  const last = lobby.joins.at(-1);
  const seal: SealState =
    state.kind === 'full' ? 'full' : lobby.status === 'em-partida' ? 'playing' : lobby.locked ? 'locked' : null;
  return {
    mode,
    state,
    heat: h,
    activity: act,
    quorum: quorumText(lobby),
    seal,
    /** Chave para piscar a janela nova (só quando o evento é fresco). */
    flashKey: act.fresh && last ? last.at : undefined,
    free: freeSlots(lobby),
  };
}

interface LobbyRowProps {
  lobby: Lobby;
  /** Relógio compartilhado da lista (useNow). */
  now?: number;
  /** Compatibilidade com a home v3: mesma linha compacta. */
  mini?: boolean;
  /** Prévia no diálogo de criar: sem link nem ação clicável. */
  preview?: boolean;
  /** Nível do título do lobby (a lista tem h2 de seção). */
  headingLevel?: 3 | 4;
}

/**
 * Vista compacta: uma linha de 56 px. Friso do modo, selo, nome com a linha ao vivo,
 * estado ou calor, janelas, ping e uma coluna de ação de largura fixa.
 */
export function LobbyRow({ lobby, now = Date.now(), mini = false, preview = false, headingLevel = 3 }: LobbyRowProps) {
  const { lobbyCtx } = useSession();
  const v = lobbyView(lobby, preview ? {} : lobbyCtx, now);
  const titleId = `lobby-${lobby.id}${preview ? '-preview' : ''}`;
  const H = headingLevel === 4 ? 'h4' : 'h3';
  const dim = v.state.kind === 'full' || v.state.kind === 'playing-closed';

  return (
    <li
      className={`lb-row has-mode${v.state.you ? ' is-you' : ''}${dim ? ' is-dim' : ''}${v.activity.fresh ? ' is-fresh' : ''}${mini ? ' is-mini' : ''}`}
      style={modeHue(v.mode)}
      data-kind={v.state.kind}
    >
      <ModeSeal mode={lobby.modeSlug} size="md" state={v.seal} link={!preview} className="lb-seal" />
      <div className="lb-main">
        <H className="lb-name" id={titleId}>
          <span className="lb-name-text">{lobby.name}</span>
          {lobby.locked && <Icon name="lock" size={13} className="lb-lock" label={t.lobbies.locked} />}
        </H>
        <p className="lb-sub">
          <span className="lb-mode-name">{v.mode?.name}</span>
          <ActivityLine activity={v.activity} />
        </p>
      </div>
      {/* Grupo só para o celular (uma linha, o que não couber some); no desktop é `display: contents`. */}
      <div className="lb-meta">
        <div className="lb-signal">
          <StateLabel state={v.state} heat={v.heat} />
          {v.quorum && !v.state.label && !v.heat && <span className="lb-quorum">{t.lobbyState.quorumShort(lobby.minPlayers)}</span>}
        </div>
        <div className="lb-slots">
          <SlotPips lobby={lobby} you={v.state.you} heat={v.heat} flashKey={v.flashKey} />
        </div>
        <div className="lb-ping">
          <PingBars lobby={lobby} />
        </div>
      </div>
      <div className="lb-action">
        {preview ? (
          <span className="btn btn-outline btn-sm btn-join is-inert" aria-hidden="true">
            {v.state.verb}
          </span>
        ) : (
          <LobbyAction lobby={lobby} state={v.state} describedBy={titleId} size="sm" />
        )}
      </div>
    </li>
  );
}
