import type { Lobby } from '../data/lobbies';
import { t } from '../i18n';
import { lobbyState, notifyKey, type LobbyState } from '../lib/lobbies';
import { useSession } from '../state/session';
import { Icon } from './Icon';

interface LobbyActionProps {
  lobby: Lobby;
  /** id do elemento com o nome do lobby, para descrever os botões. */
  describedBy?: string;
  /** O lobby recomendado ganha o único botão cheio da tabela. */
  primary?: boolean;
  /** Estado já calculado (evita recalcular quando a linha já tem). */
  state?: LobbyState;
}

/**
 * A ação de um lobby, saída direto da tabela de estados (lib/lobbies.ts `lobbyState`):
 * Entrar, Entrar no meio, Convidar (seu, com Fechar ao lado), Sair, Bater na porta,
 * Pedido enviado, Avisar quando vagar ou quando acabar. Um botão por linha; a largura é fixa no CSS.
 */
export function LobbyAction({ lobby, describedBy, primary = false, state: given }: LobbyActionProps) {
  const { requestJoin, joiningStep, toggleNotify, lobbyCtx, leaveLobby, closeLobby, inviteTo, openKnock } = useSession();
  const st = given ?? lobbyState(lobby, lobbyCtx);
  const join = primary ? 'btn btn-primary' : 'btn btn-line';

  switch (st.action) {
    case 'joining':
      return (
        <button type="button" className={`${join} btn-act is-busy`} disabled aria-live="polite">
          {t.lobbies.joinSteps[joiningStep] ?? t.lobbies.joinSteps[0]}
        </button>
      );
    case 'join':
      return (
        <button
          type="button"
          className={`${join} btn-act`}
          aria-label={st.kind === 'playing-open' ? `${st.verb}: ${lobby.name}` : t.lobbies.joinLabel(lobby.name)}
          onClick={() => requestJoin({ kind: 'lobby', lobby })}
        >
          {st.verb}
        </button>
      );
    case 'invite':
      return (
        <span className="btn-pair">
          <button type="button" className="btn btn-line btn-act" aria-label={t.lobbies.inviteLabel(lobby.name)} onClick={() => inviteTo(lobby)}>
            {st.verb}
          </button>
          <button type="button" className="btn btn-quiet btn-square" aria-label={t.lobbies.closeLabel(lobby.name)} onClick={() => closeLobby(lobby.id)}>
            <Icon name="close" size={14} />
          </button>
        </span>
      );
    case 'leave':
      return (
        <button type="button" className="btn btn-quiet btn-act" aria-label={t.lobbies.leaveLabel(lobby.name)} onClick={leaveLobby}>
          {st.verb}
        </button>
      );
    case 'knock':
      return (
        <button type="button" className="btn btn-line btn-act" aria-label={t.lobbies.knockLabel(lobby.name)} onClick={() => openKnock(lobby)}>
          {st.verb}
        </button>
      );
    case 'knock-pending':
      return (
        <button type="button" className="btn btn-quiet btn-act" aria-disabled="true" aria-describedby={describedBy}>
          {st.verb}
        </button>
      );
    case 'notify-slot':
    case 'notify-end': {
      const toast = st.action === 'notify-end' ? t.lobbies.notifyEndToast(lobby.name) : t.lobbies.notifyToast(lobby.name);
      return (
        <button
          type="button"
          className="btn btn-quiet btn-act"
          aria-pressed={st.notifyOn}
          aria-label={`${st.notifyOn ? st.verb : st.action === 'notify-end' ? t.lobbyState.notifyEnd : t.lobbyState.notifySlot}: ${lobby.name}`}
          onClick={() => toggleNotify(notifyKey(lobby), toast)}
        >
          {st.notifyOn && <Icon name="check" size={14} />}
          {st.verb}
        </button>
      );
    }
  }
}
