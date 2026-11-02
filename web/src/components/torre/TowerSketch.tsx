import type { TowerFloor } from '../../lib/towerData';

/**
 * Cena 0, carregamento: o contorno da torre em fio de latão de 1 px, com os andares
 * acendendo de baixo para cima conforme o progresso real chega. É HTML/SVG puro,
 * pinta junto com a página e dá lugar à cena 3D quando ela estiver pronta.
 * Mesmas proporções da torre 3D (andar = 1 unidade, vaga = 0,62).
 */

const U = 22;
const BAY = 0.62;
const PAD = 0.46;
const PLINTH = 3.2;

export function TowerSketch({ floors, progress }: { floors: TowerFloor[]; progress: number }) {
  const n = Math.max(1, floors.length);
  const maxW = Math.max(...floors.map((f) => f.lobby.slots * BAY + PAD * 2), 6) + 1.4;
  const top = PLINTH + n;
  const height = (top + 9.5) * U;
  const width = (maxW + 2) * U;
  const cx = width / 2;
  const y = (units: number) => height - units * U;
  const litUpTo = Math.floor(((progress - 8) / 86) * n);
  const tw = floors[n - 1] ? (floors[n - 1]!.lobby.slots * BAY + PAD * 2) * U : 4 * U;

  return (
    <svg className="tr-sketch-svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false">
      <g className="tr-sketch-lines">
        <rect x={cx - (maxW * U) / 2} y={y(PLINTH)} width={maxW * U} height={PLINTH * U} pathLength={1} />
        <rect x={cx - 0.85 * U} y={y(2.3)} width={1.7 * U} height={2.3 * U} pathLength={1} className={progress > 4 ? 'is-lit-door' : ''} />
        {floors.map((f, i) => {
          const w = (f.lobby.slots * BAY + PAD * 2) * U;
          return <rect key={f.lobby.id} x={cx - w / 2} y={y(PLINTH + i + 1)} width={w} height={U} pathLength={1} style={{ animationDelay: `${i * 40}ms` }} />;
        })}
        <rect x={cx - (tw * 0.78) / 2} y={y(top + 0.9)} width={tw * 0.78} height={0.9 * U} pathLength={1} />
        <rect x={cx - (tw * 0.54) / 2} y={y(top + 1.8)} width={tw * 0.54} height={0.9 * U} pathLength={1} />
        <path d={`M${cx - tw * 0.3} ${y(top + 1.8)} L${cx} ${y(top + 5.4)} L${cx + tw * 0.3} ${y(top + 1.8)}`} pathLength={1} />
        <path d={`M${cx} ${y(top + 5.4)} V${y(top + 8.6)}`} pathLength={1} />
      </g>
      {floors.map((f, i) =>
        f.windows.map((kind, k) => {
          const w = f.lobby.slots * BAY + PAD * 2;
          const x = cx + (-w / 2 + PAD + BAY * k + (BAY - 0.4) / 2) * U;
          const lit = i < litUpTo && kind !== 'free';
          return (
            <rect
              key={`${f.lobby.id}-${k}`}
              className={`tr-sketch-win${lit ? (kind === 'friend' ? ' is-friend' : ' is-lit') : ''}`}
              x={x}
              y={y(PLINTH + i + 0.82)}
              width={0.4 * U}
              height={0.6 * U}
            />
          );
        }),
      )}
      <circle className={`tr-sketch-beacon${progress >= 100 ? ' is-lit' : ''}`} cx={cx} cy={y(top + 8.9)} r={3} />
    </svg>
  );
}
