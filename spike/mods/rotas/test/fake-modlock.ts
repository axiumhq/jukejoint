// Uma versão falsa das partes da SDK do Modlock que as Rotas usam, para as regras rodarem no
// Vitest sem o jogo. O tempo só anda quando o teste chama `tick`.

export interface P { x: number; y: number; z: number }

export class FakePlayer {
  pawnState: { position: P; health: number } | undefined
  log: string[] = []
  watchingMovement = false
  ui: unknown
  hidden = 0
  teleports = 0
  refuseTeleport = false
  constructor(readonly slot: number) {}

  pawn() {
    if (!this.pawnState) return undefined
    return { entity: 100 + this.slot, hero: 1, team: 2, health: this.pawnState.health, maxHealth: 600, position: { ...this.pawnState.position } }
  }
  chat(t: string) { this.log.push(`chat:${t}`); return true }
  announce(title: string, t: string) { this.log.push(`announce:${title}:${t}`); return true }
  centerText(t: string) { this.log.push(`center:${t}`); return true }
  teleport(p: P) {
    if (this.refuseTeleport || !this.pawnState) return false
    this.pawnState.position = { ...p }
    this.teleports++
    return true
  }
  watchMovement(w: boolean) { this.watchingMovement = w; return true }
  said(part: string) { return this.log.some((l) => l.includes(part)) }
  lastChat() { return [...this.log].reverse().find((l) => l.startsWith('chat:')) ?? '' }
}

export class FakeText {
  removed = false
  onlyTo: readonly number[] | undefined
  constructor(readonly options: { text: string; position: P; color?: number; faceCamera?: boolean }) {}
  remove() { this.removed = true; return true }
  showOnlyTo(players?: readonly number[]) { this.onlyTo = players ?? []; return true }
  setText(t: string) { this.options.text = t; return true }
  move() { return true }
}

interface Conn { player: FakePlayer; steamId: bigint; name: string; bot: boolean; ready: boolean; generation: number; roles: string[] }
interface Sample { player: FakePlayer; actions: string[]; interactions: { kind: string; entity: number }[] }

const world = {
  conns: [] as Conn[],
  time: 0,
  frame: [] as ((f: { timeSeconds: number; movement: Sample[] }) => void)[],
  worldFns: [] as ((map: string) => void)[],
  commands: new Map<string, (p: FakePlayer, args: string) => void>(),
  startFns: [] as ((args: readonly string[]) => void)[],
  joinFns: [] as ((e: { connection: Conn }) => void)[],
  leaveFns: [] as ((e: { connection: Conn; disconnected: boolean }) => void)[],
  entities: new Map<number, { cls: string; p: P }>(),
  texts: [] as FakeText[],
  files: new Map<string, string>(),
  refuseWrites: false,
  refuseTexts: false,
  writes: 0,
  cvars: {} as Record<string, unknown>,
  logs: [] as string[],
  /** Movimento anunciado para o próximo quadro, por jogador. */
  pending: new Map<FakePlayer, { actions: string[]; interactions: { kind: string; entity: number }[] }>(),
  nextId: 1000,
}

export const fake = {
  world,
  join(name: string, slot: number, position: P = { x: 0, y: 0, z: 0 }) {
    const player = new FakePlayer(slot)
    player.pawnState = { position: { ...position }, health: 600 }
    const c: Conn = { player, steamId: BigInt(slot + 1), name, bot: false, ready: true, generation: 1, roles: [] }
    world.conns.push(c)
    for (const fn of world.joinFns) fn({ connection: c })
    return player
  },
  disconnect(player: FakePlayer) {
    const c = world.conns.find((x) => x.player === player)!
    for (const fn of world.leaveFns) fn({ connection: c, disconnected: true })
    world.conns = world.conns.filter((x) => x !== c)
  },
  loadWorld(map = 'dl_midtown') {
    for (const fn of world.worldFns) fn(map)
  },
  addEntity(cls: string, p: P) {
    const id = world.nextId++
    world.entities.set(id, { cls, p })
    return id
  },
  addBoxes(points: readonly (readonly number[])[]) {
    return points.map(([x, y, z]) => fake.addEntity('citadel_breakable_prop', { x, y, z }))
  },
  /** A caixa some do mapa, como quando quebra. */
  breakBox(id: number) { world.entities.delete(id) },
  /** O jogo anuncia, no próximo quadro, que a pessoa quebrou a caixa. A caixa continua lá. */
  announceBreak(player: FakePlayer, id: number) { fake.pend(player).interactions.push({ kind: 'propBroken', entity: id }) },
  action(player: FakePlayer, action: string) { fake.pend(player).actions.push(action) },
  pend(player: FakePlayer) {
    let p = world.pending.get(player)
    if (!p) world.pending.set(player, (p = { actions: [], interactions: [] }))
    return p
  },
  /** Roda quadros de `step` segundos; `each` move as pessoas antes de cada quadro. */
  tick(seconds: number, each?: (t: number) => void, step = 0.05) {
    const end = world.time + seconds
    while (world.time < end - 1e-9) {
      world.time = Math.round((world.time + step) * 1000) / 1000
      each?.(world.time)
      const movement: Sample[] = []
      for (const c of world.conns) {
        const pend = world.pending.get(c.player)
        if (c.player.watchingMovement && c.player.pawnState) movement.push({ player: c.player, actions: pend?.actions ?? [], interactions: pend?.interactions ?? [] })
      }
      world.pending.clear()
      for (const fn of world.frame) fn({ timeSeconds: world.time, movement })
    }
  },
  /** Leva a pessoa pelo caminho a `speed` unidades por segundo, quadro a quadro. */
  walk(player: FakePlayer, path: readonly P[], speed: number, step = 0.05) {
    let total = 0
    for (let i = 1; i < path.length; i++) total += dist(path[i - 1], path[i])
    const t0 = world.time
    fake.tick(total / speed + step, (t) => { player.pawnState!.position = along(path, (t - t0) * speed) }, step)
  },
  type(player: FakePlayer, line: string) {
    const [name, ...rest] = line.replace(/^\//, '').split(' ')
    const fn = world.commands.get(name)
    if (!fn) throw new Error(`comando desconhecido: ${name}`)
    fn(player, rest.join(' ').trim())
  },
  liveTexts() { return world.texts.filter((t) => !t.removed) },
}

function dist(a: P, b: P) { return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) }
export function along(path: readonly P[], d: number): P {
  let rest = Math.max(0, d)
  for (let i = 1; i < path.length; i++) {
    const leg = dist(path[i - 1], path[i])
    if (rest <= leg) {
      const t = leg === 0 ? 0 : rest / leg
      const a = path[i - 1], b = path[i]
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t }
    }
    rest -= leg
  }
  return { ...path[path.length - 1] }
}

export const players = () => [...world.conns]
export const onFrame = (fn: (f: { timeSeconds: number; movement: Sample[] }) => void) => { world.frame.push(fn) }
export const onWorld = (fn: (map: string) => void) => { world.worldFns.push(fn) }
export const command = (name: string, fn: (p: FakePlayer, args: string) => void) => { world.commands.set(name, fn) }
export const onPlayerJoin = (fn: (e: { connection: Conn }) => void) => { world.joinFns.push(fn) }
export const onPlayerLeave = (fn: (e: { connection: Conn; disconnected: boolean }) => void) => { world.leaveFns.push(fn) }
export const onStart = (fn: (args: readonly string[]) => void) => { world.startFns.push(fn) }
export const log = (...parts: unknown[]) => { world.logs.push(parts.map(String).join(' ')) }

export const findEntities = (cls: string) => [...world.entities].filter(([, e]) => e.cls === cls).map(([id]) => id)
export const entityPosition = (id: number) => {
  const e = world.entities.get(id)
  return e ? { position: { ...e.p }, facing: { pitch: 0, yaw: 0, roll: 0 } } : undefined
}
export const removeEntities = () => 0
export const onDamaged = () => {}
export const trace = () => undefined
export const createText = (options: { text: string; position: P }) => {
  if (world.refuseTexts) return undefined
  const t = new FakeText(options)
  world.texts.push(t)
  return t
}
export const readFile = (path: string) => world.files.get(path)
export const writeFile = (path: string, text: string) => {
  if (world.refuseWrites) return false
  world.files.set(path, text)
  world.writes++
  return true
}

// Só o que o autoteste importa; os testes não rodam o autoteste.
export const addBot = () => undefined
export const heroes = [{ name: 'hero_um', title: 'Herói Um', id: 1, portrait: '' }]
export const fireInput = () => false
export const readField = () => undefined
export const ground = (p: P) => p
export class ProbeRun { tick() {} }
export const Buttons = { attack: 1n }
export const vector = { aimAt: () => ({ pitch: 0, yaw: 0, roll: 0 }) }

// HUD: show guarda a última árvore de cada pessoa; os componentes são marcadores simples.
export const show = (p: FakePlayer, root: unknown) => { p.ui = root; return true }
export const hide = (p: FakePlayer) => { p.ui = undefined; p.hidden++; return true }
const marker = (name: string) => (props: object) => ({ name, props })
export const TopStrip = marker('TopStrip')
export const Text = marker('Text')

// modlock/jsx-runtime
export const jsx = (type: unknown, props: object) => (typeof type === 'function' ? type(props) : { type, props })
export const jsxs = jsx
export const jsxDEV = jsx
export const Fragment = 'fragment'

// modlock/console
export const apply = (settings: Record<string, unknown>) => { Object.assign(world.cvars, settings); return [] }
