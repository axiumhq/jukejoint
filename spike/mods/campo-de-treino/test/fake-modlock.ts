// A stand-in for the parts of the Modlock SDK the training ground uses, so its rules run in
// Vitest without the game. Time only moves when the test calls `tick`.

type Vec = { x: number; y: number; z: number }

export interface FakePawn {
  entity: number
  hero: string
  team: number
  health: number
  maxHealth: number
  souls: number
  position: Vec
  yaw: number
}

export interface FakeAbility {
  name: string
  slot: number
  upgrades: number
  cooldownEnd: number
  rechargeEnd: number
}

export class FakePlayer {
  pawnState: FakePawn | undefined
  items: string[] = []
  log: string[] = []
  ui: unknown
  removed = false
  driven: unknown
  abilityState: FakeAbility[] = [0, 1, 2, 3].map((slot) => ({ name: `ab${slot}`, slot, upgrades: 0, cooldownEnd: 0, rechargeEnd: 0 }))
  pendingHero: { hero: string; team: number; position?: Vec } | undefined
  /** A bot keeps the hero addBot gave it. */
  bot = false
  constructor(readonly slot: number) {}

  pawn() {
    if (!this.pawnState) return undefined
    const s = this.pawnState
    const id = heroes.find((h) => h.name === s.hero)?.id ?? 0
    return { ...s, position: { ...s.position }, hero: id, effectiveMaxHealth: s.maxHealth, eyeAngles: { pitch: 0, yaw: s.yaw, roll: 0 } }
  }
  chat(t: string) { this.log.push(`chat:${t}`); return true }
  announce(title: string, t: string) { this.log.push(`announce:${title}:${t}`); return true }
  centerText(t: string) { this.log.push(`center:${t}`); return true }
  selectHero(hero: string, team: number) {
    if (this.bot) return undefined
    this.pendingHero = { hero, team }
    return heroes.find((h) => h.name === hero)?.id
  }
  /** The game seats the hero a frame after selectHero or addBot. */
  settle() {
    if (!this.pendingHero) return
    const { hero, team, position } = this.pendingHero
    this.pendingHero = undefined
    this.pawnState = { entity: 100 + this.slot, hero, team, health: 600, maxHealth: 600, souls: 0, position: position ?? { x: team * 1000, y: 0, z: 0 }, yaw: 0 }
  }
  respawn() { if (this.pawnState) this.pawnState.health = this.pawnState.maxHealth; return true }
  resetHero(souls: number) {
    this.items = []
    if (this.pawnState) this.pawnState.souls = souls
    for (const a of this.abilityState) a.upgrades = 0
    return true
  }
  clearItems() { this.items = []; return true }
  abilities() { return this.pawnState ? this.abilityState.map((a) => ({ ...a })) : [] }
  setAbility(o: { ability: string; upgrades?: number; cooldownEnd?: number; rechargeEnd?: number }) {
    const a = this.abilityState.find((x) => x.name === o.ability)
    if (!a) return false
    if (o.upgrades !== undefined) a.upgrades = o.upgrades
    if (o.cooldownEnd !== undefined) a.cooldownEnd = o.cooldownEnd
    if (o.rechargeEnd !== undefined) a.rechargeEnd = o.rechargeEnd
    return true
  }
  refreshAbility(name: string) {
    const a = this.abilityState.find((x) => x.name === name)
    if (!a) return false
    a.cooldownEnd = 0
    a.rechargeEnd = 0
    return true
  }
  giveItem(name: string) { if (!this.pawnState) return false; this.items.push(name); return true }
  adjustSouls(n: number) { if (!this.pawnState) return false; this.pawnState.souls += n; return true }
  teleport(p: Vec) { if (!this.pawnState) return false; this.pawnState.position = { ...p }; return true }
  heal(n: number) { if (this.pawnState) this.pawnState.health = Math.min(this.pawnState.maxHealth, this.pawnState.health + n); return true }
  kill() { if (this.pawnState) this.pawnState.health = 0; return true }
  drive(c: unknown) { this.driven = c; return true }
  sound(s: string) { this.log.push(`sound:${s}`); return true }
  removeBot() { this.removed = true; fake.leave(this); return true }
  addMetric() { return true }
  said(part: string) { return this.log.some((l) => l.includes(part)) }
  /** The chat lines the player got, without the prefix. */
  chats() { return this.log.filter((l) => l.startsWith('chat:')).map((l) => l.slice(5)) }
}

interface Conn { player: FakePlayer; steamId: bigint; name: string; bot: boolean; ready: boolean; generation: number; roles: string[] }

const world = {
  conns: [] as Conn[],
  time: 0,
  timers: [] as { at: number; fn: () => number | void; done: boolean; repeat: boolean }[],
  frame: [] as ((f: { timeSeconds: number }) => void)[],
  worldFns: [] as ((map: string) => void)[],
  commands: new Map<string, (p: FakePlayer, args: string) => void>(),
  startFns: [] as ((args: readonly string[]) => void)[],
  damageFns: [] as ((hit: { victim: number; attacker: number; hitGroup: number; amount: number }) => { block?: boolean } | void)[],
  cvars: new Map<string, unknown>(),
  refuse: new Set<string>(),
  /** addBot fails while this is set, as a full server would. */
  botsRefused: false,
}

let nextSlot = 10

export const fake = {
  world,
  join(name: string, slot: number, steamId = BigInt(slot + 1)) {
    const player = new FakePlayer(slot)
    world.conns.push({ player, steamId, name, bot: false, ready: true, generation: 1, roles: [] })
    return player
  },
  /** A person who already has a hero, facing +x. */
  seat(player: FakePlayer, hero = 'hero_um', team = 2, position: Vec = { x: 0, y: 0, z: 0 }) {
    player.pawnState = { entity: 100 + player.slot, hero, team, health: 600, maxHealth: 600, souls: 0, position, yaw: 0 }
  },
  leave(player: FakePlayer) {
    world.conns = world.conns.filter((c) => c.player !== player)
  },
  bots() {
    return world.conns.filter((c) => c.bot)
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
  /** A hit on victim from attacker (or a hazard): returns true when a mod blocked it, else lands it. */
  hit(victim: FakePlayer, amount: number, attacker?: FakePlayer, hitGroup = 2) {
    const entity = victim.pawnState!.entity
    let dealt = amount
    for (const fn of world.damageFns) {
      const r = fn({ victim: entity, attacker: attacker?.pawnState?.entity ?? 0, hitGroup, amount: dealt })
      if (r?.block) return true
      if (r?.amount !== undefined) dealt = (r as { amount: number }).amount
    }
    victim.pawnState!.health = Math.max(0, victim.pawnState!.health - dealt)
    return false
  },
  type(player: FakePlayer, line: string) {
    const [name, ...rest] = line.replace(/^\//, '').split(' ')
    const fn = world.commands.get(name)
    if (!fn) throw new Error(`no command ${name}`)
    fn(player, rest.join(' ').trim())
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
export const onStart = (fn: (args: readonly string[]) => void) => { world.startFns.push(fn) }
export const onDamage = (fn: (hit: { victim: number; attacker: number; hitGroup: number; amount: number }) => { block?: boolean } | void) => { world.damageFns.push(fn) }
export const ground = (p: Vec) => p
export const log = () => {}
export const addBot = (o: { name: string; team: number; hero?: string | number; position?: Vec }) => {
  if (world.botsRefused || o.hero === undefined) return undefined
  const player = new FakePlayer(nextSlot++)
  player.bot = true
  player.pendingHero = { hero: String(o.hero), team: o.team, position: o.position }
  world.conns.push({ player, steamId: 0n, name: o.name, bot: true, ready: true, generation: 1, roles: [] })
  return player
}
export const heroes = [
  { name: 'hero_um', title: 'Herói Um', id: 1, portrait: '' },
  { name: 'hero_dois', title: 'Herói Dois', id: 2, portrait: '' },
  { name: 'hero_wraith', title: 'Wraith', id: 7, portrait: '' },
]
/** As modlock's findTitled: an exact name first, then a title that starts with or contains it. */
export const findHero = (typed: string) => {
  const t = typed.trim().toLowerCase()
  return (
    heroes.find((h) => h.name === t) ??
    heroes.find((h) => h.title.toLowerCase().startsWith(t)) ??
    heroes.find((h) => h.title.toLowerCase().includes(t))
  )
}
export const items = [
  'upgrade_headshot_booster',
  'upgrade_high_velocity_mag',
  'upgrade_extra_health',
  'upgrade_extra_stamina',
  'upgrade_mystic_burst',
].map((name, i) => ({ name, id: i + 1, slot: 'weapon', tier: 1, active: false, imbue: false, icon: '' }))
export const vector = { distance: (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) }

// HUD: show records the last tree per player; components are plain markers.
export const show = (p: FakePlayer, root: unknown) => { p.ui = root }
const marker = (name: string) => (props: object) => ({ name, props })
export const Plate = marker('Plate')
export const Text = marker('Text')
export class ProbeRun { tick() {} }
export const damage = () => true

// modlock/jsx-runtime
export const jsx = (type: unknown, props: object) => (typeof type === 'function' ? type(props) : { type, props })
export const jsxs = jsx
export const jsxDEV = jsx
export const Fragment = 'fragment'

// modlock/console
export const arena = { sv_hibernate_when_empty: false }
export const apply = (settings: Record<string, unknown>) => {
  const refused: string[] = []
  for (const [k, v] of Object.entries(settings)) {
    if (world.refuse.has(k)) refused.push(k)
    else world.cvars.set(k, v)
  }
  return refused
}
