// Rota de caixas, sem o jogo: escolher as caixas perto de quem pediu, achar uma ordem curta
// para quebrar todas, dar um nome ao lugar para guardar o recorde e acompanhar a corrida
// enquanto as caixas somem. rotas.ts liga isto ao jogo.
import { comprimento, distancia, distanciaPlana, type Ponto } from './comum'

/** Raio padrão de /caixas, medido de cima: o tamanho de um trecho de lane. */
export const RAIO_PADRAO = 2500
export const RAIO_MINIMO = 300
export const RAIO_MAXIMO = 6000
/** Só entram caixas até esta diferença de altura, para não misturar andares. */
export const FAIXA_DE_ALTURA = 450
/** Mais caixas que isso viram uma corrida longa demais: ficam as mais perto. */
export const MAXIMO_DE_CAIXAS = 30
/** O relógio começa quando a pessoa sai deste raio em volta do ponto de partida. */
export const RAIO_DA_PARTIDA = 150
/** O tamanho da grade que dá nome ao lugar do recorde (ver chaveDoLugar). */
export const GRADE_DO_LUGAR = 400

/** Caixa é uma caixa quebrável do mapa: a entidade e onde ela está. */
export interface Caixa {
  readonly id: number
  readonly p: Ponto
}

/**
 * As caixas dentro do raio, vistas de cima, na faixa de altura de quem pediu, das mais perto
 * para as mais longe, no máximo `maximo`.
 */
export function caixasPerto(partida: Ponto, caixas: readonly Caixa[], raio = RAIO_PADRAO, faixa = FAIXA_DE_ALTURA, maximo = MAXIMO_DE_CAIXAS): Caixa[] {
  return caixas
    .filter((c) => distanciaPlana(partida, c.p) <= raio && Math.abs(c.p.z - partida.z) <= faixa)
    .map((c) => ({ c, d: distancia(partida, c.p) }))
    .sort((a, b) => a.d - b.d || a.c.id - b.c.id)
    .slice(0, maximo)
    .map((x) => x.c)
}

/** O comprimento de sair da partida e passar pelas caixas nesta ordem. */
export function comprimentoDaOrdem(partida: Ponto, ordem: readonly Caixa[]): number {
  return comprimento([partida, ...ordem.map((c) => c.p)])
}

/** Vizinho mais próximo: da partida, sempre para a caixa mais perto que falta. */
export function vizinhoMaisProximo(partida: Ponto, caixas: readonly Caixa[]): Caixa[] {
  const faltam = [...caixas]
  const ordem: Caixa[] = []
  let aqui = partida
  while (faltam.length > 0) {
    let melhor = 0
    for (let i = 1; i < faltam.length; i++) if (distancia(aqui, faltam[i].p) < distancia(aqui, faltam[melhor].p)) melhor = i
    const [c] = faltam.splice(melhor, 1)
    ordem.push(c)
    aqui = c.p
  }
  return ordem
}

/**
 * 2-opt num caminho aberto que sai da partida: inverte um trecho sempre que isso encurta o
 * caminho, até nenhuma inversão ajudar. A partida fica fixa e o fim fica livre.
 */
export function doisOpt(partida: Ponto, ordem: readonly Caixa[], voltas = 50): Caixa[] {
  const pts = [partida, ...ordem.map((c) => c.p)]
  const caixas = [undefined, ...ordem]
  const n = pts.length
  for (let volta = 0; volta < voltas; volta++) {
    let melhorou = false
    for (let i = 0; i < n - 2; i++) {
      for (let j = i + 2; j < n; j++) {
        // Trocar as arestas (i, i+1) e (j, j+1) por (i, j) e (i+1, j+1); no fim, j+1 não existe.
        const antes = distancia(pts[i], pts[i + 1]) + (j + 1 < n ? distancia(pts[j], pts[j + 1]) : 0)
        const depois = distancia(pts[i], pts[j]) + (j + 1 < n ? distancia(pts[i + 1], pts[j + 1]) : 0)
        if (depois < antes - 1e-6) {
          inverte(pts, i + 1, j)
          inverte(caixas, i + 1, j)
          melhorou = true
        }
      }
    }
    if (!melhorou) break
  }
  return caixas.slice(1) as Caixa[]
}

function inverte<T>(lista: T[], de: number, ate: number): void {
  for (let a = de, b = ate; a < b; a++, b--) [lista[a], lista[b]] = [lista[b], lista[a]]
}

/** Plano é a ordem escolhida e o que ela mede, ao lado da ordem ingênua. */
export interface Plano {
  readonly ordem: Caixa[]
  readonly comprimento: number
  /** comprimentoIngenuo é o da ordem em que o mapa lista as caixas. */
  readonly comprimentoIngenuo: number
  /** comprimentoVizinho é o do vizinho mais próximo antes do 2-opt. */
  readonly comprimentoVizinho: number
}

/**
 * Uma ordem curta para quebrar as caixas: o vizinho mais próximo melhorado pelo 2-opt, e a
 * ordem do mapa melhorada pelo 2-opt; fica a mais curta. Assim o plano nunca sai pior que a
 * ordem ingênua.
 */
export function planeja(partida: Ponto, caixas: readonly Caixa[]): Plano {
  const ingenua = [...caixas].sort((a, b) => a.id - b.id)
  const vizinho = vizinhoMaisProximo(partida, caixas)
  const candidatas = [doisOpt(partida, vizinho), doisOpt(partida, ingenua)]
  const medidas = candidatas.map((o) => comprimentoDaOrdem(partida, o))
  const i = medidas[0] <= medidas[1] ? 0 : 1
  return {
    ordem: candidatas[i],
    comprimento: medidas[i],
    comprimentoIngenuo: comprimentoDaOrdem(partida, ingenua),
    comprimentoVizinho: comprimentoDaOrdem(partida, vizinho),
  }
}

/**
 * O nome do lugar onde o recorde vale: o mapa, a partida arredondada numa grade de 400
 * unidades (200 na altura) e o raio. Começar a poucos passos do mesmo ponto cai no mesmo
 * lugar; atravessar uma linha da grade cai no vizinho.
 */
export function chaveDoLugar(mapa: string, partida: Ponto, raio: number): string {
  const g = (v: number, passo: number) => Math.round(v / passo) * passo
  return `${mapa}@${g(partida.x, GRADE_DO_LUGAR)},${g(partida.y, GRADE_DO_LUGAR)},${g(partida.z, GRADE_DO_LUGAR / 2)}~${Math.round(raio)}`
}

/** O que mudou num quadro da corrida de caixas. */
export type EventoDeCaixas =
  | { readonly tipo: 'largou'; readonly t: number }
  | { readonly tipo: 'quebrou'; readonly caixa: Caixa; readonly numero: number; readonly naOrdem: boolean }
  | { readonly tipo: 'terminou'; readonly tempo: number; readonly foraDeOrdem: number }

/**
 * CorridaDeCaixas acompanha uma rota: o relógio começa quando a pessoa sai da partida ou quando
 * a primeira caixa quebra, cada caixa que some sai da lista, e a última fecha o tempo. Uma
 * caixa quebrada fora da ordem conta, mas fica anotada.
 */
export class CorridaDeCaixas {
  readonly faltam: Set<number>
  largada: number | undefined
  tempo: number | undefined
  foraDeOrdem = 0

  constructor(
    readonly partida: Ponto,
    readonly ordem: readonly Caixa[],
    readonly raioDaPartida = RAIO_DA_PARTIDA,
  ) {
    this.faltam = new Set(ordem.map((c) => c.id))
  }

  /** O número (a partir de 1) e a caixa que vêm agora, ou undefined no fim. */
  proxima(): { numero: number; caixa: Caixa } | undefined {
    const i = this.ordem.findIndex((c) => this.faltam.has(c.id))
    return i < 0 ? undefined : { numero: i + 1, caixa: this.ordem[i] }
  }

  get quebradas(): number {
    return this.ordem.length - this.faltam.size
  }

  get terminou(): boolean {
    return this.tempo !== undefined
  }

  /**
   * Um quadro: onde a pessoa está e quais caixas sumiram. `sumiu` responde por uma caixa do
   * plano; quebradas são as caixas que o jogo disse que a pessoa quebrou neste quadro.
   */
  quadro(t: number, posicao: Ponto | undefined, sumiu: (id: number) => boolean, quebradas: readonly number[] = []): EventoDeCaixas[] {
    if (this.terminou) return []
    const eventos: EventoDeCaixas[] = []
    if (this.largada === undefined && posicao && distancia(posicao, this.partida) > this.raioDaPartida) {
      this.largada = t
      eventos.push({ tipo: 'largou', t })
    }
    const ditas = new Set(quebradas)
    for (let i = 0; i < this.ordem.length; i++) {
      const caixa = this.ordem[i]
      if (!this.faltam.has(caixa.id)) continue
      if (!ditas.has(caixa.id) && !sumiu(caixa.id)) continue
      const naOrdem = this.proxima()?.caixa.id === caixa.id
      if (!naOrdem) this.foraDeOrdem += 1
      this.faltam.delete(caixa.id)
      if (this.largada === undefined) {
        this.largada = t
        eventos.push({ tipo: 'largou', t })
      }
      eventos.push({ tipo: 'quebrou', caixa, numero: i + 1, naOrdem })
    }
    if (this.faltam.size === 0) {
      this.tempo = t - (this.largada ?? t)
      eventos.push({ tipo: 'terminou', tempo: this.tempo, foraDeOrdem: this.foraDeOrdem })
    }
    return eventos
  }
}
