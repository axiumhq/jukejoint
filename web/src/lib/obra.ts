import { joinOrder, type TowerFloor } from './towerData';

/**
 * "A Obra Encantada" (docs/design/diagnostico-assinatura.md, seção E.3): o roteiro da
 * abertura, em segundos a partir do instante em que a cena 3D aparece. Puro (sem three),
 * para testar e para a cena e o HTML lerem os mesmos tempos.
 *
 *   0,00  círculo ritual na praça já aceso pelo carregamento real; ele inflama
 *   0,30  fios âmbar sobem do círculo e desenham o esqueleto da torre
 *   0,35  o saguão sobe do chão
 *   0,90  andares caem do céu na ordem de CRIAÇÃO dos lobbies, STEP s entre eles,
 *         girando de ~15° a 0°, com tranco e poeira de brasa no encaixe
 *   +0,10 depois de cada pouso: ornamentos (pilastras, frisos, faixas) se aparafusam
 *   ~2,3  os fios se soltam ponto a ponto; a coroa desce; a agulha sobe de dentro dela
 *   ~3,0  o farol acende em chama azul fria
 *   1,80+ uma brasa por jogador real voa da cidade para a janela dele, na ordem real
 *         de entrada, e a janela acende quando ela chega
 *   clímax: a última janela acesa (o título se acende aqui)
 */

export const OBRA = {
  /** Primeiro andar começa a cair. */
  FIRST: 0.9,
  /** Intervalo entre andares (spec: 80 ms). */
  STEP: 0.08,
  /** Duração da queda de um andar. */
  FALL: 0.46,
  /** Tranco do pouso. */
  JOLT: 0.2,
  /** Ornamentos começam a se aparafusar depois do pouso. */
  ORN_DELAY: 0.1,
  ORN: 0.3,
  /** Voo de uma brasa. */
  FLY: 0.72,
  /** Primeira brasa sai da cidade. */
  EMBER_START: 1.8,
  /** Janela máxima para todas as brasas saírem. */
  EMBER_SPREAD: 1.0,
  /** Gesto do usuário: o resto da abertura cabe nesse tempo (segundos reais). */
  SKIP: 0.3,
} as const;

export interface ObraEmber {
  /** Índice do andar (de baixo para cima) e da janela (vaga). */
  f: number;
  w: number;
  launch: number;
  arrive: number;
}

export interface ObraPlan {
  /** Início da queda de cada andar (índice de baixo para cima). */
  fall: number[];
  /** Ordem de criação de cada andar (0 = o lobby mais antigo). */
  rank: number[];
  embers: ObraEmber[];
  plinth: [number, number];
  threadsIn: [number, number];
  threadsOut: [number, number];
  crown: number;
  spire: number;
  beacon: number;
  /** A última janela acende (ou o farol, se não houver ninguém). */
  climax: number;
  end: number;
}

/** Fim do pouso de um andar (queda + tranco). */
export const landedAt = (plan: ObraPlan, f: number) => (plan.fall[f] ?? 0) + OBRA.FALL;

export function planObra(floors: TowerFloor[]): ObraPlan {
  const n = floors.length;
  // Ordem de criação: quem abriu há mais tempo cai primeiro (empate: ordem da pilha).
  const byAge = floors.map((fl, i) => ({ i, age: fl.lobby.minutesAgo })).sort((a, b) => b.age - a.age || a.i - b.i);
  const rank = new Array<number>(n).fill(0);
  byAge.forEach((e, r) => (rank[e.i] = r));
  const fall = rank.map((r) => OBRA.FIRST + r * OBRA.STEP);
  const lastLand = n ? Math.max(...fall) + OBRA.FALL : OBRA.FIRST;

  const crown = lastLand - 0.05;
  const spire = crown + 0.4;
  const beacon = spire + 0.45;

  const order = joinOrder(floors);
  const spread = Math.min(OBRA.EMBER_SPREAD, order.length * 0.012);
  const embers: ObraEmber[] = order.map(([f, w], i) => {
    const wanted = OBRA.EMBER_START + (order.length > 1 ? (i / (order.length - 1)) * spread : 0);
    // Nunca antes do andar dela pousar.
    const launch = Math.max(wanted, (fall[f] ?? 0) + OBRA.FALL + 0.05);
    return { f, w, launch, arrive: launch + OBRA.FLY };
  });
  const lastArrive = embers.reduce((m, e) => Math.max(m, e.arrive), 0);
  const climax = Math.max(lastArrive, beacon) + 0.1;
  return {
    fall,
    rank,
    embers,
    plinth: [0.35, 0.85],
    threadsIn: [0.3, 1.25],
    threadsOut: [lastLand - 0.35, lastLand + 0.45],
    crown,
    spire,
    beacon,
    climax,
    end: climax + 0.35,
  };
}

/**
 * Relógio da abertura com o "pulo" do gesto: depois de um gesto, o tempo corre o bastante
 * para o resto do roteiro caber em OBRA.SKIP segundos reais.
 */
export function advanceObra(t: number, dt: number, end: number, skipT: number | null): number {
  if (skipT === null || t >= end) return t + dt;
  const rate = Math.max(1, (end - skipT) / OBRA.SKIP);
  return Math.max(t + dt, Math.min(end, t + dt * rate));
}

/** 0 → 1 entre a e b, com suavização. */
export const ramp = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
