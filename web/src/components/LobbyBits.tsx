import type { CSSProperties } from 'react';
import type { Lobby } from '../data/lobbies';
import { t } from '../i18n';
import { belowQuorum, heatLevel, pingQuality, type Activity, type Heat, type LobbyState } from '../lib/lobbies';
import './lobbyStyles';

interface SlotPipsProps {
  lobby: Lobby;
  /** Uma das janelas acesas é você (moldura na sua janela). */
  you?: boolean;
  heat?: Heat | null;
  /** Chave do evento de entrada mais recente: muda, a janela nova pisca uma vez. */
  flashKey?: number;
  size?: 'md' | 'lg';
  /** Esconde o "9/12" (quando o número aparece em outro lugar, maior). */
  hideCount?: boolean;
}

/**
 * Vagas: cada vaga é uma janela. Acesa (latão) = jogador, verde = amigo, apagada = livre.
 * Abaixo do quórum as janelas acesas ficam VAZADAS (só o contorno) e um marco separa o mínimo:
 * a sala ainda não "acendeu". O calor aparece como mais luz nas janelas, nunca como cor de modo.
 */
export function SlotPips({ lobby, you = false, heat = null, flashKey, size = 'md', hideCount = false }: SlotPipsProps) {
  const hollow = belowQuorum(lobby);
  const youAt = you ? lobby.players - 1 : -1;
  const newAt = flashKey !== undefined ? lobby.players - 1 : -1;
  const pips = Array.from({ length: lobby.slots }, (_, i) => {
    if (i < lobby.friends) return 'friend';
    if (i < lobby.players) return 'taken';
    return 'free';
  });
  const label =
    t.lobbies.slots(lobby.players, lobby.slots, lobby.friends) + (hollow ? `. ${t.lobbyState.quorum(lobby.minPlayers, lobby.minPlayers - lobby.players)}` : '');
  return (
    <span className={`slots slots-${size}`} role="img" aria-label={label}>
      <span className={`pips${hollow ? ' is-hollow' : ''}`} data-heat={heatLevel(heat)} aria-hidden="true">
        {pips.map((kind, i) => (
          <span
            key={i === newAt ? `${i}-${flashKey}` : i}
            className={`pip pip-${kind}${i === youAt ? ' pip-you' : ''}${i === newAt ? ' is-new' : ''}${hollow && i === lobby.minPlayers - 1 ? ' is-quorum' : ''}`}
            style={{ '--i': i } as CSSProperties}
          />
        ))}
      </span>
      {!hideCount && (
        <span className="slots-count num" aria-hidden="true">
          {lobby.players}/{lobby.slots}
        </span>
      )}
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

/** Compatibilidade (quadro de andares da cidade). A lista nova usa `StateLabel`. */
export function StatusBadge({ lobby }: { lobby: Lobby }) {
  return (
    <span className={`status status-${lobby.status}`}>
      <span className="status-dot" aria-hidden="true" />
      {t.lobbies.status[lobby.status]}
    </span>
  );
}

/**
 * Rótulo da linha: o estado quando há exceção (Lotado, Em partida, Com convite, Você está aqui),
 * senão o calor. No estado normal sem calor, nada: aberto não grita.
 */
export function StateLabel({ state, heat }: { state: LobbyState; heat: Heat | null }) {
  // Na linha, a versão curta: o detalhe da rodada vai na linha ao vivo.
  const text = state.kind === 'playing-open' || state.kind === 'playing-closed' ? state.stamp : state.label;
  if (text) {
    return <span className={`lb-state lb-state-${state.kind}`}>{text}</span>;
  }
  if (heat) return <span className={`lb-heat lb-heat-${heat}`}>{t.heat[heat]}</span>;
  return null;
}

/** Linha de atividade em mono: "Ametista entrou agora", "aberto há 3 min". Amigo em verdete. */
export function ActivityLine({ activity, className }: { activity: Activity; className?: string }) {
  const cls = `lb-activity${activity.fresh ? ' is-fresh' : ''}${className ? ` ${className}` : ''}`;
  if (activity.name && activity.text.startsWith(activity.name)) {
    return (
      <span className={cls}>
        <span className={activity.friend ? 'lb-who is-friend' : 'lb-who'}>{activity.name}</span>
        {activity.text.slice(activity.name.length)}
      </span>
    );
  }
  return <span className={cls}>{activity.text}</span>;
}
