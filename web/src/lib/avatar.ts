/**
 * Avatar gerado: um medalhão geométrico determinístico a partir do nome.
 * Três tons de uma mesma família de cor (campo, figura e meio-tom), calculados em OKLCH para que
 * todas as pessoas tenham o mesmo peso visual, e uma composição de no máximo três formas num
 * grid de 36, legível de 20 px (pilhas) a 40 px (vagas da sala).
 * Não muda com o tema: é a identidade da pessoa. No produto, vira reserva do avatar da Steam.
 */

/** FNV-1a com mistura final (o mesmo hash do protótipo). */
export function hashName(s: string) {
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

export type AvatarShape =
  | { t: 'circle'; cx: number; cy: number; r: number; fill: string }
  | { t: 'rect'; x: number; y: number; w: number; h: number; fill: string }
  | { t: 'path'; d: string; fill: string };

export type AvatarKind = 'horizon' | 'orbit' | 'quarters' | 'bars' | 'eclipse' | 'split';

export interface AvatarArt {
  kind: AvatarKind;
  /** Campo (fundo do medalhão). */
  bg: string;
  /** Rotação da composição, em graus, em torno do centro. */
  rot: number;
  shapes: AvatarShape[];
}

/* ---------- cor: OKLCH → sRGB → hsl() ---------- */

const lin2srgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

function oklchToRgb(L: number, C: number, H: number): [number, number, number] | null {
  const a = C * Math.cos((H * Math.PI) / 180);
  const b = C * Math.sin((H * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map(lin2srgb);
  return rgb.every((v) => v >= -0.0005 && v <= 1.0005) ? (rgb.map((v) => Math.min(1, Math.max(0, v))) as [number, number, number]) : null;
}

/** Cor OKLCH como `hsl()`, reduzindo o croma até caber no sRGB. */
export function oklch(L: number, C: number, H: number) {
  let rgb = oklchToRgb(L, C, H);
  for (let c = C; !rgb && c > 0; c -= 0.005) rgb = oklchToRgb(L, Math.max(0, c - 0.005), H);
  const [r, g, b] = rgb ?? [L, L, L];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d > 1e-6) {
    s = d / (1 - Math.abs(2 * l - 1));
    h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return `hsl(${h.toFixed(1)} ${(s * 100).toFixed(1)}% ${(l * 100).toFixed(1)}%)`;
}

/**
 * Famílias de cor (matiz OKLCH). Escolhidas a dedo para fugir dos verdes e amarelos
 * lamacentos que o círculo inteiro dá em tons escuros.
 */
const HUES = [28, 52, 78, 128, 168, 196, 226, 258, 292, 332] as const;

const KINDS: AvatarKind[] = ['horizon', 'orbit', 'quarters', 'bars', 'eclipse', 'split'];

export function avatarArt(name: string): AvatarArt {
  const h = hashName(name);
  const g = hashName(name + '·');
  /** `m` valores distintos a partir dos bits `i` de `x`. */
  const b = (x: number, i: number, m: number) => ((x >>> i) & 255) % m;

  const hue = HUES[((h ^ (g >>> 7)) >>> 0) % HUES.length]!;
  const drift = [-22, 0, 22][b(g, 3, 3)]!;
  const light = b(g, 9, 4) === 0; // 1 em 4: medalhão claro com figura escura
  const step = b(h, 5, 3) * 0.02;
  const field = light ? oklch(0.76 + step, 0.055, hue) : oklch(0.34 + step, 0.055, hue);
  const fig = light ? oklch(0.36, 0.06, hue + drift) : oklch(0.83, 0.07, hue + drift);
  const mid = oklch(light ? 0.6 : 0.62, 0.11, hue - drift / 2);

  const kind = KINDS[b(g, 17, KINDS.length)]!;
  const quarter = b(h, 13, 4) * 90;
  const eighth = b(h, 13, 8) * 45;
  const shapes: AvatarShape[] = [];
  let rot = 0;

  switch (kind) {
    case 'horizon': {
      // sol meio afundado na linha do horizonte
      const y = 19 + b(h, 21, 3) * 2;
      shapes.push({ t: 'circle', cx: 11 + b(g, 25, 4) * 4.5, cy: y, r: 7, fill: mid });
      shapes.push({ t: 'rect', x: -2, y, w: 40, h: 40, fill: fig });
      rot = quarter;
      break;
    }
    case 'orbit': {
      // um corpo grande e um satélite do lado oposto
      const a = (eighth * Math.PI) / 180;
      const k = 4.5 + b(g, 25, 3);
      shapes.push({ t: 'circle', cx: 18 + Math.cos(a) * k, cy: 18 + Math.sin(a) * k, r: 11, fill: fig });
      shapes.push({ t: 'circle', cx: 18 - Math.cos(a) * 10.5, cy: 18 - Math.sin(a) * 10.5, r: 3.6, fill: mid });
      break;
    }
    case 'quarters': {
      // dois quartos de círculo em cantos opostos
      const r2 = 13 + b(g, 25, 3) * 2;
      shapes.push({ t: 'path', d: 'M0 0H22A22 22 0 0 1 0 22Z', fill: fig });
      shapes.push({ t: 'path', d: `M36 36H${36 - r2}A${r2} ${r2} 0 0 1 36 ${36 - r2}Z`, fill: mid });
      rot = quarter;
      break;
    }
    case 'bars': {
      // três faixas paralelas, alternando figura e meio-tom, deslocadas do centro
      const w = 4;
      const gap = 3.2;
      const x0 = 18 - w * 1.5 - gap + (b(g, 25, 3) - 1) * 3.6;
      const seq = b(h, 29, 2) ? [fig, mid, fig] : [mid, fig, mid];
      seq.forEach((fill, i) => shapes.push({ t: 'rect', x: x0 + i * (w + gap), y: -4, w, h: 44, fill }));
      rot = b(h, 13, 4) * 45;
      break;
    }
    case 'eclipse': {
      // crescente: um disco claro mordido pelo próprio campo, e um ponto de meio-tom
      const a = (eighth * Math.PI) / 180;
      shapes.push({ t: 'circle', cx: 18, cy: 18, r: 11.5, fill: fig });
      shapes.push({ t: 'circle', cx: 18 + Math.cos(a) * 6, cy: 18 + Math.sin(a) * 6, r: 10, fill: field });
      shapes.push({ t: 'circle', cx: 18 + Math.cos(a) * 6.5, cy: 18 + Math.sin(a) * 6.5, r: 2.8, fill: mid });
      break;
    }
    case 'split': {
      // diagonal: metade do campo em figura, um disco de meio-tom sobre o corte
      shapes.push({ t: 'path', d: 'M-2 38L38 -2V38Z', fill: fig });
      shapes.push({ t: 'circle', cx: 18, cy: 18, r: 5.5 + b(g, 25, 3), fill: mid });
      rot = quarter;
      break;
    }
  }
  // arredonda a geometria: saída estável e enxuta
  const r1 = (n: number) => Math.round(n * 10) / 10;
  for (const s of shapes) {
    if (s.t === 'circle') Object.assign(s, { cx: r1(s.cx), cy: r1(s.cy), r: r1(s.r) });
    if (s.t === 'rect') Object.assign(s, { x: r1(s.x), y: r1(s.y) });
  }
  return { kind, bg: field, rot, shapes };
}

/**
 * O glifo do avatar do redesign (Design-System): dois polígonos concêntricos, de 3 a 6 lados,
 * girados pelo nome, num disco de 32. Só o desenho: a cor vem do tema (`.av svg path` em base.css,
 * o latão), como no kit. Determinístico, o mesmo algoritmo do protótipo.
 */
export function avatarGlyph(name: string): string {
  let h = 7;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const k = 3 + (h % 4);
  const r0 = (h % 7) / 7;
  const pt = (i: number, R: number) => {
    const a = ((i + r0) / k) * 6.2832;
    return `${(16 + R * Math.cos(a)).toFixed(1)} ${(16 + R * Math.sin(a)).toFixed(1)}`;
  };
  return [10, 5].map((R) => 'M' + Array.from({ length: k }, (_, i) => pt(i, R)).join('L') + 'Z').join('');
}
