/**
 * A arte do destaque da Home (o fundo de "Jogue fora das lanes."): a avenida de três pistas vazia
 * e uma das faixas tracejadas que se solta, esquenta e vira a trilha até a porta acesa de um juke
 * joint no acostamento. Desenhada no VectorCraft como as cenas dos modos (.design/hero/), pintada
 * com `var(--token, #hex)` e `color-mix` (trocar o tema repinta) e por isso inlinada (`?raw`).
 *
 * A arte é só a faixa acima da barra do recomendado (1128×144, a parte visível da caixa de 1440).
 * `xMaxYMax slice`: a avenida fica presa à base; em caixas mais largas o corte come o céu de cima,
 * e nas mais estreitas (celular) a esquerda calma. Tudo que é claro fica em x > 840, longe do slogan.
 */
import raw from '../assets/hero/hero.tokens.svg?raw';
import { prepareScene, type PreparedScene } from './cover';

export const HERO_VIEWBOX = '0 0 1128 144';
export const HERO_ASPECT = 'xMaxYMax slice';

/** A arte com ids, classes e referências prefixados (uma por instância: `prefix` vem de `useId`). */
export function heroScene(prefix: string): PreparedScene {
  return prepareScene(raw, prefix);
}
