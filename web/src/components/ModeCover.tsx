import { memo, useLayoutEffect, useState, type CSSProperties } from 'react';
import { coverSprite, globalCoverDefs, medallionId, spriteById, stripId } from '../lib/cover';

/**
 * A capa de um modo (a cena noturna do kit com o medalhão do modo), pintada só com variáveis do tema:
 * trocar o tema repinta sem gerar nada de novo. Estática: o único movimento é o zoom de 5%
 * no hover de quem a contém (classe `has-cover`), desligado com movimento reduzido.
 * Preenche o pai (position: absolute); o pai define o tamanho e o canto.
 *
 * Custo: o desenho de cada modo mora uma vez só no sprite de `<CoverDefs />`; o cartão é um
 * `<svg>` com um `<use>`. `content-visibility: auto` pula estilo, layout e pintura das capas
 * fora da tela (o tamanho vem do pai, então nada muda de lugar quando elas entram).
 */
interface ModeCoverProps {
  /** Slug do modo (src/data/modes.ts). */
  slug: string;
  /** Versão larga do herói: a mesma cena com mais campo dos lados. */
  wide?: boolean;
  className?: string;
}

/* ---------- sprites em uso: contagem por id, lida por <CoverDefs /> ---------- */

const inUse = new Map<string, number>();
const listeners = new Set<() => void>();
let snapshot: readonly string[] = [];

function retain(id: string, delta: 1 | -1) {
  const n = (inUse.get(id) ?? 0) + delta;
  if (n > 0) inUse.set(id, n);
  else inUse.delete(id);
  const next = [...inUse.keys()].sort();
  if (next.join() === snapshot.join()) return;
  snapshot = next;
  for (const l of listeners) l();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const getSnapshot = () => snapshot;

export const ModeCover = memo(function ModeCover({ slug, wide = false, className }: ModeCoverProps) {
  const { id, viewBox, shift } = coverSprite(slug, wide);
  // Efeito de layout: o sprite entra no DOM no mesmo commit, antes da primeira pintura.
  useLayoutEffect(() => {
    retain(id, 1);
    return () => retain(id, -1);
  }, [id]);
  return (
    <div className={className ? `cover ${className}` : 'cover'} style={{ '--m': shift, contentVisibility: 'auto' } as CSSProperties} aria-hidden="true">
      <svg viewBox={viewBox} preserveAspectRatio="xMidYMid slice" focusable="false">
        <use href={`#${id}`} />
      </svg>
    </div>
  );
});

/**
 * O medalhão do modo sozinho (disco com anel de latão), do Design-System: cartão de lobby,
 * busca, listas. Decorativo. O tamanho vem do CSS (`.med`) ou de `size`.
 */
export function ModeMedallion({ slug, size, className }: { slug: string; size?: number; className?: string }) {
  return (
    <svg
      className={className ? `med ${className}` : 'med'}
      viewBox="0 0 84 84"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <use href={`#${medallionId(slug)}`} />
    </svg>
  );
}

/** A faixa de céu com a silhueta do modo (a coluna de arte do cartão de lobby). Decorativa. */
export function ModeStrip({ slug, className }: { slug: string; className?: string }) {
  return (
    <svg className={className ? `strip ${className}` : 'strip'} viewBox="0 0 74 180" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      <use href={`#${stripId(slug)}`} />
    </svg>
  );
}

/**
 * Os gradientes e símbolos globais (latão, medalhões, faixas) e os sprites das capas em uso.
 * Renderizado uma vez, na casca.
 */
export function CoverDefs() {
  // Assinatura no efeito de layout (useSyncExternalStore assina só no passivo, depois da
  // pintura): a casca vem antes do conteúdo na árvore, então já escuta quando as capas
  // se registram, e a atualização sai síncrona, antes da primeira pintura.
  const [ids, setIds] = useState(getSnapshot);
  useLayoutEffect(() => {
    const update = () => setIds(getSnapshot());
    update();
    return subscribe(update);
  }, []);
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs dangerouslySetInnerHTML={{ __html: globalCoverDefs() }} />
      <defs>
        {ids.map((id) => {
          const s = spriteById(id);
          return s ? <g key={id} dangerouslySetInnerHTML={{ __html: s.markup }} /> : null;
        })}
      </defs>
    </svg>
  );
}
