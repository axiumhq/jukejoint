import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type Ref } from 'react';
import { Link } from 'react-router';
import type { Lobby } from '../data/lobbies';
import { getMode, type Region } from '../data/modes';
import { liveBase } from '../data/stats';
import { useLiveNumber, useMediaQuery } from '../hooks';
import { formatNumber, t } from '../i18n';
import { filterLobbies, isJoinable } from '../lib/lobbies';
import { dayPeriod } from '../lib/time';
import { Icon } from './Icon';
import { AlmostFull, LobbyAction } from './LobbyAction';
import { PingBars, SlotPips, StatusBadge } from './LobbyBits';

/**
 * A Cidade Acesa: corte de prédios déco à noite, gerado a partir dos lobbies.
 * Um prédio por região, um andar por lobby, uma janela por vaga.
 * Janela acesa (latão) = jogador; verde = amigo; apagada = vaga livre.
 *
 * Os andares mais largos (mais vagas) ficam embaixo, então o recuo escalonado
 * (setback) dos arranha-céus dos anos 1920 sai dos próprios dados.
 *
 * Acessibilidade: o desenho é um listbox (setas movem entre andares, Enter vai
 * para o botão Entrar do quadro de andares). A lista de lobbies continua na página
 * como equivalente textual. Sem JS de animação: as janelas acendem por CSS e
 * prefers-reduced-motion mostra só o estado final.
 */

const WIN_W = 11;
const WIN_H = 13;
const GAP = 6;
const PAD = 12;
const FLOOR_H = 24;
const GROUND_H = 30;
const BOOT_MS = 2600;

const floorWidth = (slots: number) => slots * WIN_W + (slots - 1) * GAP + PAD * 2;

type WinKind = 'friend' | 'lit' | 'free';

interface FloorGeo {
  lobby: Lobby;
  /** 1 = térreo de cima do saguão. */
  number: number;
  /** Topo do andar em coordenadas do prédio (origem no chão, y negativo para cima). */
  y: number;
  w: number;
}

interface BuildingGeo {
  region: Region;
  floors: FloorGeo[]; // de cima para baixo (ordem de leitura e de foco)
  baseW: number;
  plinth: number;
  height: number;
}

function buildBuilding(region: Region, lobbies: Lobby[], plinth: number): BuildingGeo {
  // Ordem estável (vagas, depois id): o andar de um lobby não pula quando alguém entra ou sai.
  const bottomUp = [...lobbies].sort((a, b) => b.slots - a.slots || a.id.localeCompare(b.id));
  const floors: FloorGeo[] = bottomUp.map((lobby, i) => ({
    lobby,
    number: i + 1,
    y: -(GROUND_H + plinth + (i + 1) * FLOOR_H),
    w: floorWidth(lobby.slots),
  }));
  const baseW = floors[0]?.w ?? floorWidth(8);
  const height = GROUND_H + plinth + floors.length * FLOOR_H;
  return { region, floors: floors.reverse(), baseW, plinth, height };
}

function windowKinds(l: Lobby): WinKind[] {
  return Array.from({ length: l.slots }, (_, i) => (i < l.friends ? 'friend' : i < l.players ? 'lit' : 'free'));
}

/** Coroa escalonada + mastro. Desenho fixo, decorativo. */
function Crown({ topY, topW, tall }: { topY: number; topW: number; tall: boolean }) {
  const s1 = topW - 28;
  const s2 = Math.max(s1 - 28, 30);
  const spireH = tall ? 46 : 26;
  const y1 = topY - 10;
  const y2 = y1 - 10;
  const y3 = y2 - spireH;
  return (
    <g className="crown">
      <rect className="facade" x={-s1 / 2} y={y1} width={s1} height={10} />
      <rect className="ledge" x={-s1 / 2 - 3} y={y1 - 1.5} width={s1 + 6} height={2} />
      <rect className="facade" x={-s2 / 2} y={y2} width={s2} height={10} />
      <path className="facade" d={`M${-s2 / 2 + 6} ${y2} L-7 ${y3 + 10} L0 ${y3} L7 ${y3 + 10} L${s2 / 2 - 6} ${y2} Z`} />
      <path className="crown-rays" d={`M0 ${y2} V${y3 + 14} M-9 ${y2} L-3 ${y3 + 18} M9 ${y2} L3 ${y3 + 18}`} />
      <line className="mast" x1={0} y1={y3} x2={0} y2={y3 - (tall ? 22 : 12)} />
      <circle className="beacon" cx={0} cy={y3 - (tall ? 22 : 12)} r={2.2} />
    </g>
  );
}

interface BuildingProps {
  geo: BuildingGeo;
  x: number;
  groundY: number;
  scale: number;
  tall: boolean;
  activeId: string | null;
  booting: boolean;
  bootOffset: number;
  onActivate: (id: string) => void;
  onKey: (e: KeyboardEvent, region: Region, index: number) => void;
  registerFloor: (id: string, el: SVGGElement | null) => void;
}

function Building({ geo, x, groundY, scale, tall, activeId, booting, bootOffset, onActivate, onKey, registerFloor }: BuildingProps) {
  const { floors, baseW, plinth } = geo;
  const top = floors[0];
  const regionName = t.regions[geo.region];
  return (
    <g
      className={`building building-${geo.region.toLowerCase()}`}
      transform={`translate(${x} ${groundY}) scale(${scale})`}
      role="group"
      aria-label={t.city.building(regionName, floors.length)}
    >
      <g aria-hidden="true">
        {/* Saguão e embasamento */}
        <rect className="facade" x={-baseW / 2 - 8} y={-GROUND_H} width={baseW + 16} height={GROUND_H} />
        <rect className="ledge" x={-baseW / 2 - 11} y={-GROUND_H - 1.5} width={baseW + 22} height={2.5} />
        <path className="door" d={`M-11 0 V-16 L-6 -21 H6 L11 -16 V0 Z`} />
        <text className="region-sign" x={-baseW / 2 + 2} y={-9}>
          {regionName}
        </text>
        {plinth > 0 && (
          <g>
            <rect className="facade facade-2" x={-baseW / 2} y={-GROUND_H - plinth} width={baseW} height={plinth} />
            {Array.from({ length: Math.floor(baseW / 17) }, (_, i) => (
              <line key={i} className="pilaster" x1={-baseW / 2 + 9 + i * 17} y1={-GROUND_H - plinth + 6} x2={-baseW / 2 + 9 + i * 17} y2={-GROUND_H - 4} />
            ))}
          </g>
        )}
        {top && <Crown topY={top.y} topW={top.w} tall={tall} />}
        {/* Fachada e cornijas de recuo onde a largura muda */}
        {floors.map((f, i) => {
          const below = floors[i + 1];
          return (
            <g key={f.lobby.id}>
              <rect className="facade" x={-f.w / 2} y={f.y} width={f.w} height={FLOOR_H} />
              {(!below || below.w !== f.w) && <rect className="ledge" x={-f.w / 2 - 3} y={f.y + FLOOR_H - 1} width={f.w + 6} height={2} />}
            </g>
          );
        })}
      </g>

      {floors.map((f, i) => {
        const l = f.lobby;
        const active = l.id === activeId;
        const mode = getMode(l.modeSlug);
        const kinds = windowKinds(l);
        const fromBottom = floors.length - 1 - i;
        const label = t.city.floorLabel(
          f.number,
          l.name,
          mode?.name ?? '',
          t.lobbies.slots(l.players, l.slots, l.friends),
          regionName,
          l.ping,
          t.lobbies.status[l.status],
        );
        return (
          <g
            key={l.id}
            ref={(el) => registerFloor(l.id, el)}
            className={`floor${active ? ' is-active' : ''}${l.status === 'em-partida' ? ' is-playing' : ''}${l.mine ? ' is-mine' : ''}`}
            role="option"
            aria-selected={active}
            aria-label={label}
            tabIndex={active ? 0 : -1}
            onPointerEnter={() => onActivate(l.id)}
            onFocus={() => onActivate(l.id)}
            onClick={() => onActivate(l.id)}
            onKeyDown={(e) => onKey(e, geo.region, i)}
          >
            <rect className="floor-hit" x={-f.w / 2 - 6} y={f.y - 1} width={f.w + 12} height={FLOOR_H + 2} />
            {kinds.map((kind, k) => {
              const wx = -f.w / 2 + PAD + k * (WIN_W + GAP);
              const wy = f.y + (FLOOR_H - WIN_H) / 2;
              const style = booting ? ({ '--d': `${bootOffset + fromBottom * 70 + k * 22}ms` } as CSSProperties) : undefined;
              return (
                <g key={k} className={`win win-${kind}`} style={style}>
                  {kind !== 'free' && (
                    <rect className="win-glow" x={wx - WIN_W} y={wy - WIN_H * 0.8} width={WIN_W * 3} height={WIN_H * 2.6} />
                  )}
                  <rect className="win-pane" x={wx} y={wy} width={WIN_W} height={WIN_H} />
                </g>
              );
            })}
            {l.mine && <path className="mine-flag" d={`M${f.w / 2 + 6} ${f.y + 4} h10 l-4 4 l4 4 h-10 z`} />}
          </g>
        );
      })}
    </g>
  );
}

interface Layout {
  width: number;
  height: number;
  groundY: number;
  placed: { geo: BuildingGeo; x: number; scale: number; tall: boolean }[];
}

function layoutCity(lobbies: Lobby[], compact: boolean): Layout {
  const by = (r: Region) => lobbies.filter((l) => l.region === r);
  const br = buildBuilding('BR', by('BR'), 0);
  const crownH = 112;
  if (compact) {
    const width = Math.max(br.baseW + 70, 290);
    const height = br.height + crownH + 12;
    return { width, height, groundY: height - 6, placed: [{ geo: br, x: width / 2, scale: 1, tall: true }] };
  }
  const sideScale = 0.74;
  // Prédios do fundo: o topo fica perto da metade da torre principal.
  const sideTarget = (br.height * 0.62) / sideScale;
  const mk = (r: Region) => {
    const list = by(r);
    const plinth = Math.max(0, Math.round(sideTarget - GROUND_H - list.length * FLOOR_H));
    return buildBuilding(r, list, plinth);
  };
  const na = mk('NA');
  const eu = mk('EU');
  const width = 640;
  const height = br.height + crownH + 12;
  return {
    width,
    height,
    groundY: height - 6,
    placed: [
      { geo: na, x: 118, scale: sideScale, tall: false },
      { geo: eu, x: 528, scale: sideScale, tall: false },
      { geo: br, x: 322, scale: 1, tall: true },
    ],
  };
}

/** Silhuetas do horizonte (sem janelas, para não confundir com vagas livres). */
function FarSkyline({ width, groundY }: { width: number; groundY: number }) {
  const blocks: string[] = [];
  let x = -420;
  let i = 0;
  while (x < width + 420) {
    const w = 34 + ((i * 37) % 46);
    const h = 60 + ((i * 53) % 120);
    const step = (i * 7) % 3 === 0 ? 12 : 0;
    blocks.push(
      step
        ? `M${x} ${groundY} V${groundY - h + step} H${x + 8} V${groundY - h} H${x + w - 8} V${groundY - h + step} H${x + w} V${groundY}`
        : `M${x} ${groundY} V${groundY - h} H${x + w} V${groundY}`,
    );
    x += w + 4 + ((i * 11) % 14);
    i++;
  }
  return <path className="far-skyline" d={blocks.join(' ') + ' Z'} />;
}

function Directory({ lobby, number, actionRef }: { lobby: Lobby; number: number; actionRef: Ref<HTMLButtonElement> }) {
  const mode = getMode(lobby.modeSlug);
  const titleId = `dir-${lobby.id}`;
  return (
    <section className="directory" aria-labelledby="directory-title">
      <h2 id="directory-title" className="sr-only">
        {t.city.directory}
      </h2>
      <p className="directory-floor">
        <span className="num">{t.city.floor(number)}</span>
        <span>{t.regions[lobby.region]}</span>
        {lobby.mine && <span className="directory-mine">{t.city.yours}</span>}
      </p>
      <div className="directory-main">
        {mode && (
          <Link to={`/modos/${mode.slug}`} className="lobby-mode">
            {mode.name}
          </Link>
        )}
        <h3 className="directory-name" id={titleId}>
          {lobby.name}
          {lobby.locked && <Icon name="lock" size={15} className="lobby-lock" label={t.lobbies.locked} />}
        </h3>
        <p className="lobby-host">
          <span className="sr-only">{t.lobbies.host}: </span>
          <span className="avatar" aria-hidden="true">
            {lobby.host.slice(0, 1).toUpperCase()}
          </span>
          {lobby.host}
          {lobby.hostIsFriend && <span className="tag tag-friend">{t.lobbies.friendTag}</span>}
        </p>
      </div>
      <div className="directory-meta">
        <PingBars lobby={lobby} />
        <SlotPips lobby={lobby} />
        <AlmostFull lobby={lobby} />
        {lobby.status !== 'aberto' && <StatusBadge lobby={lobby} />}
      </div>
      <div className="directory-action">
        <LobbyAction ref={actionRef} lobby={lobby} describedBy={titleId} />
      </div>
    </section>
  );
}

export function CityScene({ lobbies }: { lobbies: Lobby[] }) {
  const compact = !useMediaQuery('(min-width: 48em)');
  const players = useLiveNumber(liveBase.playersOnline, liveBase.playersJitter, liveBase.intervalMs);
  const [period] = useState(dayPeriod);
  const [booting, setBooting] = useState(true);
  const visible = useMemo(() => (compact ? lobbies.filter((l) => l.region === 'BR') : lobbies), [lobbies, compact]);
  const layout = useMemo(() => layoutCity(visible, compact), [visible, compact]);

  const recommended = useMemo(
    () =>
      filterLobbies(lobbies, { q: '', mode: '', regions: ['BR'], slotsOnly: true, friendsOnly: false, sort: 'recomendados' }, false).find(
        (l) => !l.locked && isJoinable(l),
      ),
    [lobbies],
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const currentId = activeId && visible.some((l) => l.id === activeId) ? activeId : (recommended?.id ?? visible[0]?.id ?? null);

  const floorRefs = useRef(new Map<string, SVGGElement>());
  const actionRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setBooting(false), BOOT_MS);
    return () => window.clearTimeout(id);
  }, []);

  const registerFloor = (id: string, el: SVGGElement | null) => {
    if (el) floorRefs.current.set(id, el);
    else floorRefs.current.delete(id);
  };

  const moveTo = (id: string | undefined) => {
    if (!id) return;
    setActiveId(id);
    floorRefs.current.get(id)?.focus();
  };

  // Ordem dos prédios da esquerda para a direita (para as setas laterais).
  const order = [...layout.placed].sort((a, b) => a.x - b.x).map((p) => p.geo);

  const onKey = (e: KeyboardEvent, region: Region, index: number) => {
    const bIdx = order.findIndex((g) => g.region === region);
    const b = order[bIdx];
    if (!b) return;
    const at = (g: BuildingGeo | undefined, i: number) => (g ? g.floors[Math.max(0, Math.min(g.floors.length - 1, i))]?.lobby.id : undefined);
    switch (e.key) {
      case 'ArrowUp':
        moveTo(at(b, index - 1));
        break;
      case 'ArrowDown':
        moveTo(at(b, index + 1));
        break;
      case 'ArrowLeft': {
        const g = order[bIdx - 1];
        if (g) moveTo(at(g, Math.round((index / Math.max(1, b.floors.length - 1)) * (g.floors.length - 1))));
        break;
      }
      case 'ArrowRight': {
        const g = order[bIdx + 1];
        if (g) moveTo(at(g, Math.round((index / Math.max(1, b.floors.length - 1)) * (g.floors.length - 1))));
        break;
      }
      case 'Home':
        moveTo(at(b, 0));
        break;
      case 'End':
        moveTo(at(b, b.floors.length - 1));
        break;
      case 'Enter':
      case ' ':
        actionRef.current?.focus();
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  let activeLobby: Lobby | undefined;
  let activeNumber = 1;
  for (const p of layout.placed) {
    const f = p.geo.floors.find((x) => x.lobby.id === currentId);
    if (f) {
      activeLobby = f.lobby;
      activeNumber = f.number;
    }
  }

  const naCount = lobbies.filter((l) => l.region === 'NA').length;
  const euCount = lobbies.filter((l) => l.region === 'EU').length;
  // Os prédios do fundo acendem depois da torre principal.
  const bootOffsets: Record<Region, number> = { BR: 250, NA: 1100, EU: 1300 };

  return (
    <figure className={`city${booting ? ' is-booting' : ''}${compact ? ' is-compact' : ''}`}>
      <p className="city-kicker">
        <span>{t.live.kicker[period]}</span>
        <span className="city-kicker-num">
          <span className="live-dot" aria-hidden="true" />
          <span className="num">{formatNumber(players)}</span> {t.live.online}
        </span>
      </p>
      <p id="city-hint" className="sr-only">
        {t.city.hint}
      </p>
      <svg
        className="city-svg"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        role="listbox"
        aria-label={t.city.label}
        aria-describedby="city-hint"
        aria-orientation="vertical"
      >
        <defs>
          <radialGradient id="win-glow-grad">
            <stop offset="0" className="stop-glow" />
            <stop offset="1" className="stop-glow" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="win-glow-friend-grad">
            <stop offset="0" className="stop-glow-friend" />
            <stop offset="1" className="stop-glow-friend" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="city-haze" cx="0.5" cy="1" r="0.7">
            <stop offset="0" className="stop-haze" />
            <stop offset="1" className="stop-haze" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="beam" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" className="stop-beam" />
            <stop offset="1" className="stop-beam" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g aria-hidden="true">
          <path className="beam" d={`M${layout.width * 0.42} ${layout.groundY} L${layout.width * 0.02} 0 L${layout.width * 0.13} 0 Z`} fill="url(#beam)" />
          <path className="beam" d={`M${layout.width * 0.6} ${layout.groundY} L${layout.width * 1.02} 0 L${layout.width * 0.9} 0 Z`} fill="url(#beam)" />
          <ellipse cx={layout.width / 2} cy={layout.groundY} rx={layout.width * 0.62} ry={layout.height * 0.55} fill="url(#city-haze)" />
          <FarSkyline width={layout.width} groundY={layout.groundY} />
        </g>
        {layout.placed.map((p) => (
          <Building
            key={p.geo.region}
            geo={p.geo}
            x={p.x}
            groundY={layout.groundY}
            scale={p.scale}
            tall={p.tall}
            activeId={currentId}
            booting={booting}
            bootOffset={bootOffsets[p.geo.region]}
            onActivate={setActiveId}
            onKey={onKey}
            registerFloor={registerFloor}
          />
        ))}
        <line aria-hidden="true" className="street" x1={-400} y1={layout.groundY} x2={layout.width + 400} y2={layout.groundY} />
      </svg>

      {activeLobby && <Directory lobby={activeLobby} number={activeNumber} actionRef={actionRef} />}

      <figcaption className="city-caption">
        <span>{t.live.legend}</span>
        <span className="legend" aria-hidden="true">
          <span className="legend-item">
            <span className="legend-swatch is-lit" />
            {t.live.legendLit}
          </span>
          <span className="legend-item">
            <span className="legend-swatch is-friend" />
            {t.live.legendFriend}
          </span>
          <span className="legend-item">
            <span className="legend-swatch is-free" />
            {t.live.legendFree}
          </span>
        </span>
        {compact && (naCount > 0 || euCount > 0) && (
          <span className="city-also">
            {t.city.alsoLit(naCount, euCount)}{' '}
            <Link to="/lobbies?regiao=NA,EU" className="text-link">
              {t.city.alsoLitLink}
            </Link>
          </span>
        )}
      </figcaption>
    </figure>
  );
}
