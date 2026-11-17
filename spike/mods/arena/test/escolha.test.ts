import { type FakePlayer } from './fake-modlock'

// A escolha por votação, o Pronto, a lista de heróis, o quadro do Tab e o que o HUD mostra durante a
// partida. Cada teste carrega uma cópia nova do modo num mundo falso novo.
async function load(args: string[] = []) {
  vi.resetModules()
  const f = await import('./fake-modlock')
  await import('../main')
  const a = await import('../arena')
  const h = await import('../hud')
  const c = await import('../circulo')
  const e = await import('../escolha')
  f.fake.start(args)
  f.fake.loadWorld()
  return { w: f.fake, a, h, c, e, Buttons: f.Buttons }
}

type Loaded = Awaited<ReturnType<typeof load>>

/** Roda quadros até a fase; na escolha, quem não está pronto aperta Pronto. */
function until({ w, a }: Loaded, phase: string, max = 30) {
  for (let i = 0; i < max * 10 && a.state.phase !== phase; i++) {
    if (a.state.phase === 'waiting' && phase !== 'waiting') {
      for (const s of a.voters()) {
        const p = s.player as unknown as FakePlayer
        if (!a.isReady(p as never)) w.press(p, 'Pronto') || w.press(p, 'Jogar de novo')
      }
    }
    w.tick(0.1)
  }
  expect(a.state.phase).toBe(phase)
}

/** Duas pessoas na sala, com a escolha já desenhada. */
async function room(args: string[] = [], settings: Record<string, string> = {}) {
  const l = await load(args)
  const ana = l.w.join('Ana', settings)
  const bia = l.w.join('Bia')
  l.w.tick(1.2)
  return { ...l, ana, bia }
}

async function live(args: string[] = [], settings: Record<string, string> = {}) {
  const l = await room(args, settings)
  until(l, 'live')
  return l
}

/** Uma pessoa já com herói no mapa, como no jogo antes da primeira partida. */
function seat(p: FakePlayer, hero = 'hero_um') {
  p.pawnState = { entity: 900 + p.slot, hero, team: 2, health: 600, maxHealth: 600, position: { x: 0, y: 0, z: 0 } }
}

function screens(l: Loaded, ...ps: FakePlayer[]) {
  return ps.map((p) => l.w.screen(p)).join(' ')
}

describe('Arena: a escolha', () => {
  it('fica debaixo do placar; quem tem herói segura o Tab, quem não tem fica com o cursor solto', async () => {
    const l = await room()
    expect(l.a.state.phase).toBe('waiting')
    const text = l.w.screen(l.ana)
    for (const t of ['Duelo no círculo', 'Dupla', 'Times', 'Espelho', '1 contra 1', '2 contra 2', 'até 6 contra 6', 'Com tempo', 'Por rodadas', 'Na sala']) {
      expect(text).toContain(t)
    }
    expect(text).toContain('Segure Tab e clique para votar')
    // Sem herói (quem assistia), o jogo não tem Tab: o cursor fica solto e os ataques presos, uma vez só.
    expect(l.ana.cursor).toBe(true)
    expect(l.ana.blocked & l.Buttons.attack).toBe(l.Buttons.attack)
    l.w.tick(2)
    expect(l.ana.cursorCalls).toEqual([true])
    // Com herói, a pessoa anda pelo mapa e segura o Tab para clicar: o cursor volta para a mira.
    seat(l.ana)
    l.w.tick(0.1)
    expect(l.ana.cursor).toBe(false)
    expect(l.ana.blocked).toBe(0n)
    // Ninguém manda em ninguém: não há texto de quem abriu a sala.
    expect(screens(l, l.ana, l.bia)).not.toContain('abriu a sala')
  })

  it('sem Pronto de todo mundo, a partida não começa sozinha', async () => {
    const l = await room()
    l.w.tick(15)
    expect(l.a.state.phase).toBe('waiting')
    expect(l.a.state.fighters).toEqual([])
  })

  it('cada pessoa vota; clicar em outro botão muda o voto, clicar de novo tira', async () => {
    const l = await room()
    expect(l.w.press(l.ana, 'Times')).toBe(true)
    expect(l.a.voteCounts('variante').get('times')).toBe(1)
    expect(l.a.resolveRules().variant).toBe('times')
    l.w.tick(0.1)
    // O botão mostra a contagem, para todo mundo; o voto da própria pessoa fica marcado.
    expect(l.w.control(l.bia, 'Times')?.text).toMatch(/Times 1$/)
    expect(l.w.control(l.ana, 'Times')?.text).toContain('Seu voto.')
    expect(l.w.control(l.bia, 'Times')?.text).not.toContain('Seu voto.')
    // A Bia vota em outro: empate, e sem partida anterior vale o lobby (aqui, o padrão: duelo).
    l.w.press(l.bia, 'Espelho')
    expect(l.a.resolveRules().variant).toBe('duelo')
    // A Bia muda o voto para Times: 2 votos.
    l.w.tick(0.1)
    l.w.press(l.bia, 'Times')
    expect(l.a.voteCounts('variante').get('times')).toBe(2)
    expect(l.a.voteCounts('variante').get('espelho')).toBeUndefined()
    l.w.tick(0.1)
    expect(l.w.screen(l.bia)).toContain('Vence quem levar 3 rodadas.')
    // Clicar de novo no mesmo tira o voto.
    l.w.press(l.ana, 'Times')
    expect(l.a.voteCounts('variante').get('times')).toBe(1)
  })

  it('no empate, fica o que valeu na última partida; sem votos, o lobby', async () => {
    const l = await room([], { pontos: '1' })
    // Sem votos: o lobby de quem chegou primeiro.
    expect(l.a.resolveRules().target).toBe(1)
    l.w.press(l.ana, 'Até 3')
    l.w.press(l.bia, 'Até 3')
    expect(l.a.resolveRules().target).toBe(3)
    until(l, 'live')
    for (let i = 0; i < 3; i++) {
      l.bia.pawnState!.health = 0
      l.w.tick(0.2)
      if (i < 2) until(l, 'live')
    }
    expect(l.a.state.phase).toBe('matchOver')
    until(l, 'waiting', 10)
    l.w.tick(0.1)
    l.w.press(l.ana, 'Até 7')
    l.w.press(l.bia, 'Até 10')
    // Empate entre 7 e 10: fica o 3 da última partida, não o 1 do lobby.
    expect(l.a.resolveRules().target).toBe(3)
  })

  it('bots não votam nem precisam de Pronto: sozinha com um bot, a pessoa começa', async () => {
    const l = await load()
    const ana = l.w.join('Ana')
    l.w.tick(1.2)
    expect(l.w.press(ana, 'Treinar com um bot')).toBe(true)
    l.w.tick(1.2)
    const bot = l.a.state.queue.find((s) => s.bot)!
    expect(l.a.chooseVariant(bot.player, 'times')).toBe(false)
    expect(l.a.voteCounts('variante').size).toBe(0)
    expect(l.a.voters().map((s) => s.name)).toEqual(['Ana'])
    expect(l.w.screen(ana)).toContain('0 de 1 pronto')
    l.w.press(ana, 'Pronto')
    l.w.tick(0.2)
    expect(l.w.screen(ana)).toContain('Começando em 3')
    l.w.tick(3)
    expect(l.a.state.phase).not.toBe('waiting')
    expect(l.a.state.fighters.map((f) => f.seat.name)).toEqual(['Ana', 'Treino 1'])
  })

  it('com todo mundo pronto, "Começando" conta 3 e para se alguém tira o pronto', async () => {
    const l = await room()
    l.w.press(l.ana, 'Pronto')
    l.w.tick(0.1)
    expect(l.w.screen(l.bia)).toContain('1 de 2 prontos')
    expect(l.w.screen(l.bia)).toContain('Ana')
    expect(l.w.screen(l.bia)).toContain('pronto')
    l.w.press(l.bia, 'Pronto')
    l.w.tick(1.5)
    expect(l.w.screen(l.ana)).toContain('Começando em')
    // A Bia tira o pronto: a contagem para.
    l.w.press(l.bia, 'Pronto')
    l.w.tick(3)
    expect(l.a.state.phase).toBe('waiting')
    expect(l.a.state.beginAt).toBeUndefined()
    expect(l.w.screen(l.ana)).toContain('1 de 2 prontos')
    // De novo, sem ninguém desistir: começa depois dos 3 segundos.
    l.w.press(l.bia, 'Pronto')
    l.w.tick(2.5)
    expect(l.a.state.phase).toBe('waiting')
    l.w.tick(1)
    expect(l.a.state.phase).toBe('starting')
    expect(l.a.state.ready.size).toBe(0)
  })

  it('o jeito votado precisa caber em quem está na sala: a dupla com duas pessoas não começa', async () => {
    const l = await room()
    l.w.press(l.ana, 'Dupla')
    l.w.press(l.bia, 'Dupla')
    l.w.tick(0.1)
    expect(l.w.control(l.ana, 'Dupla')?.text).toContain('faltam 2')
    expect(l.w.screen(l.ana)).toContain('Faltam 2 pessoas')
    l.w.press(l.ana, 'Pronto')
    l.w.press(l.bia, 'Pronto')
    l.w.tick(6)
    expect(l.a.state.phase).toBe('waiting')
    // Com mais duas pessoas, a dupla cabe e a contagem corre (as novas também precisam do Pronto).
    const caio = l.w.join('Caio')
    const davi = l.w.join('Davi')
    l.w.tick(1.2)
    expect(l.w.control(l.ana, 'Dupla')?.text).not.toContain('faltam')
    l.w.press(caio, 'Pronto')
    l.w.press(davi, 'Pronto')
    l.w.tick(3.5)
    expect(l.a.state.phase).toBe('starting')
    expect(l.a.state.rules.variant).toBe('dupla')
  })

  it('com tempo e os pontos: votos de cada grupo, os pontos só no duelo e na dupla por rodadas', async () => {
    const l = await room()
    expect(l.w.screen(l.ana)).toContain('Até 5')
    l.w.press(l.ana, 'Até 7')
    l.w.press(l.bia, 'Até 7')
    expect(l.a.resolveRules().target).toBe(7)
    l.w.press(l.ana, 'Com tempo')
    l.w.press(l.bia, 'Com tempo')
    expect(l.a.resolveRules().timed).toBe(true)
    l.w.tick(0.1)
    expect(l.w.control(l.ana, 'Até 7')).toBeUndefined()
    expect(l.w.screen(l.ana)).toContain('Vence quem fizer mais pontos em 3 minutos.')
    l.w.press(l.ana, 'Por rodadas')
    l.w.press(l.bia, 'Por rodadas')
    l.w.press(l.ana, 'Times')
    l.w.press(l.bia, 'Times')
    l.w.tick(0.1)
    expect(l.w.control(l.ana, 'Até 7')).toBeUndefined()
  })

  it('os argumentos do servidor travam a escolha e a partida começa sozinha (o caminho do autoteste)', async () => {
    const s = await load(['variante=times'])
    const solo = s.w.join('Ana')
    s.w.tick(1.2)
    expect(s.w.control(solo, 'Duelo no círculo')?.disabled).toBe(true)
    expect(s.w.press(solo, 'Duelo no círculo', { force: true })).toBe(true)
    expect(s.a.voteCounts('variante').size).toBe(0)
    expect(s.a.resolveRules().variant).toBe('times')
    expect(s.w.screen(solo)).toContain('definido pelo servidor')
    expect(s.w.screen(solo)).toContain('O servidor definiu o jeito de jogar')
    expect(s.w.control(solo, 'Pronto')).toBeUndefined()
    s.w.join('Bia')
    s.w.tick(1.2)
    expect(s.a.state.phase).not.toBe('waiting')

    const p = await room(['probe'])
    expect(p.a.state.phase).not.toBe('waiting')
  })

  it('cada pessoa escolhe o próprio herói na lista, que entra na primeira rodada', async () => {
    const l = await room()
    l.w.press(l.ana, 'Escolher herói')
    l.w.tick(0.1)
    expect(l.w.screen(l.ana)).toContain('Seu herói')
    expect(l.w.screen(l.ana)).not.toContain('Na sala')
    expect(l.ana.hiddenHud).toEqual([...l.h.PANEL_HIDE])
    expect(l.w.press(l.ana, 'Herói Três')).toBe(true)
    l.w.press(l.bia, 'Escolher herói')
    l.w.tick(0.1)
    expect(l.w.press(l.bia, 'Herói Dois')).toBe(true)
    expect(l.a.chosenHero(l.ana as never)).toBe('hero_tres')
    expect(l.a.chosenHero(l.bia as never)).toBe('hero_dois')
    l.w.tick(0.1)
    expect(l.ana.hiddenHud).toEqual([...l.h.MATCH_HIDE])
    expect(l.w.screen(l.ana)).toContain('Herói Três, a partir da primeira rodada')
    // Na sala, cada pessoa aparece com o herói dela.
    expect(l.w.screen(l.bia)).toContain('Herói Três')
    until(l, 'live')
    expect(l.ana.pawnState?.hero).toBe('hero_tres')
    expect(l.bia.pawnState?.hero).toBe('hero_dois')
  })

  it('no espelho, o botão do herói dá lugar ao aviso do sorteio', async () => {
    const l = await room()
    l.w.press(l.ana, 'Espelho')
    l.w.tick(0.1)
    expect(l.w.control(l.ana, 'Escolher herói')).toBeUndefined()
    expect(l.w.screen(l.bia)).toContain('No espelho, o herói é sorteado a cada rodada')
  })

  it('a dupla com bots: um clique por bot até completar os lados', async () => {
    const l = await load()
    const ana = l.w.join('Ana', { variante: 'dupla' })
    l.w.tick(1.2)
    expect(l.w.screen(ana)).toContain('Faltam 3 pessoas')
    l.w.press(ana, 'Treinar com um bot')
    l.w.tick(0.1)
    l.w.press(ana, 'Mais um bot')
    l.w.tick(0.1)
    l.w.press(ana, 'Mais um bot')
    l.w.tick(1.2)
    expect(l.w.world.botRequests.length).toBe(3)
    expect(l.w.control(ana, 'Mais um bot')).toBeUndefined()
    l.w.press(ana, 'Tirar os bots')
    l.w.tick(1.2)
    expect(l.a.state.queue.map((s) => s.name)).toEqual(['Ana'])
  })

  it('depois da partida a escolha volta com "Jogar de novo" e o resultado', async () => {
    const l = await live([], { pontos: '1' })
    for (const p of [l.ana, l.bia]) {
      expect(p.cursor).toBe(false)
      expect(p.blocked).toBe(0n)
      expect(l.w.screen(p)).not.toContain('Na sala')
    }
    l.bia.pawnState!.health = 0
    l.w.tick(0.2)
    expect(l.a.state.phase).toBe('matchOver')
    expect(l.w.screen(l.ana)).toContain('Você venceu')
    expect(l.w.screen(l.bia)).toContain('Você perdeu')
    until(l, 'waiting', 10)
    l.w.tick(0.1)
    expect(l.w.control(l.ana, 'Jogar de novo')).toBeDefined()
    expect(l.w.screen(l.ana)).toContain('Última partida Ana vence a Arena, 1 a 0.')
    l.w.tick(10)
    expect(l.a.state.phase).toBe('waiting')
  })
})

describe('Arena: o HUD do jogo', () => {
  it('esconde a barra do topo, a marca, almas, números, avisos e minimapa, uma vez só, e não nos bots', async () => {
    const l = await load()
    const ana = l.w.join('Ana')
    l.w.tick(1.2)
    l.w.press(ana, 'Treinar com um bot')
    l.w.tick(1.2)
    expect(ana.hudCalls).toEqual([[...l.h.MATCH_HIDE]])
    for (const part of ['topBar', 'status', 'souls', 'stats', 'levelUp', 'minimap']) expect(ana.hiddenHud).toContain(part)
    for (const part of ['ownHealth', 'ammo', 'abilities']) expect(ana.hiddenHud).not.toContain(part)
    const bot = l.a.state.queue.find((s) => s.bot)!.player as unknown as FakePlayer
    until(l, 'live')
    l.w.tick(2)
    expect(ana.hudCalls.length).toBe(1)
    expect(bot.hudCalls).toEqual([])
    // A lista de heróis esconde também munição e habilidades; fechar devolve.
    l.a.openHeroMenu(ana as never)
    l.w.tick(0.1)
    l.a.closeHeroMenu(ana as never)
    l.w.tick(0.3)
    expect(ana.hudCalls).toEqual([[...l.h.MATCH_HIDE], [...l.h.PANEL_HIDE], [...l.h.MATCH_HIDE]])
  })
})

describe('Arena: o HUD da partida', () => {
  it('a contagem 3, 2, 1 e o "Valendo"', async () => {
    const l = await room()
    until(l, 'countdown')
    expect(l.h.moment()?.title).toBe('3')
    expect(l.h.moment()?.detail).toBe('Rodada 1')
    l.w.tick(1)
    expect(l.h.moment()?.title).toBe('2')
    l.w.tick(1)
    expect(l.h.moment()?.title).toBe('1')
    until(l, 'live')
    expect(l.w.screen(l.ana)).toContain('Valendo')
    l.w.tick(1.5)
    expect(l.w.screen(l.ana)).not.toContain('Valendo')
  })

  it('o placar do duelo: nomes, heróis e o meio com a rodada', async () => {
    const l = await live()
    const [near, far] = l.h.sideViews(l.a.state.queue[1])
    // Quem olha fica sempre à esquerda.
    expect(near.label).toBe('Bia')
    expect(far.label).toBe('Ana')
    expect(near.sub).toMatch(/^Herói/)
    const text = l.w.screen(l.ana)
    expect(text).toContain('Duelo no círculo · até 5')
    expect(text).toContain('Rodada 1')
  })

  it('o placar dos times: o nome do time, quantos de pé e os retratos apagados de quem caiu', async () => {
    const l = await load()
    const p = [l.w.join('P1', { variante: 'times' })]
    for (let i = 2; i <= 4; i++) p.push(l.w.join(`P${i}`))
    until(l, 'live')
    const text = l.w.screen(p[0])
    expect(text).toContain('Âmbar')
    expect(text).toContain('Safira')
    expect(text).toContain('2 de pé')
    p[1].pawnState!.health = 0
    l.w.tick(0.2)
    const [mine, other] = l.h.sideViews(l.a.state.queue[0])
    expect(mine.sub).toBe('2 de pé')
    expect(other.sub).toBe('1 de pé')
    expect(other.people.map((x) => x.down)).toEqual([true, false])
    expect(JSON.stringify(p[0].ui)).toContain('"saturation":0')
  })

  it('o aviso do gás só aparece fora do círculo, com a distância, a direção e a borda vermelha', async () => {
    const l = await live()
    const c = l.a.state.ring.center!
    l.w.tick(0.1)
    expect(l.w.screen(l.bia)).not.toContain('Fora do círculo')
    expect(JSON.stringify(l.bia.ui)).not.toContain('"inset":true')
    l.bia.pawnState!.position = { x: c.x + l.a.VARIANTS.duelo.radius + 200, y: c.y, z: c.z }
    l.w.tick(0.1)
    const text = l.w.screen(l.bia)
    expect(text).toContain('Fora do círculo')
    expect(text).toContain('O gás tira 8% da vida por segundo · 6 m até o círculo')
    expect(JSON.stringify(l.bia.ui)).toContain('"inset":true')
    expect(l.w.screen(l.ana)).not.toContain('Fora do círculo')
    l.bia.pawnState!.position = { ...c }
    l.w.tick(0.1)
    expect(l.w.screen(l.bia)).not.toContain('Fora do círculo')
  })

  it('a seta aponta o centro: à frente, à esquerda, atrás', async () => {
    const l = await load()
    const p = { x: 0, y: 0, z: 0 }
    expect(l.c.turnToCenter({ x: 100, y: 0, z: 0 }, p, 0)).toBeCloseTo(0)
    // O yaw cresce para a esquerda: o centro em +y fica à esquerda, a seta gira para a esquerda.
    expect(l.c.turnToCenter({ x: 0, y: 100, z: 0 }, p, 0)).toBeCloseTo(-90)
    expect(l.c.turnToCenter({ x: 0, y: 100, z: 0 }, p, 90)).toBeCloseTo(0)
    expect(Math.abs(l.c.turnToCenter({ x: -100, y: 0, z: 0 }, p, 0))).toBeCloseTo(180)
    expect(l.c.metersOutside({ x: 0, y: 0, z: 0 }, 1000, { x: 1100, y: 0, z: 0 })).toBe(3)
  })

  it('com tempo, quem cai vê quando volta; o círculo fecha com a barra', async () => {
    const l = await live(['tempo', 'segundos=60'])
    expect(l.w.screen(l.ana)).toContain('O círculo fecha')
    expect(JSON.stringify(l.ana.ui)).toContain('"name":"Meter"')
    l.bia.pawnState!.health = 0
    l.w.tick(0.2)
    expect(l.w.screen(l.bia)).toContain(`Você volta em ${l.a.RESPAWN_SECONDS}`)
    l.w.tick(1)
    expect(l.w.screen(l.bia)).toContain('Você volta em 2')
  })

  it('por rodadas, quem cai espera a próxima; quem está na fila vê a posição', async () => {
    const l = await load()
    const a = l.w.join('Ana', { variante: 'dupla' })
    l.w.join('Bia')
    const c = l.w.join('Caio')
    l.w.join('Davi')
    const e = l.w.join('Eva')
    until(l, 'live')
    expect(l.w.screen(e)).toContain('Você está na fila · 1ª posição')
    c.pawnState!.health = 0
    l.w.tick(0.2)
    expect(l.w.screen(c)).toContain('Você caiu')
    expect(l.w.screen(c)).toContain('Espere a próxima rodada.')
    expect(l.w.screen(a)).not.toContain('Você caiu')
  })

  it('a faixa da rodada com o placar, "Primeira queda" e "Sem tomar dano"', async () => {
    const l = await live()
    l.bia.pawnState!.health = 0
    l.w.tick(0.2)
    const text = l.w.screen(l.ana)
    expect(text).toContain('Você levou a rodada')
    expect(text).toContain('Ana 1 – 0 Bia')
    expect(text).toContain('Primeira queda')
    expect(text).toContain('Sem tomar dano')
    expect(l.w.screen(l.bia)).toContain('Ana leva a rodada')

    // Na rodada seguinte, a Ana toma um golpe antes de vencer: sem o destaque.
    until(l, 'live')
    l.w.hit(l.ana, 50, l.bia)
    l.w.tick(3)
    l.bia.pawnState!.health = 0
    l.w.tick(0.2)
    expect(l.w.screen(l.ana)).toContain('Você levou a rodada')
    expect(l.w.screen(l.ana)).not.toContain('Sem tomar dano')
    expect(l.w.screen(l.ana)).not.toContain('Primeira queda')
  })

  it('o quadro de quedas mostra quem derrubou quem, e o gás', async () => {
    const l = await live([], { pontos: '3' })
    const { ana, bia, w } = l
    for (const fn of w.world.damagedFns) fn({ victim: bia.pawnState!.entity, attacker: ana.pawnState!.entity, healthBefore: 600, healthLost: 600 })
    bia.pawnState!.health = 0
    w.tick(0.2)
    expect(l.a.state.feed.at(-1)).toMatchObject({ by: { name: 'Ana', side: 0 }, victim: { name: 'Bia', side: 1 }, gas: false })
    until(l, 'live')
    const c = l.a.state.ring.center!
    bia.pawnState!.position = { x: c.x, y: c.y + 5000, z: c.z }
    bia.pawnState!.health = 30
    w.tick(2.5)
    expect(l.a.state.feed.at(-1)).toMatchObject({ victim: { name: 'Bia' }, gas: true })
    expect(l.w.screen(ana)).toContain('Gás')
  })
})

describe('Arena: quadro do Tab durante a partida', () => {
  it('aparece só com o cursor solto e tira o placar da frente; marcar o centro é de quem chegou primeiro', async () => {
    const l = await live()
    expect(l.w.control(l.ana, 'Trocar herói')).toBeUndefined()
    expect(JSON.stringify(l.ana.ui)).toContain('"opacity":1,"transition":0.2')
    l.ana.tab = true
    l.bia.tab = true
    l.w.tick(0.1)
    expect(l.w.control(l.ana, 'Trocar herói')).toBeDefined()
    expect(l.w.control(l.ana, 'Marcar o centro aqui')).toBeDefined()
    expect(l.w.control(l.bia, 'Trocar herói')).toBeDefined()
    expect(l.w.control(l.bia, 'Marcar o centro aqui')).toBeUndefined()
    // Com o Tab segurado, o placar do jogo abre no topo: o nosso some.
    expect(JSON.stringify(l.ana.ui)).toContain('"opacity":0,"transition":0.2')
    l.ana.pawnState!.position = { x: 7000, y: 7000, z: 10 }
    l.w.press(l.ana, 'Marcar o centro aqui')
    expect(l.a.state.marked).toEqual({ x: 7000, y: 7000, z: 10 })
    expect(l.bia.said('O círculo mudou de lugar.')).toBe(true)
    // O atalho escondido segue a mesma regra.
    l.w.type(l.bia, '/arena')
    expect(l.bia.said('Só quem chegou primeiro à sala marca o centro do círculo.')).toBe(true)
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

describe('Arena: o anel no mundo', () => {
  it('com os efeitos liberados, o anel é uma corrente de lasers, cada ponta seguindo o trecho seguinte', async () => {
    const l = await room()
    l.w.world.particles = true
    expect(l.w.world.precached).toContain(l.c.RING_EFFECT)
    until(l, 'live')
    expect(l.a.state.ring.lasers).toBe(true)
    expect(l.a.state.ring.count).toBe(l.c.MARKERS)
    expect(l.w.liveTexts()).toEqual([])
    const fx = l.w.liveEffects()
    const closer = fx.find((e) => e.inactive)!
    const beams = fx.filter((e) => !e.inactive)
    expect(beams.length).toBe(l.c.MARKERS)
    const center = l.a.state.ring.center!
    for (const b of beams) {
      expect(b.resource).toBe(l.c.RING_EFFECT)
      expect(l.c.flat(center, b.position)).toBeCloseTo(l.a.VARIANTS.duelo.radius, 0)
      expect(b.anchors?.[0].index).toBe(1)
    }
    // O último trecho segue o ponto parado no começo do anel; os outros, o trecho seguinte.
    const byEntity = new Map(fx.map((e) => [e.entity(), e]))
    const ends = beams.map((b) => byEntity.get(b.anchors![0].entity)!)
    expect(ends.filter((e) => e === closer).length).toBe(1)
    expect(new Set(ends).size).toBe(l.c.MARKERS)
    // O ponto parado fica onde o primeiro trecho começa (no ângulo zero do anel).
    const first = beams.find((b) => Math.abs(b.position.y - center.y) < 1 && b.position.x > center.x)!
    expect(closer.position).toEqual(first.position)
  })

  it('quando o círculo fecha, os lasers vão junto', async () => {
    const l = await room([], {})
    l.w.world.particles = true
    until(l, 'live')
    for (const f of l.a.state.fighters) (f.seat.player as unknown as FakePlayer).pawnState!.position = { ...l.a.state.ring.center! }
    l.w.tick(l.a.SHRINK_FROM + 20)
    for (const f of l.a.state.fighters) (f.seat.player as unknown as FakePlayer).pawnState!.position = { ...l.a.state.ring.center! }
    const center = l.a.state.ring.center!
    expect(l.a.currentRadius()).toBeLessThan(l.a.VARIANTS.duelo.radius)
    for (const b of l.w.liveEffects()) expect(Math.abs(l.c.flat(center, b.position) - l.a.currentRadius())).toBeLessThan(25)
  })
})

describe('Arena: textos', () => {
  it('nenhum texto manda ninguém para o chat, nem grita', async () => {
    const l = await room()
    l.w.type(l.ana, '/ajuda')
    l.w.type(l.ana, '/modo')
    const lines = l.ana.log.filter((x) => x.startsWith('chat:') || x.startsWith('toast:'))
    expect(lines.length).toBeGreaterThan(0)
    for (const x of lines) expect(x).not.toMatch(/\/\w|!/)
    const seen: string[] = [screens(l, l.ana, l.bia)]
    l.w.press(l.ana, 'Escolher herói')
    l.w.tick(0.1)
    seen.push(l.w.screen(l.ana))
    l.w.press(l.ana, 'Fechar')
    until(l, 'countdown')
    seen.push(screens(l, l.ana, l.bia))
    until(l, 'live')
    seen.push(screens(l, l.ana, l.bia))
    const c = l.a.state.ring.center!
    l.bia.pawnState!.position = { x: c.x + 5000, y: c.y, z: c.z }
    l.ana.tab = true
    l.w.tick(0.1)
    seen.push(screens(l, l.ana, l.bia))
    l.bia.pawnState!.health = 0
    l.w.tick(0.2)
    seen.push(screens(l, l.ana, l.bia))
    for (const t of seen) expect(t).not.toMatch(/\/\w|!/)
    expect(seen.join(' ')).not.toContain('Sobe, que tem vaga')
  })
})
