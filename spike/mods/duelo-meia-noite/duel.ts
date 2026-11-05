// As regras do Duelo à Meia-Noite: a fila, as fases da partida e o placar.
//
// - Os dois primeiros da fila duelam; quem está na fila assiste.
// - A cada rodada sai um herói sorteado, o mesmo para os dois, com as quatro habilidades
//   liberadas e o mesmo kit de itens (a build recomendada, quando o servidor tem). Sem loja.
// - Quem fizer 3 rodadas leva a partida. Quem perde vai para o fim da fila, quem vence fica.
// - Rodada sem abate em 90 segundos: vence quem tiver mais vida, em proporção. Empate repete.
// - Fora da rodada valendo, ninguém toma dano: nem na contagem, nem entre as rodadas.
//
// Padrões tirados do exemplo arena do Modlock (MIT, paralin/modlock): o abate pelo golpe
// fatal em onDamaged, o bloqueio de dano fora da partida em onDamage e o autoteste com bots.

import {
  type Angles,
  type Connection,
  type DamagedEvent,
  type DamageEvent,
  type DamageResult,
  type Player,
  type Timer,
  type Vector,
  addBot,
  after,
  ground,
  heroBuild,
  heroes,
  items,
  log,
  players,
  sequence,
  settle,
  Standings,
} from 'modlock'
import * as cvar from 'modlock/console'

export const WINS_NEEDED = 3
export const ROUND_SECONDS = 90
const COUNTDOWN_SECONDS = 3
const BETWEEN_ROUNDS_SECONDS = 4
const BETWEEN_MATCHES_SECONDS = 6
/** Quantos itens cada duelista recebe por rodada. */
const KIT_SIZE = 6
/** Metade da distância entre os dois duelistas no começo da rodada. */
export const HALF_GAP = 550
const TEAMS = [2, 3] as const

/** Um jogador pela vaga dele no servidor: a vaga e a conexão que está nela agora. */
export interface Seat {
  readonly player: Player
  readonly slot: number
  readonly generation: number
  readonly steamId: bigint
  readonly name: string
  readonly bot: boolean
}

export type Phase = 'waiting' | 'starting' | 'preparing' | 'countdown' | 'live' | 'roundOver' | 'matchOver'

export const state = {
  phase: 'waiting' as Phase,
  /** A fila inteira, na ordem: os dois primeiros duelam. */
  queue: [] as Seat[],
  /** Os dois que duelam agora; vazio fora de partida. */
  duel: [] as Seat[],
  score: [0, 0],
  round: 0,
  hero: '',
  heroTitle: '',
  /** O kit da rodada, igual para os dois. */
  kit: [] as string[],
  roundEndsAt: 0,
  now: 0,
  arena: undefined as Vector | undefined,
  /** A última frase de destaque (quem levou a rodada, quem venceu), para o placar na tela. */
  banner: undefined as { title: string; detail: string; until: number } | undefined,
  timers: [] as Timer[],
}

/** Vitórias, derrotas, sequência e rating de cada pessoa nesta sessão do servidor. */
export const standings = new Standings()

/* ───────── utilidades ───────── */

export const key = (s: { slot: number; generation: number }) => `${s.slot}:${s.generation}`

function seatOf(c: Connection): Seat {
  return { player: c.player, slot: c.player.slot, generation: c.generation, steamId: c.steamId, name: c.name, bot: c.bot }
}

/** A posição na sessão: bots e pessoas, cada um pela sua conta (bots pela vaga). */
export function standingOf(s: Seat) {
  const id = s.bot ? BigInt(-1 - s.slot) : s.steamId
  return standings.get(id) ?? standings.join(id, [])
}

export function pick<T>(list: readonly T[]): T {
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

function bannerAll(title: string, detail: string, seconds = 3) {
  state.banner = { title, detail, until: state.now + seconds }
}

function later(seconds: number, fn: () => void) {
  state.timers.push(after(seconds, fn))
}

function cancelTimers() {
  for (const t of state.timers) t.cancel()
  state.timers = []
}

export function scoreLine(): string {
  const [a, b] = state.duel
  if (!a || !b) return 'Sem duelo agora.'
  return `${a.name} ${state.score[0]} × ${state.score[1]} ${b.name}`
}

export function queueLine(): string {
  const waiting = state.queue.slice(2)
  if (waiting.length === 0) return 'Ninguém na fila.'
  return `Fila: ${waiting.map((s, i) => `${i + 1}. ${s.name}`).join(' · ')}`
}

function yawTo(from: Vector, to: Vector): Angles {
  const yaw = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI
  return { pitch: 0, yaw, roll: 0 }
}

/** O duelista (0 ou 1) dono do herói entity, ou -1. */
function duelistAt(entity: number): number {
  return state.duel.findIndex((s) => s.player.pawn()?.entity === entity)
}

/* ───────── fila ───────── */

/**
 * Quem o host avisou que saiu: durante o aviso a pessoa ainda ocupa a vaga, então a fila a
 * ignora até ela sumir da lista do host.
 */
const leaving = new Set<string>()

/** O host avisou que alguém entrou: confere a fila na hora, sem esperar o próximo segundo. */
export function playerJoined() {
  syncQueue()
}

/** O host avisou que alguém saiu: tira da fila na hora e, se duelava, o outro leva. */
export function playerLeft(c: Connection) {
  leaving.add(key({ slot: c.player.slot, generation: c.generation }))
  syncQueue()
}

/** Junta a fila com quem está no servidor: entra quem chegou, sai quem foi embora. */
export function syncQueue() {
  const listed = players()
  for (const k of [...leaving]) {
    if (!listed.some((c) => key({ slot: c.player.slot, generation: c.generation }) === k)) leaving.delete(k)
  }
  const here = listed.filter((c) => c.ready && !leaving.has(key({ slot: c.player.slot, generation: c.generation })))
  const present = new Set(here.map((c) => key({ slot: c.player.slot, generation: c.generation })))
  const before = state.queue.map(key)

  const left = state.queue.filter((s) => !present.has(key(s)))
  state.queue = state.queue.filter((s) => present.has(key(s)))
  const known = new Set(state.queue.map(key))
  for (const c of here) {
    const s = seatOf(c)
    if (known.has(key(s))) continue
    state.queue.push(s)
    standingOf(s)
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

export function resetToWaiting() {
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

/**
 * O kit da rodada, igual para os dois: os primeiros itens da build recomendada do herói, na
 * ordem de compra. Sem build, dois itens de cada aba, de nível 1 ou 2, sem ativos. No servidor
 * do Modlock v0.1.73 o heroBuild volta vazio (o autoteste mostrou 0 itens), então hoje vale o
 * sorteio; o log diz qual dos dois saiu.
 */
export function loadout(hero: string): string[] {
  const fromBuild: string[] = []
  for (const category of heroBuild(hero)) {
    for (const it of category.items) {
      if (!fromBuild.includes(it.item)) fromBuild.push(it.item)
    }
  }
  log('build de', hero, fromBuild.length, 'itens')
  if (fromBuild.length >= KIT_SIZE / 2) return fromBuild.slice(0, KIT_SIZE)
  const pool = items.filter((i) => i.tier <= 2 && !i.active && !i.imbue)
  const out: string[] = []
  for (const slot of ['weapon', 'vitality', 'spirit'] as const) {
    out.push(...shuffle(pool.filter((i) => i.slot === slot)).slice(0, KIT_SIZE / 3).map((i) => i.name))
  }
  return out
}

function startRound() {
  cancelTimers()
  const [a, b] = state.duel
  if (!a || !b) return resetToWaiting()
  state.phase = 'preparing'
  state.round += 1
  // O host não troca o herói de um bot: com um bot no duelo, a rodada é com o herói dele.
  const botHero = state.duel.map((s) => (s.bot ? s.player.pawn()?.hero : undefined)).find((h) => h !== undefined)
  const hero = (botHero !== undefined && heroes.find((h) => h.id === botHero)) || pick(heroes)
  state.hero = hero.name
  state.heroTitle = hero.title
  state.kit = loadout(hero.name)
  state.duel.forEach((s, i) => {
    if (s.bot) return
    // Contra um bot, o time oposto ao dele, que o host também não troca.
    const other = state.duel[1 - i]
    const otherTeam = other.bot ? other.player.pawn()?.team : undefined
    s.player.selectHero(hero.name, otherTeam === 2 || otherTeam === 3 ? 5 - otherTeam : TEAMS[i])
  })
  centerAll(`Rodada ${state.round}: ${hero.title}`)

  // O herói aparece num quadro seguinte: espera os dois existirem, vivos, com o herói certo.
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
      equipAndPlace()
    }),
  )
}

/** Onde cada duelista começa: os dois lados da arena, no chão. */
export function spots(): [Vector, Vector] {
  const c = state.arena!
  const side = (dx: number) => ground({ x: c.x + dx, y: c.y, z: c.z }, { above: 256, below: 512 }) ?? { x: c.x + dx, y: c.y, z: c.z }
  return [side(-HALF_GAP), side(HALF_GAP)]
}

function equipAndPlace() {
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
  const place = spots()

  state.duel.forEach((s, i) => {
    const p = s.player
    p.resetHero(0)
    p.clearItems()
    for (const ab of p.abilities()) {
      if (ab.slot >= 0 && ab.slot <= 3) p.setAbility({ ability: ab.name, upgrades: 0b0011, cooldownEnd: 0 })
    }
    for (const it of state.kit) p.giveItem(it)
    p.teleport(place[i], yawTo(place[i], place[1 - i]))
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
  w.player.addMetric('duelo.rodadas', 1)
  tellAll(`Rodada ${state.round}: ${w.name} ${how}. ${scoreLine()}`)
  if (state.score[winner] >= WINS_NEEDED) {
    endMatch(w, `${w.name} vence o duelo, ${state.score[winner]} a ${state.score[1 - winner]}.`)
    return
  }
  bannerAll(`${w.name} leva a rodada`, scoreLine())
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
  bannerAll('Empate', 'A rodada vai de novo')
  centerAll('Empate: a rodada vai de novo')
  state.duel.forEach((s) => s.player.freeze(true))
  later(BETWEEN_ROUNDS_SECONDS, startRound)
}

function endMatch(winner: Seat, text: string) {
  cancelTimers()
  state.phase = 'matchOver'
  announceAll('Fim do duelo', text)
  tellAll(text)
  bannerAll('Fim do duelo', text, BETWEEN_MATCHES_SECONDS)
  state.duel.forEach((s) => s.player.freeze(false))
  // Quem perdeu vai para o fim da fila; quem venceu fica na frente.
  const loser = state.duel.find((s) => key(s) !== key(winner))
  if (loser) {
    const ws = standingOf(winner)
    settle([ws], [standingOf(loser)])
    winner.player.addMetric('duelo.vitorias', 1)
    winner.player.addMetric('duelo.sequencia', ws.streak)
  }
  state.queue = state.queue.filter((s) => key(s) !== key(winner) && (!loser || key(s) !== key(loser)))
  state.queue.unshift(winner)
  if (loser && !leaving.has(key(loser)) && players().some((c) => c.ready && key({ slot: c.player.slot, generation: c.generation }) === key(loser))) state.queue.push(loser)
  const next = state.queue[1]
  if (next) tellAll(`Próximo duelo: ${winner.name} contra ${next.name}.`)
  later(BETWEEN_MATCHES_SECONDS, () => {
    state.phase = 'waiting'
    state.duel = []
    if (state.queue.length >= 2) startMatch()
    else resetToWaiting()
  })
}

/* ───────── ganchos do servidor ───────── */

export function world(map: string) {
  const refused = cvar.apply({ ...cvar.arena, citadel_allow_duplicate_heroes: true })
  if (refused.length > 0) log('variáveis recusadas:', refused.join(', '))
  log('mapa', map)
  state.arena = undefined
  state.queue = []
  resetToWaiting()
}

let lastSync = -1
export function frame(seconds: number) {
  state.now = seconds
  if (state.now - lastSync >= 1 || state.now < lastSync) {
    lastSync = state.now
    syncQueue()
  }
  if (state.phase !== 'live') return

  // O golpe fatal conta em damaged; isto pega o que não passa por lá, como um kill() do mod.
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
}

/** Fora da rodada valendo, nenhum golpe pega num duelista. */
export function damage(hit: DamageEvent): DamageResult | void {
  if (state.phase !== 'live' && duelistAt(hit.victim) >= 0) return { block: true }
}

/** Um golpe que tira toda a vida de um duelista decide a rodada na hora. */
export function damaged(hit: DamagedEvent) {
  if (state.phase !== 'live' || hit.healthBefore <= 0 || hit.healthLost < hit.healthBefore) return
  const victim = duelistAt(hit.victim)
  if (victim >= 0) roundWon(1 - victim, 'vence no abate')
}

/* ───────── comandos ───────── */

export function placar(player: Player) {
  player.chat(state.phase === 'waiting' ? 'Esperando mais uma pessoa para o duelo.' : `${scoreLine()} · rodada ${state.round}`)
  player.chat(queueLine())
  const me = state.queue.find((s) => s.player.slot === player.slot)
  if (me) {
    const st = standingOf(me)
    player.chat(`Você nesta sessão: ${st.wins} vitórias, ${st.losses} derrotas, sequência de ${st.streak}, rating ${Math.round(st.rating)}.`)
  }
}

export function markArena(player: Player) {
  const p = player.pawn()
  if (!p) return void player.chat('Entre com um herói para marcar a arena.')
  state.arena = p.position
  tellAll('A arena mudou de lugar. Vale a partir da próxima rodada.')
  log('arena marcada', p.position.x, p.position.y, p.position.z)
}

export function trainingBot(player: Player) {
  const humans = players().filter((c) => !c.bot && c.ready).length
  if (humans >= 2) return void player.chat('O bot de treino só entra com menos de duas pessoas no servidor.')
  if (players().some((c) => c.bot)) return void player.chat('Já tem um bot na fila.')
  // Sem herói o bot não entra (o host recusa o herói 0): ele chega com um sorteado.
  addBot({ name: 'Treino', team: 3, hero: pick(heroes).name })
  player.chat('Um bot entrou na fila para você treinar.')
}
