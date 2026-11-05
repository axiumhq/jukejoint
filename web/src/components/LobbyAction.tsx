import { Link } from 'react-router';
import type { Lobby } from '../data/lobbies';
import { t } from '../i18n';
import { lobbyState, notifyKey, type LobbyState } from '../lib/lobbies';
import { useSession } from '../state/session';
import { Icon } from './Icon';

interface LobbyActionProps {
  lobby: Lobby;
  /** id do elemento com o nome do lobby, para descrever os botões. */
  describedBy?: string;
  /** O lobby recomendado ganha o único botão cheio da lista. */
  primary?: boolean;
  /** Estado já calculado (evita recalcular quando a linha já tem). */
  state?: LobbyState;
  /** Cartão v8: botão pequeno, com ícone, e o "Entrar" que vira acento no hover do cartão. */
  compact?: boolean;
}

/**
 * A ação de um lobby, saída direto da tabela de estados (lib/lobbies.ts `lobbyState`):
 * Entrar, Entrar no meio, Abrir a sala (onde você está, com Sair ou Fechar discreto ao lado),
 * Bater na porta, Pedido enviado, Avisar quando vagar ou quando acabar. Uma ação principal por cartão.
 */
export function LobbyAction({ lobby, describedBy, primary = false, state: given, compact = false }: LobbyActionProps) {
  const { requestJoin, joiningStep, toggleNotify, lobbyCtx, leaveLobby, closeLobby, openKnock } = useSession();
  const st = given ?? lobbyState(lobby, lobbyCtx);
  const sm = compact ? ' btn-sm' : '';
  const join = primary ? `btn btn-p${sm}` : `btn btn-s${sm}${compact ? ' go' : ''}`;
  const quiet = `btn btn-s${sm}`;
  const ico = (name: Parameters<typeof Icon>[0]['name']) => (compact ? <Icon name={name} /> : null);

  switch (st.action) {
    case 'joining':
      return (
        <button type="button" className={`${join} btn-act is-busy`} aria-disabled="true" aria-live="polite">
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
          {st.kind === 'playing-open' && ico('enterMid')}
          {st.verb}
        </button>
      );
    case 'open':
      // Você já está aqui: a ação é ir para a sala. Sair (ou Fechar, no seu) fica ao lado, discreto.
      return (
        <span className="btn-pair">
          {st.secondary === 'leave' && (
            <button type="button" className={`btn btn-g${sm}`} aria-label={t.lobbies.leaveLabel(lobby.name)} onClick={leaveLobby}>
              {t.lobbyState.leave}
            </button>
          )}
          {st.secondary === 'close' && (
            <button type="button" className={`btn btn-g${sm} btn-square`} aria-label={t.lobbies.closeLabel(lobby.name)} onClick={() => closeLobby(lobby.id)}>
              <Icon name="x" size={14} />
            </button>
          )}
          <Link to={`/sala/${encodeURIComponent(lobby.id)}`} className={`${join} btn-act`} aria-label={t.lobbies.openLabel(lobby.name)}>
            {st.verb}
          </Link>
        </span>
      );
    case 'knock':
      return (
        <button type="button" className={`${quiet} btn-act`} aria-label={t.lobbies.knockLabel(lobby.name)} onClick={() => openKnock(lobby)}>
          {ico('knock')}
          {st.verb}
        </button>
      );
    case 'knock-pending':
      return (
        <button type="button" className={`${quiet} btn-act`} aria-disabled="true" aria-describedby={describedBy}>
          {ico('check')}
          {st.verb}
        </button>
      );
    case 'notify-slot':
    case 'notify-end': {
      const toast = st.action === 'notify-end' ? t.lobbies.notifyEndToast(lobby.name) : t.lobbies.notifyToast(lobby.name);
      return (
        <button
          type="button"
          className={`${quiet} btn-act`}
          aria-pressed={st.notifyOn}
          aria-label={`${st.notifyOn ? st.verb : st.action === 'notify-end' ? t.lobbyState.notifyEnd : t.lobbyState.notifySlot}: ${lobby.name}`}
          onClick={() => toggleNotify(notifyKey(lobby), toast)}
        >
          {st.notifyOn ? <Icon name="check" size={compact ? undefined : 14} /> : ico('bell')}
          {st.verb}
        </button>
      );
    }
  }
}
