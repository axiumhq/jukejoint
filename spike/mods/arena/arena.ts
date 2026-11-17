// As regras da Arena: os jeitos de jogar, a fila, as fases da partida e o placar.
//
// - Duelo no círculo: 1 contra 1. Dupla: 2 contra 2. Times: até 6 contra 6. Espelho: times em
//   que todo mundo joga com o mesmo herói, sorteado a cada rodada.
// - Sem tempo, a partida vai por rodadas: um lado leva a rodada quando ninguém do outro lado
//   está de pé. Duelo e dupla vão até os pontos do lobby; times e espelho, até 3 rodadas.
// - Com tempo, a partida dura 3 minutos: quem cai volta em instantes, cada queda vale um ponto
//   para o outro lado, o círculo fecha aos poucos e vence quem fez mais pontos.
// - Fora do círculo, o gás tira vida a cada segundo.
// - Quem não joga espera na fila e assiste. No fim da partida, quem venceu fica na frente,
//   quem esperava entra e quem perdeu vai para o fim.
//
// Padrões tirados do exemplo arena do Modlock (MIT, paralin/modlock): o abate pelo golpe
// fatal em onDamaged, o bloqueio de dano fora da partida e na proteção de quem volta, e o
// autoteste com bots. A fila e a troca de herói vêm do nosso Duelo à Meia-Noite.

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
  damage as hurt,
  findHero,
  ground,
  heroes,
  items,
  log,
  players,
  sequence,
  toast,
} from 'modlock'
import * as cvar from 'modlock/console'

import { flat, gasDamage, inside, radiusAt, Ring } from './circulo'

/* ───────── jeitos de jogar ───────── */

export type Variant = 'duelo' | 'dupla' | 'times' | 'espelho'

export interface VariantInfo {
  readonly title: string
  /** Quantas pessoas de cada lado, no máximo. */
  readonly perSide: number
  /** Todo mundo com o mesmo herói, sorteado a cada rodada. */
  readonly mirror: boolean
  /** Os lados se misturam a cada partida (times) em vez de quem vence ficar junto (duelo, dupla). */
  readonly mixed: boolean
  /** O raio do círculo inteiro. */
  readonly radius: number
}

export const VARIANTS: Record<Variant, VariantInfo> = {
  duelo: { title: 'Duelo no círculo', perSide: 1, mirror: false, mixed: false, radius: 1100 },
  dupla: { title: 'Dupla', perSide: 2, mirror: false, mixed: false, radius: 1300 },
  times: { title: 'Times', perSide: 6, mirror: false, mixed: true, radius: 1800 },
  espelho: { title: 'Espelho', perSide: 6, mirror: true, mixed: true, radius: 1800 },
}

/** As regras de uma partida, lidas do lobby quando ela começa. */
export interface Rules {
  readonly variant: Variant
  readonly timed: boolean
  /** Rodadas (ou pontos) para vencer, sem tempo. */
  readonly target: number
  /** A duração da partida com tempo. */
  readonly seconds: number
}

export const DEFAULT_POINTS = 5
export const TEAM_ROUNDS = 3
export const TIMED_SECONDS = 180
/** Sem tempo, uma rodada acaba aqui mesmo sem ninguém cair (o círculo já fechou antes). */
export const ROUND_LIMIT = 120
/** Sem tempo, o círculo começa a fechar aqui e chega ao menor tamanho em SHRINK_TO. */
export const SHRINK_FROM = 45
export const SHRINK_TO = 105
export const COUNTDOWN_SECONDS = 3
export const RESPAWN_SECONDS = 3
export const PROTECTION_SECONDS = 2
const BETWEEN_ROUNDS_SECONDS = 4
const BETWEEN_MATCHES_SECONDS = 6
/** Quantos itens cada pessoa recebe: o mesmo kit para todo mundo. */
const KIT_SIZE = 6
/** Os nomes dos lados nos times. O lado 0 joga no time 2 (Âmbar), o lado 1 no time 3 (Safira). */
const TEAM_NAMES = ['Âmbar', 'Safira'] as const
export const TEAM_OF_SIDE = [2, 3] as const

/* ───────── estado ───────── */

/** Quem está numa vaga do servidor: a vaga e a conexão que está nela agora. */
export interface Seat {
  readonly player: Player
  readonly slot: number
  readonly generation: number
  readonly steamId: bigint
  readonly name: string
  readonly bot: boolean
  /** A ordem de chegada na sala: quem chegou primeiro escolhe o jeito de jogar. */
  readonly arrival: number
}

/** Quem luta na partida atual. */
export interface Fighter {
  readonly seat: Seat
  /** 0 ou 1. */
  readonly side: number
  /** De pé na rodada (sem tempo) ou em campo agora (com tempo). */
  alive: boolean
  /** Quando caiu pela última vez. */
  fellAt: number
  /** Se a última queda já foi contada para quem derrubou (ou dada como sem autor). */
  told: boolean
  /** Estava no gás quando caiu. */
  gassed: boolean
  /** O herói que pedimos para esta pessoa, como Pawn.hero, ou 0 para o que ela já tem. */
  wantHero: number
  kills: number
  streak: number
  protectedUntil: number
  /** Assistindo a alguém do time depois de cair (sem tempo). */
  benched: boolean
  inGas: boolean
}

export type Phase = 'waiting' | 'starting' | 'preparing' | 'countdown' | 'live' | 'roundOver' | 'matchOver'

export const state = {
  phase: 'waiting' as Phase,
  /** A fila inteira, na ordem: os primeiros lutam. */
  queue: [] as Seat[],
  fighters: [] as Fighter[],
  score: [0, 0],
  round: 0,
  rules: { variant: 'duelo', timed: false, target: DEFAULT_POINTS, seconds: TIMED_SECONDS } as Rules,
  /** O herói da rodada no espelho. */
  hero: '',
  heroTitle: '',
  kit: [] as string[],
  /** Quando a rodada (ou a partida com tempo) passou a valer. */
  liveAt: 0,
  endsAt: 0,
  now: 0,
  /** O centro marcado por quem abriu a sala; sem ele, o meio do caminho entre os dois lados. */
  marked: undefined as Vector | undefined,
  /** O centro achado sozinho na primeira rodada do mapa, que fica até o mapa mudar. */
  found: undefined as Vector | undefined,
  ring: new Ring(),
  /** O raio do círculo inteiro nesta partida. */
  fullRadius: 0,
  /** Quantos golpes do gás o jogo aplicou (o autoteste confere). */
  gasHits: 0,
  /** Quantas vezes o gás chamou damage, e quantas o host recusou. */
  gasCalls: 0,
  gasRefused: 0,
  /** O último aviso de golpe num lutador: atacante, vida perdida (para o autoteste). */
  lastHit: undefined as { attacker: number; lost: number; victim: number } | undefined,
  /** O lado que levou a última partida, -1 para empate, undefined antes da primeira. */
  lastWinner: undefined as number | undefined,
  banner: undefined as { title: string; detail: string; until: number } | undefined,
  /** Os argumentos do servidor (variante=, tempo, pontos=, segundos=), acima do lobby. */
  args: {} as Record<string, string>,
  /** O que quem abriu a sala escolheu na tela, acima da configuração dela. */
  override: {} as Record<string, string>,
  /**
   * Começa sozinha assim que houver duas pessoas: quando os argumentos do servidor fixam o jeito
   * de jogar ou no autoteste. Sem isso, quem abriu a sala aperta Começar na tela de escolha.
   */
  auto: false,
  /** O herói que cada pessoa escolheu na tela, pela chave da vaga. */
  chosen: new Map<string, string>(),
  /** Quem abriu a lista de heróis durante a partida, pela chave da vaga. */
  heroMenu: new Set<string>(),
  /** Como acabou a última partida, para a tela de escolha. */
  lastText: '',
  /** Segura o começo das partidas (o autoteste segura até todos os bots chegarem). */
  hold: false,
  timers: [] as Timer[],
}

/* ───────── utilidades ───────── */

export const key = (s: { slot: number; generation: number }) => `${s.slot}:${s.generation}`
const connKey = (c: Connection) => key({ slot: c.player.slot, generation: c.generation })

let arrivals = 0

function seatOf(c: Connection): Seat {
  return { player: c.player, slot: c.player.slot, generation: c.generation, steamId: c.steamId, name: c.name, bot: c.bot, arrival: arrivals++ }
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

function tellAll(text: string) {
  for (const s of state.queue) s.player.chat(text)
}

function announceAll(title: string, text: string) {
  for (const s of state.queue) s.player.announce(title, text)
}

function centerAll(text: string) {
  for (const s of state.queue) s.player.centerText(text)
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

function yawTo(from: Vector, to: Vector): Angles {
  return { pitch: 0, yaw: (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI, roll: 0 }
}

export const info = () => VARIANTS[state.rules.variant]

/** O lado (0 ou 1) da pessoa na posição i entre quem luta. */
export function sideOf(i: number, perSide: number, variant: Variant): number {
  return VARIANTS[variant].mixed ? i % 2 : i < perSide ? 0 : 1
}

/** Quantas pessoas de cada lado com esta fila. */
export function perSideFor(variant: Variant, queued: number): number {
  return Math.min(VARIANTS[variant].perSide, Math.floor(queued / 2))
}

export function sideName(side: number): string {
  const members = state.fighters.filter((f) => f.side === side)
  if (info().perSide === 1 || (members.length === 1 && !info().mixed)) return members[0]?.seat.name ?? TEAM_NAMES[side]
  if (!info().mixed) return members.map((f) => f.seat.name).join(' e ')
  return TEAM_NAMES[side]
}

/** O verbo no singular ou no plural, para o lado: "Ana vence", "Ana e Bia vencem", "Âmbar vence". */
export function verb(side: number, one: string, many: string): string {
  return !info().mixed && state.fighters.filter((f) => f.side === side).length > 1 ? many : one
}

export function scoreLine(): string {
  if (state.fighters.length === 0) return 'Sem partida agora.'
  return `${sideName(0)} ${state.score[0]} × ${state.score[1]} ${sideName(1)}`
}

export function rulesLine(r: Rules = state.rules): string {
  const v = VARIANTS[r.variant]
  if (r.timed) return `${v.title}, com tempo: ${Math.round(r.seconds / 60)} minutos, o círculo fecha, vence quem fizer mais pontos.`
  return `${v.title}: vence quem levar ${r.target} rodadas primeiro.`
}

export function queueLine(): string {
  const playing = new Set(state.fighters.map((f) => key(f.seat)))
  const waiting = state.queue.filter((s) => !playing.has(key(s)))
  if (waiting.length === 0) return 'Ninguém na fila.'
  return `Fila: ${waiting.map((s, i) => `${i + 1}. ${s.name}`).join(' · ')}`
}

export function fighterAt(entity: number): Fighter | undefined {
  if (!entity) return undefined
  return state.fighters.find((f) => f.seat.player.pawn()?.entity === entity)
}

/** O raio do círculo agora. */
export function currentRadius(): number {
  if (state.phase !== 'live' && state.phase !== 'roundOver') return state.fullRadius
  const elapsed = state.now - state.liveAt
  return state.rules.timed
    ? radiusAt(state.fullRadius, elapsed, 0, state.rules.seconds)
    : radiusAt(state.fullRadius, elapsed, SHRINK_FROM, SHRINK_TO)
}

/* ───────── configuração ───────── */

/** Lê os argumentos do servidor: variante=times, tempo (ou tempo=sim), pontos=3, segundos=60. */
export function configure(args: readonly string[]) {
  state.args = {}
  for (const a of args) {
    const [k, v] = a.split('=')
    if (k === 'variante' || k === 'pontos' || k === 'segundos') state.args[k] = v ?? ''
    else if (k === 'tempo') state.args.tempo = v ?? 'true'
  }
  state.auto = state.args.variante !== undefined || args.includes('probe')
}

function parseVariant(v: string | undefined): Variant | undefined {
  return v && v in VARIANTS ? (v as Variant) : undefined
}

function parseBool(v: string | undefined): boolean {
  return v === 'true' || v === '1' || v === 'sim' || v === 'on'
}

/** Quem chegou primeiro entre as pessoas (não bots): é quem escolhe o jeito de jogar. */
export function hostSeat(): Seat | undefined {
  return state.queue.filter((s) => !s.bot).sort((a, b) => a.arrival - b.arrival)[0]
}

/** As regras da próxima partida: argumentos do servidor, depois a tela de escolha, depois o lobby. */
export function resolveRules(): Rules {
  const host = hostSeat()
  const read = (k: string) => state.args[k] ?? state.override[k] ?? host?.player.setting(k)
  const variant = parseVariant(read('variante')) ?? 'duelo'
  const points = Math.round(Number(read('pontos')))
  const seconds = Math.round(Number(state.args.segundos))
  return {
    variant,
    timed: parseBool(read('tempo')),
    target: VARIANTS[variant].perSide <= 2 ? (points >= 1 && points <= 15 ? points : DEFAULT_POINTS) : TEAM_ROUNDS,
    seconds: seconds >= 10 ? seconds : TIMED_SECONDS,
  }
}

/* ───────── fila ───────── */

/**
 * Quem o host avisou que saiu: durante o aviso a pessoa ainda ocupa a vaga, então a fila a
 * ignora até ela sumir da lista do host.
 */
const leaving = new Set<string>()

export function playerJoined() {
  syncQueue()
}

export function playerLeft(c: Connection) {
  leaving.add(connKey(c))
  syncQueue()
}

/** Junta a fila com quem está no servidor: entra quem chegou, sai quem foi embora. */
export function syncQueue() {
  const listed = players()
  for (const k of [...leaving]) if (!listed.some((c) => connKey(c) === k)) leaving.delete(k)
  const here = listed.filter((c) => c.ready && !leaving.has(connKey(c)))
  const present = new Set(here.map(connKey))

  const left = state.queue.filter((s) => !present.has(key(s)))
  state.queue = state.queue.filter((s) => present.has(key(s)))
  const known = new Set(state.queue.map(key))
  for (const c of here) {
    if (known.has(connKey(c))) continue
    const s = seatOf(c)
    state.queue.push(s)
    s.player.chat(`Arena: ${rulesLine(state.phase === 'waiting' ? resolveRules() : state.rules)}`)
    if (state.queue.length > 2) tellAll(`${s.name} entrou na fila.`)
  }
  for (const s of left) {
    state.chosen.delete(key(s))
    state.heroMenu.delete(key(s))
  }

  const gone = new Set(left.map(key))
  const lost = state.fighters.filter((f) => gone.has(key(f.seat)))
  if (lost.length > 0 && state.phase !== 'waiting' && state.phase !== 'matchOver') {
    for (const f of lost) tellAll(`${f.seat.name} saiu do servidor.`)
    state.fighters = state.fighters.filter((f) => !gone.has(key(f.seat)))
    const sides = [0, 1].map((side) => state.fighters.some((f) => f.side === side))
    if (!sides[0] && !sides[1]) return resetToWaiting()
    if (!sides[0] || !sides[1]) {
      const side = sides[0] ? 0 : 1
      return endMatch(side, `${lost.map((f) => f.seat.name).join(' e ')} ${lost.length > 1 ? 'saíram' : 'saiu'}. ${sideName(side)} ${verb(side, 'leva', 'levam')} a partida.`)
    }
  }

  if (state.phase === 'waiting' && state.auto && state.queue.length >= 2 && !state.hold) startMatch()
  if (state.phase !== 'waiting') placeSpectators()
}

/** O herói para onde a câmera de cada pessoa que assiste já aponta. */
const watching = new Map<string, number>()

/** Quem espera na fila assiste à partida. */
function placeSpectators() {
  const playing = new Set(state.fighters.map((f) => key(f.seat)))
  const target = state.fighters.map((f) => f.seat.player.pawn()).find((p) => p && p.health > 0)?.entity
  for (const s of state.queue) {
    if (playing.has(key(s))) {
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
  for (const f of state.fighters) release(f)
  state.phase = 'waiting'
  state.fighters = []
  state.score = [0, 0]
  state.round = 0
  state.heroMenu.clear()
  centerAll('')
  if (state.auto && state.queue.length >= 2) later(1, startMatch)
}

/** O kit da partida (ou da rodada, no espelho): dois itens de cada aba, de nível 1 ou 2, sem ativos. */
export function drawKit(): string[] {
  const pool = items.filter((i) => i.tier <= 2 && !i.active && !i.imbue)
  const out: string[] = []
  for (const slot of ['weapon', 'vitality', 'spirit'] as const) {
    out.push(...shuffle(pool.filter((i) => i.slot === slot)).slice(0, KIT_SIZE / 3).map((i) => i.name))
  }
  return out
}

export function startMatch() {
  // A fila é conferida a cada segundo: só a primeira chamada começa a partida.
  if (state.phase !== 'waiting' || state.hold) return
  cancelTimers()
  if (state.queue.length < 2) return resetToWaiting()
  state.rules = resolveRules()
  const { variant } = state.rules
  const n = perSideFor(variant, state.queue.length)
  state.fighters = state.queue.slice(0, 2 * n).map((seat, i) => ({
    seat,
    side: sideOf(i, n, variant),
    alive: false,
    fellAt: 0,
    told: true,
    gassed: false,
    wantHero: 0,
    kills: 0,
    streak: 0,
    protectedUntil: 0,
    benched: false,
    inGas: false,
  }))
  state.phase = 'starting'
  state.score = [0, 0]
  state.round = 0
  state.fullRadius = info().radius
  state.kit = drawKit()
  state.ring.clear()
  announceAll(`Arena · ${info().title}`, `${sideName(0)} contra ${sideName(1)}. ${rulesLine()}`)
  tellAll(`${scoreLine()} · ${rulesLine()}`)
  log('partida', variant, state.rules.timed ? 'com tempo' : 'por rodadas', state.fighters.map((f) => `${f.seat.name}:${f.side}`).join(','))
  later(2, startRound)
}

/** O herói que cada pessoa vai usar nesta rodada, e o pedido ao jogo quando precisa trocar. */
function seatHeroes() {
  const mirror = info().mirror
  if (mirror) {
    // O host não troca o herói de um bot: com um bot na partida, o espelho usa o herói dele.
    const botHero = state.fighters.map((f) => (f.seat.bot ? f.seat.player.pawn()?.hero : undefined)).find((h) => h)
    const hero = (botHero !== undefined && heroes.find((h) => h.id === botHero)) || pick(heroes)
    state.hero = hero.name
    state.heroTitle = hero.title
    state.kit = drawKit()
  }
  for (const f of state.fighters) {
    f.wantHero = 0
    if (f.seat.bot) continue
    const pawn = f.seat.player.pawn()
    const team = TEAM_OF_SIDE[f.side]
    const chosen = mirror ? state.hero : (state.chosen.get(key(f.seat)) ?? (pawn && pawn.hero ? undefined : pick(heroes).name))
    const wanted = chosen ? findHero(chosen) : undefined
    if (wanted && pawn?.hero !== wanted.id) f.wantHero = f.seat.player.selectHero(wanted.name, team) ?? wanted.id
    else if (!pawn) f.wantHero = f.seat.player.selectHero(pick(heroes).name, team) ?? 0
  }
}

function startRound() {
  cancelTimers()
  if (state.fighters.length < 2) return resetToWaiting()
  state.phase = 'preparing'
  state.round += 1
  seatHeroes()
  if (info().mirror) centerAll(`Rodada ${state.round}: ${state.heroTitle}`)
  else centerAll(state.rules.timed ? 'Preparando a partida' : `Rodada ${state.round}`)

  // O herói aparece num quadro seguinte: espera todo mundo existir, vivo, com o herói certo.
  const deadline = state.now + 10
  state.timers.push(
    sequence(() => {
      if (state.phase !== 'preparing') return
      const ready = state.fighters.every((f) => {
        const p = f.seat.player.pawn()
        return p && p.health > 0 && (!f.wantHero || p.hero === f.wantHero)
      })
      if (!ready && state.now < deadline) {
        for (const f of state.fighters) {
          const p = f.seat.player.pawn()
          if (p && p.health <= 0) f.seat.player.respawn()
        }
        return 0.25
      }
      if (!ready) {
        const missing = state.fighters.filter((f) => !f.seat.player.pawn()).map((f) => f.seat.name)
        log('heróis não apareceram', missing.join(','))
        tellAll('Nem todos os heróis apareceram. Tentando de novo.')
        state.round -= 1
        later(1, startRound)
        return
      }
      equipAndPlace()
    }),
  )
}

/** Onde cada pessoa começa: o lado 0 a oeste do centro, o lado 1 a leste, lado a lado. */
export function spotFor(f: Fighter, radius = state.fullRadius): Vector {
  const c = state.ring.center ?? state.marked!
  const mates = state.fighters.filter((m) => m.side === f.side)
  const k = mates.indexOf(f)
  const dx = (f.side === 0 ? -1 : 1) * radius * 0.55
  const dy = (k - (mates.length - 1) / 2) * 180
  const p = { x: c.x + dx, y: c.y + dy, z: c.z }
  return ground(p, { above: 256, below: 512 }) ?? p
}

/**
 * O centro do círculo: o marcado com /arena, ou o meio do caminho entre os dois lados no chão,
 * achado na primeira rodada do mapa (com os heróis ainda nas bases) e guardado até o mapa mudar.
 */
function centerFor(): Vector | undefined {
  if (state.marked) return state.marked
  if (state.found) return state.found
  const firstOf = (side: number) => state.fighters.find((f) => f.side === side)?.seat.player.pawn()?.position
  const a = firstOf(0)
  const b = firstOf(1)
  if (!a || !b) return undefined
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: Math.max(a.z, b.z) }
  state.found = ground(mid, { above: 512, below: 2048 }) ?? a
  return state.found
}

/** Prepara um herói para a rodada: as quatro habilidades, o kit e o time certo. */
function equip(f: Fighter) {
  const p = f.seat.player
  p.resetHero(0)
  p.clearItems()
  for (const ab of p.abilities()) {
    if (ab.slot >= 0 && ab.slot <= 3) p.setAbility({ ability: ab.name, upgrades: 0b0011, cooldownEnd: 0 })
  }
  for (const it of state.kit) p.giveItem(it)
  const team = TEAM_OF_SIDE[f.side]
  if (p.pawn()?.team !== team) p.changeTeam(team)
}

function equipAndPlace() {
  const center = centerFor()
  if (!center) return resetToWaiting()
  const c = state.ring.center
  if (!c || flat(c, center) > 1 || Math.abs(c.z - center.z) > 1 || state.ring.count === 0) {
    state.ring.place(center, state.fullRadius)
    log('círculo', Math.round(center.x), Math.round(center.y), Math.round(center.z), 'raio', state.fullRadius, 'marcadores', state.ring.count)
  } else {
    state.ring.resize(state.fullRadius)
  }

  for (const f of state.fighters) {
    if (f.benched) f.seat.player.unwatch()
    Object.assign(f, { alive: true, told: true, gassed: false, benched: false, inGas: false, protectedUntil: 0 })
    equip(f)
    const at = spotFor(f)
    f.seat.player.teleport(at, yawTo(at, center))
    f.seat.player.freeze(true)
  }
  // Os itens de vitalidade aumentam a vida máxima: cura depois de equipar.
  later(0.5, () => state.fighters.forEach((f) => f.seat.player.heal(100000)))

  placeSpectators()
  state.phase = 'countdown'
  const head = info().mirror ? `${state.heroTitle} · ` : ''
  for (let n = COUNTDOWN_SECONDS; n >= 1; n--) {
    later(COUNTDOWN_SECONDS - n, () => centerAll(`${head}${scoreLine()}\n${n}`))
  }
  later(COUNTDOWN_SECONDS, () => {
    state.fighters.forEach((f) => f.seat.player.freeze(false))
    state.phase = 'live'
    state.liveAt = state.now
    state.endsAt = state.now + (state.rules.timed ? state.rules.seconds : ROUND_LIMIT)
    centerAll('Valendo')
    later(1.5, () => centerAll(''))
  })
}

/** Uma queda: conta o ponto (com tempo), tira da rodada (sem tempo) e agenda a volta. */
function fell(f: Fighter, attacker = 0) {
  if (!f.alive) return
  f.alive = false
  f.fellAt = state.now
  f.told = false
  f.gassed = f.inGas
  f.streak = 0
  if (state.rules.timed) {
    state.score[1 - f.side] += 1
    later(RESPAWN_SECONDS, () => bringBack(f))
  }
  if (attacker) credit(f, attacker)
}

/** Dá o abate a quem derrubou, quando foi alguém do outro lado. */
function credit(victim: Fighter, attacker: number) {
  if (victim.told) return
  const by = fighterAt(attacker)
  if (!by || by.side === victim.side) return
  victim.told = true
  by.kills += 1
  by.streak += 1
  by.seat.player.addMetric('arena.abates', 1)
  by.seat.player.addMetric('arena.sequencia', by.streak)
  const streak = by.streak >= 3 ? `, ${by.streak} seguidos` : ''
  tellAll(`${by.seat.name} derrubou ${victim.seat.name}${streak}.`)
}

/** Com tempo: quem caiu volta no seu lado do círculo, protegido por um instante. */
function bringBack(f: Fighter) {
  const deadline = state.now + 8
  state.timers.push(
    sequence(() => {
      if (state.phase !== 'live' || !state.fighters.includes(f)) return
      const p = f.seat.player.pawn()
      if (!p || p.health <= 0) {
        if (state.now > deadline) return void log('não voltou', f.seat.name)
        if (p) f.seat.player.respawn()
        return 0.25
      }
      const at = spotFor(f, currentRadius())
      f.seat.player.teleport(at, yawTo(at, state.ring.center ?? at))
      f.seat.player.heal(100000)
      f.alive = true
      f.inGas = false
      f.protectedUntil = state.now + PROTECTION_SECONDS
    }),
  )
}

function roundWon(side: number, how: string) {
  if (state.phase !== 'live') return
  state.phase = 'roundOver'
  cancelTimers()
  state.score[side] += 1
  tellAll(`Rodada ${state.round}: ${sideName(side)} ${verb(side, how, how.replace('leva', 'levam'))}. ${scoreLine()}`)
  if (state.score[side] >= state.rules.target) {
    return endMatch(side, `${sideName(side)} ${verb(side, 'vence', 'vencem')} a Arena, ${state.score[side]} a ${state.score[1 - side]}.`)
  }
  const took = `${sideName(side)} ${verb(side, 'leva', 'levam')} a rodada`
  bannerAll(took, scoreLine())
  centerAll(`${took}\n${scoreLine()}`)
  state.fighters.forEach((f) => f.seat.player.freeze(true))
  later(BETWEEN_ROUNDS_SECONDS, startRound)
}

function roundDraw(why: string) {
  if (state.phase !== 'live') return
  state.phase = 'roundOver'
  cancelTimers()
  state.round -= 1
  tellAll(`${why} A rodada vai de novo.`)
  bannerAll('Empate', 'A rodada vai de novo')
  centerAll('Empate: a rodada vai de novo')
  state.fighters.forEach((f) => f.seat.player.freeze(true))
  later(BETWEEN_ROUNDS_SECONDS, startRound)
}

/** Com tempo, no fim do relógio: vence o lado com mais pontos. */
function timeUp() {
  if (state.phase !== 'live') return
  const [a, b] = state.score
  if (a === b) return endMatch(-1, `Tempo esgotado: ${scoreLine()}. Empate.`)
  const side = a > b ? 0 : 1
  endMatch(side, `Tempo esgotado: ${sideName(side)} ${verb(side, 'leva', 'levam')} a Arena, ${Math.max(a, b)} a ${Math.min(a, b)}.`)
}

/** Libera um herói das travas da partida. */
function release(f: Fighter) {
  f.seat.player.freeze(false)
  if (f.benched) f.seat.player.unwatch()
  f.benched = false
}

/**
 * Fim da partida. A fila gira: quem venceu fica na frente, quem esperava entra e quem perdeu vai
 * para o fim. No empate, quem esperava entra na frente.
 */
export function endMatch(side: number, text: string) {
  cancelTimers()
  state.phase = 'matchOver'
  state.lastWinner = side
  state.lastText = text
  state.heroMenu.clear()
  announceAll('Fim da partida', text)
  tellAll(text)
  bannerAll(side >= 0 ? `${sideName(side)} ${verb(side, 'vence', 'vencem')}` : 'Empate', text, BETWEEN_MATCHES_SECONDS)
  for (const f of state.fighters) {
    release(f)
    if (f.side === side) f.seat.player.addMetric('arena.vitorias', 1)
  }
  const playing = new Set(state.fighters.map((f) => key(f.seat)))
  const winners = state.fighters.filter((f) => f.side === side).map((f) => f.seat)
  const losers = state.fighters.filter((f) => f.side !== side).map((f) => f.seat)
  const waiting = state.queue.filter((s) => !playing.has(key(s)))
  const stillHere = (list: Seat[]) => list.filter((s) => state.queue.some((q) => key(q) === key(s)))
  state.queue = [...stillHere(winners), ...waiting, ...stillHere(losers)]
  // Depois do placar final, a tela de escolha volta; com auto, a próxima partida começa sozinha.
  later(BETWEEN_MATCHES_SECONDS, () => {
    state.phase = 'waiting'
    state.fighters = []
    resetToWaiting()
  })
}

/* ───────── ganchos do servidor ───────── */

export function world(map: string) {
  const refused = cvar.apply({ ...cvar.arena, citadel_allow_duplicate_heroes: true })
  if (refused.length > 0) log('variáveis recusadas:', refused.join(', '))
  log('mapa', map)
  state.marked = undefined
  state.found = undefined
  state.ring.forget()
  state.queue = []
  state.fighters = []
  resetToWaiting()
}

let lastSync = -1
let lastGas = 0

export function frame(seconds: number) {
  state.now = seconds
  if (state.now - lastSync >= 1 || state.now < lastSync) {
    lastSync = state.now
    syncQueue()
  }
  tellFalls()
  if (state.phase !== 'live') return

  // Quedas que não passam pelo golpe fatal (um kill() do mod, por exemplo) aparecem aqui.
  for (const f of state.fighters) {
    const p = f.seat.player.pawn()
    if (f.alive && (!p || p.health <= 0)) fell(f)
    // Sem tempo, quem caiu não volta na rodada: se o jogo o reviveu, fica parado assistindo.
    if (!state.rules.timed && !f.alive && !f.benched && p && p.health > 0) {
      f.benched = true
      f.seat.player.freeze(true)
      const mate = state.fighters.find((m) => m.side === f.side && m.alive) ?? state.fighters.find((m) => m.alive)
      const target = mate?.seat.player.pawn()?.entity
      if (target) f.seat.player.watch(target, true)
    }
  }

  const radius = currentRadius()
  state.ring.resize(radius)
  if (state.now - lastGas >= 1 || state.now < lastGas) {
    lastGas = state.now
    gas(radius)
  }

  if (state.phase !== 'live') return
  if (state.rules.timed) {
    if (state.now >= state.endsAt) timeUp()
    return
  }
  const standing = [0, 1].map((side) => state.fighters.filter((f) => f.side === side && f.alive).length)
  if (standing[0] === 0 && standing[1] === 0) return roundDraw('Os dois lados caíram juntos.')
  if (standing[1] === 0) return roundWon(0, 'leva no abate')
  if (standing[0] === 0) return roundWon(1, 'leva no abate')
  if (state.now >= state.endsAt) {
    // O tempo da rodada acabou: vence o lado com mais vida de pé, em proporção.
    const share = [0, 1].map((side) => {
      const list = state.fighters.filter((f) => f.side === side && f.alive).map((f) => f.seat.player.pawn())
      return list.reduce((sum, p) => sum + (p ? p.health / Math.max(1, p.effectiveMaxHealth ?? p.maxHealth) : 0), 0)
    })
    if (Math.abs(share[0] - share[1]) < 0.01) return roundDraw('Tempo esgotado com as vidas iguais.')
    roundWon(share[0] > share[1] ? 0 : 1, 'leva no tempo, com mais vida')
  }
}

/**
 * A queda sem autor (gás, um kill() do mod, alguém do mesmo lado) é dita depois de um instante,
 * para dar tempo ao aviso do golpe, que pode trazer quem derrubou. Roda em qualquer fase: a
 * queda que fecha a rodada também é dita.
 */
function tellFalls() {
  for (const f of state.fighters) {
    if (f.told || state.now - f.fellAt < 0.6) continue
    f.told = true
    tellAll(f.gassed ? `${f.seat.name} caiu no gás.` : `${f.seat.name} caiu.`)
  }
}

/** Uma vez por segundo, o gás pega quem está de pé fora do círculo. */
function gas(radius: number) {
  const center = state.ring.center
  if (!center) return
  for (const f of state.fighters) {
    const p = f.seat.player.pawn()
    if (!f.alive || !p || p.health <= 0) continue
    const out = !inside(center, radius, p.position)
    if (out !== f.inGas) f.seat.player.centerText(out ? 'Fora do círculo: o gás está tirando a sua vida' : '')
    f.inGas = out
    if (!out || state.now < f.protectedUntil) continue
    state.gasCalls += 1
    if (!hurt({ victim: p.entity, amount: gasDamage(p.effectiveMaxHealth ?? p.maxHealth) })) state.gasRefused += 1
  }
}

/**
 * Fora da rodada valendo, durante a proteção de quem volta e em quem já caiu na rodada, nenhum
 * golpe pega.
 */
export function damage(hit: DamageEvent): DamageResult | void {
  const victim = fighterAt(hit.victim)
  if (!victim) return
  if (state.phase !== 'live' || state.now < victim.protectedUntil || victim.benched) return { block: true }
}

/** O golpe que derruba: conta a queda na hora e dá o abate a quem acertou. */
export function damaged(hit: DamagedEvent) {
  const victim = fighterAt(hit.victim)
  if (!victim) return
  state.lastHit = { attacker: hit.attacker, lost: hit.healthLost, victim: hit.victim }
  // Um golpe sem atacante (o gás) chega com atacante zero pela documentação, mas o host da
  // v0.1.73 manda a própria vítima como atacante (visto no autoteste). Os dois contam.
  if ((hit.attacker === 0 || hit.attacker === hit.victim) && hit.healthLost > 0) state.gasHits += 1
  if (hit.healthBefore <= 0 || hit.healthLost < hit.healthBefore) return
  // O aviso do golpe chega um quadro depois: a queda pode já ter sido vista (e a rodada fechada).
  if (!victim.alive) {
    if (state.now - victim.fellAt < 1) credit(victim, hit.attacker)
    return
  }
  if (state.phase === 'live') fell(victim, hit.attacker)
}

/* ───────── a tela de escolha ───────── */

/** Quem abriu a sala: a pessoa que chegou primeiro, entre as que não são bots. */
export function isHost(player: Player): boolean {
  return hostSeat()?.player.slot === player.slot
}

export type Choice = 'variante' | 'tempo' | 'pontos'

/** O item que os argumentos do servidor fixaram: ninguém muda na tela. */
export function fixed(k: Choice): boolean {
  return state.args[k] !== undefined
}

/** Só quem abriu a sala muda o jeito de jogar, e só o que o servidor não fixou. */
export function canChoose(player: Player, k: Choice): boolean {
  return isHost(player) && !fixed(k)
}

/** O jeito de jogar da próxima partida. Vale a escolha de quem abriu a sala; a das outras pessoas é ignorada. */
export function chooseVariant(player: Player, variant: Variant): boolean {
  if (!canChoose(player, 'variante') || !(variant in VARIANTS)) return false
  state.override.variante = variant
  return true
}

export function setTimed(player: Player, on: boolean): boolean {
  if (!canChoose(player, 'tempo')) return false
  state.override.tempo = String(on)
  return true
}

export const MIN_POINTS = 1
export const MAX_POINTS = 15

/** Os pontos para vencer no duelo e na dupla, de 1 a 15. */
export function setPoints(player: Player, points: number): boolean {
  if (!canChoose(player, 'pontos')) return false
  state.override.pontos = String(Math.min(MAX_POINTS, Math.max(MIN_POINTS, Math.round(points))))
  return true
}

/** Um ponto a mais ou a menos, a partir do valor de agora (dois cliques no mesmo quadro somam os dois). */
export function stepPoints(player: Player, delta: number): boolean {
  return setPoints(player, resolveRules().target + delta)
}

/** Dá para começar: a tela está aberta e há duas pessoas (ou uma pessoa e um bot) na fila. */
export function canBegin(): boolean {
  return state.phase === 'waiting' && state.queue.length >= 2 && !state.hold
}

/** Começar, na tela de quem abriu a sala. */
export function begin(player: Player): boolean {
  if (!isHost(player) || !canBegin()) return false
  startMatch()
  return state.phase !== 'waiting'
}

function seatOfPlayer(player: Player): Seat | undefined {
  return state.queue.find((s) => s.player.slot === player.slot)
}

/** O herói que a pessoa escolheu na tela, a partir da próxima rodada. */
export function pickHero(player: Player, name: string): string | undefined {
  const me = seatOfPlayer(player)
  const hero = findHero(name)
  if (!me || !hero) return undefined
  state.chosen.set(key(me), hero.name)
  if (state.heroMenu.delete(key(me))) toast(player, `${hero.title} a partir da próxima rodada.`, 4)
  return hero.name
}

/** O herói escolhido por quem tem esta vaga, ou undefined para ficar com o que já tem. */
export function chosenHero(player: Player): string | undefined {
  const me = seatOfPlayer(player)
  return me ? state.chosen.get(key(me)) : undefined
}

/** A lista de heróis durante a partida, aberta pelo botão Trocar herói. */
export function openHeroMenu(player: Player) {
  const me = seatOfPlayer(player)
  if (me && state.phase !== 'waiting') state.heroMenu.add(key(me))
}

export function closeHeroMenu(player: Player) {
  const me = seatOfPlayer(player)
  if (me) state.heroMenu.delete(key(me))
}

/** Marca o centro do círculo onde está o herói de quem abriu a sala, a partir da próxima rodada. */
export function markArena(player: Player) {
  if (!isHost(player)) return void player.chat('Só quem abriu a sala marca o centro do círculo.')
  const p = player.pawn()
  if (!p) return void player.chat('Entre com um herói para marcar o centro do círculo.')
  state.marked = p.position
  tellAll('O círculo mudou de lugar. Vale a partir da próxima rodada.')
  log('centro marcado', p.position.x, p.position.y, p.position.z)
}

/** Quantos bots de treino ainda cabem: só com menos de duas pessoas, até completar os lados (no máximo 4 lugares). */
export function botRoom(): number {
  const listed = players()
  if (listed.filter((c) => !c.bot && c.ready).length >= 2) return 0
  const rules = state.phase === 'waiting' ? resolveRules() : state.rules
  return Math.max(0, Math.min(2 * VARIANTS[rules.variant].perSide, 4) - listed.length)
}

export function botCount(): number {
  return players().filter((c) => c.bot).length
}

/** Um bot de treino, só com menos de duas pessoas, até completar os lados. */
export function trainingBot(player: Player) {
  const listed = players()
  if (listed.filter((c) => !c.bot && c.ready).length >= 2) return void player.chat('Bots de treino só entram com menos de duas pessoas no servidor.')
  if (botRoom() === 0) return void player.chat('Os lados já estão completos.')
  const rules = state.phase === 'waiting' ? resolveRules() : state.rules
  // Sem herói o bot não entra (o host recusa o herói 0). No espelho, todos os bots com o mesmo.
  const botHero = listed.map((c) => (c.bot ? c.player.pawn()?.hero : undefined)).find((h) => h)
  const hero = VARIANTS[rules.variant].mirror && botHero ? botHero : pick(heroes).name
  addBot({ name: `Treino ${botCount() + 1}`, team: TEAM_OF_SIDE[listed.length % 2], hero })
}

export function removeBots(player: Player) {
  const bots = players().filter((c) => c.bot)
  for (const c of bots) c.player.removeBot()
  player.chat(bots.length === 0 ? 'Não há bots.' : 'Os bots saíram.')
}

/* ───────── comandos: reserva escondida, a tela faz tudo isto ───────── */

export function placar(player: Player) {
  player.chat(state.phase === 'waiting' ? 'Esperando mais uma pessoa para a Arena.' : `${scoreLine()} · ${rulesLine()}`)
  player.chat(queueLine())
  const me = state.fighters.find((f) => f.seat.player.slot === player.slot)
  if (me) player.chat(`Você nesta partida: ${me.kills} abates.`)
}

export function chooseHero(player: Player, typed: string) {
  const hero = typed ? findHero(typed) : undefined
  if (!seatOfPlayer(player)) return
  if (!hero) return void player.chat('Herói não encontrado.')
  pickHero(player, hero.name)
  const now = info().mirror && state.phase !== 'waiting' ? ' No espelho o herói é sorteado; vale quando voltar a um jeito com herói livre.' : ' Vale a partir da próxima rodada.'
  player.chat(`Seu herói: ${hero.title}.${now}`)
}

/** O jeito de jogar por texto, para quem abriu a sala: as mesmas regras da tela. */
export function chooseMode(player: Player, args: string) {
  const host = hostSeat()
  const words = args.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) {
    player.chat(`Agora: ${rulesLine()} Próxima: ${rulesLine(resolveRules())}`)
    return void player.chat('O jeito de jogar se escolhe na tela da Arena, antes de cada partida.')
  }
  if (!host || host.player.slot !== player.slot) return void player.chat(`Só ${host?.name ?? 'quem abriu a sala'} muda o jeito de jogar.`)
  for (const w of words) {
    const v = parseVariant(w)
    if (v) chooseVariant(player, v)
    else if (w === 'tempo') setTimed(player, !resolveRules().timed)
    else if (/^\d+$/.test(w)) setPoints(player, Number(w))
  }
  tellAll(`Próxima partida: ${rulesLine(resolveRules())}`)
}

export function help(player: Player) {
  player.chat('Antes de cada partida, a tela da Arena mostra o jeito de jogar, o seu herói e os bots de treino. Quem abriu a sala escolhe o jeito e aperta Começar.')
  player.chat('Durante a partida, segure Tab para trocar de herói (vale na rodada seguinte). Quem abriu a sala também marca ali o centro do círculo.')
}
