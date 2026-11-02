import { t } from '../i18n';

/**
 * Círculo de espera do lobby: um segmento por vaga. Os segmentos acendem (latão)
 * conforme os jogadores chegam; amigos em verde; vagas livres apagadas.
 * Mesma semântica das janelas da cidade. O sigilo do meio é um polígono estrelado
 * calculado a partir do número de vagas (geometria déco, sem símbolo religioso).
 */

interface RitualCircleProps {
  total: number;
  taken: number;
  friends?: number;
  /** Destaca o primeiro segmento como "você" (diálogo de criar lobby). */
  youFirst?: boolean;
  className?: string;
}

const C = 100;
const R = 76;

function polar(r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return [C + Math.cos(a) * r, C + Math.sin(a) * r] as const;
}

function arc(r: number, from: number, to: number) {
  const [x1, y1] = polar(r, from);
  const [x2, y2] = polar(r, to);
  const large = to - from > 180 ? 1 : 0;
  return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

function sigil(n: number, r: number) {
  const step = Math.max(2, Math.floor(n / 2) - 1);
  const g = gcd(n, step);
  const pts = (start: number) =>
    Array.from({ length: n / g }, (_, i) => {
      const [x, y] = polar(r, ((start + i * step) % n) * (360 / n));
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(' ');
  return Array.from({ length: g }, (_, s) => pts(s));
}

export function RitualCircle({ total, taken, friends = 0, youFirst = false, className }: RitualCircleProps) {
  const seg = 360 / total;
  const gapDeg = Math.min(5, seg * 0.22);
  const free = Math.max(0, total - taken);
  return (
    <figure className={className ? `ritual ${className}` : 'ritual'}>
      <svg viewBox="0 0 200 200" role="img" aria-label={t.join.circleLabel(taken, total)}>
        <g className="ritual-ticks" aria-hidden="true">
          <circle cx={C} cy={C} r={94} className="ritual-faint" strokeDasharray="1.5 5.2" />
          {Array.from({ length: total }, (_, i) => {
            const [x1, y1] = polar(88, i * seg);
            const [x2, y2] = polar(94, i * seg);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />;
          })}
        </g>
        <g aria-hidden="true">
          {Array.from({ length: total }, (_, i) => {
            const kind = i < friends ? 'friend' : i < taken ? 'lit' : 'free';
            const you = youFirst && i === 0;
            return (
              <path
                key={i}
                className={`ritual-seg is-${kind}${you ? ' is-you' : ''}`}
                d={arc(R, i * seg + gapDeg / 2, (i + 1) * seg - gapDeg / 2)}
              />
            );
          })}
          <circle cx={C} cy={C} r={60} className="ritual-faint" />
          {sigil(total, 56).map((p) => (
            <polygon key={p} points={p} className="ritual-sigil" />
          ))}
          <circle cx={C} cy={C} r={30} className="ritual-core" />
        </g>
        <text x={C} y={C + 4} className="ritual-count" aria-hidden="true">
          {taken}/{total}
        </text>
        <text x={C} y={C + 20} className="ritual-free" aria-hidden="true">
          {t.join.circleFree(free)}
        </text>
      </svg>
    </figure>
  );
}
