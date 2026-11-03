/**
 * Capas dos modos (porte do v8.js): emblemas de oficina oculta em SVG, pintados SÓ com
 * variáveis do tema (`--k*` e `--m*`). Trocar o tema repinta a capa sem gerar nada de novo.
 * Cada modo (e versão larga) vira um sprite único em `<CoverDefs />`, com `<defs>` próprios
 * (os gradientes herdam `--m`, o desvio de matiz do modo); os cartões só o referenciam com
 * `<use>` (ver `coverSprite`). Os quatro desfoques são globais e moram no mesmo sprite.
 * Tudo aqui é puro e determinístico: a mesma capa sai igual a cada render.
 */

export type CoverKey = 'cp' | 'ub' | 'nb' | 'cc' | 'dm' | 'ct';

interface CoverSpec {
  key: CoverKey;
  /** Desvio de matiz do modo, em graus, dentro da família do tema. */
  shift: number;
  /** Semente da fumaça. */
  seed: number;
}

/** Capa por slug de modo (src/data/modes.ts). */
export const COVERS: Record<string, CoverSpec> = {
  'circulo-profano': { key: 'cp', shift: 0, seed: 7 },
  'ultimo-bonde': { key: 'ub', shift: -12, seed: 3 },
  neblina: { key: 'nb', shift: 8, seed: 11 },
  'cerco-ao-cofre': { key: 'cc', shift: 16, seed: 19 },
  'duelo-meia-noite': { key: 'dm', shift: -18, seed: 5 },
  'campo-de-treino': { key: 'ct', shift: 22, seed: 23 },
};

export const coverSpec = (slug: string): CoverSpec => COVERS[slug] ?? COVERS['circulo-profano']!;

/** Ids dos desfoques globais (CoverDefs). */
export const BLUR = { b1: 'cvfb1', b2: 'cvfb2', b3: 'cvfb3', b4: 'cvfb4' } as const;

export function globalCoverDefs() {
  return `<filter id="${BLUR.b1}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.1"/></filter>
  <filter id="${BLUR.b2}" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="3.2"/></filter>
  <filter id="${BLUR.b3}" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="9"/></filter>
  <filter id="${BLUR.b4}" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="24"/></filter>`;
}

const fb = (n: 1 | 2 | 3 | 4) => `filter="url(#cvfb${n})"`;

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

/** Atributo de cor que lê um token do tema, com opacidade opcional. */
function S(prop: 'fill' | 'stroke' | 'stop-color' | 'flood-color', v: string, op?: number | string) {
  const opProp = prop === 'stop-color' ? 'stop-opacity' : prop === 'fill' ? 'fill-opacity' : 'stroke-opacity';
  return `style="${prop}:var(--${v})${op != null ? `;${opProp}:${op}` : ''}"`;
}

const polar = (cx: number, cy: number, r: number, a: number): [number, number] => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
const f1 = (n: number) => n.toFixed(1);

function embers(seed: string, n: number, area: [number, number, number, number]) {
  const r = rng('e' + seed);
  let o = '';
  for (let i = 0; i < n; i++) {
    const x = area[0] + r() * area[2];
    const y = area[1] + r() * area[3];
    const s = 0.4 + r() * 1.3;
    const op = 0.25 + r() * 0.6;
    const hot = r() > 0.7;
    o += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${s.toFixed(2)}" ${S('fill', hot ? 'kc' : 'kh', op.toFixed(2))}${s > 1.3 ? ` ${fb(1)}` : ''}/>`;
  }
  return o;
}

/**
 * Caixa visível de cada versão, no espaço do `<svg>` (o viewBox). Com `slice` o navegador só
 * corta dentro dela, então a fumaça não precisa ser calculada fora: a região do filtro fica
 * presa aqui (o ruído depende só da coordenada, então o que aparece é o mesmo de antes).
 * As oitavas da fumaça (4 e 3, eram 5 e 4) param onde a seguinte já não se vê: cada uma tem
 * metade da amplitude da anterior, e o custo do ruído cresce com o número delas.
 */
const VIEW = { card: [0, 0, 400, 240], wide: [-300, 0, 700, 240] } as const;

function coverDefs(u: string, seed: number, wide: boolean) {
  const [vx, vy, vw, vh] = wide ? VIEW.wide : VIEW.card;
  const region = `filterUnits="userSpaceOnUse" x="${vx}" y="${vy}" width="${vw}" height="${vh}"`;
  return `<defs>
  <radialGradient id="${u}g" gradientUnits="userSpaceOnUse" cx="200" cy="118" r="260"><stop offset="0" ${S('stop-color', 'm2', 0.5)}/><stop offset=".34" ${S('stop-color', 'm1', 0.95)}/><stop offset=".78" ${S('stop-color', 'k0')}/><stop offset="1" ${S('stop-color', 'k0')}/></radialGradient>
  <linearGradient id="${u}mg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".15"/><stop offset=".45" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="1"/></linearGradient>
  <mask id="${u}mk" maskUnits="userSpaceOnUse" x="-420" y="-40" width="1240" height="320"><rect x="-420" y="-40" width="1240" height="320" fill="url(#${u}mg)"/></mask>
  <linearGradient id="${u}ng" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="240"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".3" stop-color="#fff" stop-opacity="1"/><stop offset=".55" stop-color="#fff" stop-opacity=".85"/><stop offset=".76" stop-color="#fff" stop-opacity=".3"/><stop offset="1" stop-color="#fff" stop-opacity=".12"/></linearGradient>
  <linearGradient id="${u}nh" gradientUnits="userSpaceOnUse" x1="-60" y1="0" x2="110" y2="0"><stop offset="0" stop-opacity=".75"/><stop offset="1" stop-opacity="0"/></linearGradient>
  <mask id="${u}nk" maskUnits="userSpaceOnUse" x="-420" y="-40" width="1240" height="320"><rect x="-420" y="-40" width="1240" height="320" fill="url(#${u}ng)"/><rect x="-420" y="-40" width="1240" height="320" fill="url(#${u}nh)"/></mask>
  <linearGradient id="${u}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" ${S('stop-color', 'kh')}/><stop offset=".26" ${S('stop-color', 'kl')}/><stop offset=".48" ${S('stop-color', 'kh', 0.95)}/><stop offset=".7" ${S('stop-color', 'kl')}/><stop offset="1" ${S('stop-color', 'm2')}/></linearGradient>
  <linearGradient id="${u}v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" ${S('stop-color', 'kc')}/><stop offset=".45" ${S('stop-color', 'kh')}/><stop offset="1" ${S('stop-color', 'kl')}/></linearGradient>
  <linearGradient id="${u}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" ${S('stop-color', 'm2', 0)}/><stop offset="1" ${S('stop-color', 'm2', 0.7)}/></linearGradient>
  <radialGradient id="${u}vg" cx="50%" cy="46%" r="70%"><stop offset=".55" ${S('stop-color', 'k0', 0)}/><stop offset="1" ${S('stop-color', 'k0', 0.92)}/></radialGradient>
  <filter id="${u}s" ${region}>
    <feTurbulence type="fractalNoise" baseFrequency=".0026 .017" numOctaves="4" seed="${seed}" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  4.4 0 0 0 -2.02" result="a"/>
    <feFlood ${S('flood-color', 'ks')} result="c"/><feComposite in="c" in2="a" operator="in"/></filter>
  <filter id="${u}s2" ${region}>
    <feTurbulence type="fractalNoise" baseFrequency=".006 .045" numOctaves="3" seed="${seed + 40}" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  5 0 0 0 -2.5" result="a"/>
    <feFlood ${S('flood-color', 'kh')} result="c"/><feComposite in="c" in2="a" operator="in"/></filter>
  </defs>`;
}

const smoke = (u: string, op = 0.4, y = -20, h = 300) =>
  `<rect x="-420" y="${y}" width="1240" height="${h}" filter="url(#${u}s)" opacity="${op}" mask="url(#${u}mk)"/>`;
const smoke2 = (u: string, op = 0.18, y = -20, h = 300) => `<rect x="-420" y="${y}" width="1240" height="${h}" filter="url(#${u}s2)" opacity="${op}"/>`;

/* ---------- os seis emblemas ---------- */

function emblem(k: CoverKey, u: string) {
  const B = `url(#${u}b)`;
  if (k === 'cp') {
    // anel que fecha: um diafragma de sete lâminas, com pinos no aro
    const C: [number, number] = [200, 120];
    let ticks = '';
    let arcs = '';
    let nodes = '';
    let blades = '';
    let edges = '';
    for (let i = 0; i < 120; i++) {
      const a = (i / 120) * Math.PI * 2;
      const L = i % 10 ? 4 : 8;
      const [x1, y1] = polar(...C, 90, a);
      const [x2, y2] = polar(...C, 90 - L, a);
      ticks += `<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" ${S('stroke', 'kh', i % 10 ? 0.32 : 0.7)} stroke-width="${i % 10 ? 0.6 : 1}"/>`;
    }
    // Lâmina i: do vértice V da abertura (heptágono) sai uma curva até o pino O no aro.
    const th = (i: number) => -Math.PI / 2 + (i / 7) * Math.PI * 2;
    const V = (i: number) => polar(...C, 21, th(i));
    const Q = (i: number) => polar(...C, 45, th(i) + 0.3);
    const O = (i: number) => polar(...C, 61, th(i) + 1.3);
    const pt = (p: [number, number]) => p.map(f1).join(' ');
    const open = 'M' + [0, 1, 2, 3, 4, 5, 6].map((i) => pt(V(i))).join('L') + 'Z';
    for (let i = 0; i < 7; i++) {
      const j = (i + 1) % 7;
      blades += `<path d="M${pt(V(i))}L${pt(V(j))}Q${pt(Q(j))} ${pt(O(j))}A61 61 0 0 0 ${pt(O(i))}Q${pt(Q(i))} ${pt(V(i))}Z" ${S('fill', i % 2 ? 'kl' : 'k1', 0.92)}/>`;
      edges += `M${pt(V(i))}Q${pt(Q(i))} ${pt(O(i))}`;
    }
    const P = [0, 1, 2, 3, 4, 5, 6].map(O);
    for (let i = 0; i < 7; i++) {
      const a0 = -Math.PI / 2 + (i / 7) * Math.PI * 2 + 0.12;
      const a1 = a0 + (Math.PI * 2) / 7 - 0.24;
      const [x0, y0] = polar(...C, 58, a0);
      const [x1, y1] = polar(...C, 58, a1);
      arcs += `M${f1(x0)} ${f1(y0)}A58 58 0 0 1 ${f1(x1)} ${f1(y1)}`;
    }
    for (const [x, y] of P)
      nodes += `<circle cx="${f1(x)}" cy="${f1(y)}" r="7" ${S('fill', 'm2', 0.6)} ${fb(2)}/><circle cx="${f1(x)}" cy="${f1(y)}" r="2.6" ${S('fill', 'kc')}/>`;
    return `
    <rect x="194" y="-40" width="12" height="320" ${S('fill', 'm2', 0.35)} ${fb(3)}/>
    <ellipse cx="200" cy="218" rx="170" ry="16" ${S('fill', 'm2', 0.35)} ${fb(3)}/>
    <circle cx="200" cy="120" r="104" ${S('fill', 'm2', 0.22)} ${fb(4)}/>
    <circle cx="200" cy="120" r="73" ${S('fill', 'k0', 0.62)}/>
    <circle cx="200" cy="120" r="99" fill="none" ${S('stroke', 'kh', 0.3)} stroke-width=".6"/>
    <circle cx="200" cy="120" r="95" fill="none" stroke="${B}" stroke-width="3.2"/>
    ${ticks}
    <circle cx="200" cy="120" r="76" fill="none" ${S('stroke', 'k0', 0.7)} stroke-width="11"/>
    <circle cx="200" cy="120" r="76" fill="none" stroke="${B}" stroke-width="7"/>
    <circle cx="200" cy="120" r="72.2" fill="none" ${S('stroke', 'k0', 0.6)} stroke-width="1"/>
    <path d="M131 92A76 76 0 0 1 228 49" fill="none" ${S('stroke', 'kc', 0.9)} stroke-width="1.6" stroke-linecap="round" ${fb(1)}/>
    <circle cx="200" cy="120" r="30" ${S('fill', 'kc', 0.5)} ${fb(3)}/>
    ${blades}
    <path d="${edges}" fill="none" ${S('stroke', 'k0', 0.7)} stroke-width="2.4"/>
    <path d="${edges}" fill="none" stroke="${B}" stroke-width="1.3"/>
    <path d="${edges}" fill="none" ${S('stroke', 'kc', 0.5)} stroke-width=".5" transform="translate(-.7 -.7)"/>
    <path d="${open}" fill="none" ${S('stroke', 'kc', 0.85)} stroke-width="1" stroke-linejoin="round"/>
    <path d="${arcs}" fill="none" ${S('stroke', 'm2')} stroke-width="6" opacity=".7" ${fb(2)}/>
    <path d="${arcs}" fill="none" ${S('stroke', 'kh')} stroke-width="1.8" stroke-linecap="round"/>
    ${nodes}
    <circle cx="200" cy="120" r="11" ${S('fill', 'kc', 0.6)} ${fb(2)}/>
    <circle cx="200" cy="120" r="3.4" ${S('fill', 'kc')}/>`;
  }
  if (k === 'ub') {
    // trilho, catenária e farol no ponto de fuga
    const V = [200, 106] as const;
    let sl = '';
    let masts = '';
    for (let i = 1; i <= 16; i++) {
      const f = Math.pow(i / 16, 2.2);
      const y = V[1] + 138 * f;
      const hw = 3 + 128 * f;
      sl += `<line x1="${f1(200 - hw)}" y1="${f1(y)}" x2="${f1(200 + hw)}" y2="${f1(y)}" ${S('stroke', 'kl', 0.9)} stroke-width="${(0.4 + 3.2 * f).toFixed(2)}"/><line x1="${f1(200 - hw)}" y1="${f1(y - 0.6 - 1.2 * f)}" x2="${f1(200 + hw)}" y2="${f1(y - 0.6 - 1.2 * f)}" ${S('stroke', 'kh', (0.12 + 0.3 * f).toFixed(2))} stroke-width="${(0.3 + 0.8 * f).toFixed(2)}"/>`;
    }
    for (let i = 1; i <= 6; i++) {
      const f = Math.pow(i / 6, 1.9);
      const xl = 200 - 14 - 236 * f;
      const xr = 200 + 14 + 236 * f;
      const yt = V[1] - 16 - 96 * f;
      const yb = V[1] + 138 * f + 4;
      const w = (0.5 + 3.4 * f).toFixed(2);
      const w2 = (0.4 + 1.2 * f).toFixed(2);
      masts += `<line x1="${f1(xl)}" y1="${f1(yt)}" x2="${f1(xl)}" y2="${f1(yb)}" ${S('stroke', 'kl')} stroke-width="${w}"/><line x1="${f1(xr)}" y1="${f1(yt)}" x2="${f1(xr)}" y2="${f1(yb)}" ${S('stroke', 'kl')} stroke-width="${w}"/>
      <line x1="${f1(xl)}" y1="${f1(yt + 4 * f)}" x2="${f1(200 - 6 - 60 * f)}" y2="${f1(yt + 4 * f)}" ${S('stroke', 'kh', 0.35)} stroke-width="${w2}"/><line x1="${f1(xr)}" y1="${f1(yt + 4 * f)}" x2="${f1(200 + 6 + 60 * f)}" y2="${f1(yt + 4 * f)}" ${S('stroke', 'kh', 0.35)} stroke-width="${w2}"/>`;
    }
    return `
    <ellipse cx="200" cy="106" rx="260" ry="34" ${S('fill', 'm2', 0.5)} ${fb(4)}/>
    ${masts}
    <path d="M200 92 L-60 -10 M200 92 L460 -10" ${S('stroke', 'kh', 0.5)} stroke-width=".7"/>
    <path d="M200 96 Q60 40 -60 14 M200 96 Q340 40 460 14" fill="none" ${S('stroke', 'kh', 0.3)} stroke-width=".5"/>
    ${sl}
    <polygon points="197.6,106 199.4,106 86,250 60,250" fill="${B}"/>
    <polygon points="200.6,106 202.4,106 340,250 314,250" fill="${B}"/>
    <line x1="197.6" y1="106" x2="60" y2="250" ${S('stroke', 'kc', 0.85)} stroke-width=".8"/>
    <line x1="202.4" y1="106" x2="340" y2="250" ${S('stroke', 'kc', 0.85)} stroke-width=".8"/>
    <polygon points="197,106 203,106 360,250 40,250" ${S('fill', 'm2', 0.12)} ${fb(3)}/>
    <ellipse cx="200" cy="104" rx="130" ry="1.6" ${S('fill', 'kc', 0.7)} ${fb(1)}/>
    <circle cx="200" cy="104" r="26" ${S('fill', 'm2', 0.7)} ${fb(3)}/>
    <circle cx="200" cy="104" r="7" ${S('fill', 'kc', 0.9)} ${fb(2)}/>
    <circle cx="200" cy="104" r="2.6" ${S('fill', 'kc')}/>`;
  }
  if (k === 'nb') {
    // bússola afogada na neblina
    const C: [number, number] = [200, 116];
    let rays = '';
    let ring = '';
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const L = i % 4 ? 44 : 118;
      const [x, y] = polar(...C, L, a);
      rays += `<line x1="200" y1="116" x2="${f1(x)}" y2="${f1(y)}" ${S('stroke', 'kh', i % 4 ? 0.25 : 0.55)} stroke-width="${i % 4 ? 0.6 : 1}"/>`;
    }
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const [x1, y1] = polar(...C, 70, a);
      const [x2, y2] = polar(...C, i % 4 ? 66 : 62, a);
      ring += `<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" ${S('stroke', 'kh', 0.5)} stroke-width=".7"/>`;
    }
    // A neblina é um banco na altura da bússola e se abre embaixo, onde mora o título
    // (cartões e herói no celular) — senão o texto claro afunda na névoa clara.
    return `
    <g mask="url(#${u}nk)">
    <polygon points="146,-30 166,-30 300,260 40,260" ${S('fill', 'm2', 0.26)} ${fb(3)}/>
    ${smoke(u, 0.5, 20, 260)}
    </g>
    <circle cx="200" cy="116" r="70" fill="none" ${S('stroke', 'kh', 0.55)} stroke-width="1.1"/>
    <circle cx="200" cy="116" r="74" fill="none" ${S('stroke', 'kh', 0.22)} stroke-width=".6" stroke-dasharray="2 4"/>
    ${ring}${rays}
    <path d="M200 64 L208 116 L200 168 L192 116Z" fill="${B}" opacity=".92"/>
    <path d="M148 116 L200 110 L252 116 L200 122Z" fill="${B}" opacity=".6"/>
    <circle cx="200" cy="116" r="28" ${S('fill', 'm2', 0.6)} ${fb(3)}/>
    <circle cx="200" cy="116" r="3" ${S('fill', 'kc')}/>
    <circle cx="153" cy="40" r="5" ${S('fill', 'kc', 0.9)} ${fb(2)}/>
    <g mask="url(#${u}nk)">
    <ellipse cx="200" cy="142" rx="300" ry="30" ${S('fill', 'ks', 0.13)} ${fb(4)}/>
    ${smoke(u, 0.4, 70, 170)}${smoke2(u, 0.12, 50, 170)}
    </g>`;
  }
  if (k === 'cc') {
    // roda de cofre com treliça
    let lat = '';
    let bolts = '';
    let spokes = '';
    for (let i = -14; i <= 24; i++) {
      lat += `<line x1="${i * 26 - 110}" y1="-20" x2="${i * 26 + 150}" y2="270" ${S('stroke', 'kl', 0.55)} stroke-width=".6"/><line x1="${i * 26 + 150}" y1="-20" x2="${i * 26 - 110}" y2="270" ${S('stroke', 'kl', 0.55)} stroke-width=".6"/>`;
    }
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const [x, y] = polar(200, 120, 93, a);
      bolts += `<circle cx="${f1(x)}" cy="${f1(y)}" r="2.7" fill="${B}"/><circle cx="${f1(x - 0.7)}" cy="${f1(y - 0.7)}" r=".8" ${S('fill', 'kc', 0.8)}/>`;
    }
    for (let i = 0; i < 6; i++) {
      const r = i * 60 + 14;
      spokes += `<g transform="rotate(${r} 200 120)"><line x1="200" y1="102" x2="200" y2="64" stroke="${B}" stroke-width="5" stroke-linecap="round"/><circle cx="200" cy="60" r="6.4" fill="${B}"/><circle cx="198.6" cy="58.6" r="1.6" ${S('fill', 'kc', 0.8)}/></g>`;
    }
    return (
      lat +
      `
    <circle cx="200" cy="120" r="112" ${S('fill', 'm2', 0.32)} ${fb(4)}/>
    <circle cx="200" cy="120" r="101" ${S('fill', 'k0', 0.82)}/>
    <circle cx="200" cy="120" r="93" fill="none" stroke="${B}" stroke-width="12"/>
    <circle cx="200" cy="120" r="86.5" fill="none" ${S('stroke', 'k0', 0.6)} stroke-width="1.2"/>
    ${bolts}
    <circle cx="200" cy="120" r="74" fill="none" ${S('stroke', 'm2', 0.7)} stroke-width=".8"/>
    <circle cx="200" cy="120" r="62" fill="none" stroke="${B}" stroke-width="3.4"/>
    ${spokes}
    <circle cx="200" cy="120" r="21" fill="${B}"/>
    <circle cx="200" cy="120" r="14" fill="none" ${S('stroke', 'k0', 0.55)} stroke-width="1.2"/>
    <circle cx="200" cy="120" r="6.5" ${S('fill', 'k0')}/>
    <path d="M124 70A93 93 0 0 1 222 29" fill="none" ${S('stroke', 'kc', 0.85)} stroke-width="2.2" stroke-linecap="round" ${fb(1)}/>`
    );
  }
  if (k === 'dm') {
    // relógio à meia-noite, ponteiros como lâminas
    let ticks = '';
    for (let i = 0; i < 60; i++) {
      const L = i % 5 ? 4 : 11;
      ticks += `<line x1="200" y1="36" x2="200" y2="${36 + L}" ${S('stroke', i % 5 ? 'kh' : 'kc', i % 5 ? 0.3 : 0.75)} stroke-width="${i % 5 ? 0.6 : 1.4}" transform="rotate(${i * 6} 200 126)"/>`;
    }
    const blade = (rot: number, len: number, w: number) =>
      `<g transform="rotate(${rot} 200 126)"><polygon points="${200 - w},132 200,${126 - len} ${200 + w},132 200,144" fill="url(#${u}v)"/><line x1="200" y1="${126 - len + 2}" x2="200" y2="138" ${S('stroke', 'kc', 0.9)} stroke-width=".6"/><rect x="${200 - w * 2.2}" y="130" width="${w * 4.4}" height="2.4" rx="1" fill="${B}"/></g>`;
    return `
    <circle cx="312" cy="54" r="30" ${S('fill', 'kh', 0.6)}/><circle cx="324" cy="46" r="28" ${S('fill', 'k0')}/>
    <circle cx="312" cy="54" r="40" ${S('fill', 'm2', 0.25)} ${fb(3)}/>
    <circle cx="200" cy="126" r="98" ${S('fill', 'm2', 0.22)} ${fb(4)}/>
    <circle cx="200" cy="126" r="92" ${S('fill', 'k0', 0.72)}/>
    <circle cx="200" cy="126" r="92" fill="none" stroke="${B}" stroke-width="4"/>
    <circle cx="200" cy="126" r="97" fill="none" ${S('stroke', 'kh', 0.22)} stroke-width=".6"/>
    ${ticks}
    <ellipse cx="200" cy="42" rx="42" ry="20" ${S('fill', 'm2', 0.7)} ${fb(3)}/>
    <g ${fb(3)} opacity=".8">${blade(-9, 86, 6)}${blade(7, 74, 5)}</g>
    ${blade(-9, 86, 5)}${blade(7, 74, 4)}
    <circle cx="200" cy="126" r="8" fill="${B}"/><circle cx="200" cy="126" r="2.4" ${S('fill', 'kc')}/>
    <circle cx="200" cy="40" r="2.6" ${S('fill', 'kc')} ${fb(1)}/>`;
  }
  // ct: estande com grade em perspectiva, alvo e régua
  let g = '';
  let ruler = '';
  for (let i = -18; i <= 28; i++) {
    const xb = i * 28 - 130;
    const x0 = 200 + (xb - 200) * 0.22;
    g += `<line x1="${f1(x0)}" y1="128" x2="${xb}" y2="250" stroke="url(#${u}f)" stroke-width=".8"/>`;
  }
  for (let i = 1; i <= 12; i++) {
    const f = Math.pow(i / 12, 2);
    const y = 128 + 122 * f;
    g += `<line x1="-420" y1="${f1(y)}" x2="820" y2="${f1(y)}" ${S('stroke', 'm2', (0.08 + 0.5 * f).toFixed(2))} stroke-width="${(0.3 + 0.8 * f).toFixed(2)}"/>`;
  }
  for (let i = 0; i <= 24; i++) {
    const y = 30 + i * 7.5;
    ruler += `<line x1="${i % 4 ? 318 : 312}" y1="${y}" x2="324" y2="${y}" ${S('stroke', 'kh', i % 4 ? 0.35 : 0.7)} stroke-width="${i % 4 ? 0.6 : 1}"/>`;
  }
  return (
    g +
    ruler +
    `
    <line x1="-420" y1="128" x2="820" y2="128" ${S('stroke', 'm2')} stroke-width="1" ${fb(1)}/>
    <ellipse cx="200" cy="128" rx="220" ry="16" ${S('fill', 'm2', 0.35)} ${fb(3)}/>
    <line x1="324" y1="30" x2="324" y2="210" ${S('stroke', 'kh', 0.5)} stroke-width=".7"/>
    <ellipse cx="200" cy="176" rx="50" ry="7" ${S('fill', 'k0', 0.85)} ${fb(2)}/>
    <line x1="200" y1="132" x2="200" y2="176" ${S('stroke', 'kl')} stroke-width="2.4"/>
    <circle cx="200" cy="90" r="50" ${S('fill', 'm2', 0.3)} ${fb(4)}/>
    <circle cx="200" cy="90" r="38" ${S('fill', 'k0', 0.6)}/>
    <circle cx="200" cy="90" r="38" fill="none" stroke="${B}" stroke-width="3"/>
    <circle cx="200" cy="90" r="27" fill="none" ${S('stroke', 'm2')} stroke-width="5" opacity=".85"/>
    <circle cx="200" cy="90" r="16" fill="none" ${S('stroke', 'kh', 0.8)} stroke-width="1.2"/>
    <circle cx="200" cy="90" r="6" ${S('fill', 'm2')}/><circle cx="200" cy="90" r="2" ${S('fill', 'kc')}/>
    <path d="M200 40v12M200 128v-12M150 90h12M250 90h-12" ${S('stroke', 'kc', 0.7)} stroke-width="1"/>
    <path d="M168 58a45 45 0 0 1 40-13" fill="none" ${S('stroke', 'kc', 0.8)} stroke-width="1.4" stroke-linecap="round" ${fb(1)}/>`
  );
}

/** Enquadramento por capa: [escala, dx, dy], no cartão normal e na versão larga (herói). */
const FRAME: Record<CoverKey, [number, number, number]> = {
  cp: [1.06, 0, 4],
  ub: [1, 0, 0],
  nb: [1.12, 0, 6],
  cc: [1.5, 74, 34],
  dm: [1.22, -46, 16],
  ct: [1.08, 0, 6],
};
const FRAME_W: Record<CoverKey, [number, number, number]> = {
  cp: [1.04, 0, 2],
  ub: [1, 0, 0],
  nb: [1.1, 0, 4],
  cc: [1.16, 20, 8],
  dm: [1.06, 0, 4],
  ct: [1, 0, 0],
};

function frame(k: CoverKey, wide: boolean) {
  const [s, dx, dy] = (wide ? FRAME_W : FRAME)[k];
  return `translate(${200 + dx} ${120 + dy}) scale(${s}) translate(-200 -120)`;
}

export interface CoverMarkup {
  viewBox: string;
  /** Conteúdo interno do <svg> (defs + desenho). Gerado aqui, sem dado de usuário. */
  inner: string;
}

/**
 * A capa de um modo. `uid` deixa os ids dos `<defs>` únicos na página (várias capas iguais
 * convivem). `wide` é a versão do herói: a mesma cena com mais campo dos lados.
 */
export function coverMarkup(slug: string, uid: string, wide = false): CoverMarkup {
  const { defs, body } = coverParts(slug, uid, wide);
  return { viewBox: wide ? '-300 0 700 240' : '0 0 400 240', inner: defs + body };
}

/** Os `<defs>` (gradientes, máscaras e fumaça) e o desenho, separados. */
function coverParts(slug: string, uid: string, wide: boolean) {
  const { key: k, seed } = coverSpec(slug);
  const u = uid.replace(/[^a-zA-Z0-9]/g, '') + '_';
  const sm = k === 'nb' ? '' : smoke(u, k === 'ub' ? 0.45 : 0.34);
  const body = `
  <rect x="-420" y="-40" width="1240" height="320" ${S('fill', 'k0')}/>
  <rect x="-420" y="-40" width="1240" height="320" fill="url(#${u}g)"/>
  ${sm}
  <g transform="${frame(k, wide)}">${emblem(k, u)}</g>
  ${k === 'nb' ? '' : smoke2(u, 0.1, 110, 170)}
  ${embers(k + (wide ? 'w' : ''), wide ? 34 : 20, wide ? [-260, 10, 640, 210] : [16, 12, 368, 214])}
  <rect x="-420" y="-40" width="1240" height="320" fill="url(#${u}vg)"/>`;
  return { defs: coverDefs(u, seed, wide), body };
}

export interface CoverSprite {
  /** Id do desenho compartilhado (o alvo do `<use>`). */
  id: string;
  viewBox: string;
  /** Desvio de matiz do modo (`--m`) para o contêiner dos `<defs>`. */
  shift: number;
  /** `<defs>` + `<g id>` com o desenho, para morar uma vez só no sprite de `<CoverDefs />`. */
  markup: string;
}

const sprites = new Map<string, CoverSprite>();

/**
 * A capa como sprite: uma por modo e versão, gerada uma vez e memorizada. Cada cartão só
 * aponta para ela com `<use>`, que herda `--m` e os tokens do tema de onde é usado; os
 * gradientes e filtros moram no sprite, dentro de um contêiner com o mesmo `--m`.
 */
export function coverSprite(slug: string, wide = false): CoverSprite {
  const { key, shift } = coverSpec(slug);
  const id = `cv${key}${wide ? 'w' : ''}`;
  let s = sprites.get(id);
  if (!s) {
    const { defs, body } = coverParts(slug, id, wide);
    s = { id, viewBox: wide ? '-300 0 700 240' : '0 0 400 240', shift, markup: `${defs}<g id="${id}">${body}</g>` };
    sprites.set(id, s);
  }
  return s;
}

/** Sprite já gerado, pelo id (para `<CoverDefs />`). */
export const spriteById = (id: string) => sprites.get(id);
