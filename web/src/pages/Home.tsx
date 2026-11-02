import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { CityScene } from '../components/City';
import { FloorList } from '../components/torre/FloorList';
import { HudBottom } from '../components/torre/Hud';
import { ElevatorScene, PlateScene, SceneSection, StreetScene, VaultScene } from '../components/torre/Scenes';
import { TowerStage } from '../components/torre/TowerStage';
import { useDocTheme, useDocumentTitle } from '../hooks';
import { t } from '../i18n';
import { detectTier } from '../lib/tier';
import { invalidateScenes, registerScene, towerBus, useTower } from '../lib/towerBus';
import { buildFloors, FLOOR_CAP } from '../lib/towerData';
import { useSession } from '../state/session';

/**
 * Home v4, "A Torre" (docs/design/brief-v4.md).
 *
 * Sete cenas numa rolagem nativa: abertura (carregamento), a torre, os andares,
 * o cofre dos modos, o elevador, a placa e a rua. O texto é sempre HTML; a cena 3D
 * (chunk separado, carregado depois da primeira pintura) só ilustra o mesmo dado.
 * Nível baixo, sem WebGL ou com movimento reduzido: a cidade SVG do v3 e o mesmo roteiro.
 */

const SCENES = 6;

export function Home() {
  useDocumentTitle(t.meta.home);
  const { lobbies } = useSession();
  const [info] = useState(() => {
    const detected = detectTier();
    towerBus.set({ tier: detected.tier, ready: false, progress: 0, focusId: null });
    return detected;
  });
  const tier = useTower((s) => s.tier);
  const dawn = useDocTheme() === 'light';
  const flat = tier === 'low';
  const floors = useMemo(() => buildFloors(lobbies, FLOOR_CAP[tier]), [lobbies, tier]);
  const [scene, setScene] = useState(0);
  const [floorsSeen, setFloorsSeen] = useState(false);
  // Newsreader (Gazeta) e Big Shoulders Stencil (placa) só baixam quando a rolagem chega
  // ao cofre: a primeira carga da home fica nas três fontes de base.
  const [lateFonts, setLateFonts] = useState(false);
  const els = useRef<(HTMLElement | null)[]>([]);
  const root = useRef<HTMLDivElement>(null);

  const register = useCallback((i: number, el: HTMLElement | null) => {
    els.current[i] = el;
    registerScene(i, el);
  }, []);

  // Cena atual (HUD): a seção que cruza o meio da tela.
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const i = Number((e.target as HTMLElement).dataset.cena);
          setScene(i);
          if (i >= 1) setFloorsSeen(true);
          if (i >= 2) setLateFonts(true);
        }
      },
      { rootMargin: '-50% 0px -50% 0px' },
    );
    els.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [flat]);

  // A altura das seções muda (fontes, dados, largura): a câmera remede o roteiro.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const ro = new ResizeObserver(() => invalidateScenes());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // O cabeçalho é a camada técnica transparente só no hero; depois ganha fundo (CSS por data-cena).
  useEffect(() => {
    document.documentElement.dataset.cena = String(scene);
  }, [scene]);

  useEffect(
    () => () => {
      delete document.documentElement.dataset.cena;
      towerBus.set({ ready: false, progress: 0, focusId: null });
      for (let i = 0; i < SCENES; i++) registerScene(i, null);
    },
    [],
  );

  return (
    <div ref={root} className={`tr tr-${tier}`} data-tier={tier} data-tier-reason={info.reason} data-fonts={lateFonts ? 'all' : undefined}>
      <TowerStage floors={floors} dawn={dawn} floorsSeen={floorsSeen} />

      <SceneSection index={0} id="torre" className="tr-hero" labelledBy="hero-title" register={register}>
        <div className="tr-hero-copy">
          <h1 id="hero-title" className="tr-title">
            {t.home.titleLines.map((line) => (
              <span key={line} className="tr-title-line">
                {line}{' '}
              </span>
            ))}
          </h1>
          <p className="tr-lead">{t.home.lead}</p>
          <div className="tr-actions">
            <Link to="/jogar" className="btn btn-primary btn-lg tr-cta">
              {t.home.play}
            </Link>
            <a href="#andares" className="btn btn-ghost btn-lg tr-cta-2">
              {t.home.seeLobbies}
            </a>
          </div>
        </div>
        {flat && (
          <div className="tr-hero-city">
            <CityScene lobbies={lobbies} />
          </div>
        )}
      </SceneSection>

      <SceneSection index={1} id="andares" className="tr-floors" labelledBy="andares-title" register={register}>
        <div className="tr-floors-inner">
          <div className="tr-floors-col">
            <header className="tr-head">
              <h2 id="andares-title">{t.home.floors.title}</h2>
              <p>{t.home.floors.lead}</p>
            </header>
            <FloorList floors={floors} total={lobbies.length} />
          </div>
        </div>
      </SceneSection>

      <SceneSection index={2} id="cofre" className="tr-vault" labelledBy="cofre-title" register={register}>
        <header className="tr-head">
          <h2 id="cofre-title">{t.home.vault.title}</h2>
          <p>{t.home.vault.lead}</p>
        </header>
        <VaultScene lobbies={lobbies} flat={flat} />
      </SceneSection>

      <SceneSection index={3} id="elevador" className="tr-elevator" labelledBy="elevador-title" register={register}>
        <header className="tr-head">
          <h2 id="elevador-title">{t.home.elevator.title}</h2>
        </header>
        <ElevatorScene lobbies={lobbies} flat={flat} />
      </SceneSection>

      <SceneSection index={4} id="placa" className="tr-plate-scene" labelledBy="placa-title" register={register}>
        <PlateScene />
      </SceneSection>

      <SceneSection index={5} id="rua" className="tr-street" labelledBy="rua-title" register={register}>
        <StreetScene />
      </SceneSection>

      <HudBottom scene={scene} total={SCENES} />
    </div>
  );
}
