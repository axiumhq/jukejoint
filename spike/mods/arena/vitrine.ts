// A vitrine: só para a prévia do Modlock (`modlock dev --sandbox`), que tem uma pessoa de mentira
// no lugar de quem joga e nenhum bot. Com o argumento `--arg vitrine=<estado>`, o modo para de
// jogar e, a cada quadro, monta o estado com dados de mentira, mas parecidos com uma partida de
// verdade, em volta da pessoa da prévia, para a tela dela mostrar aquele momento parado.
// Sem o argumento, nada daqui roda.
//
// Os estados: votacao, contagem, partida, times, fora, caiu, rodada, vitoria e heroi.
import { type Connection, heroes, type Player, players, type Vector } from 'modlock'

import { type Fighter, key, type Rules, type Seat, state, TIMED_SECONDS, VARIANTS } from './arena'

export const VITRINES = ['votacao', 'contagem', 'partida', 'times', 'fora', 'caiu', 'rodada', 'vitoria', 'heroi'] as const
export type Vitrine = (typeof VITRINES)[number]

/** O estado da vitrine nos argumentos do servidor (`vitrine=partida`), ou undefined. */
export function parseVitrine(args: readonly string[]): Vitrine | undefined {
  const v = args.find((a) => a.startsWith('vitrine='))?.slice('vitrine='.length)
  return (VITRINES as readonly string[]).includes(v ?? '') ? (v as Vitrine) : undefined
}

/** As pessoas de mentira: nome e herói. Nenhuma tem tela; elas só aparecem na tela da prévia. */
const NAMES = ['Enzo', 'Mina', 'Caio', 'Lia', 'Teo', 'Rui', 'Iara']

const heroAt = (i: number) => heroes[i % Math.max(1, heroes.length)]?.id ?? 0

/** Uma vaga de mentira, com um herói parado na posição dada. Vagas acima de 200 não existem no servidor. */
function fakeSeat(i: number, at: Vector, health = 600): Seat {
  const pawn = {
    entity: 0,
    hero: heroAt(i + 3),
    team: 2,
    health,
    maxHealth: 600,
    position: at,
    eyeAngles: { pitch: 0, yaw: 0, roll: 0 },
    cameraAngles: { pitch: 0, yaw: 0, roll: 0 },
  }
  const player = { slot: 200 + i, pawn: () => pawn, setting: () => undefined } as unknown as Player
  return { player, slot: 200 + i, generation: 1, steamId: 0n, name: NAMES[i], bot: false, arrival: 100 + i, fake: true }
}

const real = new Map<string, Seat>()

/** As pessoas de verdade no servidor (na prévia, a pessoa de mentira do sandbox). */
function people(): Seat[] {
  const out: Seat[] = []
  for (const c of players().filter((x: Connection) => x.ready && !x.bot)) {
    const k = key({ slot: c.player.slot, generation: c.generation })
    let s = real.get(k)
    if (!s) {
      s = { player: c.player, slot: c.player.slot, generation: c.generation, steamId: c.steamId, name: c.name, bot: false, arrival: real.size }
      real.set(k, s)
    }
    out.push(s)
  }
  return out
}

function fighter(seat: Seat, side: number, alive = true): Fighter {
  return {
    seat,
    side,
    alive,
    fellAt: state.now - 1,
    told: true,
    gassed: false,
    wantHero: 0,
    kills: 0,
    streak: 0,
    protectedUntil: 0,
    benched: !alive,
    inGas: false,
    hurt: 0,
  }
}

function rules(variant: Rules['variant'], timed: boolean, target: number): Rules {
  return { variant, timed, target, seconds: TIMED_SECONDS }
}

/** Põe o anel no mundo uma vez, para a prévia mostrar o laser; o mapa novo o tira. */
function ring(center: Vector, radius: number) {
  state.fullRadius = radius
  if (!state.ring.center) state.ring.place(center, radius)
}

/** A partida valendo há `elapsed` segundos, com `left` segundos no relógio. */
function live(elapsed: number, left: number) {
  state.phase = 'live'
  state.liveAt = state.now - elapsed
  state.endsAt = state.now + left
}

/** Monta o estado da vitrine para este quadro. */
export function showcase(name: Vitrine, now: number): void {
  state.now = now
  const me = people()[0]
  if (!me) return
  const pawn = me.player.pawn()
  const here = pawn?.position ?? { x: 0, y: 0, z: 0 }
  const near = (dx: number, dy: number): Vector => ({ x: here.x + dx, y: here.y + dy, z: here.z })
  const others = NAMES.map((_, i) => fakeSeat(i, near(400 + 120 * i, 200 * (i % 3) - 200), name === 'times' && i === 4 ? 0 : 600))

  // O que muda de um estado para outro começa do zero a cada quadro: o estado fica parado.
  state.heroMenu.clear()
  state.votes.clear()
  state.ready.clear()
  state.beginAt = undefined
  state.banner = undefined
  state.callouts = []
  state.feed = []
  state.lastText = ''
  state.auto = false
  state.round = 1
  state.score = [0, 0]
  state.fighters = []

  const [enzo, mina, caio, lia, teo, rui, iara] = others
  const who = (s: Seat, side: number) => ({ name: s.name, hero: s.player.pawn()?.hero ?? 0, side })

  switch (name) {
    case 'votacao':
    case 'heroi': {
      state.phase = 'waiting'
      state.queue = [me, enzo, mina]
      state.votes.set(key(me), { variante: 'duelo', tempo: 'false', pontos: '5' })
      state.votes.set(key(enzo), { variante: 'duelo', tempo: 'false', pontos: '5' })
      state.votes.set(key(mina), { variante: 'espelho', tempo: 'true', pontos: '3' })
      state.ready.add(key(enzo))
      state.ready.add(key(mina))
      if (name === 'heroi') state.heroMenu.add(key(me))
      break
    }
    case 'contagem': {
      state.rules = rules('duelo', false, 5)
      state.queue = [me, enzo, mina]
      state.fighters = [fighter(me, 0), fighter(enzo, 1)]
      state.round = 2
      state.score = [1, 0]
      state.phase = 'countdown'
      state.countdownAt = now - 1.2
      ring(here, VARIANTS.duelo.radius)
      break
    }
    case 'partida': {
      state.rules = rules('duelo', true, 5)
      state.queue = [me, enzo, mina]
      state.fighters = [fighter(me, 0), fighter(enzo, 1)]
      state.score = [2, 1]
      live(73, 107)
      state.feed = [{ by: who(me, 0), victim: who(enzo, 1), gas: false, at: now - 2 }]
      ring(here, VARIANTS.duelo.radius)
      break
    }
    case 'times': {
      state.rules = rules('times', false, 3)
      state.queue = [me, ...others]
      const mine = [me, enzo, caio, teo].map((s) => fighter(s, 0))
      const theirs = [mina, lia, rui, iara].map((s) => fighter(s, 1))
      mine[3].alive = false
      theirs[1].alive = false
      state.fighters = [...mine, ...theirs]
      state.round = 2
      state.score = [1, 1]
      live(40, 80)
      state.feed = [
        { by: who(mina, 1), victim: who(teo, 0), gas: false, at: now - 3 },
        { by: who(me, 0), victim: who(lia, 1), gas: false, at: now - 1 },
      ]
      ring(here, VARIANTS.times.radius)
      break
    }
    case 'fora': {
      state.rules = rules('duelo', false, 5)
      state.queue = [me, enzo]
      state.fighters = [fighter(me, 0), fighter(enzo, 1)]
      state.score = [1, 1]
      state.round = 3
      live(10, 110)
      // O centro fica à direita de onde a câmera olhava no primeiro quadro, além da borda.
      const yaw = (((pawn?.cameraAngles?.yaw ?? 0) - 90) * Math.PI) / 180
      const d = VARIANTS.duelo.radius + 320
      if (!state.ring.center) ring(near(Math.cos(yaw) * d, Math.sin(yaw) * d), VARIANTS.duelo.radius)
      break
    }
    case 'caiu': {
      state.rules = rules('dupla', false, 5)
      state.queue = [me, enzo, mina, caio]
      state.fighters = [fighter(me, 0, false), fighter(enzo, 0), fighter(mina, 1), fighter(caio, 1)]
      state.round = 2
      state.score = [0, 1]
      live(25, 95)
      state.feed = [{ by: who(mina, 1), victim: who(me, 0), gas: false, at: now - 1 }]
      ring(here, VARIANTS.dupla.radius)
      break
    }
    case 'rodada': {
      state.rules = rules('duelo', false, 5)
      state.queue = [me, enzo, mina]
      state.fighters = [fighter(me, 0), fighter(enzo, 1, false)]
      state.round = 4
      state.score = [3, 1]
      state.phase = 'roundOver'
      state.banner = { title: `${me.name} leva a rodada`, detail: '', until: now + 3, side: 0, final: false }
      state.feed = [{ by: who(me, 0), victim: who(enzo, 1), gas: false, at: now - 1 }]
      ring(here, VARIANTS.duelo.radius)
      break
    }
    case 'vitoria': {
      state.rules = rules('duelo', false, 5)
      state.queue = [me, enzo, mina]
      state.fighters = [fighter(me, 0), fighter(enzo, 1, false)]
      state.round = 8
      state.score = [5, 3]
      state.phase = 'matchOver'
      state.banner = { title: `${me.name} vence`, detail: '', until: now + 6, side: 0, final: true }
      state.callouts = [{ title: 'Sem tomar dano', detail: `${me.name} levou a rodada sem perder vida`, until: now + 2 }]
      ring(here, VARIANTS.duelo.radius)
      break
    }
  }
}
