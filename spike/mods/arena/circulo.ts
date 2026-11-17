// O círculo da Arena: um anel de marcadores no chão, o raio que fecha com o tempo e o gás de
// quem fica fora. O anel de marcadores flutuando sobre o chão segue o exemplo hill do Modlock
// (MIT, paralin/modlock); o resto é nosso.
import { type Vector, type WorldObject, createText, ground } from 'modlock'

/** Quantos marcadores desenham o anel. */
export const MARKERS = 28
/** Quanto da vida máxima o gás tira por segundo de quem está fora do círculo. */
export const GAS_SHARE = 0.08
/** O mínimo que o gás tira por segundo, para heróis com pouca vida máxima. */
export const GAS_MIN = 25
/** O menor tamanho do círculo, em proporção do raio inteiro. */
export const MIN_FRACTION = 0.3
/** Só move os marcadores quando o raio mudou ao menos isto. */
const REDRAW_STEP = 24
/** A cor dos marcadores (0xRRGGBBAA): um roxo que lembra o gás. */
const MARKER_COLOR = 0xb36bffff

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

/** Quanto o gás tira num segundo de um herói com esta vida máxima. */
export function gasDamage(maxHealth: number): number {
  return Math.max(GAS_MIN, Math.round(maxHealth * GAS_SHARE))
}

/** O ponto do anel no ângulo dado, no chão quando há chão. */
function onRing(center: Vector, radius: number, angle: number): Vector {
  const p = { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius, z: center.z }
  const floor = ground(p, { above: 400, below: 800 })
  return { x: p.x, y: p.y, z: (floor?.z ?? center.z) + 16 }
}

/** O anel de marcadores no mundo. */
export class Ring {
  center: Vector | undefined
  /** O raio que os marcadores mostram agora. */
  radius = 0
  private marks: WorldObject[] = []

  /** Quantos marcadores estão no mundo. */
  get count(): number {
    return this.marks.length
  }

  /** Desenha o anel em volta de center, tirando o anterior. */
  place(center: Vector, radius: number): void {
    this.clear()
    this.center = center
    this.radius = radius
    for (let i = 0; i < MARKERS; i++) {
      const mark = createText({
        text: '◆',
        position: onRing(center, radius, (i / MARKERS) * 2 * Math.PI),
        fontSize: 56,
        color: MARKER_COLOR,
        faceCamera: true,
        align: 'center',
      })
      if (mark) this.marks.push(mark)
    }
  }

  /** Aproxima os marcadores do centro quando o raio fecha. */
  resize(radius: number): void {
    if (!this.center || Math.abs(radius - this.radius) < REDRAW_STEP) return
    this.radius = radius
    this.marks.forEach((m, i) => m.move(onRing(this.center!, radius, (i / MARKERS) * 2 * Math.PI)))
  }

  /** Tira os marcadores do mundo. */
  clear(): void {
    for (const m of this.marks) m.remove()
    this.forget()
  }

  /** Esquece os marcadores que o jogo já tirou junto com o mapa anterior. */
  forget(): void {
    this.marks = []
    this.center = undefined
    this.radius = 0
  }
}
