import { fake, type FakePlayer } from './fake-modlock'

// Each test loads a fresh copy of the mode against a fresh fake world.
async function load() {
  vi.resetModules()
  const f = await import('./fake-modlock')
  await import('../main')
  f.fake.loadWorld()
  return f.fake
}

function kill(p: FakePlayer) {
  p.pawnState!.health = 0
}

/** Runs until the round is live: hero seated, countdown over. */
function untilLive(w: typeof fake) {
  w.tick(8)
}

describe('Duelo à Meia-Noite', () => {
  let w: typeof fake
  beforeEach(async () => {
    w = await load()
  })

  it('espera uma segunda pessoa antes de começar', () => {
    const a = w.join('Ana', 0)
    w.tick(3)
    expect(a.said('Esperando mais uma pessoa')).toBe(true)
    expect(a.pawnState).toBeUndefined()
  })

  it('dá o mesmo herói e os mesmos itens aos dois, em times opostos', () => {
    const a = w.join('Ana', 0)
    const b = w.join('Bia', 1)
    w.tick(1.5)
    untilLive(w)
    expect(a.pawnState?.hero).toBe(b.pawnState?.hero)
    expect(a.pawnState?.team).toBe(2)
    expect(b.pawnState?.team).toBe(3)
    expect(a.items.length).toBe(6)
    expect([...a.items].sort()).toEqual([...b.items].sort())
    expect(a.items.every((n) => !n.endsWith('_3'))).toBe(true)
    expect(a.frozen || b.frozen).toBe(false)
  })

  it('congela os dois durante a contagem', () => {
    const a = w.join('Ana', 0)
    const b = w.join('Bia', 1)
    w.tick(4)
    expect(a.frozen && b.frozen).toBe(true)
  })

  it('quem faz 3 rodadas leva, e a revanche começa sozinha', () => {
    const a = w.join('Ana', 0)
    const b = w.join('Bia', 1)
    w.tick(1.5)
    for (let r = 1; r <= 3; r++) {
      untilLive(w)
      kill(b)
      w.tick(0.3)
      if (r < 3) expect(a.said(`Ana ${r} × 0 Bia`)).toBe(true)
    }
    expect(a.said('Ana vence o duelo, 3 a 0.')).toBe(true)
    expect(b.said('Próximo duelo: Ana contra Bia.')).toBe(true)
    w.tick(8)
    expect(a.said('Ana contra Bia. Melhor de cinco.')).toBe(true)
  })

  it('a placar alterna e o perdedor da rodada pode virar', () => {
    const a = w.join('Ana', 0)
    const b = w.join('Bia', 1)
    w.tick(1.5)
    untilLive(w); kill(b); w.tick(0.3)
    untilLive(w); kill(a); w.tick(0.3)
    expect(a.said('Ana 1 × 1 Bia')).toBe(true)
    untilLive(w); kill(a); w.tick(0.3)
    untilLive(w); kill(a); w.tick(0.3)
    expect(a.said('Bia vence o duelo, 3 a 1.')).toBe(true)
  })

  it('quem perde vai para o fim da fila e a próxima pessoa entra', () => {
    const a = w.join('Ana', 0)
    const b = w.join('Bia', 1)
    w.tick(1.5)
    const c = w.join('Caio', 2)
    w.tick(1.5)
    expect(c.said('Duelo à Meia-Noite')).toBe(true)
    for (let r = 0; r < 3; r++) { untilLive(w); kill(b); w.tick(0.3) }
    expect(c.said('Próximo duelo: Ana contra Caio.')).toBe(true)
    w.tick(8)
    untilLive(w)
    expect(c.pawnState?.team).toBe(3)
    expect(b.pawnState).toBeUndefined()
    w.type(b, '/placar')
    expect(b.said('Fila: 1. Bia')).toBe(true)
  })

  it('quem fica na fila assiste ao duelo', () => {
    const a = w.join('Ana', 0)
    w.join('Bia', 1)
    w.tick(1.5)
    const c = w.join('Caio', 2)
    untilLive(w)
    expect(c.watching).toBe(a.pawnState?.entity)
  })

  it('se um duelista sai, o outro leva a partida', () => {
    const a = w.join('Ana', 0)
    const b = w.join('Bia', 1)
    w.tick(1.5)
    untilLive(w)
    w.leave(b)
    w.tick(1.5)
    expect(a.said('Bia saiu. Ana leva a partida.')).toBe(true)
    w.tick(8)
    expect(a.said('Esperando mais uma pessoa')).toBe(true)
  })

  it('no tempo esgotado vence quem tem mais vida; vida igual repete a rodada', () => {
    const a = w.join('Ana', 0)
    const b = w.join('Bia', 1)
    w.tick(1.5)
    untilLive(w)
    w.tick(91)
    expect(a.said('Tempo esgotado com as duas vidas iguais')).toBe(true)
    untilLive(w)
    expect(a.said('Rodada 1:')).toBe(true)
    b.pawnState!.health = 300
    w.tick(91)
    expect(a.said('Rodada 1: Ana vence no tempo, com mais vida. Ana 1 × 0 Bia')).toBe(true)
  })

  it('o golpe fatal decide a rodada uma vez só', () => {
    const a = w.join('Ana', 0)
    const b = w.join('Bia', 1)
    w.tick(1.5)
    untilLive(w)
    expect(w.hit(b, 10_000)).toBe(false)
    w.tick(0.3)
    expect(a.said('Rodada 1: Ana vence no abate. Ana 1 × 0 Bia')).toBe(true)
    expect(a.said('Ana 2 × 0 Bia')).toBe(false)
  })

  it('ninguém toma dano na contagem nem entre as rodadas', () => {
    const a = w.join('Ana', 0)
    const b = w.join('Bia', 1)
    w.tick(4)
    expect(w.hit(b, 100)).toBe(true)
    untilLive(w)
    expect(w.hit(b, 100)).toBe(false)
    kill(b)
    w.tick(0.3)
    expect(w.hit(a, 100)).toBe(true)
  })

  it('o kit são os primeiros itens da build recomendada do herói', () => {
    for (const hero of ['hero_um', 'hero_dois']) {
      w.world.builds.set(hero, [
        { name: 'Começo', description: '', items: ['a', 'b', 'c', 'b'].map((item) => ({ item, annotation: '' })) },
        { name: 'Meio', description: '', items: ['d', 'e', 'f', 'g'].map((item) => ({ item, annotation: '' })) },
      ])
    }
    const a = w.join('Ana', 0)
    const b = w.join('Bia', 1)
    w.tick(1.5)
    untilLive(w)
    expect(a.items).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
    expect(b.items).toEqual(a.items)
  })

  it('quem vence ganha as métricas e a sessão aparece no /placar', () => {
    const a = w.join('Ana', 0)
    const b = w.join('Bia', 1)
    w.tick(1.5)
    for (let r = 0; r < 3; r++) { untilLive(w); kill(b); w.tick(0.3) }
    expect(a.metrics).toEqual({ 'duelo.rodadas': 3, 'duelo.vitorias': 1, 'duelo.sequencia': 1 })
    expect(b.metrics).toEqual({})
    w.type(a, '/placar')
    expect(a.said('Você nesta sessão: 1 vitórias, 0 derrotas, sequência de 1')).toBe(true)
    w.type(b, '/placar')
    expect(b.said('Você nesta sessão: 0 vitórias, 1 derrotas, sequência de 0')).toBe(true)
  })

  it('o placar na tela mostra os dois nomes e os pontos', () => {
    const a = w.join('Ana', 0)
    const b = w.join('Bia', 1)
    w.tick(1.5)
    untilLive(w)
    kill(b)
    w.tick(0.3)
    const ui = JSON.stringify(a.ui)
    expect(ui).toContain('Ana 1 × 0 Bia')
    expect(ui).toContain('"points":[1,0]')
    expect(ui).toContain('Ana leva a rodada')
  })

  it('/placar responde para quem pediu', () => {
    const a = w.join('Ana', 0)
    w.tick(1.2)
    w.type(a, '/placar')
    expect(a.said('Esperando mais uma pessoa para o duelo.')).toBe(true)
  })
})
