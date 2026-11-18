// Contas que as duas rotas usam: distâncias, o comprimento de um caminho, o toque de um
// trecho numa esfera, o relógio escrito em português e os recordes. Nada aqui chama o jogo,
// então os testes usam estas funções direto.

/** Ponto é uma posição no mapa, em unidades do jogo. */
export interface Ponto {
  readonly x: number
  readonly y: number
  readonly z: number
}

export function distancia(a: Ponto, b: Ponto): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
}

/** Distância vista de cima, sem a altura. */
export function distanciaPlana(a: Ponto, b: Ponto): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function interpola(a: Ponto, b: Ponto, t: number): Ponto {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t }
}

/** Soma das distâncias entre pontos seguidos. */
export function comprimento(pontos: readonly Ponto[]): number {
  let total = 0
  for (let i = 1; i < pontos.length; i++) total += distancia(pontos[i - 1], pontos[i])
  return total
}

/**
 * Onde o trecho de a até b entra pela primeira vez na esfera de centro c e raio r, como uma
 * fração de 0 (em a) a 1 (em b). Sem toque, undefined. Um trecho que já começa dentro toca em 0.
 * Testar o trecho, e não só o ponto, pega quem passa rápido demais entre dois quadros.
 */
export function entradaNaEsfera(a: Ponto, b: Ponto, c: Ponto, r: number): number | undefined {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const dz = b.z - a.z
  const fx = a.x - c.x
  const fy = a.y - c.y
  const fz = a.z - c.z
  const cc = fx * fx + fy * fy + fz * fz - r * r
  if (cc <= 0) return 0
  const aa = dx * dx + dy * dy + dz * dz
  if (aa === 0) return undefined
  const bb = 2 * (fx * dx + fy * dy + fz * dz)
  const disc = bb * bb - 4 * aa * cc
  if (disc < 0) return undefined
  const t = (-bb - Math.sqrt(disc)) / (2 * aa)
  return t >= 0 && t <= 1 ? t : undefined
}

/** O ângulo, em graus, para olhar de a até b. */
export function guinada(a: Ponto, b: Ponto): number {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
}

/**
 * O tempo como um cronômetro: 7,42 s vira 0:07,42 e 64,371 s vira 1:04,37. Arredonda para
 * baixo, para um tempo nunca parecer mais rápido do que foi.
 */
export function cronometro(segundos: number): string {
  const centesimos = Math.max(0, Math.floor(segundos * 100 + 1e-6))
  const min = Math.floor(centesimos / 6000)
  const seg = Math.floor((centesimos % 6000) / 100)
  const cent = centesimos % 100
  return `${min}:${String(seg).padStart(2, '0')},${String(cent).padStart(2, '0')}`
}

/** A diferença para outro tempo, com sinal: +0,52 s ou -1,10 s. */
export function diferenca(segundos: number, referencia: number): string {
  const d = Math.round((segundos - referencia) * 100) / 100
  const texto = Math.abs(d).toFixed(2).replace('.', ',')
  return `${d > 0 ? '+' : d < 0 ? '-' : '±'}${texto} s`
}

export function unidades(n: number): string {
  return `${Math.round(n)} unidades`
}

/** Resultado de guardar um tempo: o recorde agora, o de antes e se este é novo. */
export interface Marca {
  readonly melhor: number
  readonly anterior: number | undefined
  readonly novo: boolean
}

/** Recordes guarda o melhor tempo de cada chave: um lugar de caixas ou uma rota. */
export class Recordes {
  private readonly tempos = new Map<string, number>()

  melhor(chave: string): number | undefined {
    return this.tempos.get(chave)
  }

  guarda(chave: string, segundos: number): Marca {
    const anterior = this.tempos.get(chave)
    const novo = anterior === undefined || segundos < anterior
    if (novo) this.tempos.set(chave, segundos)
    return { melhor: novo ? segundos : anterior!, anterior, novo }
  }

  limpa(): void {
    this.tempos.clear()
  }
}
