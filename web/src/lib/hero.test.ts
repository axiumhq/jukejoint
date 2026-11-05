import { describe, expect, it } from 'vitest';
import { HERO_ASPECT, HERO_VIEWBOX, heroScene } from './hero';

describe('arte do destaque', () => {
  const { css, body } = heroScene('t_');

  it('é a faixa acima da barra, presa à base e ao lado direito', () => {
    expect(HERO_VIEWBOX).toBe('0 0 1128 144');
    expect(HERO_ASPECT).toBe('xMaxYMax slice');
  });

  it('ids únicos e prefixados, e todo url(#) aponta para um id da própria arte', () => {
    const ids = [...body.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]!);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.startsWith('t_')).toBe(true);
    const refs = [...body.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]!);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) expect(ids).toContain(ref);
  });

  it('pinta com os tokens do tema (var com fallback), sem cor solta nas formas', () => {
    expect(css).toMatch(/var\(--sky-1,\s*#/);
    expect(css).toMatch(/var\(--bulb,\s*#/);
    for (const [, sel] of css.matchAll(/([^{}]+)\{/g)) expect(sel!.trim().startsWith('.t_')).toBe(true);
    // toda cor das formas vem de uma classe: nenhum fill/stroke/stop-color em hex no corpo
    expect(body).not.toMatch(/(fill|stroke|stop-color)="#[0-9a-f]{3,6}"/i);
    for (const [, c] of body.matchAll(/\bclass="([^"]+)"/g)) for (const k of c!.split(/\s+/)) expect(css).toContain(`.${k}{`);
  });

  it('decorativa e estática: sem texto, sem animação', () => {
    expect(body).not.toMatch(/<(text|animate|animateTransform|set)\b/);
    expect(css).not.toMatch(/animation|@keyframes/);
  });
});
