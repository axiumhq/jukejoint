// Medições: um modo de laboratório, sem pessoas, que mede no servidor do jogo o que as rotas
// precisam. Rode com `modlock dev --no-game` nesta pasta; cada medida sai no log como uma linha
// `MEDIDA <tipo> <json>`, que scripts/rotas/ lê.
//
// 1. Caixas: valor (m_nGoldCost), vida, tempos de surgimento e volta de cada citadel_breakable_prop,
//    e onde ficam os guardiões e os pontos de tropa.
// 2. Wave: solta uma wave com citadel_spawn_trooper_wave e mede quando as tropas de cada lane
//    chegam perto do guardião inimigo.
// 3. Movimento: um bot percorre um corredor reto com cada técnica (andar, dash, dash-jump, pulo,
//    slide) e anda de tirolesa; mede distância, velocidade, estamina e as ações que o jogo anunciou.
import {
  type Angles,
  type MovementSample,
  type Player,
  type Vector,
  addBot,
  after,
  Buttons,
  entityPosition,
  findEntities,
  ground,
  log,
  onFrame,
  onWorld,
  readField,
  trace,
  vector,
} from 'modlock'
import * as cvar from 'modlock/console'

const HERO = 'hero_inferno'
const TECH_SECONDS = 5
const CORRIDOR = 2600

function out(kind: string, data: unknown) {
  log('MEDIDA', kind, JSON.stringify(data))
}

const r = (n: number) => Math.round(n)
const pt = (v: Vector) => [r(v.x), r(v.y), r(v.z)]

/* ───────── 1. caixas e marcos ───────── */

function num(id: number, cls: string, field: string, type: 'int32' | 'float32'): number | null {
  const v = readField(id, cls, field, type)
  return typeof v === 'number' ? v : null
}

function census() {
  const boxes = findEntities('citadel_breakable_prop')
  const rows: unknown[] = []
  const gold = new Map<string, number>()
  for (const id of boxes) {
    const p = entityPosition(id)
    if (!p) continue
    const g = num(id, 'CCitadel_BreakableProp', 'm_nGoldCost', 'int32')
    const respawn = num(id, 'CCitadel_BreakableProp', 'm_flOverrideRespawnTime', 'float32')
    const initial = num(id, 'CCitadel_BreakableProp', 'm_flOverrideInitialSpawnTime', 'float32')
    const hp = num(id, 'CBaseEntity', 'm_iHealth', 'int32')
    const team = num(id, 'CBaseEntity', 'm_iTeamNum', 'int32')
    gold.set(String(g), (gold.get(String(g)) ?? 0) + 1)
    rows.push([...pt(p.position), g, hp, respawn, initial, team])
  }
  out('caixas.resumo', { total: boxes.length, porValor: Object.fromEntries(gold) })
  for (let i = 0; i < rows.length; i += 40) out('caixas', rows.slice(i, i + 40))

  for (const cls of ['npc_trooper_boss', 'npc_barrack_boss', 'info_trooper_spawn', 'npc_boss_tier2', 'npc_super_neutral', 'citadel_item_pickup_rejuv']) {
    const list = findEntities(cls).map((id) => {
      const p = entityPosition(id)
      return p ? [...pt(p.position), num(id, 'CBaseEntity', 'm_iTeamNum', 'int32')] : null
    })
    out('marcos', { classe: cls, pontos: list })
  }
}

/* ───────── 2. wave ───────── */

interface Tracked {
  id: number
  team: number | null
  born: number
  start: number[]
  reached?: number
}
const troopers = new Map<number, Tracked>()
let waveStart = 0
let waveUntil = 0

function guardians() {
  return findEntities('npc_trooper_boss')
    .map((id) => ({ id, p: entityPosition(id)?.position, team: num(id, 'CBaseEntity', 'm_iTeamNum', 'int32') }))
    .filter((g) => g.p)
}

function startWave(now: number) {
  cvar.set('citadel_trooper_spawn_enabled', false)
  const ok = cvar.run('citadel_spawn_trooper_wave')
  waveStart = now
  waveUntil = now + 150
  out('wave.inicio', { ok, t: r(now) })
}

function trackWave(now: number) {
  if (now > waveUntil) return
  const gs = guardians()
  for (const id of findEntities('npc_trooper')) {
    const p = entityPosition(id)?.position
    if (!p) continue
    let t = troopers.get(id)
    if (!t) {
      t = { id, team: num(id, 'CBaseEntity', 'm_iTeamNum', 'int32'), born: now - waveStart, start: pt(p) }
      troopers.set(id, t)
    }
    if (t.reached === undefined) {
      const enemy = gs.filter((g) => g.team !== null && g.team !== t!.team)
      const d = Math.min(...enemy.map((g) => vector.distance(p, g.p!)))
      if (d < 1500) {
        t.reached = now - waveStart
        out('wave.chegou', { trooper: id, time: t.team, saiu: pt(p), segundos: Math.round(t.reached * 10) / 10, distancia: r(d) })
      }
    }
  }
}

function waveSummary() {
  const all = [...troopers.values()]
  out('wave.resumo', {
    tropas: all.length,
    chegaram: all.filter((t) => t.reached !== undefined).length,
    tempos: all.filter((t) => t.reached !== undefined).map((t) => Math.round(t.reached! * 10) / 10).sort((a, b) => a - b),
  })
}

/* ───────── 3. movimento ───────── */

let bot: Player | undefined
let samples: MovementSample[] = []
let corridor: { start: Vector; dir: Vector; facing: Angles } | undefined

/** Um corredor reto e livre: chão contínuo e nada na frente por CORRIDOR unidades. */
function findCorridor(): typeof corridor {
  const seeds = findEntities('citadel_breakable_prop')
    .map((id) => entityPosition(id)?.position)
    .filter((p): p is Vector => !!p)
  for (let i = 0; i < seeds.length; i += 7) {
    const s = ground(seeds[i], { above: 64, below: 256 })
    if (!s) continue
    for (let a = 0; a < 360; a += 30) {
      const dir = { x: Math.cos((a * Math.PI) / 180), y: Math.sin((a * Math.PI) / 180), z: 0 }
      const from = { x: s.x + dir.x * 150, y: s.y + dir.y * 150, z: s.z + 48 }
      const to = { x: s.x + dir.x * CORRIDOR, y: s.y + dir.y * CORRIDOR, z: s.z + 48 }
      if (trace({ start: from, end: to })) continue
      let flat = true
      for (let d = 150; d <= CORRIDOR; d += 150) {
        const g = ground({ x: s.x + dir.x * d, y: s.y + dir.y * d, z: s.z + 32 }, { above: 64, below: 96 })
        if (!g || Math.abs(g.z - s.z) > 40) {
          flat = false
          break
        }
      }
      if (!flat) continue
      const start = { x: s.x + dir.x * 150, y: s.y + dir.y * 150, z: s.z + 8 }
      return { start, dir, facing: { pitch: 0, yaw: a, roll: 0 } }
    }
  }
  return undefined
}

/** held: botões segurados; pressed: toque pelo drive; press: toque pelo Player.press. */
type Input = { held: bigint; pressed: bigint; press?: bigint }
type Pattern = (tick: number, s: MovementSample | undefined) => Input
const T = 64 // ticks por segundo do servidor (a primeira medição deu 64 amostras por segundo)
const none: Input = { held: 0n, pressed: 0n }

const techniques: [string, Pattern][] = [
  ['andar', () => none],
  // Três jeitos de apertar o dash, para ver qual o jogo aceita de um bot.
  ['dash (drive.pressed)', (k) => ({ held: 0n, pressed: k % T === 0 ? Buttons.dash : 0n })],
  ['dash (segurado 4 ticks)', (k) => ({ held: k % T < 4 ? Buttons.dash : 0n, pressed: 0n })],
  ['dash (press)', (k) => ({ held: 0n, pressed: 0n, press: k % T === 0 ? Buttons.dash : 0n })],
  ['dash-jump (press)', (k) => ({ held: 0n, pressed: 0n, press: k % T === 0 ? Buttons.dash : k % T === 6 ? Buttons.jump : 0n })],
  ['dash-jump (segurado)', (k) => ({ held: k % T < 4 ? Buttons.dash : k % T >= 6 && k % T < 9 ? Buttons.jump : 0n, pressed: 0n })],
  ['pulo', (k, s) => ({ held: 0n, pressed: s?.grounded && k % 8 === 0 ? Buttons.jump : 0n })],
  ['slide (press)', (k) => ({ held: k % T >= 4 && k % T < 40 ? Buttons.crouch : 0n, pressed: 0n, press: k % T === 0 ? Buttons.dash : 0n })],
  ['dash-slide-jump (press)', (k) => ({ held: k % T >= 4 && k % T < 30 ? Buttons.crouch : 0n, pressed: 0n, press: k % T === 0 ? Buttons.dash : k % T === 30 ? Buttons.jump : 0n })],
]

let tech = -1
let techTick = 0
let techFrom = 0
let staminaBefore: number | undefined

function nextTechnique(now: number) {
  tech += 1
  if (!bot || !corridor) return
  if (tech >= techniques.length) {
    bot.drive({ facing: corridor.facing, forward: 0, left: 0, held: 0n, pressed: 0n })
    return void after(1, () => startBoxes())
  }
  bot.teleport(corridor.start, corridor.facing)
  bot.restoreStamina()
  bot.heal(100000)
  bot.drive({ facing: corridor.facing, forward: 0, left: 0, held: 0n, pressed: 0n })
  techTick = -1
  after(1.5, () => {
    samples = []
    staminaBefore = bot?.pawn()?.stamina
    techFrom = 0
    techTick = 0
  })
}

function driveTick(now: number) {
  if (!bot || !corridor || tech < 0 || tech >= techniques.length || techTick < 0) return
  const last = samples[samples.length - 1]
  const { held, pressed, press } = techniques[tech][1](techTick, last)
  bot.drive({ facing: corridor.facing, forward: 1, left: 0, held, pressed })
  if (press) bot.press(press)
  techTick += 1
  if (techTick === 1) techFrom = now
  if (now - techFrom >= TECH_SECONDS && techTick > 10) {
    const pos = bot.pawn()?.position ?? corridor.start
    const along = (pos.x - corridor.start.x) * corridor.dir.x + (pos.y - corridor.start.y) * corridor.dir.y
    const actions: Record<string, number> = {}
    for (const s of samples) for (const a of s.actions) actions[a] = (actions[a] ?? 0) + 1
    const peak = Math.max(0, ...samples.map((s) => Math.hypot(s.velocity.x, s.velocity.y)))
    out('movimento', {
      tecnica: techniques[tech][0],
      heroi: HERO,
      segundos: TECH_SECONDS,
      distancia: r(along),
      velocidadeMedia: r(along / TECH_SECONDS),
      picoVelocidade: r(peak),
      estaminaAntes: staminaBefore,
      estaminaDepois: bot.pawn()?.stamina,
      acoes: actions,
      saiuDaLinha: r(Math.abs((pos.x - corridor.start.x) * -corridor.dir.y + (pos.y - corridor.start.y) * corridor.dir.x)),
      amostras: samples.length,
    })
    techTick = -1
    nextTechnique(now)
  }
}

/* ───────── 1b. quebrar caixas no soco ───────── */

interface BoxTry {
  id: number
  at: Vector
  souls0: number
  hits: number
  broken?: number
  gone?: number
  respawned?: number
}
const boxTries: BoxTry[] = []
let boxIndex = -1
let boxPhaseUntil = 0

function startBoxes() {
  if (!bot || !corridor) return
  // Sem partida, as caixas existem mas não nasceram: força o surgimento de todas.
  out('caixas.forcar', { ok: cvar.run('citadel_respawn_all_breakables'), perto: cvar.run('citadel_respawn_nearby_breakables') })
  const c = corridor.start
  const near = findEntities('citadel_breakable_prop')
    .map((id) => ({ id, p: entityPosition(id)?.position }))
    .filter((b): b is { id: number; p: Vector } => !!b.p && Math.abs(b.p.z - c.z) < 200)
    .sort((a, b) => vector.distance(a.p, c) - vector.distance(b.p, c))
    .slice(0, 6)
  for (const b of near) boxTries.push({ id: b.id, at: b.p, souls0: 0, hits: 0 })
  out('caixas.teste', { escolhidas: near.map((b) => pt(b.p)) })
  boxIndex = -1
  nextBox()
}

function nextBox() {
  boxIndex += 1
  if (!bot) return
  if (boxIndex >= boxTries.length) {
    bot.drive({ facing: corridor!.facing, forward: 0, left: 0, held: 0n, pressed: 0n })
    boxPhaseUntil = now + 120
    out('caixas.quebra', boxTries.map((b) => ({ caixa: pt(b.at), tiros: b.hits, quebrou: b.broken !== undefined, almas: b.broken !== undefined ? soulsGain(b) : null })))
    return void after(1, () => ridezip(now))
  }
  const b = boxTries[boxIndex]
  const dx = corridor!.start.x - b.at.x
  const dy = corridor!.start.y - b.at.y
  const len = Math.hypot(dx, dy) || 1
  const stand = ground({ x: b.at.x + (dx / len) * 70, y: b.at.y + (dy / len) * 70, z: b.at.z + 40 }, { above: 64, below: 256 }) ?? b.at
  const eye = { x: stand.x, y: stand.y, z: stand.z + 64 }
  const yaw = (Math.atan2(b.at.y - eye.y, b.at.x - eye.x) * 180) / Math.PI
  const flat = Math.hypot(b.at.x - eye.x, b.at.y - eye.y) || 1
  const pitch = (Math.atan2(eye.z - (b.at.z + 20), flat) * 180) / Math.PI
  const facing = { pitch, yaw, roll: 0 }
  bot.teleport(stand, facing)
  bot.drive({ facing, forward: 0, left: 0, held: 0n, pressed: 0n })
  b.souls0 = bot.pawn()?.souls ?? 0
  // A tiro: o soco (press melee) não quebrou nenhuma caixa e o dano do modo recusa props.
  let ticks = 0
  const fire = () => {
    if (!bot) return
    if (!entityPosition(b.id)) b.broken = b.broken ?? now
    if (b.broken !== undefined || ticks >= 12) {
      bot.drive({ facing, forward: 0, left: 0, held: 0n, pressed: 0n })
      return void after(3, () => {
        out('caixas.golpe', { caixa: pt(b.at), tiros: b.hits, quebrou: b.broken !== undefined, almas: soulsGain(b) })
        nextBox()
      })
    }
    ticks += 1
    b.hits = ticks
    bot.drive({ facing, forward: 0, left: 0, held: Buttons.attack, pressed: 0n })
    after(0.25, fire)
  }
  after(0.6, fire)
}

function soulsGain(b: BoxTry) {
  return (bot?.pawn()?.souls ?? 0) - b.souls0
}

/** Depois de quebrar, olha de segundo em segundo se nasce outra caixa no mesmo lugar. */
function watchRespawns(nowS: number) {
  if (nowS > boxPhaseUntil || boxTries.length === 0) return
  if (Math.floor(nowS) === Math.floor(nowS - 1 / T)) return
  const live = findEntities('citadel_breakable_prop').map((id) => entityPosition(id)?.position).filter((p): p is Vector => !!p)
  for (const b of boxTries) {
    if (b.broken === undefined || b.respawned !== undefined) continue
    if (live.some((p) => vector.distance(p, b.at) < 40)) {
      b.respawned = nowS - b.broken
      out('caixas.voltou', { caixa: pt(b.at), segundos: r(b.respawned) })
    }
  }
}

let zipFrom = 0
let zipping = false
function ridezip(now: number) {
  if (!bot) return
  bot.drive()
  for (const lane of ['yellow', 'blue', 'purple'] as const) {
    const near = findEntities('zip_line_node').map((id) => entityPosition(id)?.position).filter((p): p is Vector => !!p)
    const node = near[Math.floor(near.length / 4)]
    if (node) bot.teleport({ x: node.x, y: node.y, z: node.z - 200 }, { pitch: 0, yaw: 0, roll: 0 })
    if (bot.zipline(lane)) {
      out('tirolesa.subiu', { lane })
      samples = []
      zipFrom = now
      zipping = true
      return
    }
  }
  out('tirolesa.subiu', { lane: null, motivo: 'nenhuma lane aceitou' })
  finish()
}

function zipTick(now: number) {
  if (!zipping || now - zipFrom < 8) return
  zipping = false
  const riding = samples.filter((s) => s.ziplineTime !== undefined && s.ziplineTime >= zipFrom + 1)
  const speeds = riding.map((s) => Math.hypot(s.velocity.x, s.velocity.y, s.velocity.z)).sort((a, b) => a - b)
  out('tirolesa', {
    amostras: riding.length,
    velocidadeMediana: speeds.length ? r(speeds[Math.floor(speeds.length / 2)]) : null,
    velocidadeMax: speeds.length ? r(speeds[speeds.length - 1]) : null,
  })
  finish()
}

function finish() {
  waveSummary()
  out('caixas.volta', boxTries.map((b) => ({ caixa: pt(b.at), quebrou: b.broken !== undefined, voltouEm: b.respawned ?? null })))
  out('fim', {})
}

/* ───────── sequência ───────── */

let now = 0
onWorld((map) => {
  out('mapa', { map })
  after(4, () => census())
  after(6, () => startWave(now))
  after(8, () => {
    bot = addBot({ name: 'Medidor', team: 2, hero: HERO })
    if (!bot) return void out('bot', { ok: false })
    bot.watchMovement(true)
    corridor = findCorridor()
    out('corredor', corridor ? { inicio: pt(corridor.start), yaw: corridor.facing.yaw, comprimento: CORRIDOR } : { achou: false })
    if (corridor) after(2, () => startBoxes())
    after(3, () => out('caixas.depois', { vivas: findEntities('citadel_breakable_prop').length }))
  })
})

onFrame((f) => {
  now = f.timeSeconds
  for (const s of f.movement) if (bot && s.player.slot === bot.slot) samples.push(s)
  trackWave(now)
  driveTick(now)
  zipTick(now)
  watchRespawns(now)
})
