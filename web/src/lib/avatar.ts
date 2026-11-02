/**
 * Avatar gerado: formas abstratas determinísticas a partir do nome (porte do v8.js).
 * Não muda com o tema: é a identidade da pessoa. No produto, vira reserva do avatar da Steam.
 */

/** FNV-1a com mistura final (o mesmo hash do protótipo, para os mesmos desenhos). */
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
  | { kind: 'band'; y: number; h: number; rot: number; fill: string }
  | { kind: 'disc'; cx: number; cy: number; r: number; fill: string }
  | { kind: 'wave'; d: string; fill: string };

export interface AvatarArt {
  bg: string;
  main: { cx: number; cy: number; r: number; fill: string };
  second: AvatarShape;
}

export function avatarArt(name: string): AvatarArt {
  const h = hashName(name);
  const g = hashName(name + '·');
  const b = (x: number, i: number, m: number) => ((x >>> i) & 255) % m;
  const hue = h % 360;
  const h2 = (hue + 40 + b(g, 4, 80)) % 360;
  const h3 = (hue + 180 + b(g, 12, 60)) % 360;
  const A = `hsl(${h2} 72% ${58 + b(h, 6, 12)}%)`;
  const B = `hsl(${h3} 68% ${62 + b(g, 20, 12)}%)`;
  const rot = b(g, 0, 8) * 22.5;
  const kind = b(g, 28, 3);
  const cx = 4 + b(h, 4, 28);
  const cy = 4 + b(h, 12, 28);
  const r = 14 + b(h, 20, 8);
  const second: AvatarShape =
    kind === 0
      ? { kind: 'band', y: 13 + b(g, 8, 8), h: 8 + b(h, 26, 6), rot, fill: B }
      : kind === 1
        ? { kind: 'disc', cx: 36 - cx, cy: 36 - cy, r: 9 + b(g, 16, 6), fill: B }
        : { kind: 'wave', d: `M-2 ${24 + b(g, 8, 8)} Q18 ${6 + b(g, 16, 10)} 38 ${22 + b(g, 24, 10)} L38 38 L-2 38Z`, fill: B };
  return { bg: `hsl(${hue} 42% 17%)`, main: { cx, cy, r, fill: A }, second };
}
