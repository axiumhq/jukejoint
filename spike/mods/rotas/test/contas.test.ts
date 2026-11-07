import { readFileSync } from 'node:fs'

import { type Caixa, caixasPerto, chaveDoLugar, comprimentoDaOrdem, CorridaDeCaixas, doisOpt, MAXIMO_DE_CAIXAS, planeja, vizinhoMaisProximo } from '../caixas'
import { cronometro, diferenca, entradaNaEsfera, type Ponto, Recordes } from '../comum'
import { type Amostra, leArquivo, montaRota, nomeDeRota, Percurso, pontosAoLongo, resumoDasTecnicas } from '../percurso'

const real = JSON.parse(readFileSync(new URL('./caixas-dl_midtown.json', import.meta.url), 'utf8')) as { caixas: number[][] }
const caixasReais: Caixa[] = real.caixas.map(([x, y, z], i) => ({ id: 1000 + i, p: { x, y, z } }))
const P = (x: number, y: number, z = 0): Ponto => ({ x, y, z })
const caixa = (id: number, x: number, y: number, z = 0): Caixa => ({ id, p: P(x, y, z) })

/** Todas as ordens de uma lista pequena, para achar a melhor por força bruta. */
function permutacoes<T>(lista: T[]): T[][] {
  if (lista.length <= 1) return [lista]
  return lista.flatMap((x, i) => permutacoes([...lista.slice(0, i), ...lista.slice(i + 1)]).map((resto) => [x, ...resto]))
}

describe('planejar a rota de caixas', () => {
  it('escolhe as caixas no raio, vistas de cima, na faixa de altura, das mais perto às mais longe', () => {
    const lista = [caixa(1, 100, 0), caixa(2, 3000, 0), caixa(3, 0, 50), caixa(4, 200, 0, 900), caixa(5, 0, -1500, 300)]
    expect(caixasPerto(P(0, 0), lista, 2500).map((c) => c.id)).toEqual([3, 1, 5])
    expect(caixasPerto(P(0, 0), lista, 1000).map((c) => c.id)).toEqual([3, 1])
  })

  it('fica com as 30 caixas mais perto quando há mais no raio', () => {
    const perto = caixasPerto(P(-1000, -3000, 384), caixasReais, 4000)
    expect(perto.length).toBe(MAXIMO_DE_CAIXAS)
  })

  it('o vizinho mais próximo vai sempre para a caixa mais perto', () => {
    const lista = [caixa(1, 300, 0), caixa(2, 100, 0), caixa(3, 200, 0)]
    expect(vizinhoMaisProximo(P(0, 0), lista).map((c) => c.id)).toEqual([2, 3, 1])
  })

  it('o 2-opt desfaz um cruzamento', () => {
    // Indo 1, 2, 3, 4 o caminho cruza; 1, 3, 2, 4 não.
    const cruzada = [caixa(1, 0, 100), caixa(2, 100, 0), caixa(3, 100, 100), caixa(4, 200, 0)]
    const antes = comprimentoDaOrdem(P(0, 0), cruzada)
    const depois = doisOpt(P(0, 0), cruzada)
    expect(comprimentoDaOrdem(P(0, 0), depois)).toBeLessThan(antes)
    expect(depois.map((c) => c.id).sort()).toEqual([1, 2, 3, 4])
  })

  it('acha a ordem ótima num grupo pequeno', () => {
    const lista = [caixa(1, 500, 400), caixa(2, -300, 200), caixa(3, 900, -100), caixa(4, 100, 800), caixa(5, -600, -500), caixa(6, 300, -700)]
    const otima = Math.min(...permutacoes(lista).map((o) => comprimentoDaOrdem(P(0, 0), o)))
    expect(planeja(P(0, 0), lista).comprimento).toBeCloseTo(otima, 3)
  })

  it('nas caixas de verdade de dl_midtown nunca sai pior que a ordem do mapa nem que o vizinho mais próximo', () => {
    const partidas = [P(-1000, -3000, 384), P(0, -2500, 384), P(-2000, -1500, 256), P(500, -4000, 384), P(-1800, -4500, 384)]
    for (const partida of partidas) {
      const perto = caixasPerto(partida, caixasReais)
      if (perto.length < 2) continue
      const plano = planeja(partida, perto)
      expect(plano.ordem.map((c) => c.id).sort()).toEqual(perto.map((c) => c.id).sort())
      expect(plano.comprimento).toBeLessThanOrEqual(plano.comprimentoIngenuo + 1e-6)
      expect(plano.comprimento).toBeLessThanOrEqual(plano.comprimentoVizinho + 1e-6)
      expect(plano.comprimento).toBeCloseTo(comprimentoDaOrdem(partida, plano.ordem), 6)
    }
    const aqui = planeja(P(-1000, -3000, 384), caixasPerto(P(-1000, -3000, 384), caixasReais))
    expect(aqui.ordem.length).toBeGreaterThan(10)
    expect(aqui.comprimento).toBeLessThan(aqui.comprimentoIngenuo / 2)
  })

  it('dá o mesmo nome a partidas próximas e nomes diferentes a outro lugar ou outro raio', () => {
    expect(chaveDoLugar('dl_midtown', P(-1100, -2900, 384), 2500)).toBe(chaveDoLugar('dl_midtown', P(-1050, -2950, 400), 2500))
    expect(chaveDoLugar('dl_midtown', P(-1000, -3000, 384), 2500)).toBe('dl_midtown@-800,-2800,400~2500')
    expect(chaveDoLugar('dl_midtown', P(-1000, -3000, 384), 2500)).not.toBe(chaveDoLugar('dl_midtown', P(1000, -3000, 384), 2500))
    expect(chaveDoLugar('dl_midtown', P(-1000, -3000, 384), 2500)).not.toBe(chaveDoLugar('dl_midtown', P(-1000, -3000, 384), 1500))
  })
})

describe('acompanhar a rota de caixas', () => {
  const ordem = [caixa(1, 300, 0), caixa(2, 600, 0), caixa(3, 900, 0)]

  it('liga o relógio ao sair da partida e fecha o tempo na última caixa', () => {
    const c = new CorridaDeCaixas(P(0, 0), ordem)
    const foi = new Set<number>()
    const sumiu = (id: number) => foi.has(id)
    expect(c.quadro(1, P(50, 0), sumiu)).toEqual([])
    expect(c.quadro(2, P(200, 0), sumiu)).toEqual([{ tipo: 'largou', t: 2 }])
    foi.add(1)
    expect(c.quadro(3, P(300, 0), sumiu)).toEqual([{ tipo: 'quebrou', caixa: ordem[0], numero: 1, naOrdem: true }])
    expect(c.proxima()?.numero).toBe(2)
    foi.add(2)
    foi.add(3)
    const fimDaRota = c.quadro(6.5, P(900, 0), sumiu)
    expect(fimDaRota.at(-1)).toEqual({ tipo: 'terminou', tempo: 4.5, foraDeOrdem: 0 })
    expect(c.terminou).toBe(true)
    expect(c.quadro(7, P(0, 0), sumiu)).toEqual([])
  })

  it('conta a caixa quebrada fora da ordem e a que o jogo diz que quebrou', () => {
    const c = new CorridaDeCaixas(P(0, 0), ordem)
    c.quadro(0, P(0, 0), () => false)
    const eventos = c.quadro(1, P(0, 0), (id) => id === 3)
    // Sem sair do lugar, a primeira caixa quebrada liga o relógio.
    expect(eventos[0]).toEqual({ tipo: 'largou', t: 1 })
    expect(eventos[1]).toMatchObject({ tipo: 'quebrou', numero: 3, naOrdem: false })
    expect(c.proxima()?.numero).toBe(1)
    c.quadro(2, P(0, 0), () => false, [1])
    const fim = c.quadro(3, P(0, 0), () => false, [2])
    expect(fim.at(-1)).toEqual({ tipo: 'terminou', tempo: 2, foraDeOrdem: 1 })
  })
})

describe('contas comuns', () => {
  it('acha onde um trecho entra numa esfera', () => {
    expect(entradaNaEsfera(P(0, 0), P(1000, 0), P(500, 0), 100)).toBeCloseTo(0.4)
    expect(entradaNaEsfera(P(0, 0), P(1000, 0), P(500, 300), 100)).toBeUndefined()
    expect(entradaNaEsfera(P(0, 0), P(100, 0), P(500, 0), 100)).toBeUndefined()
    expect(entradaNaEsfera(P(480, 0), P(1000, 0), P(500, 0), 100)).toBe(0)
    expect(entradaNaEsfera(P(0, 0), P(0, 0), P(500, 0), 100)).toBeUndefined()
  })

  it('escreve o tempo como cronômetro e a diferença com sinal', () => {
    expect(cronometro(7.42)).toBe('0:07,42')
    expect(cronometro(64.371)).toBe('1:04,37')
    expect(cronometro(-3)).toBe('0:00,00')
    expect(diferenca(10.52, 10)).toBe('+0,52 s')
    expect(diferenca(8.9, 10)).toBe('-1,10 s')
    expect(diferenca(10, 10)).toBe('±0,00 s')
  })

  it('guarda só o melhor tempo de cada chave', () => {
    const r = new Recordes()
    expect(r.guarda('a', 10)).toEqual({ melhor: 10, anterior: undefined, novo: true })
    expect(r.guarda('a', 12)).toEqual({ melhor: 10, anterior: 10, novo: false })
    expect(r.guarda('a', 9)).toEqual({ melhor: 9, anterior: 10, novo: true })
    expect(r.melhor('b')).toBeUndefined()
    expect(r.melhor('a')).toBe(9)
  })
})

/** Uma gravação a 0,1 s: parada na partida, depois em linha reta a `v`, depois parada no fim. */
function gravacao(caminho: Ponto[], v: number, parada = 1): Amostra[] {
  const amostras: Amostra[] = []
  let t = 0
  for (; t < parada - 1e-9; t += 0.1) amostras.push({ t, p: caminho[0] })
  let total = 0
  for (let i = 1; i < caminho.length; i++) total += Math.hypot(caminho[i].x - caminho[i - 1].x, caminho[i].y - caminho[i - 1].y, caminho[i].z - caminho[i - 1].z)
  for (let d = 0; d <= total + 1e-9; d += v * 0.1, t += 0.1) {
    let resta = d
    let p = caminho[caminho.length - 1]
    for (let i = 1; i < caminho.length; i++) {
      const a = caminho[i - 1]
      const b = caminho[i]
      const perna = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
      if (resta <= perna) {
        p = P(a.x + ((b.x - a.x) * resta) / perna, a.y + ((b.y - a.y) * resta) / perna, a.z + ((b.z - a.z) * resta) / perna)
        break
      }
      resta -= perna
    }
    amostras.push({ t: Math.round(t * 10) / 10, p })
  }
  for (let k = 0; k < 10; k++, t += 0.1) amostras.push({ t: Math.round(t * 10) / 10, p: caminho[caminho.length - 1] })
  return amostras
}

describe('pontos de controle', () => {
  it('põe um ponto a cada 500 unidades e o último no fim', () => {
    const pts = pontosAoLongo([P(0, 0), P(1600, 0)])
    expect(pts.map((x) => Math.round(x.p.x))).toEqual([500, 1000, 1600])
    expect(pontosAoLongo([P(0, 0), P(300, 0), P(300, 1300)]).map((x) => Math.round(x.s))).toEqual([500, 1000, 1600])
  })

  it('junta repetições seguidas e deixa os pousos de fora do resumo', () => {
    expect(resumoDasTecnicas(['slide', 'landed', 'airJump', 'airJump', 'ziplineAttached', 'landed'])).toEqual(['deslize', 'pulo duplo ×2', 'tirolesa'])
  })

  it('monta a rota: tempo da saída ao fim, sem as paradas, e as técnicas presas aos pontos', () => {
    const caminho = [P(0, 0), P(1000, 0), P(1000, 1000)]
    const amostras = gravacao(caminho, 500)
    const r = montaRota(amostras, [
      { t: 0.5, acao: 'groundDash' }, // ainda parada na partida: fora da janela
      { t: 1.4, acao: 'slide' }, // 200 unidades andadas: ponto 1
      { t: 2.6, acao: 'dashJump' }, // 800: ponto 2
      { t: 2.9, acao: 'landed' },
      { t: 4.5, acao: 'wallJump' }, // 1750: ponto 4 (fim)
      { t: 9, acao: 'airDash' }, // depois da chegada
    ], { mapa: 'dl_midtown', autor: 'Ana' })
    if ('erro' in r) throw new Error(r.erro)
    const rota = r.rota
    expect(rota.comprimento).toBeCloseTo(2000, 0)
    expect(rota.pontos.length).toBe(4)
    // 2000 unidades a 500 u/s são 4 s; sai da partida (150) aos 0,3 s e toca o fim (200 antes) aos 3,6 s.
    expect(rota.tempo).toBeCloseTo((2000 - 200 - 150) / 500, 1)
    expect(rota.tecnicas).toEqual(['deslize', 'pulo com dash', 'pulo na parede'])
    expect(rota.pousos).toBe(1)
    expect(rota.pontos.map((p) => p.dicas)).toEqual([['deslize'], ['pulo com dash'], [], ['pulo na parede']])
    expect(rota.guinada).toBeCloseTo(0)
    expect(rota.partida).toEqual(P(0, 0))
  })

  it('recusa gravação curta, com teleporte ou que nunca sai da partida', () => {
    expect(montaRota([{ t: 0, p: P(0, 0) }], [], { mapa: 'm', autor: 'a' })).toHaveProperty('erro')
    expect(montaRota(gravacao([P(0, 0), P(300, 0)], 500), [], { mapa: 'm', autor: 'a' })).toHaveProperty('erro')
    const pulo = gravacao([P(0, 0), P(2000, 0)], 500)
    pulo.splice(20, 0, { t: pulo[19].t + 0.05, p: P(9000, 9000) })
    expect(montaRota(pulo, [], { mapa: 'm', autor: 'a' })).toMatchObject({ erro: expect.stringContaining('teleporte') })
    const voltinha: Amostra[] = Array.from({ length: 60 }, (_, i) => ({ t: i * 0.1, p: P(60 * Math.cos(i / 3), 60 * Math.sin(i / 3)) }))
    expect(montaRota(voltinha, [], { mapa: 'm', autor: 'a' })).toMatchObject({ erro: expect.stringContaining('não saiu') })
  })
})

describe('correr a rota', () => {
  const pontos = [P(500, 0), P(1000, 0), P(1500, 0)]

  it('espera entrar na partida, liga o relógio ao sair e interpola os tempos', () => {
    const c = new Percurso(P(0, 0), pontos)
    expect(c.quadro(0, P(-1000, 0))).toEqual([])
    expect(c.estado).toBe('fora')
    expect(c.quadro(1, P(0, 0))).toEqual([{ tipo: 'pronto' }])
    expect(c.quadro(2, P(100, 0))).toEqual([])
    // Cruza a borda (150) a meio caminho entre 100 e 200.
    expect(c.quadro(3, P(200, 0))).toEqual([{ tipo: 'largou', t: 2.5 }])
    // De 200 a 400 em 1 s não toca o ponto 1 (raio 200: de 300 em diante).
    const toque = c.quadro(4, P(400, 0))
    expect(toque).toEqual([{ tipo: 'ponto', indice: 0, tempo: 1 }])
  })

  it('conta vários pontos num quadro só, de quem passa muito rápido', () => {
    const c = new Percurso(P(0, 0), pontos)
    c.quadro(0, P(0, 0))
    const eventos = c.quadro(1, P(2000, 0))
    expect(eventos.map((e) => e.tipo)).toEqual(['largou', 'ponto', 'ponto', 'ponto', 'chegou'])
    const chegou = eventos.at(-1)
    expect(chegou).toEqual({ tipo: 'chegou', tempo: expect.closeTo((1300 - 150) / 2000, 6) })
    expect(c.parciais.length).toBe(3)
  })

  it('não conta um ponto pulado: quem corta por fora não termina', () => {
    const c = new Percurso(P(0, 0), [P(500, 0), P(500, 1000), P(0, 1000)])
    c.quadro(0, P(0, 0))
    c.quadro(1, P(0, 500))
    const eventos = c.quadro(2, P(0, 1000))
    expect(eventos.some((e) => e.tipo === 'chegou')).toBe(false)
    expect(c.proximo).toBe(0)
  })
})

describe('nomes e arquivo', () => {
  it('aceita nomes simples e limpa acentos e espaços', () => {
    expect(nomeDeRota('Atalho Azul')).toBe('atalho-azul')
    expect(nomeDeRota('ponte_à_esquerda')).toBe('ponte_a_esquerda')
    expect(nomeDeRota('')).toBeUndefined()
    expect(nomeDeRota('../fora')).toBeUndefined()
    expect(nomeDeRota('x'.repeat(25))).toBeUndefined()
  })

  it('lê arquivo vazio ou estragado como sem rotas', () => {
    expect(leArquivo(undefined).rotas).toEqual({})
    expect(leArquivo('{oops').rotas).toEqual({})
    expect(leArquivo('{"versao":2,"rotas":{"a":{}}}').rotas).toEqual({})
  })
})
