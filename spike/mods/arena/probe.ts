// O autoteste da Arena, no jogo de verdade. Iniciado com o argumento probe
// (`modlock dev --no-game --arg probe --arg variante=times`), o modo põe bots no servidor,
// espera todos os bots chegarem, confere a partida (lados, times, heróis, círculo de marcadores),
// leva um bot para fora do círculo e confere que o gás tira vida dele, e então joga a partida:
// - por rodadas: derruba o lado 1 inteiro a cada rodada e confere o placar até o fim;
// - com tempo: derruba um bot, confere o ponto, a volta dele protegido dentro do círculo, o
//   círculo fechando e o resultado no fim do relógio.
// No fim confere que a fila girou (quem venceu na frente). Sai com PASS ou FAIL.
// O formato vem do exemplo arena do Modlock (MIT, paralin/modlock).
import { addBot, ground, heroes, log, ProbeRun } from 'modlock'

import { currentRadius, type Fighter, key, perSideFor, resolveRules, type Rules, sideOf, state, TEAM_OF_SIDE, VARIANTS, type Variant } from './arena'
import { flat, MARKERS } from './circulo'

type Step = 'seat' | 'gather' | 'live' | 'gas' | 'fall' | 'scored' | 'return' | 'shrink' | 'over'

const waits: Record<Step, string> = {
  seat: 'pôr os bots',
  gather: 'todos os bots chegarem',
  live: 'a rodada valer',
  gas: 'o gás tirar vida de quem está fora do círculo',
  fall: 'derrubar o lado 1',
  scored: 'o ponto entrar no placar',
  return: 'quem caiu voltar protegido dentro do círculo',
  shrink: 'o círculo fechar',
  over: 'o fim da partida',
}

/** Quantos bots cada jeito de jogar põe no autoteste. */
export const PROBE_BOTS: Record<Variant, number> = { duelo: 2, dupla: 4, times: 6, espelho: 4 }
/** Quanto o gás pode demorar para pegar. */
const GAS_WAIT = 8

function shuffle<T>(list: readonly T[]): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export class Probe {
  private run: ProbeRun | undefined
  private step: Step = 'seat'
  private rules: Rules | undefined
  private bots = 0
  private since = 0
  private falls = 0
  private gasDone = false
  private gasBase = 0
  private gasStart = 0
  private movedAt = 0
  private loggedAt = 0
  private center: { x: number; y: number; z: number } | undefined
  private victim: Fighter | undefined

  tick(now: number): void {
    this.run ??= new ProbeRun('Arena', 300)
    this.run.tick(now, waits[this.step], () => this.advance(now), () => this.describe())
  }

  private describe(): string {
    return `jeito ${state.rules.variant}${state.rules.timed ? ' com tempo' : ''}, fase ${state.phase}, rodada ${state.round}, placar ${state.score.join('×')}, fila ${state.queue.map((s) => s.name).join(',')}, gás: ${state.gasCalls} chamadas, ${state.gasRefused} recusadas, ${state.gasHits} golpes`
  }

  private advance(now: number): boolean | string {
    switch (this.step) {
      case 'seat':
        return this.seat()
      case 'gather':
        if (state.queue.length < this.bots) return false
        log('bots na fila', state.queue.map((s) => s.name).join(','))
        state.hold = false
        this.step = 'live'
        return false
      case 'live':
        return this.live(now)
      case 'gas':
        return this.gas(now)
      case 'fall':
        return this.fall(now)
      case 'scored':
        return this.scored()
      case 'return':
        return this.back()
      case 'shrink':
        if (currentRadius() > state.fullRadius * 0.9) return state.phase === 'live' ? false : 'a partida acabou antes de o círculo fechar'
        log('círculo fechando', Math.round(currentRadius()), 'de', state.fullRadius, 'marcadores em', Math.round(state.ring.radius))
        this.step = 'over'
        return false
      case 'over':
        return this.over()
    }
  }

  /** Põe os bots já nos times que a Arena vai dar a eles; no espelho, todos com o mesmo herói. */
  private seat(): boolean | string {
    state.hold = true
    const rules = resolveRules()
    this.rules = rules
    this.bots = PROBE_BOTS[rules.variant]
    const n = perSideFor(rules.variant, this.bots)
    const pool = shuffle(heroes)
    const slots: (number | undefined)[] = []
    for (let i = 0; i < this.bots; i++) {
      const hero = VARIANTS[rules.variant].mirror ? pool[0].name : pool[i % pool.length].name
      const team = TEAM_OF_SIDE[sideOf(i, n, rules.variant)]
      slots.push(addBot({ name: `Bot ${i + 1}`, team, hero })?.slot)
    }
    log('autoteste', rules.variant, rules.timed ? `com tempo (${rules.seconds} s)` : `por rodadas (até ${rules.target})`, 'bots', slots.join(','))
    if (slots.some((s) => s === undefined)) return 'o host recusou um bot'
    this.step = 'gather'
    return false
  }

  /** A rodada valendo: confere quem luta, os times, os heróis e o círculo. */
  private live(now: number): boolean | string {
    if (state.phase !== 'live') return false
    const rules = this.rules!
    if (state.rules.variant !== rules.variant || state.rules.timed !== rules.timed) return `a partida saiu com outro jeito: ${state.rules.variant}`
    if (state.fighters.length !== this.bots) return `${state.fighters.length} na partida, esperava ${this.bots}`
    const center = state.ring.center
    if (!center) return 'a rodada valeu sem o círculo'
    if (state.ring.count !== MARKERS) return `${state.ring.count} marcadores no anel, esperava ${MARKERS}`
    if (this.center && (flat(this.center, center) > 1 || Math.abs(this.center.z - center.z) > 1)) return 'o círculo mudou de lugar entre as rodadas'
    this.center = { ...center }
    const heroIds = new Set<number>()
    for (const f of state.fighters) {
      const p = f.seat.player.pawn()
      if (!p || p.health <= 0) return `${f.seat.name} sem herói vivo no começo da rodada`
      if (p.team !== TEAM_OF_SIDE[f.side]) return `${f.seat.name} no time ${p.team}, esperava ${TEAM_OF_SIDE[f.side]}`
      const d = flat(center, p.position)
      if (d > state.fullRadius) return `${f.seat.name} começou fora do círculo, a ${Math.round(d)} do centro`
      heroIds.add(p.hero)
    }
    if (VARIANTS[rules.variant].mirror && heroIds.size !== 1) return `espelho com ${heroIds.size} heróis diferentes`
    if (!VARIANTS[rules.variant].mirror && heroIds.size < 2) return 'cada bot devia manter o próprio herói'
    log('rodada', state.round, 'lados', state.fighters.map((f) => `${f.seat.name}:${f.side}`).join(','), 'heróis', [...heroIds].join(','), 'raio', state.fullRadius)
    this.since = now
    this.step = this.gasDone ? 'fall' : 'gas'
    return false
  }

  /** Leva um bot do lado 1 para fora do círculo e espera o jogo aplicar o golpe do gás. */
  private gas(now: number): boolean | string {
    if (state.phase !== 'live') return 'a rodada acabou antes do teste do gás'
    if (now - this.since < 1) return false
    if (!this.victim) {
      this.victim = state.fighters.find((f) => f.side === 1 && f.alive)
      if (!this.victim) return 'ninguém do lado 1 de pé para o teste do gás'
      this.gasBase = state.gasHits
      this.gasStart = now
    }
    if (state.gasHits > this.gasBase) {
      const p = this.victim.seat.player.pawn()
      log('gás', 'golpes', state.gasHits - this.gasBase, 'vida', p?.health, 'de', p?.maxHealth)
      this.gasDone = true
      this.victim = undefined
      this.since = now
      this.step = 'fall'
      return false
    }
    const p = this.victim.seat.player.pawn()
    const center = state.ring.center!
    if (p && now - this.loggedAt >= 1) {
      this.loggedAt = now
      const h = state.lastHit
      log('gás?', this.victim.seat.name, 'a', Math.round(flat(center, p.position)), 'do centro (raio', Math.round(currentRadius()), ') vida', p.health, 'chamadas', state.gasCalls, 'recusadas', state.gasRefused, 'golpes', state.gasHits, 'último aviso', h ? `atacante ${h.attacker} vítima ${h.victim} perdeu ${h.lost}` : 'nenhum', 'pawn', p.entity)
    }
    if (now - this.gasStart > GAS_WAIT) return `o gás não tirou vida em ${GAS_WAIT} s: ${this.describe()}`
    if (p && now - this.movedAt > 0.5 && flat(center, p.position) <= currentRadius()) {
      const out = { x: center.x + currentRadius() + 600, y: center.y, z: center.z }
      this.victim.seat.player.teleport(ground(out, { above: 1024, below: 2048 }) ?? out, { pitch: 0, yaw: 0, roll: 0 })
      this.movedAt = now
    }
    return false
  }

  private fall(now: number): boolean | string {
    if (state.phase !== 'live') return false
    if (now - this.since < 1) return false
    const side1 = state.fighters.filter((f) => f.side === 1 && f.alive)
    if (side1.length === 0) return false
    if (this.rules!.timed) {
      this.victim = side1[0]
      if (!this.victim.seat.player.kill()) return false
    } else {
      for (const f of side1) f.seat.player.kill()
    }
    this.falls += 1
    this.since = now
    this.step = 'scored'
    return false
  }

  private scored(): boolean | string {
    if (this.rules!.timed) {
      if (state.score[0] < 1) return state.phase === 'live' ? false : 'a partida acabou sem o ponto da queda'
      log('ponto com tempo', state.score.join('×'))
      this.step = 'return'
      return false
    }
    if (state.score[0] !== this.falls) {
      if (state.phase === 'live') return false
      return `placar ${state.score.join('×')} depois de ${this.falls} rodadas derrubando o lado 1`
    }
    this.step = state.score[0] >= this.rules!.target ? 'over' : 'live'
    return false
  }

  /** Com tempo: quem caiu volta vivo, dentro do círculo e protegido. */
  private back(): boolean | string {
    const f = this.victim!
    if (state.phase !== 'live') return 'a partida acabou antes de quem caiu voltar'
    const p = f.seat.player.pawn()
    if (!f.alive || !p || p.health <= 0) return false
    const d = flat(state.ring.center!, p.position)
    if (d > currentRadius()) return `${f.seat.name} voltou fora do círculo, a ${Math.round(d)} do centro`
    if (f.protectedUntil <= state.now - 0.5) return `${f.seat.name} voltou sem proteção`
    log('voltou', f.seat.name, 'a', Math.round(d), 'do centro, protegido até', f.protectedUntil.toFixed(1))
    this.step = 'shrink'
    return false
  }

  private over(): boolean | string {
    if (state.phase !== 'matchOver') return false
    const [a, b] = state.score
    const expected = this.rules!.timed ? (a > b ? 0 : b > a ? 1 : -1) : 0
    if (state.lastWinner !== expected) return `quem venceu foi o lado ${state.lastWinner}, esperava ${expected} (placar ${a}×${b})`
    if (expected >= 0) {
      const winners = new Set(state.fighters.filter((f) => f.side === expected).map((f) => key(f.seat)))
      const front = state.queue.slice(0, winners.size)
      if (!front.every((s) => winners.has(key(s)))) return `quem venceu não ficou na frente da fila: ${state.queue.map((s) => s.name).join(',')}`
    }
    log('fim', state.score.join('×'), 'fila', state.queue.map((s) => s.name).join(','))
    return true
  }
}
