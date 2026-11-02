import type { CSSProperties } from 'react';
import type { Mode } from '../data/modes';

/**
 * Arte de prévia de cada modo: desenho de linhas em SVG, sem fotos nem arte do jogo.
 * As animações só rodam com `playing` e são desligadas em prefers-reduced-motion (CSS).
 */

interface ModeArtProps {
  mode: Mode;
  playing?: boolean;
  label?: string;
  className?: string;
}

const C = { x: 160, y: 90 };

function Rings() {
  const ticks = Array.from({ length: 48 }, (_, i) => {
    const a = (i / 48) * Math.PI * 2;
    const r1 = i % 4 === 0 ? 60 : 64;
    return <line key={i} x1={C.x + Math.cos(a) * r1} y1={C.y + Math.sin(a) * r1} x2={C.x + Math.cos(a) * 68} y2={C.y + Math.sin(a) * 68} />;
  });
  const star = Array.from({ length: 7 }, (_, i) => {
    const a = (i * 3 * Math.PI * 2) / 7 - Math.PI / 2;
    return `${C.x + Math.cos(a) * 44},${C.y + Math.sin(a) * 44}`;
  }).join(' ');
  return (
    <>
      <g className="art-spin-slow">
        {ticks}
        <circle cx={C.x} cy={C.y} r={76} className="faint" strokeDasharray="2 6" />
      </g>
      <g className="art-spin-rev">
        <polygon points={star} />
        <circle cx={C.x} cy={C.y} r={44} className="faint" />
      </g>
      <circle cx={C.x} cy={C.y} r={18} className="art-pulse" />
      <circle cx={C.x} cy={C.y} r={3} className="solid" />
    </>
  );
}

function Rails() {
  const ties = Array.from({ length: 9 }, (_, i) => {
    const t = (i + 1) / 10;
    const y = 52 + 128 * t * t;
    const half = 6 + 64 * t * t;
    return <line key={i} x1={C.x - half} y1={y} x2={C.x + half} y2={y} className="faint" />;
  });
  return (
    <>
      <line x1={0} y1={52} x2={320} y2={52} className="faint" />
      {[40, 90, 230, 280].map((x, i) => (
        <path key={i} d={`M${x},${i < 2 ? 140 : 140} V${i < 2 ? 70 + i * 6 : 82 - (i - 2) * 6}`} className="faint" />
      ))}
      {ties}
      <line x1={88} y1={180} x2={156} y2={52} />
      <line x1={232} y1={180} x2={164} y2={52} />
      <line x1={124} y1={180} x2={158} y2={52} className="art-flow" strokeDasharray="4 10" />
      <line x1={196} y1={180} x2={162} y2={52} className="art-flow" strokeDasharray="4 10" />
      <circle cx={C.x} cy={48} r={5} className="solid art-pulse" />
    </>
  );
}

function wave(y: number, amp: number, len: number) {
  let d = `M-320,${y}`;
  for (let x = -320; x <= 640; x += len) {
    d += ` q${len / 4},${-amp} ${len / 2},0 t${len / 2},0`;
  }
  return d;
}

function Fog() {
  return (
    <>
      {[46, 70, 94, 118, 142].map((y, i) => (
        <path key={y} d={wave(y, 6 + i * 1.5, i % 2 ? 120 : 80)} className={i % 2 ? 'art-drift faint' : 'art-drift-rev'} />
      ))}
      {[
        [62, 58],
        [214, 84],
        [128, 126],
        [252, 132],
      ].map(([x, y], i) => (
        <rect key={i} x={x} y={y} width={4} height={6} className={`solid art-blink d${i}`} />
      ))}
    </>
  );
}

function Clock() {
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    const r1 = i % 3 === 0 ? 50 : 56;
    return <line key={i} x1={C.x + Math.cos(a) * r1} y1={C.y + Math.sin(a) * r1} x2={C.x + Math.cos(a) * 62} y2={C.y + Math.sin(a) * 62} />;
  });
  return (
    <>
      <circle cx={C.x} cy={C.y} r={70} />
      <circle cx={C.x} cy={C.y} r={76} className="faint" />
      {ticks}
      <line x1={C.x} y1={C.y} x2={C.x} y2={C.y - 36} className="thick" />
      <g className="art-sweep">
        <line x1={C.x} y1={C.y + 10} x2={C.x} y2={C.y - 56} />
      </g>
      <circle cx={C.x} cy={C.y} r={3} className="solid" />
    </>
  );
}

function Vault() {
  const bolts = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2;
    return <circle key={i} cx={C.x + Math.cos(a) * 62} cy={C.y + Math.sin(a) * 62} r={3} className="solid" />;
  });
  return (
    <>
      <rect x={70} y={6} width={180} height={168} className="faint" />
      <circle cx={C.x} cy={C.y} r={74} />
      <circle cx={C.x} cy={C.y} r={52} className="faint" />
      {bolts}
      <g className="art-turn">
        {[0, 60, 120].map((deg) => (
          <line
            key={deg}
            x1={C.x + Math.cos((deg * Math.PI) / 180) * 40}
            y1={C.y + Math.sin((deg * Math.PI) / 180) * 40}
            x2={C.x - Math.cos((deg * Math.PI) / 180) * 40}
            y2={C.y - Math.sin((deg * Math.PI) / 180) * 40}
            className="thick"
          />
        ))}
        <circle cx={C.x} cy={C.y} r={10} />
      </g>
    </>
  );
}

function Grid() {
  const rows = Array.from({ length: 7 }, (_, i) => {
    const t = (i + 1) / 8;
    const y = 96 + 84 * t * t;
    return <line key={`r${i}`} x1={0} y1={y} x2={320} y2={y} className="faint" />;
  });
  const cols = Array.from({ length: 11 }, (_, i) => {
    const x = (i / 10) * 320;
    return <line key={`c${i}`} x1={C.x + (x - C.x) * 0.15} y1={96} x2={C.x + (x - C.x) * 1.6} y2={180} className="faint" />;
  });
  return (
    <>
      <line x1={0} y1={96} x2={320} y2={96} />
      {rows}
      {cols}
      {[
        [96, 70, 0],
        [176, 56, 1],
        [236, 74, 2],
      ].map(([x, y, d]) => (
        <g key={d} className={`art-target d${d}`} style={{ transformOrigin: `${x}px ${y}px` } as CSSProperties}>
          <circle cx={x} cy={y} r={12} />
          <circle cx={x} cy={y} r={5} />
          <line x1={x} y1={(y ?? 0) + 12} x2={x} y2={(y ?? 0) + 30} className="faint" />
        </g>
      ))}
    </>
  );
}

const motifs = { rings: Rings, rails: Rails, fog: Fog, clock: Clock, vault: Vault, grid: Grid };

export function ModeArt({ mode, playing = false, label, className }: ModeArtProps) {
  const Motif = motifs[mode.motif];
  const style = { '--art-h': mode.hue } as CSSProperties;
  return (
    <svg
      className={`mode-art${playing ? ' is-playing' : ''}${className ? ` ${className}` : ''}`}
      viewBox="0 0 320 180"
      preserveAspectRatio="xMidYMid slice"
      style={style}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <rect width="320" height="180" className="art-bg" />
      <g className="art-lines">
        <Motif />
      </g>
    </svg>
  );
}
