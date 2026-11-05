import { BRAND_NAME } from '../config/brand';
import wordmarkUrl from '../assets/brand/wordmark.svg';

/**
 * A marca do redesign: o wordmark e o símbolo JJ, em vetor (.design/marca/*-v1.svg, cópias em
 * assets/brand). Nunca redigitar o wordmark com uma fonte: ele é sempre este desenho.
 * O wordmark é uma imagem (marfim fixo, como no kit); o símbolo é SVG em linha e pinta com
 * `currentColor`, para seguir o texto do tema.
 */

/** Largura ÷ altura do wordmark.svg (viewBox 1000 × 410): o <img> reserva o espaço antes de carregar. */
const WORDMARK_RATIO = 1000 / 410;

/** O wordmark. `alt` vazio quando o nome já está no rótulo de quem o contém (o link da marca). */
export function Wordmark({ height = 24, alt = BRAND_NAME, className }: { height?: number; alt?: string; className?: string }) {
  return <img className={className ? `wordmark ${className}` : 'wordmark'} src={wordmarkUrl} alt={alt} translate="no" width={Math.round(height * WORDMARK_RATIO)} height={height} style={{ height }} />;
}

/** O símbolo JJ (proporção 170 × 384). Decorativo por padrão. */
export function BrandSymbol({ height = 44, label, className }: { height?: number; label?: string; className?: string }) {
  return (
    <svg
      className={className ? `jj ${className}` : 'jj'}
      viewBox="-10 18 170 384"
      height={height}
      width={(height * 170) / 384}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M 40 70 L 70 70 C 66 74 66 85.6 66 96 L 66 250 C 66 284 52 300 32 300 C 16 300 6 289 6 276 L 8 262 L 22 266 C 21 276 26 282 33 282 C 40 282 44 272 44 250 L 44 96 C 44 85.6 44 74 40 70 Z M 78 70 L 108 70 C 104 74 104 85.6 104 96 L 104 270 C 104 330 80 372 44 380 L 40 360 C 68 356 82 320 82 270 L 82 96 C 82 85.6 82 74 78 70 Z M 78 32 L 108 32 C 104 38 104 48 108 56 L 98.0 56 L 93.0 61 L 88.0 56 L 78 56 C 82 48 82 38 78 32 Z M 118 110 L 148 110 C 144 114 144 125.6 144 136 L 144 236 C 144 246.4 144 258 148 262 L 118 262 C 122 258 122 246.4 122 236 L 122 136 C 122 125.6 122 114 118 110 Z"
      />
    </svg>
  );
}
