// O que cada pessoa vê, redesenhado a cada quadro (show só manda o que mudou), no mesmo desenho do
// painel de votação (paleta.tsx): sem enfeite, hierarquia clara, âmbar e safira para os lados.
// - antes da partida, duas linhas no topo (o que vale pela votação e quando começa) e o painel da
//   escolha à esquerda (escolha.tsx);
// - na partida, no topo, no lugar da barra do jogo (escondida com hideHud), o placar compacto:
//   cada lado com retrato, nome e pontos na cor do time, e no meio a rodada ou o relógio;
// - no meio da tela, a contagem 3, 2, 1 e o "Valendo", a faixa de quem levou a rodada ou a partida
//   e os destaques ("Primeira queda", "Sem tomar dano");
// - abaixo da mira, o aviso de quem está fora do círculo (com a borda, a distância e a direção do
//   centro), a volta de quem caiu e a posição na fila de quem assiste;
// - à esquerda, as últimas quedas e, com o Tab, o quadro de Trocar herói e Marcar o centro.
//
// A parte do HUD do jogo que não serve à Arena some (barra do topo, marca do canto, almas, números,
// avisos de nível e minimapa) e só é pedida de novo quando muda. Com a lista de heróis aberta, o
// cursor fica solto sem o Tab e os botões do mouse ficam presos, para um clique não virar tiro.
import { Buttons, cursorFree, freeCursor, hideHud, type HudPart, show } from 'modlock'

import {
  type Callout,
  COUNTDOWN_SECONDS,
  currentRadius,
  FEED_SECONDS,
  type FeedEntry,
  type Fighter,
  info,
  key,
  RESPAWN_SECONDS,
  type Seat,
  SHRINK_FROM,
  sideName,
  state,
  TEAM_NAMES,
} from './arena'
import { GAS_MIN, GAS_SHARE, inside, metersOutside, MIN_FRACTION, turnToCenter } from './circulo'
import { clock, HeroMenu, heroOf, heroTitle, MatchControls, PickHeader, PickPanel, Portrait } from './escolha'
import { L, P, pct, SIDE_COLORS, surface } from './paleta'

/** Os pontos só viram marcadores até este alvo; acima disso, só o número. */
const MAX_PIPS = 7
/** Nos times, quantos retratos de cada lado o placar mostra. */
const MAX_PORTRAITS = 6
/** Quanto tempo o "Valendo" fica na tela. */
const GO_SECONDS = 1.2
/** Quantas quedas o quadro da esquerda mostra de uma vez. */
const FEED_SHOWN = 3
/** Onde começa o quadro de quedas, à esquerda. */
const FEED_TOP = 190

/** O que fica preso com a escolha aberta para quem não tem herói: atirar, golpear e as habilidades. */
export const PICK_BLOCK =
  Buttons.attack | Buttons.altFire | Buttons.melee | Buttons.ability1 | Buttons.ability2 | Buttons.ability3 | Buttons.ultimate
/** Com a lista de heróis aberta, só os botões do mouse. */
export const MENU_BLOCK = Buttons.attack | Buttons.altFire

/** O HUD do jogo que some na Arena: a barra do topo, a marca do canto, almas, números, avisos de nível e o minimapa. */
export const MATCH_HIDE: readonly HudPart[] = ['topBar', 'status', 'souls', 'stats', 'levelUp', 'minimap']
/** Com a lista de heróis aberta, some também o que fica debaixo dela: munição e habilidades. */
export const PANEL_HIDE: readonly HudPart[] = [...MATCH_HIDE, 'ammo', 'abilities']

/* ───────── o cursor e o HUD do jogo, pedidos só quando mudam ───────── */

/** Os botões que cada pessoa tem presos agora, enquanto o cursor está solto por nós. */
const held = new Map<string, bigint>()
/** As partes do HUD do jogo escondidas de cada pessoa agora. */
const hidden = new Map<string, string>()

/** Solta o cursor e prende os botões (want), ou devolve tudo (want zero), só quando muda. */
function holdCursor(seat: Seat, want: bigint) {
  const k = key(seat)
  const had = held.get(k) ?? 0n
  if (want === had) return
  // Sem herói o jogo não solta o cursor: tenta de novo no próximo quadro.
  if (want !== 0n && had === 0n && !freeCursor(seat.player, true)) return
  if (want === 0n) freeCursor(seat.player, false)
  seat.player.blockInput(want)
  if (want === 0n) held.delete(k)
  else held.set(k, want)
}

/** Esconde as partes do HUD do jogo, só quando a lista muda; se o host recusar, tenta de novo. */
function hideStock(seat: Seat, parts: readonly HudPart[]) {
  const k = key(seat)
  const want = parts.join(',')
  if (hidden.get(k) === want) return
  if (hideHud(seat.player, parts)) hidden.set(k, want)
}

/* ───────── o placar ───────── */

interface Person {
  name: string
  hero: number
  down: boolean
  self: boolean
}

export interface SideView {
  side: number
  label: string
  /** O herói de quem está sozinho no lado, ou quantos estão de pé nos times. */
  sub: string | undefined
  color: string
  people: Person[]
  score: number
}

function isLive(): boolean {
  return state.phase === 'live' || state.phase === 'roundOver'
}

/** Os dois lados como o placar mostra a quem olha: o lado da pessoa (ou o lado 0) à esquerda. */
export function sideViews(viewer: Seat): [SideView, SideView] {
  const all = state.fighters
  const mine = all.find((f) => key(f.seat) === key(viewer))
  const near = mine?.side ?? 0
  const view = (side: number): SideView => {
    const list = all.filter((f) => f.side === side)
    const people = list.map((f) => ({ name: f.seat.name, hero: heroOf(f.seat), down: !f.alive && isLive(), self: key(f.seat) === key(viewer) }))
    let label: string
    let sub: string | undefined
    if (list.length === 0) label = 'Ninguém'
    else if (info().mixed) {
      label = TEAM_NAMES[side]
      const up = people.filter((p) => !p.down).length
      sub = isLive() ? `${up} de pé` : `${people.length} ${people.length === 1 ? 'pessoa' : 'pessoas'}`
    } else {
      label = sideName(side)
      sub = people.length === 1 ? heroTitle(people[0].hero) : undefined
    }
    return { side, label, sub, color: SIDE_COLORS[side], people, score: state.score[side] }
  }
  return [view(near), view(1 - near)]
}

/** A linha sobre o placar: o modo, como se vence e o herói do espelho. */
export function heading(): string {
  const parts: string[] = [info().title, state.rules.timed ? 'com tempo' : `até ${state.rules.target}`]
  if (info().mirror && state.heroTitle) parts.push(state.heroTitle)
  return parts.join(' · ')
}

/** O meio do placar: o relógio com tempo, a rodada sem tempo (com o relógio dela embaixo). */
export function middle(): { main: string; sub: string | undefined } {
  const live = state.phase === 'live'
  if (state.rules.timed) {
    const left = live ? state.endsAt - state.now : state.phase === 'matchOver' ? 0 : state.rules.seconds
    return { main: clock(left), sub: undefined }
  }
  return { main: `Rodada ${state.round || 1}`, sub: live ? clock(state.endsAt - state.now) : undefined }
}

/** Os pontos como marcadores: cheios na cor do lado, vazios só com o contorno. */
function Dots(props: { filled: number; total: number; color: string; mirror?: boolean }) {
  const { filled, total, color, mirror } = props
  return (
    <panel style={{ flow: 'right', verticalAlign: 'center' }}>
      {Array.from({ length: total }, (_, i) => {
        const lit = mirror ? i >= total - filled : i < filled
        return (
          <panel
            key={`p${i}`}
            style={{ width: 12, height: 12, borderRadius: 6, margin: [0, 3], background: lit ? color : P.clear, borderWidth: 1, borderColor: lit ? color : P.line2 }}
          />
        )
      })}
    </panel>
  )
}

function SideBlock(props: { view: SideView; align: 'left' | 'right' }) {
  const { view, align } = props
  const size = view.people.length > 2 ? 34 : 44
  const portraits = (
    <panel style={{ flow: 'right', verticalAlign: 'center' }}>
      {view.people.slice(0, MAX_PORTRAITS).map((p, i) => (
        <panel key={`${p.name}-${i}`} style={{ margin: [0, 2] }}>
          <Portrait hero={p.hero} size={size} name={p.name} edge={p.self ? P.ink : view.color} dim={p.down} />
        </panel>
      ))}
    </panel>
  )
  const names = (
    <panel style={{ flow: 'down', verticalAlign: 'center', margin: align === 'right' ? [0, 10, 0, 0] : [0, 0, 0, 10], maxWidth: 220 }}>
      <L size={20} weight="semiBold" color={view.color} shadow style={{ horizontalAlign: align, textAlign: align, noWrap: true, textOverflow: 'ellipsis' }}>
        {view.label}
      </L>
      {view.sub ? (
        <L size={15} color={P.ink2} shadow style={{ horizontalAlign: align, textAlign: align }}>
          {view.sub}
        </L>
      ) : null}
    </panel>
  )
  return (
    <panel style={{ flow: 'right', width: 320, verticalAlign: 'center' }}>
      {align === 'right' ? <panel style={{ width: 'fill' }} /> : null}
      {align === 'right' ? names : portraits}
      {align === 'right' ? portraits : names}
    </panel>
  )
}

export function Scoreboard(props: { seat: Seat; fade: boolean }) {
  const [near, far] = sideViews(props.seat)
  const mid = middle()
  const dots = !state.rules.timed && state.rules.target <= MAX_PIPS
  const score = (v: SideView) => (
    <L size={42} block color={v.color} shadow style={{ width: 64, horizontalAlign: 'center', textAlign: 'center', verticalAlign: 'center' }}>
      {v.score}
    </L>
  )
  return (
    <panel style={{ flow: 'down', horizontalAlign: 'center', margin: [14, 0, 0, 0], opacity: props.fade ? 0 : 1, transition: 0.2 }}>
      <L size={15} block upper spacing={2} color={P.ink2} shadow style={{ horizontalAlign: 'center' }}>
        {heading()}
      </L>
      <panel style={{ flow: 'right', verticalAlign: 'center', margin: [6, 0, 0, 0] }}>
        <SideBlock view={near} align="right" />
        {score(near)}
        <panel style={{ flow: 'down', width: 132, horizontalAlign: 'center', verticalAlign: 'center' }}>
          <panel style={{ padding: [4, 14], borderRadius: 18, background: P.panel, borderWidth: 1, borderColor: P.line, horizontalAlign: 'center' }}>
            <L size={state.rules.timed ? 24 : 18} block color={P.ink} style={{ horizontalAlign: 'center' }}>
              {mid.main}
            </L>
          </panel>
          {mid.sub ? (
            <L size={15} color={P.ink3} shadow style={{ horizontalAlign: 'center', margin: [3, 0, 0, 0] }}>
              {mid.sub}
            </L>
          ) : null}
        </panel>
        {score(far)}
        <SideBlock view={far} align="left" />
      </panel>
      {dots ? (
        <panel style={{ flow: 'right', horizontalAlign: 'center', margin: [6, 0, 0, 0] }}>
          <Dots filled={near.score} total={state.rules.target} color={near.color} mirror />
          <panel style={{ width: 60 }} />
          <Dots filled={far.score} total={state.rules.target} color={far.color} />
        </panel>
      ) : null}
    </panel>
  )
}

/** A linha do círculo debaixo do placar: quando fecha e quanto falta do raio. */
export function circleLine(): { text: string; value: number | undefined } | undefined {
  if (state.phase !== 'live' || !state.ring.center) return undefined
  const elapsed = state.now - state.liveAt
  const r = currentRadius()
  const value = (r - state.fullRadius * MIN_FRACTION) / Math.max(1, state.fullRadius * (1 - MIN_FRACTION))
  if (!state.rules.timed && elapsed < SHRINK_FROM) {
    const left = SHRINK_FROM - elapsed
    return left <= 10 ? { text: `O círculo fecha em ${Math.ceil(left)}`, value: undefined } : undefined
  }
  if (value <= 0.001) return { text: 'O círculo está no menor tamanho', value: undefined }
  return { text: 'O círculo fecha', value }
}

function CircleLine() {
  const c = circleLine()
  if (!c) return null
  return (
    <panel style={{ flow: 'down', horizontalAlign: 'center', margin: [10, 0, 0, 0] }}>
      <L size={15} block upper spacing={1} color={P.brass} shadow style={{ horizontalAlign: 'center' }}>
        {c.text}
      </L>
      {c.value !== undefined ? (
        <panel style={{ width: 200, height: 5, borderRadius: 3, background: P.line2, margin: [5, 0, 0, 0], horizontalAlign: 'center', overflow: 'clip' }}>
          <panel style={{ width: pct(100 * c.value), height: '100%', background: P.brass, transition: 0.25 }} />
        </panel>
      ) : null}
    </panel>
  )
}

/* ───────── o meio da tela ───────── */

/** O número da contagem agora: 3, 2, 1. */
export function countdownNumber(): number {
  const n = COUNTDOWN_SECONDS - Math.floor(state.now - state.countdownAt + 1e-6)
  return Math.min(COUNTDOWN_SECONDS, Math.max(1, n))
}

/** O que o meio da tela anuncia agora: a rodada, a contagem ou o "Valendo". */
export function moment(): { title: string; detail?: string; big: boolean; key: string } | undefined {
  const round = state.rules.timed ? 'Partida com tempo' : `Rodada ${state.round || 1}`
  const mirror = info().mirror && state.heroTitle ? `Todo mundo de ${state.heroTitle}` : undefined
  if (state.phase === 'starting' || state.phase === 'preparing') {
    return { title: state.rules.timed ? 'Preparando a partida' : round, detail: mirror, big: false, key: `prep-${state.round}` }
  }
  if (state.phase === 'countdown') {
    const n = countdownNumber()
    return { title: String(n), detail: mirror ? `${round} · ${mirror}` : round, big: true, key: `conta-${state.round}-${n}` }
  }
  if (state.phase === 'live' && state.now - state.liveAt < GO_SECONDS) return { title: 'Valendo', big: false, key: `vale-${state.round}` }
  return undefined
}

function Moment() {
  const m = moment()
  if (!m) return null
  const go = m.title === 'Valendo'
  return (
    <panel key={m.key} style={{ flow: 'down', horizontalAlign: 'center', transition: { seconds: 0.3, easing: 'out' } }} enter={{ opacity: 0, scale: m.big ? 1.6 : 1.2 }} exit={{ opacity: 0 }}>
      {m.big && m.detail ? (
        <L size={16} block upper spacing={2} color={P.ink2} shadow style={{ horizontalAlign: 'center' }}>
          {m.detail}
        </L>
      ) : null}
      <L size={m.big ? 120 : 60} block color={go ? P.brass : P.ink} shadow style={{ horizontalAlign: 'center' }}>
        {m.title}
      </L>
      {!m.big && m.detail ? (
        <L size={18} color={P.ink2} shadow style={{ horizontalAlign: 'center' }}>
          {m.detail}
        </L>
      ) : null}
    </panel>
  )
}

/** A faixa de quem levou a rodada ou a partida, do ponto de vista de quem olha. */
export function bannerFor(seat: Seat): { title: string; detail: string; side: number; final: boolean } | undefined {
  const b = state.banner
  if (!b || state.now >= b.until) return undefined
  const mine = state.fighters.find((f) => key(f.seat) === key(seat))
  const many = state.fighters.filter((f) => f.side === b.side).length > 1
  let title = b.title
  if (mine && b.side >= 0) {
    const won = mine.side === b.side
    if (b.final) title = won ? (many ? 'Seu lado venceu' : 'Você venceu') : many ? 'Seu lado perdeu' : 'Você perdeu'
    else title = won ? (many ? 'Seu lado levou a rodada' : 'Você levou a rodada') : b.title
  }
  const score = `${sideName(0)} ${state.score[0]} – ${state.score[1]} ${sideName(1)}`
  const detail = b.side < 0 ? b.detail : b.final ? `${info().title} · ${score}` : score
  return { title, detail, side: b.side, final: b.final }
}

function Result(props: { seat: Seat }) {
  const b = bannerFor(props.seat)
  if (!b) return null
  const color = b.side >= 0 ? SIDE_COLORS[b.side] : P.ink
  const winners = b.side >= 0 ? state.fighters.filter((f: Fighter) => f.side === b.side).slice(0, MAX_PORTRAITS) : []
  return (
    <panel
      key={`faixa-${b.title}-${state.round}`}
      style={{ flow: 'down', horizontalAlign: 'center', transition: { seconds: 0.3, easing: 'out' } }}
      enter={{ opacity: 0, scale: 0.94 }}
      exit={{ opacity: 0 }}
    >
      {winners.length > 0 ? (
        <panel style={{ flow: 'right', horizontalAlign: 'center', margin: [0, 0, 8, 0] }}>
          {winners.map((f) => (
            <panel key={key(f.seat)} style={{ margin: [0, 3] }}>
              <Portrait hero={heroOf(f.seat)} size={b.final ? 60 : 48} name={f.seat.name} edge={color} />
            </panel>
          ))}
        </panel>
      ) : null}
      <L size={b.final ? 52 : 40} block color={color} shadow style={{ horizontalAlign: 'center' }}>
        {b.title}
      </L>
      <L size={20} color={P.ink} shadow style={{ horizontalAlign: 'center' }}>
        {b.detail}
      </L>
    </panel>
  )
}

function Highlights() {
  if (state.phase === 'waiting') return null
  return (
    <panel style={{ flow: 'down', horizontalAlign: 'center' }}>
      {state.callouts
        .filter((c) => state.now < c.until)
        .map((c) => (
          <Highlight key={`${c.title}-${c.until}`} callout={c} small={Boolean(state.banner && state.now < state.banner.until)} />
        ))}
    </panel>
  )
}

/** Um destaque. Sob a faixa de vitória ele fica menor, para não disputar com o resultado. */
function Highlight(props: { callout: Callout; small?: boolean }) {
  const c = props.callout
  return (
    <panel style={{ flow: 'down', horizontalAlign: 'center', margin: [props.small ? 22 : 12, 0, 0, 0], transition: { seconds: 0.25, easing: 'out' } }} enter={{ opacity: 0, scale: 1.2 }} exit={{ opacity: 0 }}>
      <L size={props.small ? 28 : 44} block color={P.brass} shadow style={{ horizontalAlign: 'center' }}>
        {c.title}
      </L>
      {c.detail ? (
        <L size={18} color={P.ink} shadow style={{ horizontalAlign: 'center' }}>
          {c.detail}
        </L>
      ) : null}
    </panel>
  )
}

/* ───────── abaixo da mira ───────── */

/** Só para a vitrine da prévia, que não tem herói de verdade: o aviso de fora do círculo a mostrar. */
export const previewOutside: { value?: { meters: number; turn: number } } = {}

/** Se a pessoa está de pé fora do círculo agora, quantos metros faltam e para onde virar. */

export function outside(seat: Seat): { meters: number; turn: number } | undefined {
  if (state.phase !== 'live' || !state.ring.center) return undefined
  const f = state.fighters.find((x) => key(x.seat) === key(seat))
  const p = seat.player.pawn()
  if (f && f.alive && !p && previewOutside.value) return previewOutside.value
  if (!f || !f.alive || !p || p.health <= 0) return undefined
  const center = state.ring.center
  const radius = currentRadius()
  if (inside(center, radius, p.position)) return undefined
  return { meters: Math.max(1, metersOutside(center, radius, p.position)), turn: turnToCenter(center, p.position, p.cameraAngles?.yaw ?? p.eyeAngles?.yaw ?? 0) }
}

/** A volta de quem caiu e a fila de quem assiste. */
export function personalLine(seat: Seat): { title: string; detail?: string } | undefined {
  if (state.phase === 'waiting') return undefined
  const f = state.fighters.find((x) => key(x.seat) === key(seat))
  if (!f) {
    if (state.phase === 'matchOver') return undefined
    const playing = new Set(state.fighters.map((x) => key(x.seat)))
    const pos = state.queue.filter((s) => !playing.has(key(s))).findIndex((s) => key(s) === key(seat)) + 1
    return pos > 0 ? { title: `Você está na fila · ${pos}ª posição`, detail: 'Você entra quando abrir vaga na próxima partida.' } : undefined
  }
  if (state.phase !== 'live' || f.alive) return undefined
  if (state.rules.timed) {
    const back = Math.ceil(f.fellAt + RESPAWN_SECONDS - state.now)
    return { title: back > 0 ? `Você volta em ${back}` : 'Voltando', detail: f.gassed ? 'Você caiu no gás.' : undefined }
  }
  return { title: 'Você caiu', detail: 'Espere a próxima rodada.' }
}

/** A seta que aponta o centro do círculo, feita de dois traços. */
function Arrow(props: { turn: number }) {
  const bar = (x: number, angle: number) => <panel style={{ x, y: 16, width: 24, height: 4, borderRadius: 2, background: P.ink, rotate: angle }} />
  return (
    <panel style={{ width: 44, height: 40, horizontalAlign: 'center', rotate: props.turn, transition: 0.1 }}>
      {bar(3, -45)}
      {bar(17, 45)}
    </panel>
  )
}

function Below(props: { seat: Seat }) {
  const out = outside(props.seat)
  if (out) {
    return (
      <panel style={{ flow: 'down', horizontalAlign: 'center' }} enter={{ opacity: 0, translate: [0, 10] }}>
        <Arrow turn={out.turn} />
        <L size={30} block color={P.warn} shadow style={{ horizontalAlign: 'center', margin: [2, 0, 0, 0] }}>
          Fora do círculo
        </L>
        <L size={18} color={P.ink} shadow style={{ horizontalAlign: 'center' }}>
          {`O gás tira ${Math.round(GAS_SHARE * 100)}% da vida por segundo (mín. ${GAS_MIN}) · ${out.meters} m até o círculo`}
        </L>
      </panel>
    )
  }
  const line = personalLine(props.seat)
  if (!line) return null
  return (
    <panel key={line.title.startsWith('Você volta') ? 'volta' : line.title} style={{ flow: 'down', horizontalAlign: 'center' }} enter={{ opacity: 0 }}>
      <L size={30} block color={P.ink} shadow style={{ horizontalAlign: 'center' }}>
        {line.title}
      </L>
      {line.detail ? (
        <L size={18} color={P.ink2} shadow style={{ horizontalAlign: 'center' }}>
          {line.detail}
        </L>
      ) : null}
    </panel>
  )
}

/** A borda de quem está no gás, pulsando. */
function Vignette() {
  return (
    <panel
      style={{ x: 0, y: 0, width: '100%', height: '100%', boxShadow: { inset: true, blur: 200, spread: 24, color: `${P.warn}8c` } }}
      enter={{ opacity: 0 }}
      exit={{ opacity: 0 }}
      cycle={{ style: { opacity: 0.45 }, seconds: 0.7 }}
    />
  )
}

/* ───────── as últimas quedas, à esquerda ───────── */

function FeedRow(props: { entry: FeedEntry }) {
  const { by, victim, gas } = props.entry
  return (
    <panel
      style={{ flow: 'right', verticalAlign: 'center', height: 38, margin: [0, 0, 5, 0], padding: [4, 12, 4, 5], ...surface, boxShadow: undefined, transition: 0.25 }}
      enter={{ opacity: 0, translate: [-24, 0] }}
      exit={{ opacity: 0 }}
    >
      {by ? <Portrait hero={by.hero} size={28} name={by.name} edge={SIDE_COLORS[by.side]} /> : null}
      <L size={16} weight="semiBold" color={by ? SIDE_COLORS[by.side] : gas ? P.warn : P.ink3} style={{ margin: [0, 8], verticalAlign: 'center' }}>
        {by ? by.name : gas ? 'Gás' : 'Caiu'}
      </L>
      <panel style={{ width: 12, height: 2, background: P.ink3, verticalAlign: 'center', margin: [0, 8, 0, 0] }} />
      <L size={16} color={P.ink3} style={{ margin: [0, 8, 0, 0], verticalAlign: 'center' }}>
        {victim.name}
      </L>
      <Portrait hero={victim.hero} size={28} name={victim.name} dim />
    </panel>
  )
}

function Feed() {
  if (state.phase === 'waiting') return null
  const rows = state.feed.filter((e) => state.now - e.at < FEED_SECONDS).slice(-FEED_SHOWN)
  if (rows.length === 0) return null
  return (
    <panel style={{ x: 34, y: FEED_TOP, flow: 'down' }}>
      {rows.map((e) => (
        <FeedRow key={`${e.at}-${e.victim.name}`} entry={e} />
      ))}
    </panel>
  )
}

/* ───────── tudo junto ───────── */

/** A tela de uma pessoa agora. */
export function Screen(props: { seat: Seat; menu: boolean; up: boolean | undefined }) {
  const { seat, menu, up } = props
  const picking = state.phase === 'waiting'
  // Com o Tab segurado na partida, o placar do jogo abre no topo: o nosso sai da frente.
  const fade = !picking && !menu && up === true
  const out = outside(seat)
  return (
    <panel style={{ width: '100%', height: '100%' }}>
      {out ? <Vignette /> : null}
      <panel style={{ x: 0, y: 0, width: '100%', height: 150, gradient: { shape: 'down', colors: ['#0c0a09cc', '#0c0a0900'] }, opacity: fade ? 0 : 1, transition: 0.2 }} />
      <panel style={{ x: 0, y: 0, width: '100%', flow: 'down' }}>
        {picking ? <PickHeader /> : <Scoreboard seat={seat} fade={fade} />}
        {picking || fade ? null : <CircleLine />}
      </panel>
      <panel style={{ x: 0, y: '21%', width: '100%', flow: 'down' }}>
        <Moment />
        <Result seat={seat} />
        <Highlights />
      </panel>
      <panel style={{ x: 0, y: '59%', width: '100%', flow: 'down' }}>
        <Below seat={seat} />
      </panel>
      <Feed />
      {picking && !menu ? <PickPanel seat={seat} cursor={up === true} /> : null}
      {picking ? null : <MatchControls seat={seat} cursor={!menu && up !== false} />}
      {menu ? <HeroMenu seat={seat} /> : null}
    </panel>
  )
}

export function drawHud(): void {
  const here = new Set(state.queue.map(key))
  for (const k of [...held.keys()]) if (!here.has(k)) held.delete(k)
  for (const k of [...hidden.keys()]) if (!here.has(k)) hidden.delete(k)

  const picking = state.phase === 'waiting'
  for (const seat of state.queue) {
    // Bots e as pessoas de mentira da vitrine não têm tela.
    if (seat.bot || seat.fake) continue
    const k = key(seat)
    const menu = state.heroMenu.has(k)
    const pawn = seat.player.pawn()
    // Sem herói (quem assistia), a pessoa não tem o Tab: o cursor fica solto para a escolha.
    holdCursor(seat, menu ? MENU_BLOCK : picking && !pawn ? PICK_BLOCK : 0n)
    hideStock(seat, menu ? PANEL_HIDE : MATCH_HIDE)
    show(seat.player, <Screen seat={seat} menu={menu} up={cursorFree(seat.player)} />)
  }
}
