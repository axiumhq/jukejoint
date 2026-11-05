// O treino de alvos: a corrida de uma pessoa contra três heróis-alvo parados na frente dela.
// Cada acerto vale 1 ponto, um tiro na cabeça vale 2, e o alvo atingido pula para outro lugar.
//
// Adaptado do exemplo drill do Modlock, MIT, paralin/modlock. O que mudou: os textos em
// português, a duração escolhida no comando, o herói-alvo que existe no servidor, os lugares
// no chão e os alvos presos no lugar por drive (por alvo), no lugar das variáveis de servidor do
// exemplo, que valeriam também para os bots de treino.
import { type Angles, type DamageEvent, type Player, type Vector, addBot, findHero, ground, heroes, vector } from 'modlock'

/** Quantos alvos ficam em pé num treino. */
export const TARGET_COUNT = 3
/** O grupo de acerto da cabeça. */
export const HEAD_GROUP = 1
/** Pontos por acerto no corpo e na cabeça. */
export const BODY_POINTS = 1
export const HEAD_POINTS = 2
/** Quanto para cada lado da mira um alvo pode ficar, em graus. */
export const ARC_DEGREES = 35
/** A distância de um alvo até onde o treino começou. */
export const NEAR = 500
export const FAR = 900
/** Um alvo que saiu mais que isto do lugar volta para ele. */
const DRIFT = 64
/** O herói dos alvos: o do exemplo, se o servidor tiver, senão o primeiro da lista. */
const TARGET_HERO = 'hero_wraith'

export function targetHero(): string {
  return (findHero(TARGET_HERO) ?? heroes[0]).name
}

/** Um alvo: o bot, o lugar onde ele deve ficar e o herói dele quando já está no lugar. */
export interface Target {
  readonly bot: Player
  spot: Vector
  /** O herói do alvo depois de posto no lugar, ou zero. */
  entity: number
}

export class Drill {
  score = 0
  headshots = 0
  hits = 0
  /** O último texto do centro da tela, para não mandar o mesmo de novo. */
  shown = ''
  readonly targets: Target[] = []

  constructor(
    readonly shooter: Player,
    readonly endsAt: number,
    readonly seconds: number,
    readonly origin: Vector,
    private readonly yaw: number,
  ) {}

  /** Põe os alvos no time oposto ao de team e diz se todos entraram. */
  start(team: number): boolean {
    const hero = targetHero()
    for (let i = 0; i < TARGET_COUNT; i++) {
      const spot = this.spot()
      const bot = addBot({ name: `Alvo ${i + 1}`, team: team === 2 ? 3 : 2, hero, position: spot })
      if (!bot) {
        this.stop()
        return false
      }
      this.targets.push({ bot, spot, entity: 0 })
    }
    return true
  }

  /** Põe no lugar cada alvo cujo herói chegou e devolve ao lugar quem saiu dele. */
  frame(): void {
    for (const t of this.targets) {
      if (t.entity === 0) {
        this.place(t)
        continue
      }
      const pawn = t.bot.pawn()
      if (pawn && vector.distance(pawn.position, t.spot) > DRIFT) this.place(t)
    }
  }

  /** O alvo dono do herói entity, se for um deste treino. */
  targetAt(entity: number): Target | undefined {
    return this.targets.find((t) => t.entity !== 0 && t.entity === entity)
  }

  /**
   * Conta o tiro de quem treina num alvo e muda o alvo de lugar. Diz se a vítima é um alvo deste
   * treino: um alvo nunca toma dano, nem de outra pessoa (que não pontua).
   */
  hit(hit: DamageEvent): boolean {
    const target = this.targetAt(hit.victim)
    if (!target) return false
    if (hit.attacker === 0 || hit.attacker !== this.shooter.pawn()?.entity) return true

    const head = hit.hitGroup === HEAD_GROUP
    this.score += head ? HEAD_POINTS : BODY_POINTS
    this.hits += 1
    if (head) {
      this.headshots += 1
      this.shooter.sound('Damage.Send.Crit')
    }
    target.spot = this.spot()
    this.place(target)
    return true
  }

  /** Tira os alvos do servidor. */
  stop(): void {
    for (const { bot } of this.targets) bot.removeBot()
    this.targets.length = 0
  }

  /** Leva o herói de um alvo para o lugar dele, virado para quem treina, e o prende ali. */
  private place(t: Target): void {
    const pawn = t.bot.pawn()
    if (!pawn || !t.bot.teleport(t.spot, this.facing())) return
    t.entity = pawn.entity
    // Sem botões nem movimento: o cérebro do bot não anda nem atira enquanto é alvo.
    t.bot.drive({ facing: this.facing(), forward: 0, left: 0, held: 0n, pressed: 0n })
  }

  /** Um lugar sorteado no arco à frente de quem treina. */
  private spot(): Vector {
    const yaw = this.yaw + (Math.random() * 2 - 1) * ARC_DEGREES
    const distance = NEAR + Math.random() * (FAR - NEAR)
    const radians = (yaw * Math.PI) / 180
    const spot = {
      x: this.origin.x + Math.cos(radians) * distance,
      y: this.origin.y + Math.sin(radians) * distance,
      z: this.origin.z,
    }
    // No chão, para o alvo não afundar numa rampa nem ficar no ar.
    return ground(spot, { above: 256, below: 512 }) ?? spot
  }

  /** Os alvos olham de volta para onde o treino começou. */
  private facing(): Angles {
    return { pitch: 0, yaw: this.yaw + 180, roll: 0 }
  }
}
