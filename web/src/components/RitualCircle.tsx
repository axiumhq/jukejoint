import type { CSSProperties } from 'react';
import { getMode, type Mode } from '../data/modes';
import { t } from '../i18n';
import { ModeGlyph } from './ModeArt';

/**
 * Círculo de espera do lobby: um segmento por vaga. Os segmentos acendem (latão)
 * conforme os jogadores chegam; amigos em verde; vagas livres apagadas.
 * Mesma semântica das janelas da cidade.
 *
 * v4: o sigilo do meio é o motivo do modo (o mesmo do selo e da carta), e o círculo mostra
 * o quórum: até o mínimo chegar, os segmentos acesos ficam vazados e um marco de latão
 * indica onde a partida começa.
 */

interface RitualCircleProps {
  total: number;
  taken: number;
  friends?: number;
  /** Destaca o primeiro segmento como "você" (diálogo de criar lobby). */
  youFirst?: boolean;
  /** Destaca o último segmento aceso como "você" (você entrou). */
  youLast?: boolean;
  /** Modo do lobby: o sigilo vira o motivo dele. */
  mode?: Mode | string;
  /** Mínimo para começar. */
  quorum?: number;
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

/** Sigilo genérico (sem modo): polígono estrelado pelo número de vagas. */
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

export function RitualCircle({ total, taken, friends = 0, youFirst = false, youLast = false, mode: m, quorum = 0, className }: RitualCircleProps) {
  const mode = typeof m === 'string' ? getMode(m) : m;
  const seg = 360 / total;
  const gapDeg = Math.min(5, seg * 0.22);
  const free = Math.max(0, total - taken);
  const hollow = quorum > 0 && taken < quorum;
  const label = quorum > 0 ? t.join.circleQuorumLabel(taken, total, quorum) : t.join.circleLabel(taken, total);
  const style = mode ? ({ '--mode-h': mode.hue } as CSSProperties) : undefined;
  return (
    <figure className={`ritual has-mode${className ? ` ${className}` : ''}${hollow ? ' is-hollow' : ''}`} style={style}>
      <svg viewBox="0 0 200 200" role="img" aria-label={label}>
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
            const you = (youFirst && i === 0) || (youLast && i === taken - 1);
            return (
              <path
                key={i}
                className={`ritual-seg is-${kind}${you ? ' is-you' : ''}${quorum > 0 && i < quorum && kind === 'free' ? ' is-needed' : ''}`}
                d={arc(R, i * seg + gapDeg / 2, (i + 1) * seg - gapDeg / 2)}
              />
            );
          })}
          {quorum > 0 && quorum < total && (
            <line
              className="ritual-quorum"
              x1={polar(R - 11, quorum * seg)[0]}
              y1={polar(R - 11, quorum * seg)[1]}
              x2={polar(R + 11, quorum * seg)[0]}
              y2={polar(R + 11, quorum * seg)[1]}
            />
          )}
          <circle cx={C} cy={C} r={60} className="ritual-faint" />
          {mode ? (
            <ModeGlyph motif={mode.motif} x={C - 54} y={C - 54} size={108} className="ritual-glyph" />
          ) : (
            sigil(total, 56).map((p) => <polygon key={p} points={p} className="ritual-sigil" />)
          )}
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
