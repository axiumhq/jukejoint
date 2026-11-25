// Rota de movimento, sem o jogo: transformar uma gravação (posições a cada 0,1 s e as ações de
// movimento que o jogo anunciou) em pontos de controle, medir o tempo e acompanhar uma corrida
// que precisa tocar os pontos na ordem. rotas.ts liga isto ao jogo.
import { comprimento, distancia, entradaNaEsfera, guinada, interpola, type Ponto } from './comum'

/** De quanto em quanto tempo a gravação guarda a posição. */
export const INTERVALO_DA_AMOSTRA = 0.1
/** Um ponto de controle a cada tantas unidades de caminho. */
export const ESPACO_ENTRE_PONTOS = 500
/** Quão perto do ponto de controle é tocar nele. */
export const RAIO_DO_PONTO = 200
/** O relógio começa quando a pessoa sai deste raio em volta da partida. */
export const RAIO_DA_LARGADA = 150
/** Um salto maior que isso entre duas amostras é um teleporte ou uma volta à base, não um atalho. */
export const SALTO_MAXIMO = 1200
/** Uma rota mais curta que isso não precisa de prática. */
export const COMPRIMENTO_MINIMO = 400
/** Gravação mais longa que isso para sozinha (10 minutos de amostras). */
export const AMOSTRAS_MAXIMAS = 6000

/** As ações de movimento que a gravação guarda, com o nome que a pessoa lê. */
export const TECNICAS = {
  groundDash: 'dash no chão',
  slide: 'deslize',
  dashJump: 'pulo com dash',
  airJump: 'pulo duplo',
  wallJump: 'pulo na parede',
  airDash: 'dash no ar',
  ziplineAttached: 'tirolesa',
  bouncePad: 'plataforma de salto',
  landed: 'pouso',
} as const

export type Tecnica = keyof typeof TECNICAS

export function eTecnica(acao: string): acao is Tecnica {
  return Object.prototype.hasOwnProperty.call(TECNICAS, acao)
}

export interface Amostra {
  readonly t: number
  readonly p: Ponto
}

export interface Acao {
  readonly t: number
  readonly acao: Tecnica
}

export interface PontoDeControle {
  readonly p: Ponto
  /** dicas são as técnicas que a gravação usou para chegar aqui desde o ponto anterior. */
  readonly dicas: readonly string[]
}

/** Rota é um atalho gravado, pronto para correr e para guardar em arquivo. */
export interface Rota {
  nome?: string
  readonly mapa: string
  readonly autor: string
  readonly partida: Ponto
  /** guinada é para onde olhar na partida: o primeiro ponto. */
  readonly guinada: number
  readonly pontos: readonly PontoDeControle[]
  readonly comprimento: number
  /** tempo é o da gravação, medido como uma corrida: da saída da partida ao último ponto. */
  readonly tempo: number
  /** tecnicas são as ações em ordem, sem os pousos, com repetições seguidas juntas. */
  readonly tecnicas: readonly string[]
  readonly pousos: number
  recorde?: { tempo: number; por: string }
}

/** Pontos a cada `espaco` unidades ao longo do caminho, com o último ponto sempre no fim. */
export function pontosAoLongo(caminho: readonly Ponto[], espaco = ESPACO_ENTRE_PONTOS): { p: Ponto; s: number }[] {
  const saida: { p: Ponto; s: number }[] = []
  if (caminho.length < 2) return saida
  const total = comprimento(caminho)
  let andado = 0
  let alvo = espaco
  for (let i = 1; i < caminho.length; i++) {
    const a = caminho[i - 1]
    const b = caminho[i]
    const d = distancia(a, b)
    while (d > 0 && alvo <= andado + d && alvo < total - espaco / 2) {
      saida.push({ p: interpola(a, b, (alvo - andado) / d), s: alvo })
      alvo += espaco
    }
    andado += d
  }
  saida.push({ p: caminho[caminho.length - 1], s: total })
  return saida
}

/** As técnicas em ordem, sem pousos, com repetições seguidas juntas: "pulo duplo ×2". */
export function resumoDasTecnicas(acoes: readonly Tecnica[]): string[] {
  const saida: { nome: string; vezes: number }[] = []
  for (const a of acoes) {
    if (a === 'landed') continue
    const nome = TECNICAS[a]
    const ultima = saida[saida.length - 1]
    if (ultima?.nome === nome) ultima.vezes += 1
    else saida.push({ nome, vezes: 1 })
  }
  return saida.map((x) => (x.vezes > 1 ? `${x.nome} ×${x.vezes}` : x.nome))
}

export type ResultadoDaGravacao = { readonly rota: Rota } | { readonly erro: string }

/**
 * Transforma uma gravação numa rota: pontos de controle ao longo do caminho, o tempo medido
 * como uma corrida de verdade (o mesmo Percurso refaz a gravação) e as técnicas usadas entre a
 * saída e a chegada, cada uma presa ao ponto que ela ajudou a alcançar.
 */
export function montaRota(amostras: readonly Amostra[], acoes: readonly Acao[], quem: { mapa: string; autor: string }): ResultadoDaGravacao {
  if (amostras.length < 2) return { erro: 'A gravação ficou curta demais. Ande um pouco antes do /fim.' }
  for (let i = 1; i < amostras.length; i++) {
    if (distancia(amostras[i - 1].p, amostras[i].p) > SALTO_MAXIMO) return { erro: 'A gravação teve um teleporte ou uma volta à base no meio. Grave de novo, num trajeto só.' }
  }
  const caminho = amostras.map((a) => a.p)
  const total = comprimento(caminho)
  if (total < COMPRIMENTO_MINIMO) return { erro: `A rota tem ${Math.round(total)} unidades. Grave pelo menos ${COMPRIMENTO_MINIMO}.` }

  const marcos = pontosAoLongo(caminho)
  const partida = caminho[0]
  const corrida = new Percurso(partida, marcos.map((m) => m.p))
  for (const a of amostras) corrida.quadro(a.t, a.p)
  if (corrida.largada === undefined) return { erro: 'Você não saiu da partida durante a gravação.' }
  if (corrida.tempo === undefined) return { erro: 'A gravação não chegou ao fim do próprio caminho.' }
  // Um caminho enrolado perto da partida toca todos os pontos de uma vez: não é uma rota.
  if (corrida.tempo < 0.2) return { erro: 'A rota terminou quase na partida. Grave um trajeto que vá a algum lugar.' }
  const chegada = corrida.largada + corrida.tempo

  // O trecho de caminho já andado em cada amostra, para saber a que ponto cada ação pertence.
  const andado: number[] = [0]
  for (let i = 1; i < caminho.length; i++) andado.push(andado[i - 1] + distancia(caminho[i - 1], caminho[i]))
  const naJanela = acoes.filter((a) => a.t >= corrida.largada! - INTERVALO_DA_AMOSTRA && a.t <= chegada + 1e-6)
  const porPonto: Tecnica[][] = marcos.map(() => [])
  for (const a of naJanela) {
    let i = 0
    while (i + 1 < amostras.length && amostras[i + 1].t <= a.t) i++
    const s = andado[i]
    const k = marcos.findIndex((m) => s <= m.s + 1e-6)
    porPonto[k < 0 ? marcos.length - 1 : k].push(a.acao)
  }

  const rota: Rota = {
    mapa: quem.mapa,
    autor: quem.autor,
    partida,
    guinada: guinada(partida, marcos[0].p),
    pontos: marcos.map((m, k) => ({ p: m.p, dicas: resumoDasTecnicas(porPonto[k]) })),
    comprimento: total,
    tempo: corrida.tempo,
    tecnicas: resumoDasTecnicas(naJanela.map((a) => a.acao)),
    pousos: naJanela.filter((a) => a.acao === 'landed').length,
  }
  return { rota }
}

/** O que mudou num quadro da corrida de movimento. */
export type EventoDoPercurso =
  | { readonly tipo: 'pronto' }
  | { readonly tipo: 'largou'; readonly t: number }
  | { readonly tipo: 'ponto'; readonly indice: number; readonly tempo: number }
  | { readonly tipo: 'chegou'; readonly tempo: number }

export type EstadoDoPercurso = 'fora' | 'pronto' | 'correndo' | 'chegou'

/**
 * Percurso acompanha uma corrida: espera a pessoa entrar na partida, liga o relógio no instante
 * em que ela sai, e conta cada ponto tocado na ordem, testando o trecho entre dois quadros para
 * ninguém passar por um ponto sem contar. Os tempos são interpolados dentro do quadro.
 */
export class Percurso {
  estado: EstadoDoPercurso = 'fora'
  proximo = 0
  largada: number | undefined
  tempo: number | undefined
  readonly parciais: number[] = []
  private ultimo: Amostra | undefined

  constructor(
    readonly partida: Ponto,
    readonly pontos: readonly Ponto[],
    readonly raioDoPonto = RAIO_DO_PONTO,
    readonly raioDaLargada = RAIO_DA_LARGADA,
  ) {}

  quadro(t: number, p: Ponto): EventoDoPercurso[] {
    const eventos: EventoDoPercurso[] = []
    const antes = this.ultimo
    this.ultimo = { t, p }
    if (this.estado === 'chegou') return eventos
    const dentro = distancia(p, this.partida) <= this.raioDaLargada
    if (this.estado === 'fora') {
      if (dentro) {
        this.estado = 'pronto'
        eventos.push({ tipo: 'pronto' })
      }
      return eventos
    }
    if (!antes) return eventos
    let de = 0
    if (this.estado === 'pronto') {
      if (dentro) return eventos
      // O instante em que cruzou a borda da partida, de dentro para fora.
      const volta = entradaNaEsfera(p, antes.p, this.partida, this.raioDaLargada)
      de = volta === undefined ? 0 : 1 - volta
      this.largada = antes.t + de * (t - antes.t)
      this.estado = 'correndo'
      eventos.push({ tipo: 'largou', t: this.largada })
    }
    while (this.proximo < this.pontos.length) {
      const inicio = interpola(antes.p, p, de)
      const f = entradaNaEsfera(inicio, p, this.pontos[this.proximo], this.raioDoPonto)
      if (f === undefined) break
      de = de + f * (1 - de)
      const quando = antes.t + de * (t - antes.t) - this.largada!
      this.parciais.push(quando)
      eventos.push({ tipo: 'ponto', indice: this.proximo, tempo: quando })
      this.proximo += 1
      if (this.proximo === this.pontos.length) {
        this.tempo = quando
        this.estado = 'chegou'
        eventos.push({ tipo: 'chegou', tempo: quando })
      }
    }
    return eventos
  }
}

/** Nome de rota aceito em /salvar: letras, números, hífen e sublinhado, até 24. */
export function nomeDeRota(texto: string): string | undefined {
  const nome = texto
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-')
  return /^[a-z0-9_-]{1,24}$/.test(nome) ? nome : undefined
}

/** O arquivo de rotas de um mapa, como readFile e writeFile o guardam. */
export interface ArquivoDeRotas {
  readonly versao: 1
  readonly rotas: Record<string, Rota>
}

export const MAXIMO_DE_ROTAS = 50

export function arquivoDoMapa(mapa: string): string {
  return `rotas-${mapa.replace(/[^a-z0-9_-]/gi, '_')}.json`
}

/** Lê o arquivo de rotas; texto vazio ou estragado vira um arquivo sem rotas. */
export function leArquivo(texto: string | undefined): ArquivoDeRotas {
  if (!texto) return { versao: 1, rotas: {} }
  try {
    const dado = JSON.parse(texto) as Partial<ArquivoDeRotas>
    if (dado && dado.versao === 1 && dado.rotas && typeof dado.rotas === 'object') return { versao: 1, rotas: dado.rotas }
  } catch {
    // estragado: começa de novo
  }
  return { versao: 1, rotas: {} }
}

export function escreveArquivo(arquivo: ArquivoDeRotas): string {
  return JSON.stringify(arquivo)
}
