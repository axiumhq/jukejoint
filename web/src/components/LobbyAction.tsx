import { forwardRef } from 'react';
import type { Lobby } from '../data/lobbies';
import { t } from '../i18n';
import { freeSlots, isJoinable } from '../lib/lobbies';
import { useSession } from '../state/session';
import { Icon } from './Icon';

interface LobbyActionProps {
  lobby: Lobby;
  /** id do elemento com o nome do lobby, para descrever o botão de aviso. */
  describedBy?: string;
  className?: string;
}

/**
 * A ação de um lobby: Entrar quando dá, etapas de entrada enquanto conecta,
 * e "Avisar quando vagar / acabar" quando não dá. Usada na lista e no quadro de andares.
 */
export const LobbyAction = forwardRef<HTMLButtonElement, LobbyActionProps>(function LobbyAction(
  { lobby, describedBy, className = 'btn-outline' },
  ref,
) {
  const { requestJoin, joiningId, joiningStep, notify, toggleNotify } = useSession();
  const joining = joiningId === lobby.id;
  const notifyOn = notify.has(lobby.id);

  if (joining) {
    return (
      <button ref={ref} type="button" className={`btn ${className} btn-join`} disabled aria-live="polite">
        {t.lobbies.joinSteps[joiningStep] ?? t.lobbies.joinSteps[0]}
      </button>
    );
  }

  if (isJoinable(lobby)) {
    return (
      <button
        ref={ref}
        type="button"
        className={`btn ${className} btn-join`}
        aria-label={t.lobbies.joinLabel(lobby.name)}
        onClick={() => requestJoin({ kind: 'lobby', lobby })}
      >
        {t.lobbies.join}
      </button>
    );
  }

  const label = lobby.status === 'em-partida' ? t.lobbies.notifyEnd : t.lobbies.notifySlot;
  return (
    <button
      ref={ref}
      type="button"
      className="btn btn-quiet btn-join"
      aria-pressed={notifyOn}
      aria-describedby={describedBy}
      onClick={() => toggleNotify(lobby.id, t.lobbies.notifyToast(lobby.name))}
    >
      <Icon name={notifyOn ? 'check' : 'bell'} size={16} />
      {notifyOn ? t.lobbies.notifyOn : label}
    </button>
  );
});

/** "Falta 1" / "Faltam 2": só com até 2 vagas livres num lobby em que dá para entrar. */
export function AlmostFull({ lobby }: { lobby: Lobby }) {
  const free = freeSlots(lobby);
  if (!isJoinable(lobby) || free > 2 || free < 1) return null;
  return <span className="almost-full">{t.lobbies.almostFull(free)}</span>;
}
