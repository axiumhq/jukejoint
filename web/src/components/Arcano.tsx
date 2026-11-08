import type { ReactNode } from 'react';
import { modeArcana } from '../lib/lobbies';
import { pintura } from '../lib/pintura';
import { ModeIcon } from './ModeCover';
import '../styles/arcano.css';

const ROMANOS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/** Numeral romano do arcano do modo (a posição dele no catálogo, que não muda com a ordem da tela). */
export function romano(n: number) {
  return ROMANOS[n - 1] ?? String(n);
}

/** Classes da carta: quem renderiza escolhe a tag (botão na home, link nas páginas de modo). */
export function arcanoClass(slug: string, opts: { quiet?: boolean; size?: 'lg'; className?: string } = {}) {
  return ['arcano', pintura(slug) && 'has-art', opts.quiet && 'is-quiet', opts.size === 'lg' && 'is-lg', opts.className].filter(Boolean).join(' ');
}

/**
 * A face de um arcano: a pintura do modo (ou o fundo de latão sem ela), os cantos escalonados,
 * o numeral, o selo, o nome, o formato e a linha de baixo (`vivo`). Vai dentro de um `<button>`
 * ou `<Link>` com `arcanoClass(slug)`.
 */
export function ArcanoFace({ slug, name, format, vivo, sr }: { slug: string; name: string; format: string; vivo: ReactNode; sr?: ReactNode }) {
  const art = pintura(slug);
  return (
    <>
      {art && (
        <picture className="arc-art" aria-hidden="true">
          <img src={art} alt="" loading="lazy" decoding="async" />
        </picture>
      )}
      <i aria-hidden="true" />
      <i aria-hidden="true" />
      <i aria-hidden="true" />
      <i aria-hidden="true" />
      <span className="arc-num" aria-hidden="true">
        {romano(modeArcana(slug))}
      </span>
      <span className="arc-sig" aria-hidden="true">
        <ModeIcon slug={slug} kind={art ? 'selo' : 'glyph'} />
      </span>
      <span className="arc-t">
        <b>{name}</b>
        <span className="arc-fmt">{format}</span>
      </span>
      <span className="arc-vivo">{vivo}</span>
      {sr && <span className="sr-only">{sr}</span>}
    </>
  );
}
