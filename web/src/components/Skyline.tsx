import { useLayoutEffect, useMemo, useRef } from 'react';
import { useReducedMotion } from '../hooks';

/**
 * Silhueta de cidade dos anos 1920 (prédios escalonados, torres, caixas d'água)
 * gerada de forma determinística. As janelas acendem ao carregar a página
 * e, depois, uma ou outra acende ou apaga, como jogadores entrando e saindo.
 */

const W = 1440;
const H = 360;
const GROUND = H;

function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Win {
  x: number;
  y: number;
  w: number;
  h: number;
  lit: boolean;
  dim: boolean;
}

interface Building {
  d: string;
  windows: Win[];
  spire?: string;
}

function makeLayer(seed: number, opts: { minH: number; maxH: number; minW: number; maxW: number; tiers: number; windows: boolean; litP: number; win: [number, number]; gap: [number, number] }) {
  const r = rng(seed);
  const out: Building[] = [];
  let x = -20;
  while (x < W + 20) {
    const w = Math.round(opts.minW + r() * (opts.maxW - opts.minW));
    const h = Math.round(opts.minH + r() * (opts.maxH - opts.minH));
    const tiers = Math.floor(r() * (opts.tiers + 1));
    const top = GROUND - h;
    // Polígono com recuos escalonados (setbacks), típicos dos arranha-céus da época.
    const left: [number, number][] = [[x, GROUND], [x, top]];
    const right: [number, number][] = [];
    let l = x;
    let rr = x + w;
    let y = top;
    for (let i = 0; i < tiers; i++) {
      const inset = Math.max(3, Math.round((rr - l) * (0.12 + r() * 0.1)));
      const rise = Math.round(10 + r() * 22);
      if (rr - l - inset * 2 < 8) break;
      left.push([l + inset, y], [l + inset, y - rise]);
      right.unshift([rr - inset, y - rise], [rr - inset, y]);
      l += inset;
      rr -= inset;
      y -= rise;
    }
    // Sobe pela esquerda, cruza o topo do último nível e desce pela direita.
    const poly: [number, number][] = [...left, [rr, y], ...right, [x + w, top], [x + w, GROUND]];
    const d = 'M' + poly.map(([px, py]) => `${px},${py}`).join('L') + 'Z';

    let spire: string | undefined;
    if (tiers >= 2 && r() > 0.55) {
      const cx = (l + rr) / 2;
      const sh = 14 + r() * 26;
      spire = `M${cx - 2},${y}L${cx},${y - sh}L${cx + 2},${y}Z`;
    }

    const windows: Win[] = [];
    if (opts.windows) {
      const [ww, wh] = opts.win;
      const [gx, gy] = opts.gap;
      const cols = Math.floor((w - 8) / gx);
      const rows = Math.floor((h - 14) / gy);
      const offX = x + (w - cols * gx) / 2 + (gx - ww) / 2;
      for (let c = 0; c < cols; c++) {
        for (let rI = 0; rI < rows; rI++) {
          const wy = top + 10 + rI * gy;
          if (wy + wh > GROUND - 4) continue;
          const lit = r() < opts.litP;
          windows.push({ x: Math.round(offX + c * gx), y: Math.round(wy), w: ww, h: wh, lit, dim: r() > 0.6 });
        }
      }
    }
    out.push({ d, windows, spire });
    x += w + Math.round(r() * 6);
  }
  return out;
}

interface SkylineProps {
  className?: string;
}

export function Skyline({ className }: SkylineProps) {
  const ref = useRef<SVGSVGElement>(null);
  const reduced = useReducedMotion();

  const layers = useMemo(
    () => ({
      far: makeLayer(7, { minH: 150, maxH: 260, minW: 26, maxW: 60, tiers: 3, windows: false, litP: 0, win: [2, 3], gap: [8, 10] }),
      mid: makeLayer(23, { minH: 110, maxH: 230, minW: 40, maxW: 90, tiers: 3, windows: true, litP: 0.14, win: [3, 5], gap: [9, 13] }),
      near: makeLayer(61, { minH: 60, maxH: 150, minW: 60, maxW: 130, tiers: 1, windows: true, litP: 0.2, win: [4, 6], gap: [12, 16] }),
    }),
    [],
  );

  useLayoutEffect(() => {
    const svg = ref.current;
    if (!svg || reduced) return;
    const all = Array.from(svg.querySelectorAll<SVGRectElement>('rect.w'));
    const target = all.filter((el) => el.dataset.lit === '1');
    target.forEach((el) => el.classList.remove('on'));
    const timers: number[] = [];
    // Momento único de abertura: a cidade acende em ~1,4 s.
    const order = [...target].sort(() => Math.random() - 0.5);
    order.forEach((el, i) => {
      timers.push(window.setTimeout(() => el.classList.add('on'), 250 + (i / order.length) * 1400 + Math.random() * 120));
    });
    // Depois, uma janela por vez muda de estado.
    const tick = window.setInterval(() => {
      const el = all[Math.floor(Math.random() * all.length)];
      el?.classList.toggle('on');
    }, 1600);
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      window.clearInterval(tick);
      target.forEach((el) => el.classList.add('on'));
    };
  }, [reduced]);

  return (
    <svg
      ref={ref}
      className={className ? `skyline ${className}` : 'skyline'}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      focusable="false"
    >
      <g className="sky-far">
        {layers.far.map((b, i) => (
          <path key={i} d={b.d} />
        ))}
      </g>
      <g className="sky-mid">
        {layers.mid.map((b, i) => (
          <g key={i}>
            <path d={b.d} />
            {b.spire && <path d={b.spire} />}
          </g>
        ))}
        {layers.mid.flatMap((b, i) =>
          b.windows.map((wn, j) => (
            <rect key={`${i}-${j}`} className={`w${wn.lit ? ' on' : ''}${wn.dim ? ' dim' : ''}`} data-lit={wn.lit ? '1' : '0'} x={wn.x} y={wn.y} width={wn.w} height={wn.h} />
          )),
        )}
      </g>
      <g className="sky-near">
        {layers.near.map((b, i) => (
          <path key={i} d={b.d} />
        ))}
        {layers.near.flatMap((b, i) =>
          b.windows.map((wn, j) => (
            <rect key={`${i}-${j}`} className={`w${wn.lit ? ' on' : ''}${wn.dim ? ' dim' : ''}`} data-lit={wn.lit ? '1' : '0'} x={wn.x} y={wn.y} width={wn.w} height={wn.h} />
          )),
        )}
      </g>
    </svg>
  );
}
