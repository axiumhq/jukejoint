import { forwardRef } from 'react';
import type { Lobby } from '../data/lobbies';
import { t } from '../i18n';
import { freeSlots, isJoinable, lobbyState, notifyKey, type LobbyState } from '../lib/lobbies';
import { useSession } from '../state/session';
import { Icon } from './Icon';

interface LobbyActionProps {
  lobby: Lobby;
  /** id do elemento com o nome do lobby, para descrever os botões. */
  describedBy?: string;
  /** Estilo do botão de entrar (lista: contorno; destaque: cheio). */
  className?: string;
  /** Estado já calculado (evita recalcular quando a linha já tem). */
  state?: LobbyState;
  size?: 'sm' | 'md';
}

/**
 * A ação de um lobby, saída direto da tabela de estados (lib/lobbies.ts `lobbyState`):
 * Entrar · Entrar no meio · Convidar + Fechar (seu) · Sair (já entrou) · Bater na porta (com convite)
 * · Pedido enviado · Avisar quando vagar / acabar. A largura da coluna é fixa no CSS.
 * Usada na lista, no ingresso, no destaque e no quadro de andares da cidade.
 */
export const LobbyAction = forwardRef<HTMLButtonElement, LobbyActionProps>(function LobbyAction(
  { lobby, describedBy, className = 'btn-outline', state: given, size = 'md' },
  ref,
) {
  const { requestJoin, joiningStep, toggleNotify, lobbyCtx, leaveLobby, closeLobby, inviteTo, openKnock } = useSession();
  const st = given ?? lobbyState(lobby, lobbyCtx);
  const sz = size === 'sm' ? ' btn-sm' : '';

  switch (st.action) {
    case 'joining':
      return (
        <button ref={ref} type="button" className={`btn ${className}${sz} btn-join`} disabled aria-live="polite">
          {t.lobbies.joinSteps[joiningStep] ?? t.lobbies.joinSteps[0]}
        </button>
      );
    case 'join':
      return (
        <button
          ref={ref}
          type="button"
          className={`btn ${className}${sz} btn-join`}
          aria-label={st.kind === 'playing-open' ? `${st.verb}: ${lobby.name}` : t.lobbies.joinLabel(lobby.name)}
          onClick={() => requestJoin({ kind: 'lobby', lobby })}
        >
          {st.kind === 'playing-open' ? (
            <>
              <span className="verb-long">{st.verb}</span>
              <span className="verb-short" aria-hidden="true">
                {t.lobbyState.join}
              </span>
            </>
          ) : (
            st.verb
          )}
        </button>
      );
    case 'invite':
      return (
        <span className="btn-pair">
          <button ref={ref} type="button" className={`btn btn-outline${sz} btn-join`} aria-label={t.lobbies.inviteLabel(lobby.name)} onClick={() => inviteTo(lobby)}>
            <Icon name="copy" size={16} />
            {st.verb}
          </button>
          <button type="button" className={`btn btn-quiet${sz} btn-square`} aria-label={t.lobbies.closeLabel(lobby.name)} onClick={() => closeLobby(lobby.id)}>
            <Icon name="close" size={16} />
          </button>
        </span>
      );
    case 'leave':
      return (
        <button ref={ref} type="button" className={`btn btn-ghost${sz} btn-join`} aria-label={t.lobbies.leaveLabel(lobby.name)} onClick={leaveLobby}>
          {st.verb}
        </button>
      );
    case 'knock':
      return (
        <button ref={ref} type="button" className={`btn btn-outline${sz} btn-join`} aria-label={t.lobbies.knockLabel(lobby.name)} onClick={() => openKnock(lobby)}>
          <Icon name="door" size={16} />
          {st.verb}
        </button>
      );
    case 'knock-pending':
      return (
        <button ref={ref} type="button" className={`btn btn-quiet${sz} btn-join is-waiting`} aria-disabled="true" aria-describedby={describedBy}>
          <span className="knock-dots" aria-hidden="true" />
          {st.verb}
        </button>
      );
    case 'notify-slot':
    case 'notify-end': {
      const toast = st.action === 'notify-end' ? t.lobbies.notifyEndToast(lobby.name) : t.lobbies.notifyToast(lobby.name);
      return (
        <button
          ref={ref}
          type="button"
          className={`btn btn-quiet${sz} btn-join`}
          aria-pressed={st.notifyOn}
          aria-label={`${st.notifyOn ? st.verb : st.action === 'notify-end' ? t.lobbyState.notifyEnd : t.lobbyState.notifySlot}: ${lobby.name}`}
          onClick={() => toggleNotify(notifyKey(lobby), toast)}
        >
          <Icon name={st.notifyOn ? 'check' : 'bell'} size={16} />
          <span className="verb-long">{st.verb}</span>
          <span className="verb-short" aria-hidden="true">
            {st.notifyOn ? st.verb : t.lobbyState.notifyShort}
          </span>
        </button>
      );
    }
  }
});

/** "Falta 1" / "Faltam 2": só com até 2 vagas livres num lobby em que dá para entrar. */
export function AlmostFull({ lobby }: { lobby: Lobby }) {
  const free = freeSlots(lobby);
  if (!isJoinable(lobby) || free > 2 || free < 1) return null;
  return <span className="almost-full">{t.lobbies.almostFull(free)}</span>;
}
