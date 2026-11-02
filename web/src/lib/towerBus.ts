import { useSyncExternalStore } from 'react';
import type { Tier } from './tier';

/**
 * Canal entre o HTML da home e a cena 3D (que vive num chunk carregado depois).
 * Estado pequeno e mutável fora do React: a cena lê por referência a cada quadro,
 * o HTML assina só o que muda raramente (progresso, nível, andar em foco).
 */

export interface TowerState {
  tier: Tier;
  /** Progresso real do carregamento da cena (0 a 100). */
  progress: number;
  /** A cena 3D já pintou o primeiro quadro e pode substituir o esboço. */
  ready: boolean;
  /** Lobby em foco na lista (hover ou foco de teclado): o andar dele acende. */
  focusId: string | null;
}

let state: TowerState = { tier: 'low', progress: 0, ready: false, focusId: null };
const listeners = new Set<() => void>();

export const towerBus = {
  get: () => state,
  set(patch: Partial<TowerState>) {
    let changed = false;
    for (const k of Object.keys(patch) as (keyof TowerState)[]) {
      if (state[k] !== patch[k]) changed = true;
    }
    if (!changed) return;
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  /** Só sobe: o progresso real nunca anda para trás. */
  progress(p: number) {
    if (p > state.progress) towerBus.set({ progress: Math.min(100, p) });
  },
};

/**
 * Etiquetas dos andares (HTML, aria-hidden): a cena projeta cada andar na tela e move
 * a etiqueta dele direto no DOM, a cada quadro, sem passar pelo React.
 */
export const floorLabels = new Map<string, HTMLElement>();

export function useTower<T>(pick: (s: TowerState) => T): T {
  return useSyncExternalStore(towerBus.subscribe, () => pick(state), () => pick(state));
}

/* ───────── Rolagem → coordenada de cena ─────────
 * Cada <section data-cena> registra o próprio elemento. A cena 3D chama sceneCoord()
 * dentro do laço de quadro (sem ouvir o evento de scroll): lê scrollY uma vez por quadro
 * e devolve em que cena o centro da tela está e quanto dela já passou. */

const sections: (HTMLElement | null)[] = [];
let metrics: { top: number; height: number }[] = [];
let metricsDirty = true;

export function registerScene(index: number, el: HTMLElement | null) {
  sections[index] = el;
  metricsDirty = true;
}

export function invalidateScenes() {
  metricsDirty = true;
}

function measure() {
  const y = window.scrollY;
  metrics = sections.map((el) => {
    if (!el) return { top: 0, height: 1 };
    const r = el.getBoundingClientRect();
    return { top: r.top + y, height: Math.max(1, r.height) };
  });
  metricsDirty = false;
}

/**
 * Onde o centro da tela está no roteiro. Dentro de uma cena: a = b = índice, t = 0 e
 * `localA` vai de 0 a 1. Perto da borda entre duas cenas (meia tela para cada lado):
 * a = anterior no fim (localA = 1), b = seguinte no começo (localB = 0) e t sobe de 0 a 1.
 * A cena 3D mistura as poses: pose(a, localA) → pose(b, localB) por t.
 */
export interface SceneCoord {
  a: number;
  b: number;
  localA: number;
  localB: number;
  t: number;
}

const smooth = (x: number) => x * x * (3 - 2 * x);

export function sceneCoord(): SceneCoord {
  if (metricsDirty || metrics.length !== sections.length) measure();
  if (metrics.length === 0) return { a: 0, b: 0, localA: 0, localB: 0, t: 0 };
  const vh = window.innerHeight;
  const f = window.scrollY + vh * 0.5;
  const zone = vh * 0.42;
  let i = 0;
  for (let k = 0; k < metrics.length; k++) {
    if (f >= metrics[k]!.top - zone) i = k;
  }
  const m = metrics[i]!;
  if (i > 0 && f < m.top + zone) {
    const t = smooth(Math.min(1, Math.max(0, (f - (m.top - zone)) / (2 * zone))));
    return { a: i - 1, b: i, localA: 1, localB: 0, t };
  }
  // A primeira cena começa com a página no topo (centro da tela em meia altura).
  const start = i > 0 ? m.top + zone : m.top + vh * 0.5;
  const end = m.top + m.height - (i < metrics.length - 1 ? zone : 0);
  const local = Math.min(1, Math.max(0, (f - start) / Math.max(1, end - start)));
  return { a: i, b: i, localA: local, localB: local, t: 0 };
}

if (typeof window !== 'undefined') {
  window.addEventListener('resize', invalidateScenes, { passive: true });
}
