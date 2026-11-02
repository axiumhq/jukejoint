import type { CSSProperties } from 'react';
import type { TowerFloor } from '../../lib/towerData';

/**
 * Cena 0, carregamento (v5, "Obra Encantada"): enquanto o chunk 3D baixa, o círculo ritual
 * da praça acende anel por anel com o PROGRESSO REAL (fontes → módulo 3D → cena → ambiente →
 * shaders), e os fios âmbar sobem dele desenhando o esqueleto da torre. É SVG puro, pinta
 * junto com a página e dá lugar à cena 3D, que continua do mesmo ponto (círculo aceso,
 * esqueleto desenhado, andares caindo do céu). Se o 3D demorar, a espera é a própria cena.
 * Mesmas proporções da torre 3D (andar = 1 unidade, vaga = 0,62). Nada de janela aqui:
 * quem acende janela é a brasa de cada jogador, já no 3D.
 */

const U = 22;
const BAY = 0.62;
const PAD = 0.46;
const PLINTH = 3.2;
/** Raio do círculo em unidades da torre (o mesmo da praça no 3D) e o achatamento da perspectiva. */
const R = 10.5;
const SQUASH = 0.2;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export function TowerSketch({ floors, progress }: { floors: TowerFloor[]; progress: number }) {
  const n = Math.max(1, floors.length);
  const maxW = Math.max(...floors.map((f) => f.lobby.slots * BAY + PAD * 2), 6) + 1.4;
  const top = PLINTH + n;
  const below = R * SQUASH + 0.6;
  const height = (top + 9.5 + below) * U;
  const width = (R * 2 + 1) * U;
  const cx = width / 2;
  const y = (units: number) => height - (units + below) * U;
  const gy = y(0);
  const tw = floors[n - 1] ? (floors[n - 1]!.lobby.slots * BAY + PAD * 2) * U : 4 * U;
  const p = progress / 100;
  // Seis peças do círculo (de fora para dentro), cada uma com a sua fatia do progresso.
  const ring = (k: number) => clamp01(p * 6 - k);
  // Os fios só sobem depois do módulo 3D chegar (55%): é o esqueleto que o 3D vai preencher.
  const thr = clamp01((progress - 50) / 44);
  const draw = (k: number, steps: number) => ({ strokeDashoffset: 1 - clamp01(thr * steps - k) }) as CSSProperties;
  const ell = (r: number, k: number, cls = '') => (
    <ellipse className={`tr-rite${cls}`} cx={cx} cy={gy} rx={r * R * U} ry={r * R * U * SQUASH} pathLength={1} style={{ strokeDashoffset: 1 - ring(k) }} />
  );
  const steps = n + 4;

  return (
    <svg className="tr-sketch-svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false">
      <g className="tr-rites">
        {ell(0.985, 0)}
        {ell(0.92, 1, ' is-band')}
        {ell(0.86, 2)}
        {ell(0.72, 3, ' is-dash')}
        {ell(0.62, 4, ' is-band')}
        {ell(0.3, 5)}
      </g>
      <g className="tr-threads">
        {/* fios do círculo até os cantos do saguão */}
        {[-1, 1].map((s) => (
          <path
            key={s}
            d={`M${cx + s * R * U * 0.97} ${gy} Q${cx + s * (maxW * U) * 0.9} ${y(PLINTH * 0.9)} ${cx + (s * maxW * U) / 2} ${y(PLINTH)}`}
            pathLength={1}
            style={draw(0, steps)}
          />
        ))}
        <rect x={cx - (maxW * U) / 2} y={y(PLINTH)} width={maxW * U} height={PLINTH * U} pathLength={1} style={draw(1, steps)} />
        {floors.map((f, i) => {
          const w = (f.lobby.slots * BAY + PAD * 2) * U;
          return <rect key={f.lobby.id} x={cx - w / 2} y={y(PLINTH + i + 1)} width={w} height={U} pathLength={1} style={draw(i + 2, steps)} />;
        })}
        <path d={`M${cx - tw * 0.39} ${y(top)} V${y(top + 1.8)} H${cx + tw * 0.39} V${y(top)}`} pathLength={1} style={draw(n + 2, steps)} />
        <path d={`M${cx} ${y(top + 1.8)} V${y(top + 8.6)}`} pathLength={1} style={draw(n + 3, steps)} />
      </g>
      <circle className={`tr-sketch-beacon${progress >= 100 ? ' is-lit' : ''}`} cx={cx} cy={y(top + 8.9)} r={3} />
    </svg>
  );
}
