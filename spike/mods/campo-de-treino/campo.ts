// As regras do Campo de Treino: um mapa vazio, sem placar, com comandos de chat para treinar.
//
// - Quem entra ganha um herói sorteado no time 2, se ainda não tiver um. As pessoas ficam todas
//   no mesmo time; os bots e os alvos ficam no outro.
// - Ninguém fica morto: quem cai volta em 3 segundos (pessoas e bots de treino).
// - Cada ajuste (sem recarga, vida infinita) vale só para quem pediu e fica até /reset ou até a
//   pessoa sair.
// - Bots de treino: até MAX_PRACTICE_BOTS no servidor, e no máximo MAX_MOD_BOTS bots do modo
//   contando os alvos dos treinos.
//
// O treino de alvos (drill.ts) é adaptado do exemplo drill do Modlock, MIT, paralin/modlock.

import {
  type Angles,
  type Connection,
  type DamageEvent,
  type DamageResult,
  type Item,
  type Player,
  type Vector,
  addBot,
  findHero,
  ground,
  heroes,
  items,
  log,
  players,
} from 'modlock'
import * as cvar from 'modlock/console'

import { Drill, TARGET_COUNT } from './drill'

/** Quantos bots de treino o servidor aceita ao mesmo tempo. */
export const MAX_PRACTICE_BOTS = 4
/** Quantos bots o modo põe no servidor no total, bots de treino e alvos dos treinos juntos. */
export const MAX_MOD_BOTS = 12
/** Quanto tempo alguém fica caído antes de voltar. */
export const RESPAWN_SECONDS = 3
/** A distância, à frente de quem pediu, onde um bot de treino aparece. */
export const BOT_DISTANCE = 600
/** O time das pessoas; os bots e os alvos ficam no outro. */
export const PEOPLE_TEAM = 2
/** As almas de /almas sem número, e o máximo de uma vez. */
export const DEFAULT_SOULS = 10_000
export const MAX_SOULS = 100_000
/** A duração do treino de alvos sem número, e os limites. */
export const DRILL_SECONDS = 30
export const DRILL_MIN_SECONDS = 10
export const DRILL_MAX_SECONDS = 120
/** Um golpe que pode tirar esta fração da vida ou mais é barrado com a vida infinita ligada. */
const LETHAL_SHARE = 0.5

/** O comportamento dos bots, igual para todos os bots do servidor (são variáveis do servidor). */
export const LEVELS = {
  parado: {
    text: 'ficam parados e não atacam',
    settings: { citadel_bot_test_mode: true, citadel_bot_brain_disable_movement: true, citadel_bot_brain_disable_attacks: true },
  },
  passivo: {
    text: 'andam, mas não atacam',
    settings: { citadel_bot_test_mode: false, citadel_bot_brain_disable_movement: false, citadel_bot_brain_disable_attacks: true },
  },
  ativo: {
    text: 'andam e atacam',
    settings: { citadel_bot_test_mode: false, citadel_bot_brain_disable_movement: false, citadel_bot_brain_disable_attacks: false },
  },
} as const satisfies Record<string, { text: string; settings: cvar.Settings }>
export type Level = keyof typeof LEVELS
export const DEFAULT_LEVEL: Level = 'parado'

/** Os ajustes de uma pessoa, pela vaga e pela conexão que está nela. */
export interface Toggles {
  noCooldown: boolean
  godMode: boolean
}

/** Uma pessoa no campo. */
export interface Person {
  readonly player: Player
  readonly name: string
  readonly since: number
  /** Já tentamos dar um herói a ela. */
  seated: boolean
  deadSince?: number
}

/** Um bot de treino que o modo pôs. */
export interface PracticeBot {
  readonly player: Player
  readonly hero: string
  readonly spot: Vector
  readonly facing: Angles
  /** O herói dele já foi posto no lugar desde que apareceu ou voltou. */
  placed: boolean
  deadSince?: number
}

export const state = {
  now: 0,
  level: DEFAULT_LEVEL as Level,
  /** As pessoas no servidor, pela chave vaga:conexão. */
  people: new Map<string, Person>(),
  /** Os ajustes de cada um, pela chave vaga:conexão (vale para bots também, como no autoteste). */
  toggles: new Map<string, Toggles>(),
  /** O fim de recarga que já zeramos, por habilidade de cada um, para não zerar duas vezes. */
  refreshed: new Map<string, Map<string, number>>(),
  bots: [] as PracticeBot[],
  /** O treino de alvos de cada pessoa, pela vaga de quem treina. */
  drills: new Map<number, Drill>(),
  /** O melhor resultado de cada pessoa nesta sessão do servidor, pela conta (bots pela vaga). */
  best: new Map<string, number>(),
  /** A última resposta que cada vaga recebeu, para o autoteste ler. */
  replies: new Map<number, string>(),
  /** O que as variáveis de servidor recusaram na última vez que foram aplicadas. */
  refused: [] as string[],
  /** Onde cada um com vida infinita estava vivo por último, para voltar ali se cair mesmo assim. */
  lastAlive: new Map<string, { position: Vector; facing: Angles }>(),
  /** Quem com vida infinita caiu e está voltando, e quando o modo pediu a volta. */
  reviving: new Map<string, number>(),
  /** Os últimos golpes que passaram pelo onDamage, para o autoteste ler. */
  hits: [] as DamageEvent[],
}

/* ───────── utilidades ───────── */

export function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)]
}

/** A conexão que está na vaga do player agora. */
export function connectionOf(player: Player): Connection | undefined {
  return players().find((c) => c.player.slot === player.slot)
}

export const keyOf = (c: Connection) => `${c.player.slot}:${c.generation}`

function playerKey(player: Player): string {
  const c = connectionOf(player)
  return c ? keyOf(c) : `${player.slot}:?`
}

/** A chave do recorde: a conta de uma pessoa, ou a vaga de um bot. */
function bestKey(player: Player): string {
  const c = connectionOf(player)
  return c && !c.bot ? `conta:${c.steamId}` : `bot:${player.slot}`
}

export function togglesOf(player: Player): Toggles {
  const k = playerKey(player)
  let t = state.toggles.get(k)
  if (!t) state.toggles.set(k, (t = { noCooldown: false, godMode: false }))
  return t
}

/** Responde a quem pediu, no chat. */
export function reply(player: Player, text: string): void {
  player.chat(text)
  state.replies.set(player.slot, text)
}

function tellOthers(except: Player, text: string): void {
  for (const p of state.people.values()) if (p.player.slot !== except.slot) p.player.chat(text)
}

function nameOf(player: Player): string {
  return connectionOf(player)?.name ?? `vaga ${player.slot}`
}

function enemyTeam(player: Player): number {
  return player.pawn()?.team === 3 ? 2 : 3
}

function alive(player: Player): boolean {
  const p = player.pawn()
  return p !== undefined && p.health > 0
}

/** Quantos bots o modo tem no servidor agora, bots de treino e alvos. */
export function modBots(): number {
  let n = state.bots.length
  for (const d of state.drills.values()) n += d.targets.length
  return n
}

/** Aplica o comportamento dos bots e guarda o que o servidor recusou. */
function applyLevel(level: Level): string[] {
  const refused = cvar.apply(LEVELS[level].settings)
  state.refused = refused
  if (refused.length > 0) log('variáveis recusadas:', refused.join(', '))
  return refused
}

/* ───────── ganchos do servidor ───────── */

export function world(map: string): void {
  const refused = cvar.apply({ ...cvar.arena, citadel_allow_duplicate_heroes: true })
  if (refused.length > 0) log('variáveis recusadas:', refused.join(', '))
  applyLevel(state.level)
  log('mapa', map)
  // Um mapa novo já tirou os bots e os alvos.
  state.bots = []
  state.drills.clear()
  state.people.clear()
}

let lastSync = -1
export function frame(seconds: number): void {
  state.now = seconds
  if (state.now - lastSync >= 1 || state.now < lastSync) {
    lastSync = state.now
    sync()
  }
  for (const p of state.people.values()) keepAlive(p)
  for (const b of state.bots) keepBot(b)
  for (const [k, t] of state.toggles) applyToggles(k, t)
  for (const d of [...state.drills.values()]) runDrill(d)
}

/** Junta a lista de pessoas e de bots com quem está no servidor. */
function sync(): void {
  const here = players()
  const keys = new Set(here.map(keyOf))
  for (const c of here) {
    if (c.bot || !c.ready || state.people.has(keyOf(c))) continue
    state.people.set(keyOf(c), { player: c.player, name: c.name, since: state.now, seated: false })
    c.player.chat('Campo de Treino: sem placar, no seu ritmo. Digite /ajuda para ver os comandos.')
  }
  for (const k of [...state.people.keys()]) if (!keys.has(k)) state.people.delete(k)
  for (const k of [...state.toggles.keys()]) {
    if (!keys.has(k)) {
      forget(k)
    }
  }
  const slots = new Set(here.map((c) => c.player.slot))
  state.bots = state.bots.filter((b) => slots.has(b.player.slot))
  for (const d of [...state.drills.values()]) if (!slots.has(d.shooter.slot)) finishDrill(d, false)

  // Quem chegou sem herói ganha um sorteado, uma vez.
  for (const p of state.people.values()) {
    if (p.seated || state.now - p.since < 2) continue
    p.seated = true
    if (p.player.pawn()) continue
    const hero = pick(heroes)
    p.player.selectHero(hero.name, PEOPLE_TEAM)
    p.player.chat(`Você entrou com ${hero.title}. /heroi <nome> troca de herói.`)
  }
}

/** Quem cai volta depois de RESPAWN_SECONDS. */
function keepAlive(p: Person): void {
  const pawn = p.player.pawn()
  if (!pawn || pawn.health > 0) {
    p.deadSince = undefined
    return
  }
  p.deadSince ??= state.now
  if (state.now - p.deadSince >= RESPAWN_SECONDS) {
    p.player.respawn()
    p.deadSince = state.now
  }
}

/** Um bot de treino fica no lugar onde foi chamado e volta para ele quando cai. */
function keepBot(b: PracticeBot): void {
  const pawn = b.player.pawn()
  if (!pawn) return
  if (pawn.health <= 0) {
    b.placed = false
    b.deadSince ??= state.now
    if (state.now - b.deadSince >= RESPAWN_SECONDS) {
      b.player.respawn()
      b.deadSince = state.now
    }
    return
  }
  b.deadSince = undefined
  if (!b.placed && b.player.teleport(b.spot, b.facing)) b.placed = true
}

function forget(k: string): void {
  state.toggles.delete(k)
  state.refreshed.delete(k)
  state.lastAlive.delete(k)
  state.reviving.delete(k)
}

function applyToggles(k: string, t: Toggles): void {
  if (!t.noCooldown && !t.godMode) return
  const c = players().find((x) => keyOf(x) === k)
  const pawn = c?.player.pawn()
  if (!c || !pawn) return
  if (pawn.health <= 0) {
    // Um golpe passou mesmo assim (dano contínuo, um kill, um golpe que o onDamage não viu): com
    // a vida infinita, a pessoa volta na hora, no lugar onde estava.
    const asked = state.reviving.get(k)
    if (t.godMode && (asked === undefined || state.now - asked >= 0.5)) {
      c.player.respawn()
      state.reviving.set(k, state.now)
    }
    return
  }
  if (t.godMode) {
    const spot = state.lastAlive.get(k)
    if (state.reviving.delete(k) && spot) c.player.teleport(spot.position, spot.facing)
    else state.lastAlive.set(k, { position: pawn.position, facing: { pitch: 0, yaw: pawn.eyeAngles.yaw, roll: 0 } })
    const max = pawn.effectiveMaxHealth ?? pawn.maxHealth
    if (pawn.health < max) c.player.heal(100_000)
  }
  if (t.noCooldown) {
    let seen = state.refreshed.get(k)
    if (!seen) state.refreshed.set(k, (seen = new Map()))
    for (const ab of c.player.abilities()) {
      // O fim de recarga é zerado uma vez por recarga: se o jogo deixar outro valor depois do
      // refresh, ele só volta a contar quando uma recarga nova começar.
      const end = Math.max(ab.cooldownEnd, ab.rechargeEnd)
      if (end <= 0 || seen.get(ab.name) === end) continue
      if (!c.player.refreshAbility(ab.name)) c.player.setAbility({ ability: ab.name, cooldownEnd: 0, rechargeEnd: 0 })
      const after = c.player.abilities().find((a) => a.name === ab.name)
      seen.set(ab.name, after ? Math.max(after.cooldownEnd, after.rechargeEnd) : end)
    }
  }
}

/** Os alvos nunca tomam dano; e quem está com vida infinita não toma golpe que mata. */
export function damage(hit: DamageEvent): DamageResult | void {
  state.hits.push(hit)
  if (state.hits.length > 256) state.hits.shift()
  for (const d of state.drills.values()) if (d.hit(hit)) return { block: true }
  for (const [k, t] of state.toggles) {
    if (!t.godMode) continue
    const pawn = players()
      .find((c) => keyOf(c) === k)
      ?.player.pawn()
    if (pawn && pawn.entity === hit.victim && hit.amount >= pawn.health * LETHAL_SHARE) return { block: true }
  }
}

/* ───────── treino de alvos ───────── */

function runDrill(d: Drill): void {
  if (state.now >= d.endsAt || !alive(d.shooter)) return finishDrill(d, true)
  d.frame()
  // Só manda o texto quando ele muda: os pontos ou o segundo.
  const text = `${d.score} pontos · ${Math.ceil(d.endsAt - state.now)} s`
  if (text !== d.shown) {
    d.shooter.centerText(text)
    d.shown = text
  }
}

/** Termina um treino, mostra o resultado a quem treinou e guarda o melhor. */
export function finishDrill(d: Drill, show: boolean): void {
  d.stop()
  state.drills.delete(d.shooter.slot)
  if (!show) return
  d.shooter.centerText('')
  const k = bestKey(d.shooter)
  const before = state.best.get(k)
  const record = before === undefined || d.score > before
  if (record) state.best.set(k, d.score)
  const best = state.best.get(k) ?? d.score
  const result = `${d.score} pontos, ${d.headshots} na cabeça`
  d.shooter.announce('Fim do treino de alvos', record && d.score > 0 ? `${result}. Seu novo recorde!` : result)
  reply(d.shooter, `Treino de alvos: ${result}. Seu melhor nesta sessão: ${best}.`)
}

export function bestOf(player: Player): number | undefined {
  return state.best.get(bestKey(player))
}

/* ───────── comandos ───────── */

export function alvos(player: Player, args: string): void {
  if (state.drills.has(player.slot)) return reply(player, 'Seu treino de alvos já está rodando. /parar termina.')
  const pawn = player.pawn()
  if (!pawn || pawn.health <= 0) return reply(player, 'Entre com um herói vivo para treinar nos alvos.')
  let seconds = DRILL_SECONDS
  if (args) {
    const n = Number(args)
    if (!Number.isInteger(n) || n < DRILL_MIN_SECONDS || n > DRILL_MAX_SECONDS) {
      return reply(player, `Use /alvos ou /alvos <segundos>, de ${DRILL_MIN_SECONDS} a ${DRILL_MAX_SECONDS}.`)
    }
    seconds = n
  }
  if (modBots() + TARGET_COUNT > MAX_MOD_BOTS) {
    return reply(player, 'O campo está cheio de bots. Tire alguns com /semBots ou espere outro treino acabar.')
  }
  const d = new Drill(player, state.now + seconds, seconds, pawn.position, pawn.eyeAngles.yaw)
  if (!d.start(pawn.team)) return reply(player, 'Os alvos não entraram no servidor.')
  state.drills.set(player.slot, d)
  const best = bestOf(player)
  reply(player, `Treino de alvos: ${seconds} s. Acerto vale 1, cabeça vale 2.${best === undefined ? '' : ` Seu melhor: ${best}.`} /parar termina.`)
}

export function parar(player: Player): void {
  const d = state.drills.get(player.slot)
  if (!d) return reply(player, 'Você não está num treino de alvos. /alvos começa um.')
  finishDrill(d, true)
}

export function bot(player: Player, args: string): void {
  const pawn = player.pawn()
  if (!pawn) return reply(player, 'Entre com um herói para chamar um bot.')
  if (state.bots.length >= MAX_PRACTICE_BOTS) return reply(player, `Já tem ${MAX_PRACTICE_BOTS} bots no campo, o máximo. /semBots tira todos.`)
  if (modBots() >= MAX_MOD_BOTS) return reply(player, 'O campo está cheio de bots. Espere um treino de alvos acabar.')
  const asked = args ? findHero(args) : undefined
  const hero = asked ?? pick(heroes)
  const radians = (pawn.eyeAngles.yaw * Math.PI) / 180
  const ahead = { x: pawn.position.x + Math.cos(radians) * BOT_DISTANCE, y: pawn.position.y + Math.sin(radians) * BOT_DISTANCE, z: pawn.position.z }
  const spot = ground(ahead, { above: 256, below: 1024 }) ?? ahead
  const facing = { pitch: 0, yaw: pawn.eyeAngles.yaw + 180, roll: 0 }
  // Sem herói o host recusa o bot (herói 0), e depois não troca o herói dele.
  const added = addBot({ name: `Treino ${state.bots.length + 1}`, team: enemyTeam(player), hero: hero.name, position: spot })
  if (!added) return reply(player, 'O bot não entrou no servidor.')
  state.bots.push({ player: added, hero: hero.name, spot, facing, placed: false })
  const missed = args && !asked ? `Não achei o herói "${args}", então veio um sorteado: ` : ''
  reply(player, `${missed}${hero.title} entrou na sua frente. Os bots ${LEVELS[state.level].text} (/dificuldade muda). /semBots tira todos.`)
  tellOthers(player, `${nameOf(player)} chamou um bot (${hero.title}).`)
}

export function semBots(player: Player): void {
  const n = state.bots.length
  if (n === 0) return reply(player, 'Não tem bot de treino no campo.')
  for (const b of state.bots) b.player.removeBot()
  state.bots = []
  reply(player, n === 1 ? 'Tirei o bot de treino.' : `Tirei os ${n} bots de treino.`)
  tellOthers(player, `${nameOf(player)} tirou os bots de treino.`)
}

export function dificuldade(player: Player, args: string): void {
  const typed = args.trim().toLowerCase()
  const options = Object.keys(LEVELS).join(', ')
  if (!typed) return reply(player, `Os bots ${LEVELS[state.level].text} (${state.level}). Use /dificuldade <${options}>.`)
  if (!(typed in LEVELS)) return reply(player, `Não conheço "${args}". Use /dificuldade <${options}>.`)
  const level = typed as Level
  const refused = applyLevel(level)
  if (refused.length > 0) return reply(player, `O servidor recusou a mudança (${refused.join(', ')}). Os bots continuam como estavam.`)
  state.level = level
  reply(player, `Agora os bots ${LEVELS[level].text}. Vale para todos os bots do servidor.`)
  tellOthers(player, `${nameOf(player)} mudou os bots: agora eles ${LEVELS[level].text}.`)
}

export function semRecarga(player: Player): void {
  const t = togglesOf(player)
  t.noCooldown = !t.noCooldown
  state.refreshed.delete(playerKey(player))
  reply(player, t.noCooldown ? 'Sem recarga: ligado. Suas habilidades voltam na hora.' : 'Sem recarga: desligado. As recargas voltam ao normal.')
}

export function vida(player: Player): void {
  const t = togglesOf(player)
  t.godMode = !t.godMode
  const k = playerKey(player)
  state.lastAlive.delete(k)
  state.reviving.delete(k)
  const pawn = player.pawn()
  if (t.godMode && pawn && pawn.health > 0) {
    // O lugar já vale agora: um golpe no mesmo quadro também volta para cá.
    state.lastAlive.set(k, { position: pawn.position, facing: { pitch: 0, yaw: pawn.eyeAngles.yaw, roll: 0 } })
    player.heal(100_000)
  }
  reply(player, t.godMode ? 'Vida infinita: ligada. Você vê o dano, mas a vida volta e você não cai.' : 'Vida infinita: desligada.')
}

export function almas(player: Player, args: string): void {
  if (!player.pawn()) return reply(player, 'Entre com um herói para ganhar almas.')
  const n = args ? Number(args.replace(/[.\s]/g, '')) : DEFAULT_SOULS
  if (!Number.isInteger(n) || n < 1 || n > MAX_SOULS) return reply(player, `Use /almas <quantidade>, de 1 a ${MAX_SOULS}.`)
  if (!player.adjustSouls(n)) return reply(player, 'O servidor não deu as almas.')
  reply(player, `Mais ${n} almas.`)
}

/** Acha o item pelo que a pessoa digitou: o nome da loja do jogo, com ou sem "upgrade_". */
export function findItem(typed: string): { item?: Item; matches: Item[] } {
  const t = typed.trim().toLowerCase().replace(/[\s-]+/g, '_')
  if (!t) return { matches: [] }
  const exact = items.find((i) => i.name === t || i.name === `upgrade_${t}`)
  if (exact) return { item: exact, matches: [exact] }
  const matches = items.filter((i) => i.name.includes(t))
  return { item: matches.length === 1 ? matches[0] : undefined, matches }
}

export function item(player: Player, args: string): void {
  if (!args) return reply(player, 'Use /item <nome>, com o nome do item na loja do jogo, como /item headshot_booster.')
  if (!player.pawn()) return reply(player, 'Entre com um herói para ganhar itens.')
  const { item: found, matches } = findItem(args)
  if (!found) {
    if (matches.length === 0) return reply(player, `Nenhum item com "${args}". Os nomes são os da loja do jogo, em inglês.`)
    const some = matches.slice(0, 6).map((i) => i.name.replace(/^upgrade_/, ''))
    return reply(player, `${matches.length} itens com "${args}": ${some.join(', ')}${matches.length > 6 ? '…' : ''}. Digite um deles.`)
  }
  if (!player.giveItem(found.name)) return reply(player, `O servidor não deu o item ${found.name}.`)
  reply(player, `Você ganhou ${found.name.replace(/^upgrade_/, '')}.`)
}

export function heroi(player: Player, args: string): void {
  if (!args) return reply(player, 'Use /heroi <nome>, como /heroi geist.')
  const hero = findHero(args)
  if (!hero) return reply(player, `Não achei o herói "${args}".`)
  const team = player.pawn()?.team
  if (player.selectHero(hero.name, team === 2 || team === 3 ? team : PEOPLE_TEAM) === undefined) {
    return reply(player, 'O servidor não trocou o herói.')
  }
  reply(player, `Trocando para ${hero.title}. Seus ajustes continuam.`)
}

export function reset(player: Player): void {
  const t = togglesOf(player)
  t.noCooldown = false
  t.godMode = false
  state.refreshed.delete(playerKey(player))
  state.lastAlive.delete(playerKey(player))
  state.reviving.delete(playerKey(player))
  if (!player.pawn()) return reply(player, 'Ajustes desligados. Entre com um herói para resetar o herói.')
  player.resetHero(0)
  player.heal(100_000)
  reply(player, 'Herói como no começo: sem itens, sem melhorias, sem almas, e sem recarga e vida infinita desligados.')
}
