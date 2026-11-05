// O autoteste do Campo de Treino, no jogo de verdade. Iniciado com o argumento probe
// (`modlock dev --no-game --arg probe`), o modo põe um bot no lugar de uma pessoa e roda os
// comandos em nome dele, conferindo no servidor o que dá para conferir sem gente: o bot de
// treino, as almas, o item, a recarga zerada, a vida infinita, a dificuldade, o treino de alvos
// (tiros de outros, a arma do bot de teste num alvo, a conta da cabeça e do corpo, o relógio, o
// recorde, /parar) e o /reset. Sai com PASS ou FAIL.
// O formato vem do exemplo arena do Modlock (MIT, paralin/modlock).
import { type Player, type Vector, addBot, Buttons, damage as hurt, findHero, ground, heroes, items, log, players, ProbeRun, vector } from 'modlock'

import { BOT_DISTANCE, bestOf, damage, pick, state, togglesOf } from './campo'
import { findCommand } from './comandos'
import { FAR, HEAD_GROUP, NEAR, TARGET_COUNT } from './drill'

/** Um passo: devolve true para seguir, false para esperar e um texto para falhar. */
interface Step {
  readonly wait: string
  readonly check: (now: number) => boolean | string
}

/** Quanto um passo pode esperar antes de falhar. */
const STEP_SECONDS = 40
/** A duração do treino de alvos no autoteste. */
const DRILL_SECONDS = 30

function flat(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export class Probe {
  private readonly run = new ProbeRun('Campo de Treino', 300)
  private index = 0
  private stepStart = -1
  private me: Player | undefined
  private marker: Player | undefined
  private mark = 0
  private value = 0
  private hero = 0
  private ability = ''
  private spot: Vector | undefined
  private armed = false
  private readonly steps: Step[]

  constructor() {
    this.steps = this.plan()
  }

  tick(now: number): void {
    const step = this.steps[this.index]
    this.run.tick(
      now,
      step?.wait ?? 'o fim',
      () => {
        if (!step) return true
        if (this.stepStart < 0) this.stepStart = now
        if (now - this.stepStart > STEP_SECONDS) return `passo "${step.wait}" passou de ${STEP_SECONDS} s`
        const r = step.check(now)
        if (r !== true) return r
        this.index += 1
        this.stepStart = -1
        return this.index >= this.steps.length
      },
      () => `passo ${this.index}, última resposta: ${this.me ? state.replies.get(this.me.slot) : '-'}`,
    )
  }

  /** Roda um comando em nome do bot de teste e devolve a resposta que ele recebeu. */
  private type(name: string, args = ''): string {
    const c = findCommand(name)
    if (!c || !this.me) return ''
    state.replies.delete(this.me.slot)
    c.run(this.me, args)
    const r = state.replies.get(this.me.slot) ?? ''
    log('comando', `/${name} ${args}`.trim(), '→', r)
    return r
  }

  private pawn() {
    return this.me?.pawn()
  }

  private plan(): Step[] {
    return [
      {
        wait: 'o bot que faz a pessoa',
        check: () => {
          this.me = addBot({ name: 'Pessoa Teste', team: 2, hero: pick(heroes).name })
          // Um bot do outro time só para achar a base dele: a pessoa treina no meio do caminho.
          this.marker = addBot({ name: 'Marco', team: 3, hero: pick(heroes).name })
          return (this.me && this.marker) ? true : 'o bot de teste não entrou'
        },
      },
      {
        wait: 'a pessoa no meio do mapa',
        check: () => {
          const a = this.pawn()
          const b = this.marker?.pawn()
          if (!a || !b || a.health <= 0 || b.health <= 0 || a.hero === 0 || b.hero === 0) return false
          const mid = { x: (a.position.x + b.position.x) / 2, y: (a.position.y + b.position.y) / 2, z: Math.max(a.position.z, b.position.z) }
          const spot = ground(mid, { above: 512, below: 2048 }) ?? mid
          const yaw = (Math.atan2(b.position.y - a.position.y, b.position.x - a.position.x) * 180) / Math.PI
          this.marker!.removeBot()
          this.spot = spot
          log('meio do mapa', Math.round(spot.x), Math.round(spot.y), Math.round(spot.z))
          return this.me!.teleport(spot, { pitch: 0, yaw, roll: 0 }) || 'o teleporte da pessoa falhou'
        },
      },
      {
        wait: 'a pessoa chegar ao meio',
        check: () => {
          const a = this.pawn()
          return a !== undefined && flat(a.position, this.spot!) < 100
        },
      },
      {
        wait: 'a /ajuda',
        check: () => {
          const r = this.type('ajuda')
          return r.startsWith('Sem placar') || `ajuda respondeu: ${r}`
        },
      },
      {
        wait: 'o /bot',
        check: () => {
          const hero = heroes[1] ?? heroes[0]
          this.hero = hero.id
          const r = this.type('bot', hero.title)
          return r.includes('entrou na sua frente') || `bot respondeu: ${r}`
        },
      },
      {
        wait: 'o bot de treino no lugar',
        check: () => {
          const b = state.bots[0]
          const bp = b?.player.pawn()
          const mine = this.pawn()
          // O herói recém-chegado diz herói 0 nos primeiros quadros: espera o id dele.
          if (!b || !bp || !mine || !b.placed || bp.hero === 0) return false
          const gap = flat(bp.position, mine.position)
          log('bot de treino', bp.hero, 'time', bp.team, 'distância', Math.round(gap))
          if (bp.hero !== this.hero) return `o bot veio com o herói ${bp.hero}, esperado ${this.hero}`
          if (bp.team === mine.team) return `o bot ficou no time ${bp.team}, o mesmo da pessoa`
          if (Math.abs(gap - BOT_DISTANCE) > 300) return `o bot ficou a ${Math.round(gap)} da pessoa`
          return true
        },
      },
      {
        wait: 'o /almas',
        check: () => {
          this.value = this.pawn()?.souls ?? 0
          const r = this.type('almas', '5000')
          return r === 'Mais 5000 almas.' || `almas respondeu: ${r}`
        },
      },
      {
        wait: 'as almas chegarem',
        check: () => {
          const souls = this.pawn()?.souls ?? 0
          if (souls < this.value + 5000) return false
          log('almas', this.value, '→', souls)
          return true
        },
      },
      {
        wait: 'o /item',
        check: () => {
          const it = items.find((i) => i.tier === 1 && !i.imbue && !i.active) ?? items[0]
          const r = this.type('item', it.name.replace(/^upgrade_/, ''))
          return r.startsWith('Você ganhou') || `item respondeu: ${r}`
        },
      },
      {
        wait: 'o /semRecarga ligar',
        check: (now) => {
          const ab = this.me?.abilities().find((a) => a.slot === 0)
          if (!ab || !this.me) return 'o bot de teste não tem habilidade na vaga 0'
          this.ability = ab.name
          const r = this.type('semRecarga')
          if (!r.includes('ligado')) return `semRecarga respondeu: ${r}`
          this.value = now + 30
          this.me.setAbility({ ability: ab.name, upgrades: ab.upgrades | 1, cooldownEnd: this.value })
          this.mark = now
          return true
        },
      },
      {
        wait: 'a recarga zerar',
        check: (now) => {
          if (now - this.mark < 1) return false
          const ab = this.me?.abilities().find((a) => a.name === this.ability)
          log('recarga com semRecarga', this.ability, 'fim', ab?.cooldownEnd, 'escrito', this.value, 'agora', now)
          if (!ab) return 'a habilidade sumiu'
          return ab.cooldownEnd < this.value - 5 || `a recarga ficou em ${ab.cooldownEnd}`
        },
      },
      {
        wait: 'o /semRecarga desligar',
        check: (now) => {
          const r = this.type('semRecarga')
          if (!r.includes('desligado')) return `semRecarga respondeu: ${r}`
          this.value = now + 30
          this.me!.setAbility({ ability: this.ability, cooldownEnd: this.value })
          this.mark = now
          return true
        },
      },
      {
        wait: 'a recarga ficar',
        check: (now) => {
          if (now - this.mark < 1) return false
          const ab = this.me?.abilities().find((a) => a.name === this.ability)
          log('recarga sem semRecarga', this.ability, 'fim', ab?.cooldownEnd, 'escrito', this.value)
          return (ab !== undefined && Math.abs(ab.cooldownEnd - this.value) < 1) || `a recarga mudou sozinha: ${ab?.cooldownEnd}`
        },
      },
      {
        wait: 'o /vida e um golpe fatal',
        check: (now) => {
          const r = this.type('vida')
          if (!r.includes('ligada')) return `vida respondeu: ${r}`
          const p = this.pawn()
          if (!p) return 'sem herói'
          this.spot = p.position
          // O damage() do modo não passa pelo onDamage (o autoteste mostrou): este golpe testa a
          // volta na hora, no mesmo lugar, e não o bloqueio.
          hurt({ victim: p.entity, amount: 100_000 })
          this.mark = now
          return true
        },
      },
      {
        wait: 'a pessoa voltar no mesmo lugar',
        check: (now) => {
          if (now - this.mark < 1.5) return false
          const p = this.pawn()
          if (!p || p.health <= 0) return false
          const gap = flat(p.position, this.spot!)
          log('vida depois do golpe fatal', p.health, '/', p.effectiveMaxHealth ?? p.maxHealth, 'a', Math.round(gap), 'do lugar')
          if (gap > 100) return `voltou a ${Math.round(gap)} do lugar onde caiu`
          hurt({ victim: p.entity, amount: 50 })
          this.mark = now
          return true
        },
      },
      {
        wait: 'a vida voltar depois de um golpe pequeno',
        check: (now) => {
          if (now - this.mark < 1.5) return false
          const p = this.pawn()
          if (!p) return 'sem herói'
          const max = p.effectiveMaxHealth ?? p.maxHealth
          log('vida depois do golpe pequeno', p.health, '/', max)
          if (p.health < max) return `a vida ficou em ${p.health} de ${max}`
          return this.type('vida').includes('desligada') || 'vida não desligou'
        },
      },
      {
        wait: 'a /dificuldade',
        check: () => {
          const a = this.type('dificuldade', 'ativo')
          if (!a.startsWith('Agora os bots')) return `dificuldade ativo respondeu: ${a}`
          const b = this.type('dificuldade', 'parado')
          return b.startsWith('Agora os bots') || `dificuldade parado respondeu: ${b}`
        },
      },
      {
        wait: 'o /alvos',
        check: () => {
          const r = this.type('alvos', String(DRILL_SECONDS))
          return r.startsWith('Treino de alvos') || `alvos respondeu: ${r}`
        },
      },
      {
        wait: 'os alvos no lugar',
        check: (now) => {
          const d = state.drills.get(this.me!.slot)
          if (!d) return 'o treino acabou antes dos alvos'
          if (d.targets.length !== TARGET_COUNT || d.targets.some((t) => t.entity === 0)) return false
          for (const t of d.targets) {
            const p = t.bot.pawn()
            if (!p || vector.distance(p.position, t.spot) > 64) return false
            const gap = flat(p.position, d.origin)
            if (gap < NEAR - 50 || gap > FAR + 50) return `um alvo ficou a ${Math.round(gap)} de onde o treino começou`
          }
          log('alvos', d.targets.map((t) => Math.round(flat(t.bot.pawn()!.position, d.origin))).join(','))
          state.hits.length = 0
          this.mark = now
          return true
        },
      },
      {
        wait: 'tiros de outros não pontuarem',
        check: (now) => {
          if (now - this.mark < 2) return false
          const d = state.drills.get(this.me!.slot)
          if (!d) return 'o treino acabou cedo'
          const ids = new Set(d.targets.map((t) => t.entity))
          const others = state.hits.filter((h) => ids.has(h.victim) && h.attacker !== this.pawn()?.entity).length
          const hurtTargets = d.targets.filter((t) => (t.bot.pawn()?.health ?? 0) < (t.bot.pawn()?.maxHealth ?? 0)).length
          log('tiros de outros nos alvos', others, 'alvos feridos', hurtTargets, 'pontos', d.score)
          if (d.score !== 0) return `tiros de outros deram ${d.score} pontos`
          if (hurtTargets > 0) return `${hurtTargets} alvos perderam vida`
          this.mark = now
          return true
        },
      },
      {
        wait: 'o bot de teste acertar um alvo com a arma',
        check: (now) => {
          const d = state.drills.get(this.me!.slot)
          const p = this.pawn()
          if (!d || !p) return 'o treino acabou cedo'
          if (d.hits === 0) {
            // A arma de verdade: o bot de teste segura o tiro mirando no peito de um alvo. O
            // primeiro alvo vem para 250 unidades à frente (o treino leva o alvo para o lugar dele),
            // para o tiro não depender da sorte; se não pegar, a mira passa pelos três.
            if (!this.armed) {
              this.armed = true
              const radians = (p.eyeAngles.yaw * Math.PI) / 180
              const ahead = { x: p.position.x + Math.cos(radians) * 250, y: p.position.y + Math.sin(radians) * 250, z: p.position.z }
              d.targets[0].spot = ground(ahead, { above: 256, below: 512 }) ?? ahead
            }
            const which = now - this.mark < 6 ? 0 : Math.floor((now - this.mark) / 2) % d.targets.length
            const target = d.targets[which].bot.pawn()
            if (!target) return false
            const from = p.eyePosition
            const to = { x: target.position.x, y: target.position.y, z: target.position.z + 50 }
            const yaw = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI
            const pitch = (-Math.atan2(to.z - from.z, flat(to, from)) * 180) / Math.PI
            this.me!.drive({ facing: { pitch, yaw, roll: 0 }, forward: 0, left: 0, held: Buttons.attack, pressed: 0n })
            if (now - this.mark < 16) return false
            const mine = state.hits.filter((h) => h.attacker === p.entity).length
            return `a arma não pontuou em 16 s (${mine} golpes do bot de teste no onDamage)`
          }
          this.me!.drive()
          log('arma', d.hits, 'acertos,', d.headshots, 'na cabeça,', d.score, 'pontos')
          if (d.score !== d.hits + d.headshots) return `${d.score} pontos para ${d.hits} acertos e ${d.headshots} na cabeça`
          const hurtTargets = d.targets.filter((t) => (t.bot.pawn()?.health ?? 0) < (t.bot.pawn()?.maxHealth ?? 0)).length
          return hurtTargets === 0 || `${hurtTargets} alvos perderam vida`
        },
      },
      {
        wait: 'o alvo atingido pular',
        check: () => {
          const d = state.drills.get(this.me!.slot)
          if (!d) return 'o treino acabou cedo'
          // O alvo atingido muda de lugar e o modo leva o herói dele para lá.
          return d.targets.every((t) => vector.distance(t.bot.pawn()!.position, t.spot) <= 64)
        },
      },
      {
        wait: 'a conta da cabeça e do corpo',
        check: () => {
          // A arma do bot não escolhe onde pega: a conta de cada parte vai direto ao onDamage do
          // modo, com os alvos e o bot de teste de verdade.
          const d = state.drills.get(this.me!.slot)!
          const before = d.score
          const me = this.pawn()!.entity
          const hit = (victim: number, attacker: number, hitGroup: number) =>
            damage({ victim, attacker, inflictor: attacker, ability: 0, flags: 0n, hitGroup, amount: 10 })?.block === true
          const t1 = d.targets[1]
          const old = t1.spot
          if (!hit(t1.entity, me, HEAD_GROUP)) return 'o golpe na cabeça não foi barrado'
          if (d.score !== before + 2) return `a cabeça deu ${d.score - before} pontos`
          if (t1.spot === old) return 'o alvo da cabeça não mudou de lugar'
          if (!hit(d.targets[2].entity, me, 2)) return 'o golpe no corpo não foi barrado'
          if (d.score !== before + 3) return `o corpo deu ${d.score - before - 2} pontos`
          const other = state.bots[0]?.player.pawn()?.entity ?? 0
          if (!hit(d.targets[0].entity, other, HEAD_GROUP)) return 'o golpe do bot de treino num alvo não foi barrado'
          if (d.score !== before + 3) return 'o golpe do bot de treino pontuou'
          this.value = d.score
          return true
        },
      },
      {
        wait: 'o relógio do treino acabar',
        check: () => {
          const d = state.drills.get(this.me!.slot)
          if (d) {
            this.value = d.score
            return false
          }
          const best = bestOf(this.me!)
          log('fim do treino', this.value, 'pontos, recorde', best)
          return best === this.value || `recorde ${best}, esperado ${this.value}`
        },
      },
      {
        wait: 'os alvos saírem do servidor',
        check: () => !players().some((c) => c.bot && c.name.startsWith('Alvo')),
      },
      {
        wait: 'o /parar',
        check: (now) => {
          if (!state.drills.has(this.me!.slot)) {
            const r = this.type('alvos')
            if (!r.startsWith('Treino de alvos')) return `alvos respondeu: ${r}`
            this.mark = now
            return false
          }
          if (now - this.mark < 1) return false
          const r = this.type('parar')
          if (state.drills.has(this.me!.slot)) return 'o /parar não terminou o treino'
          return r.includes(`Seu melhor nesta sessão: ${this.value}`) || `parar respondeu: ${r}`
        },
      },
      {
        wait: 'o /semBots',
        check: () => {
          const r = this.type('semBots')
          return r.startsWith('Tirei') || `semBots respondeu: ${r}`
        },
      },
      {
        wait: 'os bots saírem do servidor',
        check: () => state.bots.length === 0 && !players().some((c) => c.bot && (c.name.startsWith('Treino') || c.name.startsWith('Alvo'))),
      },
      {
        wait: 'o /heroi',
        check: () => {
          // O host não troca o herói de um bot: aqui só dá para ver a resposta.
          const target = findHero('haze') ?? heroes[0]
          const r = this.type('heroi', target.title)
          return r.startsWith('Trocando para') || r === 'O servidor não trocou o herói.' || `heroi respondeu: ${r}`
        },
      },
      {
        wait: 'o /reset',
        check: () => {
          this.type('semRecarga')
          this.type('vida')
          const r = this.type('reset')
          const t = togglesOf(this.me!)
          if (t.noCooldown || t.godMode) return 'o /reset não desligou os ajustes'
          return r.startsWith('Herói como no começo') || `reset respondeu: ${r}`
        },
      },
    ]
  }
}
