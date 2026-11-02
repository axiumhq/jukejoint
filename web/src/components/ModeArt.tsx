import type { Mode } from '../data/modes';
import { ModeCover } from './ModeCover';

/**
 * Compatibilidade: a página do modo (fase 2) ainda pede `ModeArt`. Agora é a capa v8
 * do modo numa caixa 5:3. Com `label`, vira imagem acessível; sem, é decorativa.
 */
export function ModeArt({ mode, label, className }: { mode: Mode; label?: string; className?: string }) {
  return (
    <span
      className={className ? `mode-art-v8 ${className}` : 'mode-art-v8'}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <ModeCover slug={mode.slug} />
    </span>
  );
}
