import { memo } from 'react';

/**
 * Line-art de maquinário (engrenagem, anéis de régua e cruz de mira), decoração a 5–7,5%
 * na cor --lineart do tema. Estática e fora da árvore de acessibilidade.
 */
const polar = (cx: number, cy: number, r: number, a: number): [number, number] => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
const f1 = (n: number) => n.toFixed(1);

function paths() {
  let teeth = '';
  const N = 36;
  const R1 = 232;
  const R2 = 248;
  const p = (r: number, a: number) => `${f1(300 + r * Math.cos(a))} ${f1(300 + r * Math.sin(a))}`;
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2;
    const a1 = a0 + (Math.PI / N) * 0.9;
    const a2 = a0 + (Math.PI / N) * 1.1;
    const a3 = a0 + (Math.PI * 2) / N;
    teeth += (i ? 'L' : 'M') + p(R1, a0) + 'L' + p(R2, a0 + 0.02) + 'L' + p(R2, a1) + 'L' + p(R1, a1 + 0.02) + 'L' + p(R1, a2) + 'L' + p(R1, a3);
  }
  let ticks = '';
  for (let i = 0; i < 180; i++) {
    const a = (i / 180) * Math.PI * 2;
    const L = i % 15 ? 6 : 16;
    const [x1, y1] = polar(300, 300, 196, a);
    const [x2, y2] = polar(300, 300, 196 - L, a);
    ticks += `M${f1(x1)} ${f1(y1)}L${f1(x2)} ${f1(y2)}`;
  }
  return { teeth: teeth + 'Z', ticks };
}

const P = paths();

export const LineArt = memo(function LineArt({ className }: { className?: string }) {
  return (
    <div className={className ? `lineart ${className}` : 'lineart'} aria-hidden="true">
      <svg viewBox="0 0 600 600" focusable="false">
        <path d={P.teeth} strokeWidth="1" />
        <circle cx="300" cy="300" r="214" strokeWidth="1" />
        <path d={P.ticks} strokeWidth=".8" />
        <circle cx="300" cy="300" r="150" strokeWidth="1" strokeDasharray="3 6" />
        <circle cx="300" cy="300" r="96" strokeWidth="1.2" />
        <circle cx="300" cy="300" r="40" strokeWidth="1" />
        <path d="M300 20v560M20 300h560" strokeWidth=".7" />
        <circle cx="452" cy="148" r="58" strokeWidth="1" />
        <circle cx="452" cy="148" r="22" strokeWidth="1" />
      </svg>
    </div>
  );
});
