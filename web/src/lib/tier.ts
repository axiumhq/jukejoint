/**
 * Nível de aparelho da home (brief v4, "Níveis de aparelho").
 *
 *  - high: 3D completo + passe de composição próprio (vinheta, grão, bloom por mip, aberração).
 *  - mid:  3D com menos andares, sem pós-processamento, DPR menor.
 *  - low:  sem 3D. A cidade SVG do v3 e o mesmo roteiro em HTML.
 *
 * Heurística própria (sem detect-gpu: a base de benchmarks dele vem de um CDN de terceiros
 * a cada visita e parou de ser atualizada; aqui bastam sinais locais). O monitor de quadros
 * da cena 3D rebaixa o nível em tempo de execução se o FPS cair (ver three/TowerScene.tsx).
 *
 * Para forçar um nível ao revisar: `/?tier=low`, `/?tier=mid` ou `/?tier=high`.
 */

export type Tier = 'high' | 'mid' | 'low';

export interface TierInfo {
  tier: Tier;
  /** Por que esse nível (aparece no atributo data-tier-reason, útil para depurar). */
  reason: string;
  /** O nível veio de ?tier= na URL. */
  forced: boolean;
}

const SOFTWARE_GL = /swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic/i;
const WEAK_GPU = /mali-[gt][0-9]{1,2}\b|mali-4|adreno \(tm\) [3-5][0-9]{2}|powervr|intel\(r\) (hd|uhd) graphics [0-9]{3}\b|intel hd graphics|apple a(9|10|11)/i;

let cached: TierInfo | null = null;

function readOverride(): Tier | null {
  try {
    const v = new URLSearchParams(window.location.search).get('tier');
    return v === 'low' || v === 'mid' || v === 'high' ? v : null;
  } catch {
    return null;
  }
}

/** Lê o nome da GPU num contexto descartável. Devolve null se não houver WebGL2. */
function probeGpu(): { renderer: string } | null {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    if (!gl) return null;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return { renderer };
  } catch {
    return null;
  }
}

export function detectTier(): TierInfo {
  if (cached) return cached;
  const forced = readOverride();
  if (forced) return (cached = { tier: forced, reason: 'url', forced: true });

  const mq = (q: string) => window.matchMedia(q).matches;
  if (mq('(prefers-reduced-motion: reduce)')) return (cached = { tier: 'low', reason: 'reduced-motion', forced: false });

  const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
  if (nav.connection?.saveData) return (cached = { tier: 'low', reason: 'save-data', forced: false });

  const gpu = probeGpu();
  if (!gpu) return (cached = { tier: 'low', reason: 'no-webgl2', forced: false });
  if (SOFTWARE_GL.test(gpu.renderer)) return (cached = { tier: 'low', reason: 'software-gl', forced: false });

  const cores = nav.hardwareConcurrency ?? 4;
  const memory = nav.deviceMemory ?? 8;
  if (cores <= 2 || memory <= 2) return (cached = { tier: 'low', reason: 'weak-device', forced: false });

  const touchPhone = mq('(pointer: coarse)') && Math.min(window.screen.width, window.screen.height) < 600;
  if (touchPhone || WEAK_GPU.test(gpu.renderer) || cores <= 4 || memory <= 4) {
    return (cached = { tier: 'mid', reason: touchPhone ? 'phone' : 'modest-gpu', forced: false });
  }
  return (cached = { tier: 'high', reason: 'capable', forced: false });
}
