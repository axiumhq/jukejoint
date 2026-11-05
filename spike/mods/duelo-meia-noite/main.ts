// Duelo à Meia-Noite: um contra um, melhor de cinco, com fila.
//
// - Os dois primeiros da fila duelam; quem está na fila assiste.
// - A cada rodada sai um herói sorteado, o mesmo para os dois, com as quatro habilidades
//   liberadas e o mesmo conjunto de itens. Sem loja.
// - Quem fizer 3 rodadas leva a partida. Quem perde vai para o fim da fila, quem vence fica.
// - Rodada sem abate em 90 segundos: vence quem tiver mais vida, em proporção. Empate repete.
//
// Comandos no chat: /placar mostra o placar e a fila; /arena muda o lugar do duelo para onde
// você está; /bot põe um bot na fila (só com menos de duas pessoas, para treinar sozinho).

import {
  type Angles,
  type Connection,
  type Player,
  type Timer,
  type Vector,
  addBot,
  after,
  command,
  ground,
  heroes,
  items,
  log,
  onFrame,
  onWorld,
  players,
  sequence,
} from 'modlock'
import * as cvar from 'modlock/console'

const WINS_NEEDED = 3
const ROUND_SECONDS = 90
const COUNTDOWN_SECONDS = 3
const BETWEEN_ROUNDS_SECONDS = 4
const BETWEEN_MATCHES_SECONDS = 6
/** Metade da distância entre os dois duelistas no começo da rodada. */
const HALF_GAP = 550
const TEAMS = [2, 3] as const

/** Um jogador pela vaga dele no servidor: a vaga e a conexão que está nela agora. */
interface Seat {
  readonly player: Player
  readonly slot: number
  readonly generation: number
  readonly name: string
  readonly bot: boolean
}

type Phase = 'waiting' | 'starting' | 'preparing' | 'countdown' | 'live' | 'roundOver' | 'matchOver'

const state = {
  phase: 'waiting' as Phase,
  /** A fila inteira, na ordem: os dois primeiros duelam. */
  queue: [] as Seat[],
  /** Os dois que duelam agora; vazio fora de partida. */
  duel: [] as Seat[],
  score: [0, 0],
  round: 0,
  hero: '',
  heroTitle: '',
  roundEndsAt: 0,
  now: 0,
  arena: undefined as Vector | undefined,
  timers: [] as Timer[],
}

/* ───────── utilidades ───────── */

const key = (s: { slot: number; generation: number }) => `${s.slot}:${s.generation}`

function seatOf(c: Connection): Seat {
  return { player: c.player, slot: c.player.slot, generation: c.generation, name: c.name, bot: c.bot }
}

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)]
}

function shuffle<T>(list: readonly T[]): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function everyone(fn: (s: Seat) => void) {
  for (const s of state.queue) fn(s)
}

function tellAll(text: string) {
  everyone((s) => s.player.chat(text))
}

function announceAll(title: string, text: string) {
  everyone((s) => s.player.announce(title, text))
}

function centerAll(text: string) {
  everyone((s) => s.player.centerText(text))
}

function later(seconds: number, fn: () => void) {
  state.timers.push(after(seconds, fn))
}

function cancelTimers() {
  for (const t of state.timers) t.cancel()
  state.timers = []
}

function scoreLine(): string {
  const [a, b] = state.duel
  if (!a || !b) return 'Sem duelo agora.'
  return `${a.name} ${state.score[0]} × ${state.score[1]} ${b.name}`
}

function queueLine(): string {
  const waiting = state.queue.slice(2)
  if (waiting.length === 0) return 'Ninguém na fila.'
  return `Fila: ${waiting.map((s, i) => `${i + 1}. ${s.name}`).join(' · ')}`
}

function yawTo(from: Vector, to: Vector): Angles {
  const yaw = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI
  return { pitch: 0, yaw, roll: 0 }
}

/* ───────── fila ───────── */

/** Junta a fila com quem está no servidor: entra quem chegou, sai quem foi embora. */
function syncQueue() {
  const here = players().filter((c) => c.ready)
  const present = new Set(here.map((c) => key({ slot: c.player.slot, generation: c.generation })))
  const before = state.queue.map(key)

  const left = state.queue.filter((s) => !present.has(key(s)))
  state.queue = state.queue.filter((s) => present.has(key(s)))
  const known = new Set(state.queue.map(key))
  for (const c of here) {
    const s = seatOf(c)
    if (known.has(key(s))) continue
    state.queue.push(s)
    s.player.chat('Duelo à Meia-Noite: um contra um, melhor de cinco. Digite /placar para ver a fila.')
    if (state.queue.length > 2) tellAll(`${s.name} entrou na fila.`)
  }

  const duelKeys = state.duel.map(key)
  const lostDuelist = left.find((s) => duelKeys.includes(key(s)))
  if (lostDuelist && state.phase !== 'waiting' && state.phase !== 'matchOver') {
    const rest = state.duel.find((s) => key(s) !== key(lostDuelist))
    tellAll(`${lostDuelist.name} saiu do servidor.`)
    if (rest) endMatch(rest, `${lostDuelist.name} saiu. ${rest.name} leva a partida.`)
    else resetToWaiting()
    return
  }

  if (state.phase === 'waiting' && state.queue.length >= 2) {
    startMatch()
  } else if (state.phase === 'waiting' && before.join() !== state.queue.map(key).join()) {
    centerAll(state.queue.length < 2 ? 'Esperando mais uma pessoa para o duelo' : '')
  }
  if (state.phase !== 'waiting') placeSpectators()
}

/** O herói para onde a câmera de cada espectador já aponta, para não reapontar a cada segundo. */
const watching = new Map<string, number>()

/** Quem não duela assiste ao duelo. */
function placeSpectators() {
  const duelKeys = new Set(state.duel.map(key))
  const target = state.duel[0]?.player.pawn()?.entity
  for (const s of state.queue) {
    if (duelKeys.has(key(s))) {
      watching.delete(key(s))
      continue
    }
    if (s.player.pawn()) s.player.spectate()
    if (target && watching.get(key(s)) !== target && s.player.watch(target, true)) watching.set(key(s), target)
  }
}

/* ───────── partida ───────── */

function resetToWaiting() {
  cancelTimers()
  state.phase = 'waiting'
  state.duel = []
  state.score = [0, 0]
  state.round = 0
  centerAll(state.queue.length < 2 ? 'Esperando mais uma pessoa para o duelo' : '')
  if (state.queue.length >= 2) later(1, startMatch)
}

function startMatch() {
  // A fila é conferida a cada segundo: só a primeira chamada começa a partida.
  if (state.phase !== 'waiting') return
  cancelTimers()
  if (state.queue.length < 2) return resetToWaiting()
  state.phase = 'starting'
  state.duel = state.queue.slice(0, 2)
  state.score = [0, 0]
  state.round = 0
  const [a, b] = state.duel
  announceAll('Duelo à Meia-Noite', `${a.name} contra ${b.name}. Melhor de cinco.`)
  log('partida', a.name, 'x', b.name)
  later(2, startRound)
}

/** O mesmo conjunto para os dois: dois itens de cada aba, de nível 1 ou 2, sem ativos. */
function loadout(): string[] {
  const pool = items.filter((i) => i.tier <= 2 && !i.active && !i.imbue)
  const out: string[] = []
  for (const slot of ['weapon', 'vitality', 'spirit'] as const) {
    out.push(...shuffle(pool.filter((i) => i.slot === slot)).slice(0, 2).map((i) => i.name))
  }
  return out
}

function startRound() {
  cancelTimers()
  const [a, b] = state.duel
  if (!a || !b) return resetToWaiting()
  state.phase = 'preparing'
  state.round += 1
  const hero = pick(heroes)
  state.hero = hero.name
  state.heroTitle = hero.title
  const kit = loadout()
  state.duel.forEach((s, i) => s.player.selectHero(hero.name, TEAMS[i]))
  centerAll(`Rodada ${state.round}: ${hero.title}`)

  // O herói aparece num quadro seguinte: espera os dois existirem com o herói certo.
  const deadline = state.now + 10
  state.timers.push(
    sequence(() => {
      if (state.phase !== 'preparing') return
      const pawns = state.duel.map((s) => s.player.pawn())
      const ready = pawns.every((p) => p && p.health > 0)
      if (!ready && state.now < deadline) {
        state.duel.forEach((s, i) => {
          const p = pawns[i]
          if (p && p.health <= 0) s.player.respawn()
        })
        return 0.25
      }
      if (!ready) {
        tellAll('O herói da rodada não apareceu. Sorteando outro.')
        state.round -= 1
        later(1, startRound)
        return
      }
      equipAndPlace(kit)
    }),
  )
}

function equipAndPlace(kit: string[]) {
  const [a, b] = state.duel
  const pa = a.player.pawn()
  const pb = b.player.pawn()
  if (!pa || !pb) return resetToWaiting()

  if (!state.arena) {
    // Sem /arena: o meio do caminho entre as duas bases, no chão.
    const mid = { x: (pa.position.x + pb.position.x) / 2, y: (pa.position.y + pb.position.y) / 2, z: Math.max(pa.position.z, pb.position.z) }
    state.arena = ground(mid, { above: 512, below: 2048 }) ?? pa.position
    log('arena', state.arena.x, state.arena.y, state.arena.z)
  }
  const c = state.arena
  const spots = [
    ground({ x: c.x - HALF_GAP, y: c.y, z: c.z }, { above: 256, below: 512 }) ?? { x: c.x - HALF_GAP, y: c.y, z: c.z },
    ground({ x: c.x + HALF_GAP, y: c.y, z: c.z }, { above: 256, below: 512 }) ?? { x: c.x + HALF_GAP, y: c.y, z: c.z },
  ]

  state.duel.forEach((s, i) => {
    const p = s.player
    p.resetHero(0)
    p.clearItems()
    for (const ab of p.abilities()) {
      if (ab.slot >= 0 && ab.slot <= 3) p.setAbility({ ability: ab.name, upgrades: 0b0011, cooldownEnd: 0 })
    }
    for (const it of kit) p.giveItem(it)
    p.teleport(spots[i], yawTo(spots[i], spots[1 - i]))
    p.freeze(true)
  })
  // Os itens de vitalidade aumentam a vida máxima: cura depois de equipar.
  later(0.5, () => state.duel.forEach((s) => s.player.heal(100000)))

  placeSpectators()
  state.phase = 'countdown'
  for (let n = COUNTDOWN_SECONDS; n >= 1; n--) {
    later(COUNTDOWN_SECONDS - n, () => centerAll(`${state.heroTitle} · ${scoreLine()}\n${n}`))
  }
  later(COUNTDOWN_SECONDS, () => {
    state.duel.forEach((s) => s.player.freeze(false))
    state.phase = 'live'
    state.roundEndsAt = state.now + ROUND_SECONDS
    centerAll('Valendo!')
    later(1.5, () => centerAll(''))
  })
}

function roundWon(winner: number, how: string) {
  if (state.phase !== 'live') return
  state.phase = 'roundOver'
  cancelTimers()
  state.score[winner] += 1
  const w = state.duel[winner]
  tellAll(`Rodada ${state.round}: ${w.name} ${how}. ${scoreLine()}`)
  if (state.score[winner] >= WINS_NEEDED) {
    endMatch(w, `${w.name} vence o duelo, ${state.score[winner]} a ${state.score[1 - winner]}.`)
    return
  }
  centerAll(`${w.name} leva a rodada\n${scoreLine()}`)
  state.duel.forEach((s) => s.player.freeze(true))
  later(BETWEEN_ROUNDS_SECONDS, startRound)
}

function roundDraw() {
  if (state.phase !== 'live') return
  state.phase = 'roundOver'
  cancelTimers()
  state.round -= 1
  tellAll('Tempo esgotado com as duas vidas iguais. A rodada vai de novo.')
  centerAll('Empate: a rodada vai de novo')
  state.duel.forEach((s) => s.player.freeze(true))
  later(BETWEEN_ROUNDS_SECONDS, startRound)
}

function endMatch(winner: Seat, text: string) {
  cancelTimers()
  state.phase = 'matchOver'
  announceAll('Fim do duelo', text)
  tellAll(text)
  state.duel.forEach((s) => s.player.freeze(false))
  // Quem perdeu vai para o fim da fila; quem venceu fica na frente.
  const loser = state.duel.find((s) => key(s) !== key(winner))
  state.queue = state.queue.filter((s) => key(s) !== key(winner) && (!loser || key(s) !== key(loser)))
  state.queue.unshift(winner)
  if (loser && players().some((c) => c.ready && key({ slot: c.player.slot, generation: c.generation }) === key(loser))) state.queue.push(loser)
  const next = state.queue[1]
  if (next) tellAll(`Próximo duelo: ${winner.name} contra ${next.name}.`)
  later(BETWEEN_MATCHES_SECONDS, () => {
    state.phase = 'waiting'
    state.duel = []
    if (state.queue.length >= 2) startMatch()
    else resetToWaiting()
  })
}

/* ───────── laço ───────── */

onWorld((map) => {
  const refused = cvar.apply({ ...cvar.arena, citadel_allow_duplicate_heroes: true })
  if (refused.length > 0) log('variáveis recusadas:', refused.join(', '))
  log('mapa', map)
  state.arena = undefined
  state.queue = []
  resetToWaiting()
})

let lastSync = -1
onFrame((frame) => {
  state.now = frame.timeSeconds
  if (state.now - lastSync >= 1 || state.now < lastSync) {
    lastSync = state.now
    syncQueue()
  }
  if (state.phase !== 'live') return

  const pawns = state.duel.map((s) => s.player.pawn())
  const dead = pawns.map((p) => !p || p.health <= 0)
  if (dead[0] && dead[1]) return roundDraw()
  if (dead[0]) return roundWon(1, 'vence no abate')
  if (dead[1]) return roundWon(0, 'vence no abate')

  if (state.now >= state.roundEndsAt) {
    const share = pawns.map((p) => (p ? p.health / Math.max(1, p.effectiveMaxHealth ?? p.maxHealth) : 0))
    if (Math.abs(share[0] - share[1]) < 0.01) return roundDraw()
    roundWon(share[0] > share[1] ? 0 : 1, 'vence no tempo, com mais vida')
  }
})

/* ───────── comandos ───────── */

command('placar', (player) => {
  player.chat(state.phase === 'waiting' ? 'Esperando mais uma pessoa para o duelo.' : `${scoreLine()} · rodada ${state.round}`)
  player.chat(queueLine())
})

command('arena', (player) => {
  const p = player.pawn()
  if (!p) return void player.chat('Entre com um herói para marcar a arena.')
  state.arena = p.position
  tellAll('A arena mudou de lugar. Vale a partir da próxima rodada.')
  log('arena marcada', p.position.x, p.position.y, p.position.z)
})

command('bot', (player) => {
  const humans = players().filter((c) => !c.bot && c.ready).length
  if (humans >= 2) return void player.chat('O bot de treino só entra com menos de duas pessoas no servidor.')
  if (players().some((c) => c.bot)) return void player.chat('Já tem um bot na fila.')
  addBot({ name: 'Treino', team: 3 })
  player.chat('Um bot entrou na fila para você treinar.')
})
