import { useEffect, useState } from 'react';
import { liveBase } from '../../data/stats';
import { useLiveNumber } from '../../hooks';
import { formatNumber, t } from '../../i18n';
import { setSound, useSoundOn } from '../../lib/sound';
import { towerBus } from '../../lib/towerBus';
import { useSession } from '../../state/session';
import { Decode } from '../Decode';
import { LoadStatus } from './TowerStage';

/**
 * Camada técnica da home, em Martian Mono nos quatro cantos (método do igloo.inc,
 * com a nossa voz): em cima, marca + hora local e Steam + som; embaixo, gente agora
 * + lobbies e a cena atual com a posição da rolagem.
 */

function cityFromZone() {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
    const known: Record<string, string> = { 'America/Sao_Paulo': 'São Paulo', 'America/Bahia': 'Salvador', 'America/Belem': 'Belém', 'America/Maceio': 'Maceió', 'America/Cuiaba': 'Cuiabá' };
    return known[zone] ?? zone.split('/').pop()?.replace(/_/g, ' ') ?? '';
  } catch {
    return '';
  }
}

const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

export function HudClock() {
  const [now, setNow] = useState(() => new Date());
  const [city] = useState(cityFromZone);
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(id);
  }, []);
  const time = timeFmt.format(now);
  return (
    <p className="hud-clock" title={t.home.hud.clockLabel}>
      {city && <span className="hud-city">{city}, </span>}
      <Decode on="mount" delay={250} text={time} />
    </p>
  );
}

export function SoundToggle() {
  const on = useSoundOn();
  return (
    <button type="button" className="hud-sound" aria-pressed={on} title={t.home.hud.soundLabel} onClick={() => setSound(!on)}>
      <svg className="hud-sound-bars" viewBox="0 0 16 12" aria-hidden="true" focusable="false">
        {[2, 6, 10, 14].map((x, i) => (
          <line key={x} x1={x} x2={x} y1={on ? 2 + (i % 2) * 3 : 5.5} y2={on ? 10 - (i % 2) * 2 : 6.5} />
        ))}
      </svg>
      <span>{on ? t.home.hud.soundOn : t.home.hud.soundOff}</span>
    </button>
  );
}

export function HudBottom({ scene, total }: { scene: number; total: number }) {
  const { lobbies } = useSession();
  const players = useLiveNumber(liveBase.playersOnline, liveBase.playersJitter, liveBase.intervalMs);
  // O letreiro da cidade 3D mostra o mesmo número (cenário; o texto de verdade é este).
  useEffect(() => towerBus.set({ playersNow: players }), [players]);
  const open = lobbies.filter((l) => l.status !== 'cheio').length;
  const name = t.home.scenes[scene] ?? '';
  return (
    <div className="hud-bottom">
      <div className="hud-live">
        <LoadStatus />
        <p className="num">
          <span className="live-dot" aria-hidden="true" />
          {t.home.hud.players(formatNumber(players))}
        </p>
        <p className="num">{t.home.hud.lobbies(open)}</p>
      </div>
      <p className="hud-scene" aria-hidden="true">
        <Decode on="mount" replay text={t.home.sceneOf(scene + 1, total, name)} />
        <span className="hud-track">
          <span className="hud-track-fill" />
        </span>
      </p>
    </div>
  );
}
