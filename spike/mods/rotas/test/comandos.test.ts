import { readFileSync } from 'node:fs'

import type { fake as Fake, FakePlayer, P } from './fake-modlock'

const real = JSON.parse(readFileSync(new URL('./caixas-dl_midtown.json', import.meta.url), 'utf8')) as { caixas: number[][] }
const LANE: P = { x: -1000, y: -3000, z: 384 }

/** Cada teste carrega uma cópia nova do modo num mundo falso novo; `files` simula o disco do host. */
async function load(files?: Map<string, string>) {
  vi.resetModules()
  const f = await import('./fake-modlock')
  if (files) for (const [k, v] of files) f.fake.world.files.set(k, v)
  await import('../main')
  const rotas = await import('../rotas')
  return { w: f.fake, rotas }
}

describe('Rotas: comandos', () => {
  let w: typeof Fake
  let rotas: typeof import('../rotas')
  beforeEach(async () => {
    ;({ w, rotas } = await load())
  })

  it('aplica os ajustes sem tropas e sem o preset arena, que tiraria os acampamentos', () => {
    w.loadWorld()
    expect(w.world.cvars.citadel_trooper_spawn_enabled).toBe(false)
    expect(w.world.cvars.sv_hibernate_when_empty).toBe(false)
    expect(w.world.cvars).not.toHaveProperty('citadel_neutral_spawn_enabled')
  })

  it('/ajuda lista todos os comandos', () => {
    w.loadWorld()
    const ana = w.join('Ana', 0)
    expect(ana.said('/ajuda')).toBe(true)
    w.type(ana, '/ajuda')
    for (const c of ['/caixas', '/parar', '/gravar', '/fim', '/correr', '/salvar', '/rotas', '/ajuda']) expect(ana.log.filter((l) => l.includes(c)).length).toBeGreaterThan(0)
  })

  describe('/caixas', () => {
    let ana: FakePlayer
    let ids: number[]
    beforeEach(() => {
      ids = w.addBoxes(real.caixas)
      w.loadWorld()
      ana = w.join('Ana', 0, LANE)
    })

    function plano() {
      return rotas.estado.sessoes.get(0)!.caixas!
    }

    it('precisa de herói vivo e de um raio que faça sentido', () => {
      ana.pawnState!.health = 0
      w.type(ana, '/caixas')
      expect(ana.lastChat()).toContain('herói vivo')
      ana.pawnState!.health = 600
      w.type(ana, '/caixas longe')
      expect(ana.lastChat()).toContain('/caixas <raio>')
    })

    it('avisa quando não há caixa no raio', () => {
      ana.pawnState!.position = { x: 9000, y: 9000, z: 0 }
      w.type(ana, '/caixas')
      expect(ana.lastChat()).toContain('Nenhuma caixa')
      expect(rotas.estado.sessoes.get(0)?.caixas).toBeUndefined()
    })

    it('planeja as caixas perto, marca cada uma com o número só para quem pediu e diz o caminho', () => {
      w.type(ana, '/caixas')
      const rc = plano()
      expect(rc.plano.ordem.length).toBeGreaterThan(10)
      expect(rc.plano.comprimento).toBeLessThanOrEqual(rc.plano.comprimentoIngenuo)
      const textos = w.liveTexts()
      expect(textos.length).toBe(rc.plano.ordem.length)
      expect(textos.every((t) => t.options.faceCamera && t.onlyTo?.length === 1 && t.onlyTo[0] === 0)).toBe(true)
      expect(textos.map((t) => t.options.text).sort((a, b) => Number(a) - Number(b))).toEqual(rc.plano.ordem.map((_, i) => String(i + 1)))
      const primeira = textos.find((t) => t.options.text === '1')!
      expect(primeira.options.position.z).toBeGreaterThan(rc.plano.ordem[0].p.z)
      expect(ana.said(`${Math.round(rc.plano.comprimento)} unidades`)).toBe(true)
      expect(ana.watchingMovement).toBe(true)
    })

    it('o raio muda quantas caixas entram', () => {
      w.type(ana, '/caixas 600')
      const pequeno = plano().plano.ordem.length
      w.type(ana, '/caixas 4000')
      expect(plano().plano.ordem.length).toBeGreaterThan(pequeno)
      // A rota anterior foi trocada: só ficam as marcas da nova.
      expect(w.liveTexts().length).toBe(plano().plano.ordem.length)
    })

    it('tira cada caixa quebrada, acende a próxima e fecha o tempo na última', () => {
      w.type(ana, '/caixas 900')
      const ordem = plano().plano.ordem
      expect(ordem.length).toBeGreaterThanOrEqual(3)
      w.tick(1)
      ana.pawnState!.position = { ...ordem[0].p }
      w.tick(0.5) // saiu da partida: relógio ligado em 1,05 s
      for (const [i, c] of ordem.entries()) {
        w.breakBox(c.id)
        w.tick(0.5)
        if (i < ordem.length - 1) {
          const acesa = w.liveTexts().find((t) => t.options.text === String(i + 2))!
          expect(acesa.options.color).toBe(0xffc83cff)
          expect(w.liveTexts().some((t) => t.options.text === String(i + 1))).toBe(false)
        }
      }
      expect(rotas.estado.sessoes.get(0)!.caixas).toBeUndefined()
      expect(w.liveTexts().length).toBe(0)
      expect(ana.said('announce:Rota de caixas')).toBe(true)
      expect(ana.said('Primeiro tempo neste lugar')).toBe(true)
      expect(ana.watchingMovement).toBe(false)
      expect(ids.length).toBe(real.caixas.length)
    })

    it('guarda o recorde do lugar: uma volta mais lenta mostra o recorde, uma mais rápida bate', () => {
      const volta = (espera: number) => {
        ana.pawnState!.position = { ...LANE }
        w.type(ana, '/caixas 600')
        const ordem = plano().plano.ordem
        ana.pawnState!.position = { ...ordem[0].p }
        w.tick(0.1)
        for (const c of ordem) {
          w.tick(espera)
          w.world.entities.delete(c.id)
        }
        w.tick(0.2)
        for (const c of ordem) w.addEntity('citadel_breakable_prop', c.p) // as caixas voltam, com outro id
      }
      volta(1)
      expect(ana.said('Primeiro tempo')).toBe(true)
      volta(2)
      expect(ana.lastChat()).toContain('Recorde aqui:')
      volta(0.5)
      expect(ana.lastChat()).toContain('Novo recorde aqui')
    })

    it('conta a caixa que o jogo diz que a pessoa quebrou, mesmo que a entidade fique', () => {
      w.type(ana, '/caixas 600')
      const ordem = plano().plano.ordem
      for (const c of ordem) {
        w.announceBreak(ana, c.id)
        w.tick(0.1)
      }
      expect(rotas.estado.sessoes.get(0)!.caixas).toBeUndefined()
      expect(ana.said('announce:Rota de caixas')).toBe(true)
    })

    it('/parar cancela e tira as marcas', () => {
      w.type(ana, '/caixas')
      expect(w.liveTexts().length).toBeGreaterThan(0)
      w.type(ana, '/parar')
      expect(w.liveTexts().length).toBe(0)
      expect(ana.lastChat()).toContain('rota de caixas foi cancelada')
      w.type(ana, '/parar')
      expect(ana.lastChat()).toContain('Nada rodando')
    })

    it('a faixa do topo mostra o progresso e some depois do resultado', () => {
      w.type(ana, '/caixas 600')
      w.tick(0.1)
      expect(JSON.stringify(ana.ui)).toContain('Rota de caixas')
      expect(JSON.stringify(ana.ui)).toContain(`0/${plano().plano.ordem.length}`)
      for (const c of plano().plano.ordem) w.breakBox(c.id)
      w.tick(0.2)
      expect(JSON.stringify(ana.ui)).toContain('FIM')
      w.tick(9)
      expect(ana.ui).toBeUndefined()
      expect(ana.hidden).toBe(1)
    })

    it('quem sai do servidor leva as marcas junto', () => {
      w.type(ana, '/caixas')
      w.disconnect(ana)
      expect(w.liveTexts().length).toBe(0)
      expect(rotas.estado.sessoes.size).toBe(0)
    })
  })

  describe('/gravar, /fim, /correr', () => {
    const CAMINHO: P[] = [{ x: 0, y: 0, z: 0 }, { x: 1000, y: 0, z: 0 }, { x: 1000, y: 1000, z: 0 }]
    let ana: FakePlayer
    beforeEach(() => {
      w.loadWorld()
      ana = w.join('Ana', 0)
    })

    function grava() {
      w.type(ana, '/gravar')
      w.tick(0.5)
      w.walk(ana, CAMINHO.slice(0, 2), 500)
      w.action(ana, 'slide')
      w.tick(0.05)
      w.action(ana, 'landed')
      w.walk(ana, CAMINHO.slice(1), 500)
      w.action(ana, 'meleeStarted')
      w.tick(1)
      w.type(ana, '/fim')
      return rotas.estado.sessoes.get(0)!.ultima!
    }

    it('/fim sem gravação avisa', () => {
      w.type(ana, '/fim')
      expect(ana.lastChat()).toContain('Nenhuma gravação')
    })

    it('grava o caminho a cada 0,1 s e mostra comprimento, tempo e técnicas em ordem', () => {
      w.type(ana, '/gravar')
      expect(ana.watchingMovement).toBe(true)
      w.tick(1)
      expect(rotas.estado.sessoes.get(0)!.gravacao!.amostras.length).toBe(11)
      w.type(ana, '/parar')
      const rota = grava()
      expect(rota.comprimento).toBeCloseTo(2000, -1)
      expect(rota.pontos.length).toBe(4)
      expect(rota.tecnicas).toEqual(['deslize'])
      expect(rota.pousos).toBe(1)
      expect(rota.tempo).toBeGreaterThan(3)
      expect(rota.tempo).toBeLessThan(3.7)
      expect(ana.said('Técnicas: deslize (1 pouso)')).toBe(true)
      expect(ana.said('2000 unidades')).toBe(true)
      expect(ana.watchingMovement).toBe(false)
    })

    it('a gravação para se o herói morre', () => {
      w.type(ana, '/gravar')
      w.tick(0.3)
      ana.pawnState!.health = 0
      w.tick(0.2)
      expect(rotas.estado.sessoes.get(0)!.gravacao).toBeUndefined()
      expect(ana.lastChat()).toContain('o herói morreu')
    })

    it('/correr sem rota avisa', () => {
      w.type(ana, '/correr')
      expect(ana.lastChat()).toContain('Nenhuma rota gravada')
      w.type(ana, '/correr nada')
      expect(ana.lastChat()).toContain('Não achei a rota nada')
    })

    it('leva à partida, mostra os pontos, cronometra e compara com a gravação e o recorde', () => {
      const rota = grava()
      w.type(ana, '/correr')
      expect(ana.teleports).toBe(1)
      expect(ana.pawnState!.position).toEqual(rota.partida)
      // A partida e os 4 pontos, com as dicas da gravação no ponto que elas ajudam a alcançar.
      const textos = w.liveTexts()
      expect(textos.map((t) => t.options.text)).toEqual(['partida', '1', '2\ndeslize', '3', '4 · fim'])
      w.tick(0.5)
      w.walk(ana, CAMINHO, 800)
      w.tick(0.2)
      const recorde = rota.recorde!
      expect(recorde.por).toBe('Ana')
      expect(recorde.tempo).toBeLessThan(rota.tempo)
      expect(recorde.tempo).toBeCloseTo((2000 - 200 - 150) / 800, 1)
      expect(ana.said('announce:Rota de movimento')).toBe(true)
      expect(ana.lastChat()).toContain('Contra a gravação')
      expect(ana.lastChat()).toContain('primeiro recorde')
      expect(w.liveTexts().length).toBe(0)

      w.type(ana, '/correr')
      w.tick(0.5)
      w.walk(ana, CAMINHO, 400)
      expect(rota.recorde!.tempo).toBe(recorde.tempo)
      expect(ana.lastChat()).toContain('recorde 0:02')
    })

    it('a próxima marca acende ao tocar cada ponto, e cortar caminho não termina a corrida', () => {
      grava()
      w.type(ana, '/correr')
      w.tick(0.3)
      w.walk(ana, [{ x: 0, y: 0, z: 0 }, { x: 600, y: 0, z: 0 }], 800)
      expect(w.liveTexts().map((t) => t.options.text).sort()).toEqual(['2\ndeslize', '3', '4 · fim'])
      expect(w.liveTexts().find((t) => t.options.text.startsWith('2'))!.options.color).toBe(0xffc83cff)
      // Direto para o fim, pulando o 2 e o 3.
      w.walk(ana, [{ x: 600, y: 0, z: 0 }, { x: 1000, y: 1000, z: 0 }], 800)
      w.tick(1)
      expect(rotas.estado.sessoes.get(0)!.corrida).toBeDefined()
      expect(ana.said('announce:')).toBe(false)
    })

    it('sem teleporte, pede para ir até a partida e começa quando a pessoa chega lá', () => {
      grava()
      ana.refuseTeleport = true
      ana.pawnState!.position = { x: -2000, y: 0, z: 0 }
      w.type(ana, '/correr')
      expect(ana.lastChat()).toContain('Vá até o marcador "partida"')
      w.walk(ana, [{ x: -2000, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }], 2000)
      expect(ana.said('center:Saia da partida para começar')).toBe(true)
      w.walk(ana, CAMINHO, 800)
      expect(rotas.estado.sessoes.get(0)!.ultima!.recorde).toBeDefined()
    })

    it('a corrida para se o herói morre', () => {
      grava()
      w.type(ana, '/correr')
      w.tick(0.2)
      ana.pawnState!.health = 0
      w.tick(0.1)
      expect(rotas.estado.sessoes.get(0)!.corrida).toBeUndefined()
      expect(w.liveTexts().length).toBe(0)
    })
  })

  describe('/salvar e /rotas', () => {
    const CAMINHO: P[] = [{ x: 0, y: 0, z: 0 }, { x: 1500, y: 0, z: 0 }]
    let ana: FakePlayer
    beforeEach(() => {
      w.loadWorld()
      ana = w.join('Ana', 0)
    })

    function grava() {
      w.type(ana, '/gravar')
      w.walk(ana, CAMINHO, 600)
      w.type(ana, '/fim')
    }

    it('pede uma rota gravada e um nome que valha', () => {
      w.type(ana, '/salvar ponte')
      expect(ana.lastChat()).toContain('Grave uma rota antes')
      grava()
      w.type(ana, '/salvar')
      expect(ana.lastChat()).toContain('/salvar <nome>')
      w.type(ana, '/rotas')
      expect(ana.lastChat()).toContain('Nenhuma rota salva')
    })

    it('guarda no arquivo do mapa, lista, e a rota sobrevive a um servidor novo com o recorde', async () => {
      grava()
      w.type(ana, '/salvar Ponte Azul')
      expect(ana.lastChat()).toContain('Rota ponte-azul salva')
      expect(ana.lastChat()).toContain('guardada no servidor')
      const arquivo = JSON.parse(w.world.files.get('rotas-dl_midtown.json')!)
      expect(arquivo.rotas['ponte-azul'].autor).toBe('Ana')
      w.type(ana, '/rotas')
      expect(ana.said('ponte-azul: 1500 unidades')).toBe(true)

      w.type(ana, '/correr ponte-azul')
      w.tick(0.3)
      w.walk(ana, CAMINHO, 900)
      expect(JSON.parse(w.world.files.get('rotas-dl_midtown.json')!).rotas['ponte-azul'].recorde.por).toBe('Ana')

      // Outro servidor, com o mesmo disco.
      const disco = new Map(w.world.files)
      ;({ w, rotas } = await load(disco))
      w.loadWorld()
      const bia = w.join('Bia', 1)
      w.type(bia, '/rotas')
      expect(bia.said('ponte-azul: 1500 unidades, gravada em')).toBe(true)
      expect(bia.said('(Ana)')).toBe(true)
      w.type(bia, '/correr ponte-azul')
      expect(bia.teleports).toBe(1)
      expect(w.liveTexts().length).toBe(rotas.estado.arquivo.rotas['ponte-azul'].pontos.length + 1)
    })

    it('salvar de novo com o mesmo nome substitui', () => {
      grava()
      w.type(ana, '/salvar ponte')
      grava()
      w.type(ana, '/salvar ponte')
      expect(ana.lastChat()).toContain('substituída')
      expect(Object.keys(rotas.estado.arquivo.rotas)).toEqual(['ponte'])
    })

    it('quando o host recusa o arquivo, avisa que a rota vale só nesta sessão', () => {
      w.world.refuseWrites = true
      grava()
      w.type(ana, '/salvar ponte')
      expect(ana.lastChat()).toContain('vale só até o servidor fechar')
      w.type(ana, '/correr ponte')
      expect(rotas.estado.sessoes.get(0)!.corrida).toBeDefined()
    })

    it('uma rota de outro mapa não corre aqui', async () => {
      grava()
      w.type(ana, '/salvar ponte')
      const disco = new Map(w.world.files)
      disco.set('rotas-street_test.json', disco.get('rotas-dl_midtown.json')!)
      ;({ w, rotas } = await load(disco))
      w.loadWorld('street_test')
      const bia = w.join('Bia', 1)
      w.type(bia, '/correr ponte')
      expect(bia.lastChat()).toContain('é do mapa dl_midtown')
    })
  })
})
