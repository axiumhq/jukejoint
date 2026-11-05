// A stand-in for the parts of the Modlock SDK the duel uses, so its rules run in Vitest
// without the game. Time only moves when the test calls `tick`.

export interface FakePawn {
  entity: number
  hero: string
  team: number
  health: number
  maxHealth: number
  position: { x: number; y: number; z: number }
}

export class FakePlayer {
  pawnState: FakePawn | undefined
  frozen = false
  items: string[] = []
  log: string[] = []
  watching: number | undefined
  private pendingHero: { hero: string; team: number } | undefined
  constructor(readonly slot: number) {}

  pawn() {
    return this.pawnState ? { ...this.pawnState, effectiveMaxHealth: this.pawnState.maxHealth } : undefined
  }
  chat(t: string) { this.log.push(`chat:${t}`); return true }
  announce(title: string, t: string) { this.log.push(`announce:${title}:${t}`); return true }
  centerText(t: string) { this.log.push(`center:${t}`); return true }
  selectHero(hero: string, team: number) { this.pendingHero = { hero, team }; return 1 }
  /** The game seats the hero a frame after selectHero. */
  settle() {
    if (!this.pendingHero) return
    const { hero, team } = this.pendingHero
    this.pendingHero = undefined
    this.pawnState = { entity: 100 + this.slot, hero, team, health: 600, maxHealth: 600, position: { x: team * 1000, y: 0, z: 0 } }
  }
  respawn() { if (this.pawnState) this.pawnState.health = this.pawnState.maxHealth; return true }
  resetHero() { this.items = []; return true }
  clearItems() { this.items = []; return true }
  abilities() { return [0, 1, 2, 3].map((slot) => ({ name: `ab${slot}`, slot })) }
  setAbility() { return true }
  giveItem(name: string) { this.items.push(name); return true }
  teleport(p: { x: number; y: number; z: number }) { if (this.pawnState) this.pawnState.position = p; return true }
  freeze(f = true) { this.frozen = f; return true }
  heal() { if (this.pawnState) this.pawnState.health = this.pawnState.maxHealth; return true }
  spectate() { this.pawnState = undefined; return true }
  watch(target: number) { this.watching = target; return true }
  said(part: string) { return this.log.some((l) => l.includes(part)) }
}

interface Conn { player: FakePlayer; steamId: bigint; name: string; bot: boolean; ready: boolean; generation: number; roles: string[] }

const world = {
  conns: [] as Conn[],
  time: 0,
  timers: [] as { at: number; fn: () => number | void; done: boolean; repeat: boolean }[],
  frame: [] as ((f: { timeSeconds: number }) => void)[],
  worldFns: [] as ((map: string) => void)[],
  commands: new Map<string, (p: FakePlayer, args: string) => void>(),
}

export const fake = {
  world,
  join(name: string, slot: number) {
    const player = new FakePlayer(slot)
    world.conns.push({ player, steamId: BigInt(slot + 1), name, bot: false, ready: true, generation: 1, roles: [] })
    return player
  },
  leave(player: FakePlayer) {
    world.conns = world.conns.filter((c) => c.player !== player)
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
  type(player: FakePlayer, line: string) {
    const [name, ...rest] = line.replace(/^\//, '').split(' ')
    world.commands.get(name)?.(player, rest.join(' '))
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
export const ground = (p: { x: number; y: number; z: number }) => p
export const log = () => {}
export const addBot = () => undefined
export const heroes = [
  { name: 'hero_um', title: 'Herói Um', id: 1, portrait: '' },
  { name: 'hero_dois', title: 'Herói Dois', id: 2, portrait: '' },
]
export const items = ['weapon', 'vitality', 'spirit'].flatMap((slot) =>
  [1, 2, 3].map((n) => ({ name: `upgrade_${slot}_${n}`, slot, tier: n === 3 ? 4 : n, active: false, imbue: false, id: n, icon: '' })),
)

// modlock/console
export const arena = {}
export const apply = () => []
