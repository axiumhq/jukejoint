import { useEffect, useRef, useState, type ComponentType } from 'react';
import { t } from '../../i18n';
import { floorLabels, floorMarks, towerBus, useTower } from '../../lib/towerBus';
import type { TowerFloor } from '../../lib/towerData';
import { Decode } from '../Decode';
import { TowerSketch } from './TowerSketch';

/**
 * Palco fixo atrás do HTML da home (aria-hidden: é cenário).
 * Pinta o esboço da torre na hora; o chunk 3D só começa a baixar quando o navegador
 * fica ocioso depois da primeira pintura. O progresso do carregamento é real
 * (fontes → módulo 3D → cena montada → ambiente → shaders compilados → primeiro quadro).
 * Se o import falhar, a home cai para a cidade SVG (nível baixo) sem perder nada.
 */

type SceneProps = { quality: 'high' | 'mid'; floors: TowerFloor[]; dawn: boolean; skipIntro?: boolean };

interface StageProps {
  floors: TowerFloor[];
  dawn: boolean;
  /** Cena 2 (andares) já apareceu: as etiquetas se decifram. */
  floorsSeen: boolean;
}

export function TowerStage({ floors, dawn, floorsSeen }: StageProps) {
  const tier = useTower((s) => s.tier);
  const progress = useTower((s) => s.progress);
  const ready = useTower((s) => s.ready);
  const [Scene, setScene] = useState<ComponentType<SceneProps> | null>(null);
  const downgraded = useRef(false);
  const firstTier = useRef(tier);

  useEffect(() => {
    if (tier === 'low') return;
    if (tier !== firstTier.current) downgraded.current = true;
    let alive = true;
    towerBus.progress(6);
    void document.fonts?.ready.then(() => alive && towerBus.progress(18));
    const start = () => {
      import('../../three/TowerScene')
        .then((mod) => {
          if (!alive) return;
          towerBus.progress(55);
          setScene(() => mod.default as ComponentType<SceneProps>);
        })
        .catch(() => alive && towerBus.set({ tier: 'low' }));
    };
    const ric = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 120));
    const cic = window.cancelIdleCallback ?? window.clearTimeout;
    const id = ric(start, { timeout: 1200 });
    // Rede lenta: o círculo e os fios seguem como cena de espera, mas o título não fica
    // apagado para sempre (a abertura 3D, quando chegar, roda com ele já aceso).
    const safety = window.setTimeout(() => alive && !towerBus.get().ready && towerBus.set({ phase: 'done' }), 9000);
    return () => {
      alive = false;
      cic(id);
      window.clearTimeout(safety);
    };
  }, [tier]);

  if (tier === 'low') return null;
  const quality = tier === 'high' ? 'high' : 'mid';

  return (
    <div className={`tr-stage${ready ? ' is-ready' : ''}`} aria-hidden="true">
      <div className="tr-sky" />
      <div className="tr-sketch">
        <TowerSketch floors={floors} progress={progress} />
      </div>
      {Scene && (
        <div className="tr-gl">
          <Scene key={quality} quality={quality} floors={floors} dawn={dawn} skipIntro={downgraded.current} />
        </div>
      )}
      <div className="tr-labels">
        {floors.map((f) => (
          <span
            key={f.lobby.id}
            className={`tr-label${f.lobby.mine ? ' is-mine' : ''}`}
            ref={(el) => {
              if (el) floorLabels.set(f.lobby.id, el);
              else floorLabels.delete(f.lobby.id);
            }}
          >
            <span className="tr-label-full">
              {floorsSeen ? (
                <Decode on="mount" text={t.home.floors.label(f.number, f.modeName, f.lobby.players, f.lobby.slots)} />
              ) : (
                t.home.floors.label(f.number, f.modeName, f.lobby.players, f.lobby.slots)
              )}
            </span>
            <span className="tr-label-short">{t.home.floors.labelShort(f.number, f.lobby.players, f.lobby.slots)}</span>
          </span>
        ))}
        {floors.map((f) => (
          <span
            key={`m-${f.lobby.id}`}
            className="tr-mark"
            ref={(el) => {
              if (el) floorMarks.set(f.lobby.id, el);
              else floorMarks.delete(f.lobby.id);
            }}
          >
            {String(f.number).padStart(2, '0')}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Linha do HUD durante a abertura: "Riscando o círculo… 42%" → "Erguendo a torre…" → "Cidade acesa.", e as notícias da obra ao vivo. */
export function LoadStatus() {
  const tier = useTower((s) => s.tier);
  const progress = useTower((s) => s.progress);
  const ready = useTower((s) => s.ready);
  const phase = useTower((s) => s.phase);
  const news = useTower((s) => s.news);
  const [gone, setGone] = useState(false);
  const done = ready && phase === 'done';
  useEffect(() => {
    if (!done) return;
    const id = window.setTimeout(() => setGone(true), 1600);
    return () => window.clearTimeout(id);
  }, [done]);
  if (tier === 'low' || (gone && !news)) return null;
  const text = news ? ('raised' in news ? t.home.news.raised(news.raised) : t.home.news.gone) : (!ready ? t.home.loading(Math.round(progress)) : phase === 'floors' ? t.home.raising : phase === 'souls' ? t.home.souls : t.home.loaded);
  return (
    // Só cenário: o leitor de tela não precisa ouvir cada passo do carregamento (a lista é a verdade).
    <p className={`tr-load${done && !news ? ' is-done' : ''}`} aria-hidden="true">
      <span className="num">{text}</span>
    </p>
  );
}
