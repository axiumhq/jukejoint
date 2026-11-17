import { type FakePlayer } from './fake-modlock'

// A tela de escolha: o jeito de jogar, o tempo, os pontos, o herói, os bots e o Começar, e o
// quadro do Tab durante a partida. Cada teste carrega uma cópia nova do modo num mundo falso novo.
async function load(args: string[] = []) {
  vi.resetModules()
  const f = await import('./fake-modlock')
  await import('../main')
  const a = await import('../arena')
  const h = await import('../hud')
  f.fake.start(args)
  f.fake.loadWorld()
  return { w: f.fake, a, h, Buttons: f.Buttons }
}

type Loaded = Awaited<ReturnType<typeof load>>

/** Roda quadros até a fase, sem apertar nada. */
function until({ w, a }: Loaded, phase: string, max = 30) {
  for (let i = 0; i < max * 10 && a.state.phase !== phase; i++) w.tick(0.1)
  expect(a.state.phase).toBe(phase)
}

/** Duas pessoas na sala, com a tela já desenhada. */
async function room(args: string[] = [], settings: Record<string, string> = {}) {
  const l = await load(args)
  const ana = l.w.join('Ana', settings)
  const bia = l.w.join('Bia')
  l.w.tick(1.2)
  return { ...l, ana, bia }
}

describe('Arena: tela de escolha', () => {
  it('abre para quem está na fila: cursor solto, ataque e habilidades presos', async () => {
    const l = await room()
    expect(l.a.state.phase).toBe('waiting')
    for (const p of [l.ana, l.bia]) {
      expect(p.cursor).toBe(true)
      expect(p.blocked & l.Buttons.attack).toBe(l.Buttons.attack)
      expect(p.blocked & l.Buttons.ultimate).toBe(l.Buttons.ultimate)
      const text = l.w.screen(p)
      for (const t of ['Duelo no círculo', 'Dupla', 'Times', 'Espelho', '1 contra 1', '2 contra 2', 'até 6 contra 6', 'Com tempo']) expect(text).toContain(t)
    }
    // O cursor é solto uma vez só, não a cada quadro.
    l.w.tick(2)
    expect(l.ana.cursorCalls).toEqual([true])
  })

  it('sem argumentos do servidor, a partida não começa sozinha', async () => {
    const l = await room()
    l.w.tick(15)
    expect(l.a.state.phase).toBe('waiting')
    expect(l.a.state.fighters).toEqual([])
  })

  it('quem abriu a sala escolhe o jeito; o clique de outra pessoa é ignorado', async () => {
    const l = await room()
    expect(l.w.screen(l.ana)).toContain('Você abriu a sala')
    expect(l.w.screen(l.bia)).toContain('Quem abriu a sala escolhe o jeito de jogar: Ana')
    // Para a Bia os cartões vêm desligados; mesmo forçando o clique, nada muda.
    expect(l.w.control(l.bia, 'Times')?.disabled).toBe(true)
    expect(l.w.press(l.bia, 'Times')).toBe(false)
    expect(l.w.press(l.bia, 'Times', { force: true })).toBe(true)
    expect(l.a.resolveRules().variant).toBe('duelo')
    expect(l.w.press(l.ana, 'Times')).toBe(true)
    expect(l.a.state.override.variante).toBe('times')
    expect(l.a.resolveRules().variant).toBe('times')
    // A escolha aparece para todo mundo no quadro seguinte.
    l.w.tick(0.1)
    expect(l.w.screen(l.bia)).toContain('Vence quem levar 3 rodadas.')
  })

  it('a tela vale acima do lobby, e os argumentos do servidor acima da tela', async () => {
    const l = await room([], { variante: 'dupla' })
    expect(l.a.resolveRules().variant).toBe('dupla')
    l.w.press(l.ana, 'Espelho')
    expect(l.a.resolveRules().variant).toBe('espelho')

    // Com o jeito nos argumentos, a tela só mostra (aqui com uma pessoa, antes de começar sozinha).
    const s = await load(['variante=times'])
    const solo = s.w.join('Ana', { variante: 'duelo' })
    s.w.tick(1.2)
    expect(s.w.control(solo, 'Duelo no círculo')?.disabled).toBe(true)
    expect(s.w.press(solo, 'Duelo no círculo', { force: true })).toBe(true)
    expect(s.a.resolveRules().variant).toBe('times')
    expect(s.w.screen(solo)).toContain('definido pelo servidor')
    expect(s.w.screen(solo)).toContain('O servidor definiu o jeito de jogar')
  })

  it('com tempo e pontos para vencer: só quem abriu a sala muda, de 1 a 15', async () => {
    const l = await room()
    expect(l.w.screen(l.ana)).toContain('Pontos para vencer − 5 +')
    expect(l.w.press(l.bia, '+', { force: true })).toBe(true)
    expect(l.a.resolveRules().target).toBe(5)
    l.w.press(l.ana, '+')
    l.w.tick(0.1)
    l.w.press(l.ana, '+')
    expect(l.a.resolveRules().target).toBe(7)
    l.w.press(l.ana, '−')
    expect(l.a.resolveRules().target).toBe(6)
    expect(l.a.setPoints(l.ana as never, 40)).toBe(true)
    expect(l.a.resolveRules().target).toBe(15)
    l.w.tick(0.1)
    expect(l.w.control(l.ana, '+')?.disabled).toBe(true)
    expect(l.a.setPoints(l.ana as never, -3)).toBe(true)
    expect(l.a.resolveRules().target).toBe(1)

    expect(l.w.change(l.bia, 'Com tempo', true, { force: true })).toBe(true)
    expect(l.a.resolveRules().timed).toBe(false)
    expect(l.w.change(l.ana, 'Com tempo', true)).toBe(true)
    expect(l.a.resolveRules().timed).toBe(true)
    // Com tempo os pontos não contam: o controle some e a regra aparece no lugar.
    l.w.tick(0.1)
    expect(l.w.control(l.ana, '+')).toBeUndefined()
    expect(l.w.screen(l.ana)).toContain('Vence quem fizer mais pontos em 3 minutos.')
    // Nos times também não: são 3 rodadas.
    l.w.change(l.ana, 'Com tempo', false)
    l.w.press(l.ana, 'Times')
    l.w.tick(0.1)
    expect(l.w.control(l.ana, '+')).toBeUndefined()
  })

  it('cada pessoa escolhe o próprio herói, que entra na primeira rodada', async () => {
    const l = await room()
    expect(l.w.press(l.ana, 'Herói Três')).toBe(true)
    expect(l.w.press(l.bia, 'Herói Dois')).toBe(true)
    expect(l.a.chosenHero(l.ana as never)).toBe('hero_tres')
    expect(l.a.chosenHero(l.bia as never)).toBe('hero_dois')
    l.w.tick(0.1)
    expect(l.w.screen(l.ana)).toContain('Herói Três, a partir da primeira rodada')
    l.w.press(l.ana, 'Começar')
    until(l, 'live')
    expect(l.ana.pawnState?.hero).toBe('hero_tres')
    expect(l.bia.pawnState?.hero).toBe('hero_dois')
  })

  it('no espelho a grade de heróis dá lugar ao aviso do sorteio', async () => {
    const l = await room()
    l.w.press(l.ana, 'Espelho')
    l.w.tick(0.1)
    expect(l.w.control(l.ana, 'Herói Um')).toBeUndefined()
    expect(l.w.screen(l.bia)).toContain('No espelho, o herói é sorteado a cada rodada')
  })

  it('Começar: só para quem abriu a sala, ligado com duas pessoas ou com um bot', async () => {
    const l = await load()
    const ana = l.w.join('Ana')
    l.w.tick(1.2)
    expect(l.w.control(ana, 'Começar')?.disabled).toBe(true)
    expect(l.a.begin(ana as never)).toBe(false)
    expect(l.w.press(ana, 'Começar', { force: true })).toBe(true)
    expect(l.a.state.phase).toBe('waiting')

    // Sozinha, a pessoa treina com um bot; o Começar liga, e Tirar os bots aparece.
    expect(l.w.press(ana, 'Treinar com um bot')).toBe(true)
    l.w.tick(1.2)
    expect(l.a.state.queue.map((s) => s.name)).toEqual(['Ana', 'Treino 1'])
    expect(l.w.control(ana, 'Começar')?.disabled).toBe(false)
    expect(l.w.control(ana, 'Tirar os bots')).toBeDefined()
    // No duelo os lados já estão completos: não cabe mais bot.
    expect(l.w.control(ana, 'Mais um bot')).toBeUndefined()
    l.w.press(ana, 'Tirar os bots')
    l.w.tick(1.2)
    expect(l.a.state.queue.map((s) => s.name)).toEqual(['Ana'])

    // Com outra pessoa: o Começar é só de quem abriu a sala; não há bot de treino.
    const bia = l.w.join('Bia')
    l.w.tick(1.2)
    expect(l.w.control(bia, 'Começar')).toBeUndefined()
    expect(l.w.screen(bia)).toContain('Esperando quem abriu a sala começar')
    expect(l.w.control(ana, 'Treinar com um bot')).toBeUndefined()
    expect(l.a.begin(bia as never)).toBe(false)
    expect(l.w.press(ana, 'Começar')).toBe(true)
    expect(l.a.state.phase).toBe('starting')
  })

  it('a dupla com bots: um clique por bot até completar os lados', async () => {
    const l = await load()
    const ana = l.w.join('Ana', { variante: 'dupla' })
    l.w.tick(1.2)
    l.w.press(ana, 'Treinar com um bot')
    l.w.tick(0.1)
    l.w.press(ana, 'Mais um bot')
    l.w.tick(0.1)
    l.w.press(ana, 'Mais um bot')
    l.w.tick(1.2)
    expect(l.w.world.botRequests.length).toBe(3)
    expect(l.w.control(ana, 'Mais um bot')).toBeUndefined()
    l.w.press(ana, 'Começar')
    until(l, 'live')
    expect(l.a.state.fighters.length).toBe(4)
  })

  it('ao começar a partida, a tela some, o cursor volta e os botões soltam; no fim, a tela volta', async () => {
    const l = await room([], { pontos: '1' })
    l.w.press(l.ana, 'Começar')
    l.w.tick(0.2)
    for (const p of [l.ana, l.bia]) {
      expect(p.cursor).toBe(false)
      expect(p.blocked).toBe(0n)
      expect(l.w.screen(p)).not.toContain('Jeito de jogar')
    }
    expect(l.ana.cursorCalls).toEqual([true, false])
    until(l, 'live')
    l.bia.pawnState!.health = 0
    l.w.tick(0.2)
    expect(l.a.state.phase).toBe('matchOver')
    until(l, 'waiting', 10)
    l.w.tick(0.1)
    expect(l.ana.cursor).toBe(true)
    expect(l.ana.blocked & l.Buttons.attack).toBe(l.Buttons.attack)
    expect(l.w.screen(l.ana)).toContain('Última partida Ana vence a Arena, 1 a 0.')
    // Sem argumentos, a próxima partida também espera o Começar.
    l.w.tick(10)
    expect(l.a.state.phase).toBe('waiting')
  })

  it('com o jeito nos argumentos do servidor, começa sozinha como antes (o caminho do autoteste)', async () => {
    const l = await room(['variante=duelo'])
    expect(l.a.state.phase).not.toBe('waiting')
    until(l, 'live')
    expect(l.w.control(l.ana, 'Começar')).toBeUndefined()

    const p = await room(['probe'])
    expect(p.a.state.phase).not.toBe('waiting')
  })
})

describe('Arena: quadro do Tab durante a partida', () => {
  async function live() {
    const l = await room()
    l.w.press(l.ana, 'Começar')
    until(l, 'live')
    return l
  }

  it('aparece só com o cursor solto; marcar o centro é só de quem abriu a sala', async () => {
    const l = await live()
    expect(l.w.control(l.ana, 'Trocar herói')).toBeUndefined()
    l.ana.tab = true
    l.bia.tab = true
    l.w.tick(0.1)
    expect(l.w.control(l.ana, 'Trocar herói')).toBeDefined()
    expect(l.w.control(l.ana, 'Marcar o centro aqui')).toBeDefined()
    expect(l.w.control(l.bia, 'Trocar herói')).toBeDefined()
    expect(l.w.control(l.bia, 'Marcar o centro aqui')).toBeUndefined()
    l.ana.pawnState!.position = { x: 7000, y: 7000, z: 10 }
    l.w.press(l.ana, 'Marcar o centro aqui')
    expect(l.a.state.marked).toEqual({ x: 7000, y: 7000, z: 10 })
    expect(l.bia.said('O círculo mudou de lugar.')).toBe(true)
    // O atalho escondido segue a mesma regra.
    l.w.type(l.bia, '/arena')
    expect(l.bia.said('Só quem abriu a sala marca o centro do círculo.')).toBe(true)
  })

  it('Trocar herói abre a lista com o cursor solto; o herói escolhido entra na rodada seguinte', async () => {
    const l = await live()
    l.bia.tab = true
    l.w.tick(0.1)
    l.w.press(l.bia, 'Trocar herói')
    l.w.tick(0.1)
    expect(l.w.screen(l.bia)).toContain('O novo herói entra na próxima rodada.')
    expect(l.bia.cursor).toBe(true)
    expect(l.bia.blocked).toBe(l.Buttons.attack | l.Buttons.altFire)
    l.w.press(l.bia, 'Herói Três')
    l.w.tick(0.1)
    expect(l.a.chosenHero(l.bia as never)).toBe('hero_tres')
    expect(l.bia.said('toast:Herói Três a partir da próxima rodada.')).toBe(true)
    expect(l.bia.cursor).toBe(false)
    expect(l.bia.blocked).toBe(0n)
    expect(l.w.screen(l.bia)).not.toContain('O novo herói entra')
    l.ana.pawnState!.health = 0
    l.w.tick(0.2)
    until(l, 'live')
    expect(l.bia.pawnState?.hero).toBe('hero_tres')
  })

  it('Fechar fecha a lista sem trocar nada', async () => {
    const l = await live()
    l.a.openHeroMenu(l.ana as never)
    l.w.tick(0.1)
    l.w.press(l.ana, 'Fechar')
    l.w.tick(0.1)
    expect(l.a.state.heroMenu.size).toBe(0)
    expect(l.ana.cursor).toBe(false)
    expect(l.a.chosenHero(l.ana as never)).toBeUndefined()
  })
})

describe('Arena: textos', () => {
  it('nenhum texto manda ninguém para o chat', async () => {
    const l = await room()
    l.w.type(l.ana, '/ajuda')
    l.w.type(l.ana, '/modo')
    const lines = l.ana.log.filter((x) => x.startsWith('chat:') || x.startsWith('toast:'))
    expect(lines.length).toBeGreaterThan(0)
    for (const x of lines) expect(x).not.toMatch(/\/\w/)
    expect(l.w.screen(l.ana)).not.toMatch(/\/\w|!/)
    expect(l.w.screen(l.bia)).not.toMatch(/\/\w|!/)
  })
})
