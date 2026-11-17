// A stand-in for the parts of the Modlock SDK the Arena uses, so its rules run in Vitest
// without the game. Time only moves when the test calls `tick`. Grown from the duel's fake
// (../../duelo-meia-noite/test/fake-modlock.ts) with world text, mod damage, team changes and
// lobby settings.

type Vec = { x: number; y: number; z: number }

export interface FakePawn {
  entity: number
  hero: string
  team: number
  health: number
  maxHealth: number
  position: Vec
}

let nextEntity = 100

export class FakePlayer {
  pawnState: FakePawn | undefined
  frozen = false
  items: string[] = []
  log: string[] = []
  watching: number | undefined
  metrics: Record<string, number> = {}
  settings: Record<string, string> = {}
  ui: unknown
  bot = false
  removed = false
  private pendingHero: { hero: string; team: number } | undefined
  constructor(readonly slot: number) {}

  pawn() {
    if (!this.pawnState) return undefined
    const id = heroes.find((h) => h.name === this.pawnState!.hero)?.id ?? 0
    return { ...this.pawnState, hero: id, effectiveMaxHealth: this.pawnState.maxHealth }
  }
  setting(key: string) { return this.settings[key] }
  chat(t: string) { this.log.push(`chat:${t}`); return true }
  announce(title: string, t: string) { this.log.push(`announce:${title}:${t}`); return true }
  centerText(t: string) { this.log.push(`center:${t}`); return true }
  selectHero(hero: string, team: number) {
    this.pendingHero = { hero, team }
    return heroes.find((h) => h.name === hero)?.id
  }
  /** The game seats the hero a frame after selectHero. */
  settle() {
    if (!this.pendingHero) return
    const { hero, team } = this.pendingHero
    this.pendingHero = undefined
    this.pawnState = { entity: nextEntity++, hero, team, health: 600, maxHealth: 600, position: { x: team * 1000, y: 0, z: 0 } }
  }
  respawn() { if (this.pawnState) this.pawnState.health = this.pawnState.maxHealth; return true }
  changeTeam(team: number) { if (!this.pawnState) return false; this.pawnState.team = team; return true }
  resetHero() { this.items = []; return true }
  clearItems() { this.items = []; return true }
  abilities() { return [0, 1, 2, 3].map((slot) => ({ name: `ab${slot}`, slot })) }
  setAbility() { return true }
  giveItem(name: string) { this.items.push(name); return true }
  teleport(p: Vec) { if (this.pawnState) this.pawnState.position = { ...p }; return true }
  freeze(f = true) { this.frozen = f; return true }
  heal() { if (this.pawnState && this.pawnState.health > 0) this.pawnState.health = this.pawnState.maxHealth; return true }
  spectate() { this.pawnState = undefined; return true }
  watch(target: number) { this.watching = target; return true }
  unwatch() { this.watching = undefined; return true }
  kill() { if (this.pawnState) this.pawnState.health = 0; return true }
  removeBot() { this.removed = true; fake.leave(this); return true }
  /** A KIND_MAX metric (the streak) keeps the largest value; the rest add up. */
  addMetric(name: string, value: number) { this.metrics[name] = name.endsWith('.sequencia') ? Math.max(this.metrics[name] ?? 0, value) : (this.metrics[name] ?? 0) + value; return true }
  said(part: string) { return this.log.some((l) => l.includes(part)) }
}

interface Conn { player: FakePlayer; steamId: bigint; name: string; bot: boolean; ready: boolean; generation: number; roles: string[] }

export interface FakeText { id: number; text: string; position: Vec; removed: boolean; move(p: Vec): boolean; remove(): boolean; setText(t: string): boolean }

type DamagedHit = { victim: number; attacker: number; healthBefore: number; healthLost: number }

const world = {
  conns: [] as Conn[],
  time: 0,
  timers: [] as { at: number; fn: () => number | void; done: boolean; repeat: boolean }[],
  frame: [] as ((f: { timeSeconds: number }) => void)[],
  worldFns: [] as ((map: string) => void)[],
  commands: new Map<string, (p: FakePlayer, args: string) => void>(),
  startFns: [] as ((args: readonly string[]) => void)[],
  joinFns: [] as ((e: { connection: Conn }) => void)[],
  leaveFns: [] as ((e: { connection: Conn; disconnected: boolean }) => void)[],
  swept: 0,
  damageFns: [] as ((hit: { victim: number; attacker: number }) => { block: boolean } | void)[],
  damagedFns: [] as ((hit: DamagedHit) => void)[],
  /** Every world text the mod placed, removed ones included. */
  texts: [] as FakeText[],
  /** The hits the mod dealt with damage(). */
  modHits: [] as { victim: number; amount: number; attacker?: number }[],
  /** Bots the mod asked for with addBot. */
  botRequests: [] as { name: string; team: number; hero?: string | number }[],
}

function pawnOwner(entity: number) {
  return world.conns.find((c) => c.player.pawnState?.entity === entity)?.player
}

function land(victim: FakePlayer, amount: number, attacker: number) {
  const before = victim.pawnState!.health
  victim.pawnState!.health = Math.max(0, before - amount)
  for (const fn of world.damagedFns) fn({ victim: victim.pawnState!.entity, attacker, healthBefore: before, healthLost: before - victim.pawnState!.health })
}

let nextSlot = 0

export const fake = {
  world,
  join(name: string, settings: Record<string, string> = {}) {
    const player = new FakePlayer(nextSlot++)
    player.settings = settings
    world.conns.push({ player, steamId: BigInt(player.slot + 1), name, bot: false, ready: true, generation: 1, roles: [] })
    return player
  },
  /** A bot arrives seated on its hero and team, and the host refuses to change its hero. */
  joinBot(name: string, hero: string, team: number) {
    const player = new FakePlayer(nextSlot++)
    player.bot = true
    player.pawnState = { entity: nextEntity++, hero, team, health: 600, maxHealth: 600, position: { x: team * 1000, y: 0, z: 0 } }
    player.selectHero = () => undefined
    world.conns.push({ player, steamId: 0n, name, bot: true, ready: true, generation: 1, roles: [] })
    return player
  },
  leave(player: FakePlayer) {
    world.conns = world.conns.filter((c) => c.player !== player)
  },
  /** The host's leave notice: the player still holds the slot while the handlers run. */
  disconnect(player: FakePlayer) {
    const c = world.conns.find((x) => x.player === player)!
    for (const fn of world.leaveFns) fn({ connection: c, disconnected: true })
    world.conns = world.conns.filter((x) => x !== c)
  },
  start(args: string[] = []) {
    for (const fn of world.startFns) fn(args)
  },
  loadWorld() {
    for (const fn of world.worldFns) fn('street_test')
  },
  /** Runs frames of 0.1 s for the given seconds, seating heroes and firing timers. */
  tick(seconds: number) {
    const end = world.time + seconds
    while (world.time < end - 1e-9) {
      world.time = Math.round((world.time + 0.1) * 10) / 10
      for (const c of world.conns) c.player.settle()
      for (const t of [...world.timers]) {
        if (t.done || t.at > world.time + 1e-9) continue
        const next = t.fn()
        if (t.repeat && typeof next === 'number') t.at = world.time + next
        else t.done = true
      }
      world.timers = world.timers.filter((t) => !t.done)
      for (const fn of world.frame) fn({ timeSeconds: world.time })
    }
  },
  /** A hit by attacker (or a hazard) on victim: true when a mod blocked it, else it lands. */
  hit(victim: FakePlayer, amount: number, attacker?: FakePlayer) {
    const entity = victim.pawnState!.entity
    const from = attacker?.pawnState?.entity ?? 0
    if (world.damageFns.some((fn) => fn({ victim: entity, attacker: from })?.block)) return true
    land(victim, amount, from)
    return false
  },
  type(player: FakePlayer, line: string) {
    const [name, ...rest] = line.replace(/^\//, '').split(' ')
    world.commands.get(name)?.(player, rest.join(' ').trim())
  },
  liveTexts() {
    return world.texts.filter((t) => !t.removed)
  },
}

function timer(at: number, fn: () => number | void, repeat: boolean) {
  const t = { at, fn, done: false, repeat }
  world.timers.push(t)
  return { get finished() { return t.done }, cancel() { t.done = true } }
}

export const after = (s: number, fn: () => void) => timer(world.time + s, () => { fn() }, false)
export const sequence = (fn: (run: number) => number | void) => {
  let run = 0
  return timer(world.time, () => fn(++run), true)
}
export const players = () => [...world.conns]
export const onFrame = (fn: (f: { timeSeconds: number }) => void) => { world.frame.push(fn) }
export const onWorld = (fn: (map: string) => void) => { world.worldFns.push(fn) }
export const command = (name: string, fn: (p: FakePlayer, args: string) => void) => { world.commands.set(name, fn) }
export const onPlayerJoin = (fn: (e: { connection: Conn }) => void) => { world.joinFns.push(fn) }
export const onPlayerLeave = (fn: (e: { connection: Conn; disconnected: boolean }) => void) => { world.leaveFns.push(fn) }
export class Strays { sweep() { world.swept++ } }
export const onStart = (fn: (args: readonly string[]) => void) => { world.startFns.push(fn) }
export const onDamage = (fn: (hit: { victim: number; attacker: number }) => { block: boolean } | void) => { world.damageFns.push(fn) }
export const onDamaged = (fn: (hit: DamagedHit) => void) => { world.damagedFns.push(fn) }
/**
 * The mod's own hits skip onDamage, as on the host, and report through onDamaged. A hit without
 * an attacker reports the victim as its own attacker, as the v0.1.73 host does (the Arena's
 * probe saw it), not the zero its docs promise.
 */
export const damage = (o: { victim: number; amount: number; attacker?: number }) => {
  world.modHits.push(o)
  const victim = pawnOwner(o.victim)
  if (!victim || victim.frozen || victim.pawnState!.health <= 0) return false
  land(victim, o.amount, o.attacker ?? o.victim)
  return true
}
export const ground = (p: Vec) => p
export const log = () => {}
export const addBot = (o: { name: string; team: number; hero?: string | number }) => {
  world.botRequests.push(o)
  const hero = typeof o.hero === 'number' ? heroes.find((h) => h.id === o.hero)?.name : o.hero
  return fake.joinBot(o.name, hero ?? 'hero_um', o.team)
}
export const heroes = [
  { name: 'hero_um', title: 'Herói Um', id: 1, portrait: '' },
  { name: 'hero_dois', title: 'Herói Dois', id: 2, portrait: '' },
  { name: 'hero_tres', title: 'Herói Três', id: 3, portrait: '' },
]
export const findHero = (typed: string) =>
  heroes.find((h) => h.name === typed) ?? heroes.find((h) => h.title.toLowerCase().includes(typed.toLowerCase()))
export const items = ['weapon', 'vitality', 'spirit'].flatMap((slot) =>
  [1, 2, 3].map((n) => ({ name: `upgrade_${slot}_${n}`, slot, tier: n === 3 ? 4 : n, active: false, imbue: false, id: n, icon: '' })),
)
let textIds = 0
export const createText = (o: { text: string; position: Vec }) => {
  const t: FakeText = {
    id: ++textIds,
    text: o.text,
    position: { ...o.position },
    removed: false,
    move(p) { t.position = { ...p }; return true },
    remove() { t.removed = true; return true },
    setText(s) { t.text = s; return true },
  }
  world.texts.push(t)
  return t
}

// HUD: show records the last tree per player; components are plain markers.
export const show = (p: FakePlayer, root: unknown) => { p.ui = root }
const marker = (name: string) => (props: object) => ({ name, props })
export const TopStrip = marker('TopStrip')
export const Score = marker('Score')
export const Pips = marker('Pips')
export const Banner = marker('Banner')
export class ProbeRun { tick() {} }

// modlock/jsx-runtime
export const jsx = (type: unknown, props: object) => (typeof type === 'function' ? type(props) : { type, props })
export const jsxs = jsx
export const jsxDEV = jsx
export const Fragment = 'fragment'

// modlock/console
export const arena = {}
export const apply = () => []
