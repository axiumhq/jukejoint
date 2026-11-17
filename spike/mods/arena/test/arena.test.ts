import { type FakePlayer } from './fake-modlock'

// Each test loads a fresh copy of the mode against a fresh fake world.
async function load(args: string[] = []) {
  vi.resetModules()
  const f = await import('./fake-modlock')
  await import('../main')
  const a = await import('../arena')
  const c = await import('../circulo')
  f.fake.start(args)
  f.fake.loadWorld()
  return { w: f.fake, a, c }
}

type Loaded = Awaited<ReturnType<typeof load>>

/** Runs frames until the match reaches phase (a round valendo, by default). */
function until({ w, a }: Loaded, phase: string = 'live', max = 30) {
  for (let i = 0; i < max * 10 && a.state.phase !== phase; i++) w.tick(0.1)
  expect(a.state.phase).toBe(phase)
}

function down(p: FakePlayer) {
  p.pawnState!.health = 0
}

/** Derruba todo mundo do lado e deixa o quadro seguinte contar. */
function downSide(l: Loaded, side: number) {
  for (const f of l.a.state.fighters.filter((x) => x.side === side)) down(f.seat.player as unknown as FakePlayer)
  l.w.tick(0.2)
}

function names(l: Loaded) {
  return l.a.state.queue.map((s) => s.name)
}

function sides(l: Loaded) {
  return [0, 1].map((side) => l.a.state.fighters.filter((f) => f.side === side).map((f) => f.seat.name))
}

describe('Arena: espera e começo', () => {
  it('espera uma segunda pessoa antes de começar', async () => {
    const l = await load()
    const a = l.w.join('Ana')
    l.w.tick(3)
    expect(a.said('Esperando mais uma pessoa')).toBe(true)
    expect(l.a.state.phase).toBe('waiting')
  })

  it('sem configuração, é o duelo no círculo até 5 pontos', async () => {
    const l = await load()
    l.w.join('Ana')
    l.w.join('Bia')
    until(l)
    expect(l.a.state.rules).toMatchObject({ variant: 'duelo', timed: false, target: 5 })
    expect(sides(l)).toEqual([['Ana'], ['Bia']])
  })

  it('põe os lados em times opostos, dentro do círculo, com o mesmo kit e congelados na contagem', async () => {
    const l = await load()
    const a = l.w.join('Ana')
    const b = l.w.join('Bia')
    until(l, 'countdown')
    expect(a.frozen && b.frozen).toBe(true)
    expect(a.pawnState?.team).toBe(2)
    expect(b.pawnState?.team).toBe(3)
    expect(a.items.length).toBe(6)
    expect([...a.items].sort()).toEqual([...b.items].sort())
    const center = l.a.state.ring.center!
    for (const p of [a, b]) expect(l.c.flat(center, p.pawnState!.position)).toBeLessThan(l.a.VARIANTS.duelo.radius)
    until(l)
    expect(a.frozen || b.frozen).toBe(false)
  })

  it('desenha o anel com os marcadores no raio do círculo', async () => {
    const l = await load()
    l.w.join('Ana')
    l.w.join('Bia')
    until(l)
    const marks = l.w.liveTexts()
    expect(marks.length).toBe(l.c.MARKERS)
    const center = l.a.state.ring.center!
    for (const m of marks) expect(l.c.flat(center, m.position)).toBeCloseTo(l.a.VARIANTS.duelo.radius, 0)
  })

  it('o centro do círculo fica no mesmo lugar de uma rodada para outra; /arena o muda', async () => {
    const l = await load()
    const a = l.w.join('Ana')
    const b = l.w.join('Bia')
    until(l)
    const first = { ...l.a.state.ring.center! }
    a.pawnState!.position = { x: first.x + 300, y: first.y + 4000, z: 0 }
    down(b)
    l.w.tick(0.2)
    until(l)
    expect(l.a.state.ring.center).toEqual(first)
    a.pawnState!.position = { x: 9000, y: 9000, z: 50 }
    l.w.type(a, '/arena')
    expect(b.said('O círculo mudou de lugar.')).toBe(true)
    down(b)
    l.w.tick(0.2)
    until(l)
    expect(l.a.state.ring.center).toEqual({ x: 9000, y: 9000, z: 50 })
    expect(l.w.liveTexts().length).toBe(l.c.MARKERS)
  })

  it('fora da rodada valendo ninguém toma dano; quem já caiu também não', async () => {
    const l = await load()
    const a = l.w.join('Ana')
    const b = l.w.join('Bia')
    until(l, 'countdown')
    expect(l.w.hit(b, 100, a)).toBe(true)
    until(l)
    expect(l.w.hit(b, 100, a)).toBe(false)
    down(b)
    l.w.tick(0.2)
    expect(l.w.hit(a, 100, b)).toBe(true)
  })
})

describe('Arena: duelo no círculo', () => {
  it('quem faz os pontos do lobby leva, com abates e vitória nas métricas', async () => {
    const l = await load()
    const a = l.w.join('Ana', { pontos: '3' })
    const b = l.w.join('Bia')
    for (let r = 1; r <= 3; r++) {
      until(l)
      expect(l.w.hit(b, 10_000, a)).toBe(false)
      l.w.tick(0.2)
    }
    expect(a.said('Ana derrubou Bia')).toBe(true)
    expect(a.said('Rodada 2: Ana leva no abate. Ana 2 × 0 Bia')).toBe(true)
    expect(a.said('Ana vence a Arena, 3 a 0.')).toBe(true)
    expect(a.metrics).toEqual({ 'arena.abates': 3, 'arena.sequencia': 3, 'arena.vitorias': 1 })
    expect(b.metrics).toEqual({})
  })

  it('o abate visto antes do aviso do golpe ainda vai para quem derrubou', async () => {
    const l = await load()
    const a = l.w.join('Ana')
    const b = l.w.join('Bia')
    until(l)
    down(b)
    l.w.tick(0.1)
    expect(l.a.state.phase).toBe('roundOver')
    // O aviso do golpe fatal chega um quadro depois.
    for (const fn of l.w.world.damagedFns) fn({ victim: b.pawnState!.entity, attacker: a.pawnState!.entity, healthBefore: 300, healthLost: 300 })
    expect(a.metrics['arena.abates']).toBe(1)
  })

  it('quem perde vai para o fim da fila e a próxima pessoa entra', async () => {
    const l = await load()
    l.w.join('Ana', { pontos: '1' })
    const b = l.w.join('Bia')
    const c = l.w.join('Caio')
    until(l)
    expect(sides(l)).toEqual([['Ana'], ['Bia']])
    expect(c.watching).toBeDefined()
    down(b)
    l.w.tick(0.2)
    expect(names(l)).toEqual(['Ana', 'Caio', 'Bia'])
    until(l, 'starting', 10)
    until(l)
    expect(sides(l)).toEqual([['Ana'], ['Caio']])
    expect(b.pawnState).toBeUndefined()
    l.w.type(b, '/placar')
    expect(b.said('Fila: 1. Bia')).toBe(true)
  })

  it('se um lado sai do servidor, o outro leva a partida', async () => {
    const l = await load()
    const a = l.w.join('Ana')
    const b = l.w.join('Bia')
    until(l)
    l.w.disconnect(b)
    expect(a.said('Bia saiu. Ana leva a partida.')).toBe(true)
    l.w.tick(8)
    expect(a.said('Esperando mais uma pessoa')).toBe(true)
  })

  it('a rodada sem queda acaba no tempo: vence quem tem mais vida; vida igual repete', async () => {
    const l = await load()
    const a = l.w.join('Ana')
    const b = l.w.join('Bia')
    until(l)
    // Longe do gás: os dois no centro.
    for (const p of [a, b]) p.pawnState!.position = { ...l.a.state.ring.center! }
    l.w.tick(l.a.ROUND_LIMIT + 1)
    expect(a.said('Tempo esgotado com as vidas iguais. A rodada vai de novo.')).toBe(true)
    until(l)
    // Longe do gás: os dois no centro.
    for (const p of [a, b]) p.pawnState!.position = { ...l.a.state.ring.center! }
    b.pawnState!.health = 300
    l.w.tick(l.a.ROUND_LIMIT + 1)
    expect(a.said('Rodada 1: Ana leva no tempo, com mais vida. Ana 1 × 0 Bia')).toBe(true)
  })
})

describe('Arena: dupla', () => {
  it('2 contra 2: a rodada só acaba quando a dupla inteira cai', async () => {
    const l = await load()
    const a = l.w.join('Ana', { variante: 'dupla', pontos: '2' })
    l.w.join('Bia')
    const c = l.w.join('Caio')
    const d = l.w.join('Davi')
    until(l)
    expect(sides(l)).toEqual([['Ana', 'Bia'], ['Caio', 'Davi']])
    expect(c.pawnState?.team).toBe(3)
    down(c)
    l.w.tick(0.2)
    expect(l.a.state.phase).toBe('live')
    down(d)
    l.w.tick(0.2)
    expect(a.said('Rodada 1: Ana e Bia levam no abate. Ana e Bia 1 × 0 Caio e Davi')).toBe(true)
    until(l)
    downSide(l, 1)
    expect(a.said('Ana e Bia vencem a Arena, 2 a 0.')).toBe(true)
  })

  it('a dupla que vence fica junta, a que esperava entra e a que perdeu vai para o fim', async () => {
    const l = await load()
    l.w.join('Ana', { variante: 'dupla', pontos: '1' })
    for (const n of ['Bia', 'Caio', 'Davi', 'Eva', 'Fábio']) l.w.join(n)
    until(l)
    downSide(l, 0)
    expect(names(l)).toEqual(['Caio', 'Davi', 'Eva', 'Fábio', 'Ana', 'Bia'])
    until(l, 'starting', 10)
    until(l)
    expect(sides(l)).toEqual([['Caio', 'Davi'], ['Eva', 'Fábio']])
  })

  it('com três pessoas, a dupla vira um contra um e a terceira espera', async () => {
    const l = await load()
    l.w.join('Ana', { variante: 'dupla' })
    l.w.join('Bia')
    l.w.join('Caio')
    until(l)
    expect(sides(l)).toEqual([['Ana'], ['Bia']])
    expect(l.a.queueLine()).toBe('Fila: 1. Caio')
  })
})

describe('Arena: times', () => {
  it('até 6 contra 6, com os lados alternados e quem sobra na fila', async () => {
    const l = await load()
    l.w.join('P1', { variante: 'times' })
    for (let i = 2; i <= 13; i++) l.w.join(`P${i}`)
    until(l)
    const [s0, s1] = sides(l)
    expect(s0).toEqual(['P1', 'P3', 'P5', 'P7', 'P9', 'P11'])
    expect(s1).toEqual(['P2', 'P4', 'P6', 'P8', 'P10', 'P12'])
    expect(l.a.queueLine()).toBe('Fila: 1. P13')
    expect(l.a.state.fighters.every((f) => (f.seat.player as unknown as FakePlayer).pawnState?.team === l.a.TEAM_OF_SIDE[f.side])).toBe(true)
  })

  it('um time leva a rodada quando ninguém do outro está de pé; 3 rodadas levam a partida', async () => {
    const l = await load()
    const p = [l.w.join('P1', { variante: 'times', pontos: '9' })]
    for (let i = 2; i <= 4; i++) p.push(l.w.join(`P${i}`))
    until(l)
    expect(l.a.state.rules.target).toBe(3)
    // P2 e P4 são Safira. Cair um não fecha a rodada.
    down(p[1])
    l.w.tick(0.2)
    expect(l.a.state.phase).toBe('live')
    // Quem caiu e o jogo reviveu fica parado, assistindo, sem tomar dano.
    p[1].pawnState!.health = 600
    l.w.tick(0.2)
    expect(p[1].frozen).toBe(true)
    expect(p[1].watching).toBe(p[3].pawnState!.entity)
    expect(l.w.hit(p[1], 100, p[0])).toBe(true)
    down(p[3])
    l.w.tick(0.2)
    expect(p[0].said('Rodada 1: Âmbar leva no abate. Âmbar 1 × 0 Safira')).toBe(true)
    until(l)
    expect(p[1].frozen).toBe(false)
    downSide(l, 0)
    until(l)
    downSide(l, 1)
    until(l)
    downSide(l, 1)
    expect(p[0].said('Âmbar vence a Arena, 3 a 1.')).toBe(true)
    expect(p[0].metrics['arena.vitorias']).toBe(1)
    expect(p[2].metrics['arena.vitorias']).toBe(1)
    expect(p[1].metrics['arena.vitorias']).toBeUndefined()
  })

  it('se alguém do time sai, a partida segue; se o time inteiro sai, o outro leva', async () => {
    const l = await load()
    const p = [l.w.join('P1', { variante: 'times' })]
    for (let i = 2; i <= 4; i++) p.push(l.w.join(`P${i}`))
    until(l)
    l.w.disconnect(p[1])
    expect(l.a.state.phase).toBe('live')
    expect(sides(l)[1]).toEqual(['P4'])
    l.w.disconnect(p[3])
    expect(p[0].said('P4 saiu. Âmbar leva a partida.')).toBe(true)
  })
})

describe('Arena: espelho', () => {
  it('todo mundo com o mesmo herói, sorteado a cada rodada', async () => {
    const l = await load()
    const p = [l.w.join('P1', { variante: 'espelho' })]
    for (let i = 2; i <= 4; i++) p.push(l.w.join(`P${i}`))
    const seen = new Set<string>()
    for (let r = 0; r < 3; r++) {
      until(l)
      const heroes = new Set(p.map((x) => x.pawnState!.hero))
      expect(heroes.size).toBe(1)
      expect(l.a.state.hero).toBe(p[0].pawnState!.hero)
      seen.add(l.a.state.hero)
      downSide(l, r % 2)
    }
    expect(l.a.state.rules.target).toBe(3)
  })

  it('com um bot, o espelho usa o herói do bot, que o host não troca', async () => {
    const l = await load()
    l.w.join('Ana', { variante: 'espelho' })
    const bot = l.w.joinBot('Treino', 'hero_tres', 3)
    until(l)
    expect(l.a.state.hero).toBe('hero_tres')
    expect(l.a.state.fighters.map((f) => (f.seat.player as unknown as FakePlayer).pawnState?.hero)).toEqual(['hero_tres', 'hero_tres'])
    expect(bot.pawnState?.team).toBe(3)
  })
})

describe('Arena: o círculo e o gás', () => {
  it('fora do círculo, o gás tira vida a cada segundo; dentro, não', async () => {
    const l = await load()
    const a = l.w.join('Ana')
    const b = l.w.join('Bia')
    until(l)
    const c = l.a.state.ring.center!
    b.pawnState!.position = { x: c.x + l.a.VARIANTS.duelo.radius + 200, y: c.y, z: c.z }
    l.w.tick(1.1)
    expect(b.said('Fora do círculo')).toBe(true)
    expect(b.pawnState!.health).toBe(600 - l.c.gasDamage(600))
    expect(a.pawnState!.health).toBe(600)
    expect(l.a.state.gasHits).toBeGreaterThanOrEqual(1)
    expect(l.w.world.modHits.every((h) => h.attacker === undefined)).toBe(true)
    b.pawnState!.position = { ...c }
    const before = b.pawnState!.health
    l.w.tick(2)
    expect(b.pawnState!.health).toBe(before)
  })

  it('cair no gás conta como queda e decide a rodada', async () => {
    const l = await load()
    const a = l.w.join('Ana')
    const b = l.w.join('Bia')
    until(l)
    const c = l.a.state.ring.center!
    b.pawnState!.position = { x: c.x, y: c.y + 5000, z: c.z }
    b.pawnState!.health = 30
    l.w.tick(2.5)
    expect(a.said('Bia caiu no gás.')).toBe(true)
    expect(a.said('Rodada 1: Ana leva no abate. Ana 1 × 0 Bia')).toBe(true)
  })

  it('sem tempo, o círculo fica inteiro e depois fecha até 30% do raio', async () => {
    const l = await load()
    l.w.join('Ana')
    l.w.join('Bia')
    until(l)
    const full = l.a.VARIANTS.duelo.radius
    // Longe do gás e sem ninguém cair: os dois no centro.
    for (const f of l.a.state.fighters) (f.seat.player as unknown as FakePlayer).pawnState!.position = { ...l.a.state.ring.center! }
    l.w.tick(l.a.SHRINK_FROM - 1)
    expect(l.a.currentRadius()).toBe(full)
    l.w.tick((l.a.SHRINK_TO - l.a.SHRINK_FROM) / 2 + 1)
    expect(l.a.currentRadius()).toBeCloseTo(full * (1 - 0.7 * 0.5), -1)
    const center = l.a.state.ring.center!
    for (const m of l.w.liveTexts()) expect(Math.abs(l.c.flat(center, m.position) - l.a.currentRadius())).toBeLessThan(25)
    l.w.tick(l.a.SHRINK_TO + 1 - (l.a.state.now - l.a.state.liveAt))
    expect(l.a.state.phase).toBe('live')
    expect(l.a.currentRadius()).toBeCloseTo(full * l.c.MIN_FRACTION, 5)
  })

  it('o raio fecha em linha reta entre os dois instantes', async () => {
    const { c } = await load()
    expect(c.radiusAt(1000, 10, 20, 80)).toBe(1000)
    expect(c.radiusAt(1000, 50, 20, 80)).toBeCloseTo(650)
    expect(c.radiusAt(1000, 500, 20, 80)).toBeCloseTo(300)
    expect(c.gasDamage(600)).toBe(48)
    expect(c.gasDamage(100)).toBe(c.GAS_MIN)
  })
})

describe('Arena: com tempo', () => {
  it('cada queda vale ponto, quem cai volta protegido no seu lado e o círculo fecha desde o começo', async () => {
    const l = await load()
    const a = l.w.join('Ana', { tempo: 'true' })
    const b = l.w.join('Bia')
    until(l)
    expect(l.a.state.rules.timed).toBe(true)
    l.w.tick(10)
    expect(l.a.currentRadius()).toBeLessThan(l.a.VARIANTS.duelo.radius)
    for (const p of [a, b]) p.pawnState!.position = { ...l.a.state.ring.center! }
    expect(l.w.hit(b, 10_000, a)).toBe(false)
    l.w.tick(0.2)
    expect(l.a.state.score).toEqual([1, 0])
    expect(l.a.state.phase).toBe('live')
    l.w.tick(l.a.RESPAWN_SECONDS + 0.5)
    expect(b.pawnState!.health).toBe(600)
    expect(l.c.flat(l.a.state.ring.center!, b.pawnState!.position)).toBeLessThan(l.a.currentRadius())
    expect(b.pawnState!.position.x).toBeGreaterThan(l.a.state.ring.center!.x)
    expect(l.w.hit(b, 100, a)).toBe(true)
    l.w.tick(l.a.PROTECTION_SECONDS + 0.2)
    expect(l.w.hit(b, 100, a)).toBe(false)
  })

  it('no fim dos 3 minutos vence quem fez mais pontos', async () => {
    const l = await load()
    const a = l.w.join('Ana', { tempo: 'true' })
    const b = l.w.join('Bia')
    until(l)
    const center = () => { for (const p of [a, b]) if (p.pawnState) p.pawnState.position = { ...l.a.state.ring.center! } }
    center()
    down(a)
    l.w.tick(5)
    center()
    down(b)
    l.w.tick(5)
    center()
    down(b)
    l.w.tick(5)
    center()
    expect(l.a.state.score).toEqual([2, 1])
    for (let t = 0; t < l.a.TIMED_SECONDS; t += 5) {
      center()
      l.w.tick(5)
    }
    expect(a.said('Tempo esgotado: Ana leva a Arena, 2 a 1.')).toBe(true)
    expect(a.metrics['arena.vitorias']).toBe(1)
  })

  it('empate no tempo: quem esperava entra na frente', async () => {
    const l = await load(['tempo', 'segundos=20'])
    const a = l.w.join('Ana')
    l.w.join('Bia')
    l.w.join('Caio')
    until(l)
    for (let t = 0; t < 21; t += 1) {
      for (const f of l.a.state.fighters) (f.seat.player as unknown as FakePlayer).pawnState!.position = { ...l.a.state.ring.center! }
      l.w.tick(1)
    }
    expect(a.said('Tempo esgotado: Ana 0 × 0 Bia. Empate.')).toBe(true)
    expect(names(l)).toEqual(['Caio', 'Ana', 'Bia'])
  })
})

describe('Arena: configuração e comandos', () => {
  it('os argumentos do servidor valem acima do lobby', async () => {
    const l = await load(['variante=times', 'tempo', 'segundos=60'])
    l.w.join('Ana', { variante: 'duelo', tempo: 'false' })
    l.w.join('Bia')
    until(l)
    expect(l.a.state.rules).toMatchObject({ variant: 'times', timed: true, seconds: 60, target: 3 })
  })

  it('quem abriu a sala muda o jeito com /modo; outra pessoa não', async () => {
    const l = await load()
    const a = l.w.join('Ana', { pontos: '1' })
    const b = l.w.join('Bia')
    until(l)
    l.w.type(b, '/modo times')
    expect(b.said('Só Ana muda o jeito de jogar.')).toBe(true)
    l.w.type(a, '/modo dupla tempo')
    expect(a.said('Próxima partida: Dupla, com tempo')).toBe(true)
    down(b)
    l.w.tick(0.2)
    until(l, 'starting', 10)
    expect(l.a.state.rules).toMatchObject({ variant: 'dupla', timed: true })
  })

  it('/heroi troca o herói a partir da próxima rodada', async () => {
    const l = await load()
    const a = l.w.join('Ana')
    l.w.join('Bia')
    until(l)
    l.w.type(a, '/heroi Herói Três')
    expect(a.said('Seu herói: Herói Três.')).toBe(true)
    downSide(l, 1)
    until(l)
    expect(a.pawnState?.hero).toBe('hero_tres')
    expect(a.pawnState?.team).toBe(2)
  })

  it('/bot completa os lados só com menos de duas pessoas', async () => {
    const l = await load()
    const a = l.w.join('Ana', { variante: 'dupla' })
    l.w.tick(1.2)
    for (let i = 0; i < 4; i++) l.w.type(a, '/bot')
    expect(l.w.world.botRequests.length).toBe(3)
    expect(a.said('Os lados já estão completos.')).toBe(true)
    until(l)
    expect(sides(l)).toEqual([['Ana', 'Treino 1'], ['Treino 2', 'Treino 3']])
    l.w.type(a, '/tirarbots')
    expect(a.said('Os bots saíram.')).toBe(true)
    l.w.tick(1.2)
    expect(names(l)).toEqual(['Ana'])
  })

  it('o placar na tela mostra os lados, os pontos, os marcadores e o relógio', async () => {
    const l = await load()
    const a = l.w.join('Ana', { pontos: '3' })
    const b = l.w.join('Bia')
    until(l)
    down(b)
    l.w.tick(0.2)
    const ui = JSON.stringify(a.ui)
    expect(ui).toContain('Ana 1 × 0 Bia · Duelo no círculo · rodada 1')
    expect(ui).toContain('"points":[1,0]')
    expect(ui).toContain('"total":3')
    expect(ui).toContain('Ana leva a rodada')
    until(l)
    expect(JSON.stringify(a.ui)).toContain('"line":"2:00"')
  })

  it('/placar responde para quem pediu', async () => {
    const l = await load()
    const a = l.w.join('Ana')
    l.w.tick(1.2)
    l.w.type(a, '/placar')
    expect(a.said('Esperando mais uma pessoa para a Arena.')).toBe(true)
  })
})
