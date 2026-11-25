// O círculo da Arena: o anel no chão, o raio que fecha com o tempo e o gás de quem fica fora.
//
// O anel é uma corrente de lasers rentes ao chão: cada trecho é o efeito de mira do Assassinato
// (`assassinate_laser_targetting`, um dos efeitos que o host do Modlock traz liberados),
// do ponto i até o ponto i+1 do anel. A ponta de cada trecho segue o começo do trecho seguinte
// (âncoras de efeito), então fechar o círculo é só mover os trechos. Se o host recusar o efeito,
// o anel volta a ser de marcadores de texto flutuando sobre o chão, como no exemplo hill do
// Modlock (MIT, paralin/modlock), agora maiores e com um sinal que a fonte do jogo tem.
import { type Vector, type WorldObject, createParticle, createText, ground } from 'modlock'

/** Quantos pontos (e trechos de laser, ou marcadores) desenham o anel. */
export const MARKERS = 40
/** Quanto da vida máxima o gás tira por segundo de quem está fora do círculo. */
export const GAS_SHARE = 0.08
/** O mínimo que o gás tira por segundo, para heróis com pouca vida máxima. */
export const GAS_MIN = 25
/** O menor tamanho do círculo, em proporção do raio inteiro. */
export const MIN_FRACTION = 0.3
/** Só move o anel quando o raio mudou ao menos isto. */
const REDRAW_STEP = 24
/** O efeito de cada trecho do anel: um laser com a ponta no ponto de controle 1. */
export const RING_EFFECT = 'particles/abilities/assassinate_laser_targetting.vpcf'
/** O ponto de controle da ponta do laser. */
const FAR_END = 1
/** O tom do anel (0xRRGGBBAA): o latão do painel, puxado para o âmbar. */
const RING_TINT = 0xd9a95cff
/** Quanto o laser fica acima do chão, para não sumir em degraus e calçadas. */
const RING_LIFT = 10
/** Os marcadores de reserva: um traço vertical, que a fonte do jogo (Reaver) tem. */
const MARKER_TEXT = '|'
const MARKER_COLOR = 0xd9a95cff
const MARKER_SIZE = 120
const MARKER_SCALE = 2
/** Os efeitos que o anel usa, para o precache no começo do servidor. */
export const RING_RESOURCES = [RING_EFFECT] as const
/** Quantos metros tem uma unidade do jogo (uma polegada). */
export const METERS_PER_UNIT = 0.0254

/**
 * O raio num instante: inteiro até `from`, fechando em linha reta até `to`, onde chega a
 * MIN_FRACTION do raio inteiro e fica.
 */
export function radiusAt(full: number, elapsed: number, from: number, to: number): number {
  if (elapsed <= from) return full
  const t = Math.min(1, (elapsed - from) / Math.max(1e-6, to - from))
  return full * (1 - (1 - MIN_FRACTION) * t)
}

/** A distância no chão (sem a altura) entre dois pontos. */
export function flat(a: Vector, b: Vector): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** Se o ponto está dentro do círculo, olhando só o chão. */
export function inside(center: Vector, radius: number, p: Vector): boolean {
  return flat(center, p) <= radius
}

/** Quanto falta, em metros inteiros, para voltar para dentro do círculo (0 dentro). */
export function metersOutside(center: Vector, radius: number, p: Vector): number {
  return Math.max(0, Math.ceil((flat(center, p) - radius) * METERS_PER_UNIT))
}

/**
 * Para que lado fica o centro, visto pela câmera: o giro em graus no sentido do relógio que uma
 * seta para cima precisa para apontar o centro na tela (0 à frente, 90 à direita, 180 atrás).
 * O yaw do jogo cresce no sentido anti-horário visto de cima.
 */
export function turnToCenter(center: Vector, p: Vector, cameraYaw: number): number {
  const yaw = (Math.atan2(center.y - p.y, center.x - p.x) * 180) / Math.PI
  let rel = cameraYaw - yaw
  while (rel > 180) rel -= 360
  while (rel <= -180) rel += 360
  return rel
}

/** Quanto o gás tira num segundo de um herói com esta vida máxima. */
export function gasDamage(maxHealth: number): number {
  return Math.max(GAS_MIN, Math.round(maxHealth * GAS_SHARE))
}

/** O ponto i do anel, no chão quando há chão. */
function onRing(center: Vector, radius: number, i: number, lift: number): Vector {
  const angle = (i / MARKERS) * 2 * Math.PI
  const p = { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius, z: center.z }
  const floor = ground(p, { above: 400, below: 800 })
  return { x: p.x, y: p.y, z: (floor?.z ?? center.z) + lift }
}

/** O anel no mundo: trechos de laser, ou marcadores de texto quando o host recusa o efeito. */
export class Ring {
  center: Vector | undefined
  /** O raio que o anel mostra agora. */
  radius = 0
  /** Os trechos de laser, na ordem do anel. */
  private beams: WorldObject[] = []
  /** O ponto que a ponta do último trecho segue: o começo do primeiro. */
  private closer: WorldObject | undefined
  /** Os trechos sem âncora, que só se redesenham do zero quando o raio muda. */
  private loose = false
  private marks: { index: number; obj: WorldObject }[] = []

  /** Quantas peças desenham o anel agora (trechos de laser ou marcadores). */
  get count(): number {
    return this.beams.length > 0 ? this.beams.length : this.marks.length
  }

  /** Se o anel é de laser (true) ou de marcadores de reserva (false). */
  get lasers(): boolean {
    return this.beams.length > 0
  }

  /** Desenha o anel em volta de center, tirando o anterior. */
  place(center: Vector, radius: number): void {
    this.clear()
    this.center = center
    this.radius = radius
    if (!this.drawBeams()) this.drawMarks()
  }

  /** Os trechos de laser, do último para o primeiro: a ponta de cada um segue o começo do seguinte. */
  private drawBeams(): boolean {
    const c = this.center!
    const at = (i: number) => onRing(c, this.radius, ((i % MARKERS) + MARKERS) % MARKERS, RING_LIFT)
    // Um ponto parado no começo do anel, só para a ponta do último trecho seguir.
    this.closer = createParticle({ resource: RING_EFFECT, position: at(0), inactive: true })
    const made: WorldObject[] = []
    for (let i = MARKERS - 1; i >= 0; i--) {
      const next = i === MARKERS - 1 ? this.closer : made[0]
      const anchor = next?.entity()
      const beam = createParticle({
        resource: RING_EFFECT,
        position: at(i),
        color: RING_TINT,
        point: { index: FAR_END, position: at(i + 1) },
        anchors: anchor !== undefined ? [{ index: FAR_END, entity: anchor }] : undefined,
      })
      if (!beam) break
      if (anchor === undefined) this.loose = true
      made.unshift(beam)
    }
    if (made.length < MARKERS) {
      for (const b of made) b.remove()
      this.closer?.remove()
      this.closer = undefined
      this.loose = false
      return false
    }
    this.beams = made
    return true
  }

  private drawMarks(): void {
    const c = this.center!
    for (let i = 0; i < MARKERS; i++) {
      const mark = createText({
        text: MARKER_TEXT,
        position: onRing(c, this.radius, i, 8),
        fontSize: MARKER_SIZE,
        scale: MARKER_SCALE,
        color: MARKER_COLOR,
        faceCamera: true,
        align: 'center',
      })
      if (mark) this.marks.push({ index: i, obj: mark })
    }
  }

  /** Aproxima o anel do centro quando o raio fecha. */
  resize(radius: number): void {
    if (!this.center || Math.abs(radius - this.radius) < REDRAW_STEP) return
    this.radius = radius
    const c = this.center
    if (this.beams.length > 0) {
      if (this.loose) {
        // Sem âncoras, a ponta não acompanha: redesenha o anel inteiro.
        for (const b of this.beams) b.remove()
        this.closer?.remove()
        this.beams = []
        this.closer = undefined
        this.loose = false
        if (!this.drawBeams()) this.drawMarks()
        return
      }
      this.closer?.move(onRing(c, radius, 0, RING_LIFT))
      this.beams.forEach((b, i) => b.move(onRing(c, radius, i, RING_LIFT)))
      return
    }
    for (const m of this.marks) m.obj.move(onRing(c, radius, m.index, 8))
  }

  /** Tira o anel do mundo. */
  clear(): void {
    for (const b of this.beams) b.remove()
    this.closer?.remove()
    for (const m of this.marks) m.obj.remove()
    this.forget()
  }

  /** Esquece o anel que o jogo já tirou junto com o mapa anterior. */
  forget(): void {
    this.beams = []
    this.closer = undefined
    this.loose = false
    this.marks = []
    this.center = undefined
    this.radius = 0
  }
}
