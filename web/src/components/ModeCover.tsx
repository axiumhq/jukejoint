import { memo, useId, useMemo, type CSSProperties } from 'react';
import { coverMarkup, coverSpec, globalCoverDefs } from '../lib/cover';

/**
 * A capa de um modo (emblema de oficina oculta), pintada só com variáveis do tema:
 * trocar o tema repinta sem gerar nada de novo. Estática: o único movimento é o zoom de 5%
 * no hover de quem a contém (classe `has-cover`), desligado com movimento reduzido.
 * Preenche o pai (position: absolute); o pai define o tamanho e o canto.
 */
interface ModeCoverProps {
  /** Slug do modo (src/data/modes.ts). */
  slug: string;
  /** Versão larga do herói: a mesma cena com mais campo dos lados. */
  wide?: boolean;
  className?: string;
}

export const ModeCover = memo(function ModeCover({ slug, wide = false, className }: ModeCoverProps) {
  const uid = useId();
  const { viewBox, inner } = useMemo(() => coverMarkup(slug, uid, wide), [slug, uid, wide]);
  return (
    <div className={className ? `cover ${className}` : 'cover'} style={{ '--m': coverSpec(slug).shift } as CSSProperties} aria-hidden="true">
      <svg viewBox={viewBox} preserveAspectRatio="xMidYMid slice" focusable="false" dangerouslySetInnerHTML={{ __html: inner }} />
    </div>
  );
});

/** Os quatro desfoques que todas as capas usam. Renderizado uma vez, na casca. */
export function CoverDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs dangerouslySetInnerHTML={{ __html: globalCoverDefs() }} />
    </svg>
  );
}
