/**
 * Capas dos modos do redesign: a cena noturna do kit (céu, lua com halo, a fileira de prédios
 * com janelas acesas, névoa e chão) e, no centro, o medalhão do modo (disco com anel de latão e
 * o desenho próprio do modo recortado dentro). Pintadas SÓ com variáveis do tema e da marca
 * (`--k0`, `--sky-*`, `--bldg*`, `--ground`, `--med-*`, `--brass*`, `--bulb`, `--moon-*`):
 * trocar o tema repinta a capa sem gerar nada de novo.
 * Cada modo (e versão larga) vira um sprite único em `<CoverDefs />`, com `<defs>` próprios;
 * os cartões só o referenciam com `<use>` (ver `coverSprite`). O medalhão e a silhueta de cada
 * modo também existem soltos (`<symbol>` globais), para o cartão de lobby e as listas.
 * Tudo aqui é puro e determinístico: a mesma capa sai igual a cada render.
 */

export type CoverKey = 'cp' | 'ub' | 'nb' | 'cc' | 'dm' | 'ct';

interface CoverSpec {
  key: CoverKey;
  /** Compat com o v8 (desvio de matiz); o redesign usa a mesma paleta em todos os modos. */
  shift: number;
  /** Semente da cidade (prédios e janelas). */
  seed: number;
}

/** Capa por slug de modo (src/data/modes.ts). */
export const COVERS: Record<string, CoverSpec> = {
  'circulo-profano': { key: 'cp', shift: 0, seed: 7 },
  'ultimo-bonde': { key: 'ub', shift: 0, seed: 3 },
  neblina: { key: 'nb', shift: 0, seed: 11 },
  'cerco-ao-cofre': { key: 'cc', shift: 0, seed: 19 },
  'duelo-meia-noite': { key: 'dm', shift: 0, seed: 5 },
  'campo-de-treino': { key: 'ct', shift: 0, seed: 23 },
};

export const coverSpec = (slug: string): CoverSpec => COVERS[slug] ?? COVERS['circulo-profano']!;

/**
 * O desenho de cada modo (do Design-System): `mark` é o traço dentro do medalhão (espaço 84,
 * deslocado por translate(-108 2), como no kit) e `sil` a silhueta da faixa de céu do cartão
 * (espaço 74 × 180, ancorada embaixo).
 */
const ART: Record<CoverKey, { mark: string; sil: string }> = {
  cp: {
    mark: 'M150 40m-14 0a14 14 0 1 0 28 0a14 14 0 1 0-28 0M150 40m-28 0a28 28 0 1 0 56 0a28 28 0 1 0-56 0',
    sil: 'M0 180V120a30 30 0 0 1 60 0v60h-9v-60a21 21 0 0 0-42 0v60z',
  },
  ub: {
    mark: 'M110 30H190M110 52H190M124 20V62M142 20V62M160 20V62M178 20V62',
    sil: 'M0 180v-14h74v14zM8 166v-52h3v52zM46 166v-70h3v70zM0 116h66v3H0z',
  },
  nb: {
    mark: 'M100 24q12-10 25 0t25 0t25 0t25 0M100 42q12-10 25 0t25 0t25 0t25 0M100 60q12-10 25 0t25 0t25 0t25 0',
    sil: 'M0 180v-54q18-16 37 0t37 0v54z',
  },
  dm: {
    mark: 'M150 40m-26 0a26 26 0 1 0 52 0a26 26 0 1 0-52 0M150 40V20M150 40L164 48',
    sil: 'M20 180V92l17-26 17 26v88z',
  },
  cc: {
    mark: 'M124 14h52v52h-52zM150 40m-12 0a12 12 0 1 0 24 0a12 12 0 1 0-24 0',
    sil: 'M4 180v-72h66v72zM4 108l33-22 33 22z',
  },
  ct: {
    mark: 'M110 20H190M110 40H190M110 60H190M130 0V80M150 0V80M170 0V80',
    sil: 'M0 180v-30h74v30zM12 150v-34h50v34z',
  },
};

/* ---------- utilidades ---------- */

function hash(s: string) {
  let h = 2166136261;
  for (const c of s) {
    h ^= c.codePointAt(0)!;
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return h >>> 0;
}

function rng(seed: string) {
  let h = hash(seed) || 1;
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 10000) / 10000;
  };
}

/** Atributo de cor que lê um token, com opacidade opcional. */
function S(prop: 'fill' | 'stroke' | 'stop-color', v: string, op?: number | string) {
  const opProp = prop === 'stop-color' ? 'stop-opacity' : prop === 'fill' ? 'fill-opacity' : 'stroke-opacity';
  return `style="${prop}:var(--${v})${op != null ? `;${opProp}:${op}` : ''}"`;
}

/* ---------- gradientes ---------- */

/** Os gradientes do kit, com prefixo: latão, medalhão, céu, halo, lua e névoa. */
function paints(p: string, sky?: { y1: number; y2: number }) {
  const skyUnits = sky ? ` gradientUnits="userSpaceOnUse" x1="0" y1="${sky.y1}" x2="0" y2="${sky.y2}"` : ' x1="0" y1="0" x2="0" y2="1"';
  return `<linearGradient id="${p}lat" x1="0" y1="0" x2="1" y2="1"><stop offset="0" ${S('stop-color', 'brass-hi')}/><stop offset=".5" ${S('stop-color', 'brass')}/><stop offset="1" ${S('stop-color', 'brass-lo')}/></linearGradient>
  <radialGradient id="${p}med" cx="38%" cy="30%" r="80%"><stop offset="0" ${S('stop-color', 'med-1')}/><stop offset="1" ${S('stop-color', 'med-2')}/></radialGradient>
  <linearGradient id="${p}sky"${skyUnits}><stop offset="0" ${S('stop-color', 'k0')}/><stop offset="1" ${S('stop-color', 'sky-2')}/></linearGradient>
  <radialGradient id="${p}halo"><stop offset="0" ${S('stop-color', 'bulb', 0.34)}/><stop offset=".45" ${S('stop-color', 'brass', 0.1)}/><stop offset="1" ${S('stop-color', 'brass', 0)}/></radialGradient>
  <radialGradient id="${p}moon" cx="40%" cy="35%"><stop offset="0" ${S('stop-color', 'moon-hi')}/><stop offset="1" ${S('stop-color', 'moon-lo')}/></radialGradient>
  <linearGradient id="${p}mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" ${S('stop-color', 'sky-2', 0)}/><stop offset="1" ${S('stop-color', 'sky-2', 0.55)}/></linearGradient>
  <clipPath id="${p}clm"><circle cx="42" cy="42" r="30"/></clipPath>`;
}

/** O medalhão do modo no espaço 0..84, pintado com os gradientes de prefixo `p`. */
function medallion(k: CoverKey, p: string) {
  return `<circle cx="42" cy="42" r="40" fill="url(#${p}med)" stroke="url(#${p}lat)" stroke-width="2.5"/><g clip-path="url(#${p}clm)"><path d="${ART[k].mark}" transform="translate(-108 2)" fill="none" stroke="url(#${p}lat)" stroke-width="2"/></g>`;
}

/* ---------- símbolos globais (cartão de lobby, listas) ---------- */

/** Prefixo dos gradientes e símbolos globais (CoverDefs). */
const G = 'jj-';

/** Id do `<symbol>` do medalhão do modo (viewBox 0 0 84 84). */
export const medallionId = (slug: string) => `${G}m-${coverSpec(slug).key}`;
/** Id do `<symbol>` da faixa de céu com a silhueta do modo (viewBox 0 0 74 180). */
export const stripId = (slug: string) => `${G}s-${coverSpec(slug).key}`;

/** Gradientes globais, um medalhão e uma faixa por modo. Moram uma vez só, na casca. */
export function globalCoverDefs() {
  const keys = Object.keys(ART) as CoverKey[];
  return `${paints(G)}
  ${keys.map((k) => `<symbol id="${G}m-${k}" viewBox="0 0 84 84">${medallion(k, G)}</symbol>`).join('')}
  ${keys
    .map(
      (k) =>
        `<symbol id="${G}s-${k}" viewBox="0 0 74 180" preserveAspectRatio="xMidYMax slice"><rect width="74" height="180" fill="url(#${G}sky)"/><path d="${ART[k].sil}" ${S('fill', 'ground')}/></symbol>`,
    )
    .join('')}`;
}

/* ---------- a cena ---------- */

const f1 = (n: number) => n.toFixed(1);

/** Prédios com janelas acesas entre x0 e x1, de baixo (y=240) para cima. */
function skyline(seed: string, x0: number, x1: number, tall: [number, number], fill: string, windows: number) {
  const r = rng(seed);
  let body = '';
  let lit = '';
  let x = x0;
  while (x < x1) {
    const w = 26 + Math.round(r() * 34);
    const h = tall[0] + Math.round(r() * (tall[1] - tall[0]));
    const top = 240 - h;
    body += `M${x} 240V${top}h${w}V240z`;
    if (windows > 0) {
      for (let wy = top + 8; wy < 222; wy += 14) {
        for (let wx = x + 6; wx < x + w - 6; wx += 11) {
          if (r() < windows) lit += `M${wx} ${wy}h4v6h-4z`;
        }
      }
    }
    x += w + Math.round(r() * 6);
  }
  return `<path d="${body}" ${S('fill', fill)}/>${lit ? `<path d="${lit}" ${S('fill', 'bulb', 0.8)}/>` : ''}`;
}

export interface CoverMarkup {
  viewBox: string;
  /** Conteúdo interno do <svg> (defs + desenho). Gerado aqui, sem dado de usuário. */
  inner: string;
}

const VIEW = { card: '0 0 400 240', wide: '-300 0 700 240' } as const;

/** Os `<defs>` e o desenho, separados. `wide` é a versão do herói: mais céu e cidade à esquerda. */
function coverParts(slug: string, uid: string, wide: boolean) {
  const { key: k, seed } = coverSpec(slug);
  const p = uid.replace(/[^a-zA-Z0-9]/g, '') + '_';
  const x0 = wide ? -300 : 0;
  const w = wide ? 700 : 400;
  const s = `${k}${seed}${wide ? 'w' : ''}`;
  // o medalhão: centro (200, 92), lado 118, acima da faixa de texto dos cartões; na larga fica à
  // direita, o texto do herói ocupa a esquerda
  const med = `<g style="filter:var(--sh-art)" transform="translate(141 33) scale(1.4)">${medallion(k, p)}</g>`;
  const body = `
  <rect x="${x0}" y="0" width="${w}" height="240" ${S('fill', 'k0')}/>
  <rect x="${x0}" y="0" width="${w}" height="240" fill="url(#${p}sky)"/>
  <circle cx="306" cy="50" r="90" fill="url(#${p}halo)"/>
  <circle cx="306" cy="50" r="15" fill="url(#${p}moon)" opacity=".6"/>
  ${skyline(s + 'a', x0 - 10, x0 + w + 10, [70, 132], 'bldg', 0.18)}
  <rect x="${x0}" y="128" width="${w}" height="112" fill="url(#${p}mist)"/>
  ${skyline(s + 'b', x0 - 20, x0 + w + 20, [24, 70], 'bldg-2', 0.08)}
  <rect x="${x0}" y="${f1(150)}" width="${w}" height="20" rx="10" ${S('fill', 'mist', 0.03)}/>
  <rect x="${x0}" y="176" width="${w}" height="26" rx="13" ${S('fill', 'mist', 0.05)}/>
  <rect x="${x0}" y="222" width="${w}" height="18" ${S('fill', 'ground')}/>
  <circle cx="200" cy="200" r="70" fill="url(#${p}halo)"/>
  ${med}`;
  return { defs: `<defs>${paints(p, { y1: 0, y2: 240 })}</defs>`, body };
}

/**
 * A capa de um modo. `uid` deixa os ids dos `<defs>` únicos na página (várias capas iguais
 * convivem). `wide` é a versão do herói: a mesma cena com mais campo à esquerda.
 */
export function coverMarkup(slug: string, uid: string, wide = false): CoverMarkup {
  const { defs, body } = coverParts(slug, uid, wide);
  return { viewBox: wide ? VIEW.wide : VIEW.card, inner: defs + body };
}

export interface CoverSprite {
  /** Id do desenho compartilhado (o alvo do `<use>`). */
  id: string;
  viewBox: string;
  /** Compat (v8): o redesign não desvia a cor por modo. */
  shift: number;
  /** `<defs>` + `<g id>` com o desenho, para morar uma vez só no sprite de `<CoverDefs />`. */
  markup: string;
}

const sprites = new Map<string, CoverSprite>();

/** A capa como sprite: uma por modo e versão, gerada uma vez e memorizada. */
export function coverSprite(slug: string, wide = false): CoverSprite {
  const { key, shift } = coverSpec(slug);
  const id = `cv${key}${wide ? 'w' : ''}`;
  let s = sprites.get(id);
  if (!s) {
    const { defs, body } = coverParts(slug, id, wide);
    s = { id, viewBox: wide ? VIEW.wide : VIEW.card, shift, markup: `${defs}<g id="${id}">${body}</g>` };
    sprites.set(id, s);
  }
  return s;
}

/** Sprite já gerado, pelo id (para `<CoverDefs />`). */
export const spriteById = (id: string) => sprites.get(id);
