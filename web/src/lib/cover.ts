/**
 * Arte dos modos: a CENA (1600×900, `scenes/<slug>.tokens.svg`) e o ÍCONE (glifo 24 e detalhe 48,
 * `icons/<slug>*.svg`). Os `.tokens.svg` pintam tudo com `var(--token, #hex)`; isso só funciona com
 * o SVG dentro do documento, então o markup é lido como texto (`?raw`) e inserido inline.
 *
 * Cena: um chunk por modo (`import()` dinâmico), preparada uma vez (`prepareScene`: ids, classes e
 * referências ganham prefixo do modo, pois três cenas usam `c0..cN` e `linear-gradient-1` iguais) e
 * montada uma vez no sprite de `<CoverDefs />`; cada capa é só um `<svg><use/></svg>`.
 * Ícone: ~1 KB cada, entram junto do bundle (glob eager) e são inlinados no componente.
 */

const FALLBACK = 'circulo-profano';

/** Slugs com cena e ícone (src/data/modes.ts). */
export const SCENE_SLUGS = ['circulo-profano', 'ultimo-bonde', 'neblina', 'duelo-meia-noite', 'cerco-ao-cofre', 'campo-de-treino'] as const;
export type SceneSlug = (typeof SCENE_SLUGS)[number];

export const sceneSlug = (slug: string): SceneSlug => ((SCENE_SLUGS as readonly string[]).includes(slug) ? (slug as SceneSlug) : FALLBACK);

/* ---------- enquadramento ---------- */

export type CoverVariant = 'card' | 'wide' | 'strip';

/** A cena é 1600×900, com o foco à direita; a faixa calma embaixo à esquerda é a dos títulos. */
const W = 1600;
const H = 900;
/** Altura da janela das capas de cartão (aspecto ~2,7:1, o dos cartões de modo). */
const CARD_H = 600;

/** Centro do foco de cada modo, em coordenadas da cena (ponto que a versão larga mantém no meio). */
const FOCUS: Record<SceneSlug, { x: number; y: number }> = {
  'circulo-profano': { x: 1000, y: 450 },
  // a torre do relógio fica à direita; o bonde no meio
  'ultimo-bonde': { x: 1100, y: 330 },
  // lanterna ~300 e cabeça do vulto ~465: a faixa estreita centra em y 400
  neblina: { x: 1180, y: 400 },
  // o relógio (rosto 300–470) e as cabeças dos duelistas (~620) cabem juntos numa faixa de 430
  'duelo-meia-noite': { x: 1100, y: 460 },
  'cerco-ao-cofre': { x: 1050, y: 450 },
  'campo-de-treino': { x: 1190, y: 520 },
};

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);

export interface Framing {
  viewBox: string;
  preserveAspectRatio: string;
}

/**
 * Enquadramento da cena para cada uso (equivale a um `object-position` por modo):
 * - `card`: faixa de 600 de altura com a largura toda, centrada no foco vertical e ancorada à direita;
 * - `wide`: janela de 80% da cena centrada no foco, para as faixas largas do herói (a altura que
 *   aparece depende do contêiner, mas o foco fica no meio);
 * - `strip`: coluna 74×180 do cartão de lobby, uma fatia estreita centrada no foco.
 */
export function coverFraming(slug: string, variant: CoverVariant): Framing {
  const f = FOCUS[sceneSlug(slug)];
  if (variant === 'card') {
    // faixa de 600 de altura centrada no foco vertical, a largura toda, ancorada à direita
    const y = clamp(f.y - CARD_H / 2, 0, H - CARD_H);
    return { viewBox: `0 ${Math.round(y)} ${W} ${CARD_H}`, preserveAspectRatio: 'xMaxYMid slice' };
  }
  if (variant === 'wide') {
    const w = W * 0.8;
    const h = H * 0.8;
    const x = clamp(f.x - w / 2, 0, W - w);
    const y = clamp(f.y - h / 2, 0, H - h);
    return { viewBox: `${Math.round(x)} ${Math.round(y)} ${w} ${h}`, preserveAspectRatio: 'xMidYMid slice' };
  }
  const w = Math.round((H * 74) / 180);
  const x = clamp(f.x - w / 2, 0, W - w);
  return { viewBox: `${Math.round(x)} 0 ${w} ${H}`, preserveAspectRatio: 'xMidYMid slice' };
}

/* ---------- cena (chunk por modo) ---------- */

const sceneLoaders = import.meta.glob<string>('../assets/modes/scenes/*.tokens.svg', { query: '?raw', import: 'default' });

export interface PreparedScene {
  /** Regras `<style>` já com as classes prefixadas. */
  css: string;
  /** Defs e formas, com ids prefixados; vai dentro de `<g id>` no sprite. */
  body: string;
}

/** Id do `<g>` da cena no sprite (o alvo do `<use>`). */
export const sceneId = (slug: string) => `jjsc-${sceneSlug(slug)}`;

/**
 * Tira o `<svg>` externo e prefixa ids (`id="x"`, `url(#x)`, `href="#x"`) e classes
 * (`class="c0"`, `.c0{}`), para que cenas diferentes convivam no mesmo documento.
 */
export function prepareScene(raw: string, prefix: string): PreparedScene {
  const open = raw.indexOf('>', raw.indexOf('<svg'));
  const close = raw.lastIndexOf('</svg>');
  let inner = raw.slice(open + 1, close);
  let css = '';
  inner = inner.replace(/<style[^>]*>([\s\S]*?)<\/style>/g, (_m, c: string) => {
    css += c;
    return '';
  });
  css = css.replace(/([^{}]+)\{/g, (_m, sel: string) => `${sel.replace(/\.([A-Za-z_][\w-]*)/g, `.${prefix}$1`)}{`);
  const body = inner
    .replace(/\bid="([^"]+)"/g, `id="${prefix}$1"`)
    .replace(/url\(#([^)]+)\)/g, `url(#${prefix}$1)`)
    .replace(/(xlink:)?href="#([^"]+)"/g, (_m, x: string | undefined, id: string) => `${x ?? ''}href="#${prefix}${id}"`)
    .replace(/\bclass="([^"]+)"/g, (_m, c: string) => `class="${c.split(/\s+/).map((n) => prefix + n).join(' ')}"`);
  return { css, body };
}

/** Carrega e prepara a cena do modo (import dinâmico: um chunk por cena). */
export async function loadScene(slug: string): Promise<PreparedScene> {
  const s = sceneSlug(slug);
  const load = sceneLoaders[`../assets/modes/scenes/${s}.tokens.svg`];
  if (!load) throw new Error(`sem cena para ${s}`);
  return prepareScene(await load(), `${s.split('-').map((p) => p[0]).join('')}_`);
}

/* ---------- ícones ---------- */

const iconRaw = import.meta.glob<string>('../assets/modes/icons/*.svg', { query: '?raw', import: 'default', eager: true });

/** glifo 24 (listas), detalhe 48 (medalhão) e selo 24: sem anel, centrado e do mesmo tamanho nos seis. */
export type IconKind = 'glyph' | 'detalhe' | 'selo';

export interface IconMarkup {
  viewBox: string;
  /** Atributos de pintura da raiz (fill, stroke…), aplicados a um `<g>`. */
  attrs: Record<string, string>;
  inner: string;
}

const iconCache = new Map<string, IconMarkup>();

/** O ícone do modo: glifo 24 (currentColor) ou detalhe 48 (duas cores de latão). */
export function modeIcon(slug: string, kind: IconKind): IconMarkup {
  const s = sceneSlug(slug);
  const file = kind === 'glyph' ? s : `${s}-${kind}`;
  const key = `${kind}:${s}`;
  let m = iconCache.get(key);
  if (!m) {
    const raw = iconRaw[`../assets/modes/icons/${file}.svg`] ?? '';
    const tag = /<svg([^>]*)>/.exec(raw)?.[1] ?? '';
    const attrs: Record<string, string> = {};
    let viewBox = kind === 'detalhe' ? '0 0 48 48' : '0 0 24 24';
    for (const [, k, v] of tag.matchAll(/([\w:-]+)="([^"]*)"/g)) {
      if (!k || v == null) continue;
      if (k === 'viewBox') viewBox = v;
      else if (['fill', 'stroke', 'stroke-width', 'stroke-miterlimit', 'stroke-linecap', 'stroke-linejoin', 'fill-rule'].includes(k)) attrs[k] = v;
    }
    m = { viewBox, attrs, inner: raw.slice(raw.indexOf('>', raw.indexOf('<svg')) + 1, raw.lastIndexOf('</svg>')) };
    iconCache.set(key, m);
  }
  return m;
}

/** Gradientes do medalhão (disco e anel de latão), pintados pelo tema; moram em `<CoverDefs />`. */
export const MEDALLION_DEFS = `<linearGradient id="jj-lat" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--brass-hi)"/><stop offset=".5" style="stop-color:var(--brass)"/><stop offset="1" style="stop-color:var(--brass-lo)"/></linearGradient><radialGradient id="jj-med" cx="38%" cy="30%" r="80%"><stop offset="0" style="stop-color:var(--med-1)"/><stop offset="1" style="stop-color:var(--med-2)"/></radialGradient>`;
