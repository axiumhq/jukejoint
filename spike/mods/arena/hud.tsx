// O que cada pessoa vê, redesenhado a cada quadro (show só manda o que mudou):
// - no topo, no lugar da barra do jogo (escondida com hideHud), o placar da Arena: cada lado com
//   retrato, nome e pontos no tom do time, e no meio a rodada ou o relógio; antes da partida, quem
//   vai lutar contra quem, com a escolha (escolha.tsx) logo abaixo;
// - no meio da tela, a contagem 3, 2, 1 e o "Valendo", a faixa de quem levou a rodada ou a partida
//   e os destaques ("Primeira queda", "Sem tomar dano");
// - abaixo da mira, o aviso de quem está fora do círculo (com a borda vermelha, a distância e a
//   direção do centro), a volta de quem caiu e a posição na fila de quem assiste;
// - à esquerda, as últimas quedas e, com o Tab, o quadro de Trocar herói e Marcar o centro.
//
// A parte do HUD do jogo que não serve à Arena some (barra do topo, marca do canto, almas, números,
// avisos de nível e minimapa) e só é pedida de novo quando muda. Com a lista de heróis aberta, o
// cursor fica solto sem o Tab e os botões do mouse ficam presos, para um clique não virar tiro.
import { Buttons, cursorFree, freeCursor, hideHud, type HudPart, Meter, Pill, Pips, show, Text, theme, type Tone } from 'modlock'

import {
  type Callout,
  COUNTDOWN_SECONDS,
  currentRadius,
  FEED_SECONDS,
  type FeedEntry,
  type Fighter,
  info,
  key,
  perSideFor,
  resolveRules,
  RESPAWN_SECONDS,
  type Seat,
  SHRINK_FROM,
  sideName,
  sideOf,
  state,
  TEAM_NAMES,
  VARIANTS,
} from './arena'
import { GAS_SHARE, inside, metersOutside, MIN_FRACTION, turnToCenter } from './circulo'
import { clock, HeroMenu, heroOf, heroTitle, MatchControls, PickOverlay, Portrait } from './escolha'

const { tones } = theme

/** Os pontos só viram marcadores até este alvo; acima disso, só o número. */
const MAX_PIPS = 7
/** Nos times, quantos retratos de cada lado o placar mostra. */
const MAX_PORTRAITS = 6
/** O tom de cada lado: o lado 0 joga no time 2 (âmbar), o lado 1 no time 3 (safira). */
export const SIDE_TONES: readonly Tone[] = ['amber', 'sapphire']
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
  tone: Tone
  people: Person[]
  score: number
}

/** Quem está em cada lado: na partida, quem luta; antes dela, quem vai lutar com esta fila. */
function members(): { seat: Seat; side: number; down: boolean }[] {
  if (state.phase !== 'waiting') return state.fighters.map((f) => ({ seat: f.seat, side: f.side, down: !f.alive && isLive() }))
  const rules = resolveRules()
  const n = perSideFor(rules.variant, state.queue.length)
  if (n === 0) return state.queue.slice(0, 1).map((seat) => ({ seat, side: 0, down: false }))
  return state.queue.slice(0, 2 * n).map((seat, i) => ({ seat, side: sideOf(i, n, rules.variant), down: false }))
}

function isLive(): boolean {
  return state.phase === 'live' || state.phase === 'roundOver'
}

function mixed(): boolean {
  return VARIANTS[state.phase === 'waiting' ? resolveRules().variant : state.rules.variant].mixed
}

/** Os dois lados como o placar mostra a quem olha: o lado da pessoa (ou o lado 0) à esquerda. */
export function sideViews(viewer: Seat): [SideView, SideView] {
  const all = members()
  const mine = all.find((m) => key(m.seat) === key(viewer))
  const near = mine?.side ?? 0
  const view = (side: number): SideView => {
    const list = all.filter((m) => m.side === side)
    const people = list.map((m) => ({ name: m.seat.name, hero: heroOf(m.seat), down: m.down, self: key(m.seat) === key(viewer) }))
    let label: string
    let sub: string | undefined
    if (list.length === 0) label = 'Falta alguém'
    else if (mixed()) {
      label = TEAM_NAMES[side]
      const up = people.filter((p) => !p.down).length
      sub = isLive() ? `${up} de pé` : `${people.length} ${people.length === 1 ? 'pessoa' : 'pessoas'}`
    } else {
      label = state.phase === 'waiting' ? people.map((p) => p.name).join(' e ') : sideName(side)
      sub = people.length === 1 ? heroTitle(people[0].hero) : undefined
    }
    return { side, label, sub, tone: SIDE_TONES[side], people, score: state.phase === 'waiting' ? 0 : state.score[side] }
  }
  return [view(near), view(1 - near)]
}

/** A linha sobre o placar: o jeito de jogar, como se vence e o herói do espelho. */
export function heading(): string {
  if (state.phase === 'waiting') return 'Arena · próxima partida'
  const parts: string[] = [info().title, state.rules.timed ? 'com tempo' : `até ${state.rules.target}`]
  if (info().mirror && state.heroTitle) parts.push(state.heroTitle)
  return parts.join(' · ')
}

/** O meio do placar: o relógio com tempo, a rodada sem tempo, "contra" antes da partida. */
export function middle(): { main: string; sub: string | undefined } {
  if (state.phase === 'waiting') return { main: 'contra', sub: undefined }
  const live = state.phase === 'live'
  if (state.rules.timed) return { main: clock(live ? state.endsAt - state.now : state.rules.seconds), sub: undefined }
  return { main: `Rodada ${state.round || 1}`, sub: live ? clock(state.endsAt - state.now) : undefined }
}

function SideBlock(props: { view: SideView; align: 'left' | 'right' }) {
  const { view, align } = props
  const many = view.people.length > 2
  const size = many ? 34 : 46
  const portraits = (
    <panel style={{ flow: 'right', verticalAlign: 'center' }}>
      {view.people.slice(0, MAX_PORTRAITS).map((p, i) => (
        <panel key={`${p.name}-${i}`} style={{ margin: [0, 2] }}>
          <Portrait hero={p.hero} size={size} edge={p.self ? tones.text : tones[view.tone]} dim={p.down} />
        </panel>
      ))}
    </panel>
  )
  const names = (
    <panel style={{ flow: 'down', verticalAlign: 'center', margin: align === 'right' ? [0, 10, 0, 0] : [0, 0, 0, 10], maxWidth: 220 }}>
      <Text
        role="label"
        tone={view.tone}
        style={{ horizontalAlign: align, textAlign: align, fontSize: 18, letterSpacing: 1, noWrap: true, textOverflow: 'ellipsis' }}
      >
        {view.label}
      </Text>
      {view.sub ? (
        <Text role="caption" tone="muted" style={{ horizontalAlign: align, textAlign: align }}>
          {view.sub}
        </Text>
      ) : null}
    </panel>
  )
  return (
    <panel style={{ flow: 'right', width: 330, verticalAlign: 'center' }}>
      {align === 'right' ? <panel style={{ width: 'fill' }} /> : null}
      {align === 'right' ? names : portraits}
      {align === 'right' ? portraits : names}
    </panel>
  )
}

function ScoreNumber(props: { view: SideView; show: boolean }) {
  return (
    <panel style={{ width: 70, verticalAlign: 'center' }}>
      {props.show ? (
        <Text role="display" tone={props.view.tone} style={{ fontSize: 44 }}>
          {props.view.score}
        </Text>
      ) : null}
    </panel>
  )
}

export function Scoreboard(props: { seat: Seat; fade: boolean }) {
  const [near, far] = sideViews(props.seat)
  const mid = middle()
  const waiting = state.phase === 'waiting'
  const pips = !waiting && !state.rules.timed && state.rules.target <= MAX_PIPS
  return (
    <panel
      style={{ flow: 'down', horizontalAlign: 'center', margin: [12, 0, 0, 0], opacity: props.fade ? 0 : 1, transition: 0.2 }}
    >
      <Text role="label" style={{ letterSpacing: 2 }}>
        {heading()}
      </Text>
      <panel style={{ flow: 'right', verticalAlign: 'center', margin: [6, 0, 0, 0] }}>
        <SideBlock view={near} align="right" />
        <ScoreNumber view={near} show={!waiting} />
        <panel style={{ flow: 'down', width: 140, horizontalAlign: 'center', verticalAlign: 'center' }}>
          <Pill style={{ minWidth: 112 }}>
            <Text role={state.rules.timed && !waiting ? 'title' : 'label'} plated style={{ margin: [2, 8] }}>
              {mid.main}
            </Text>
          </Pill>
          {mid.sub ? (
            <Text role="caption" tone="muted" style={{ margin: [3, 0, 0, 0] }}>
              {mid.sub}
            </Text>
          ) : null}
        </panel>
        <ScoreNumber view={far} show={!waiting} />
        <SideBlock view={far} align="left" />
      </panel>
      {pips ? (
        <panel style={{ flow: 'right', horizontalAlign: 'center', margin: [4, 0, 0, 0] }}>
          <Pips filled={near.score} total={state.rules.target} tone={near.tone} mirror style={{ margin: [0, 34, 0, 0] }} />
          <Pips filled={far.score} total={state.rules.target} tone={far.tone} style={{ margin: [0, 0, 0, 34] }} />
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
    <panel style={{ flow: 'down', horizontalAlign: 'center', margin: [8, 0, 0, 0] }}>
      <Text role="label" tone="accent" style={{ letterSpacing: 1 }}>
        {c.text}
      </Text>
      {c.value !== undefined ? <Meter value={c.value} tone="accent" width={200} height={6} style={{ margin: [4, 0, 0, 0] }} /> : null}
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
  return (
    <panel
      key={m.key}
      style={{ flow: 'down', horizontalAlign: 'center', transition: { seconds: 0.3, easing: 'out' } }}
      enter={{ opacity: 0, scale: m.big ? 1.7 : 1.25 }}
      exit={{ opacity: 0 }}
    >
      {m.big && m.detail ? (
        <Text role="label" style={{ letterSpacing: 2 }}>
          {m.detail}
        </Text>
      ) : null}
      <Text role="display" tone={m.title === 'Valendo' ? 'gold' : 'text'} style={{ fontSize: m.big ? 128 : 64, lineHeight: m.big ? 132 : 70 }}>
        {m.title}
      </Text>
      {!m.big && m.detail ? (
        <Text role="body" tone="muted">
          {m.detail}
        </Text>
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
  const tone: Tone = b.side >= 0 ? SIDE_TONES[b.side] : 'text'
  const winners = b.side >= 0 ? state.fighters.filter((f: Fighter) => f.side === b.side).slice(0, MAX_PORTRAITS) : []
  return (
    <panel
      key={`faixa-${b.title}-${state.round}`}
      style={{
        flow: 'down',
        horizontalAlign: 'center',
        padding: [16, 70],
        gradient: { shape: 'radial', colors: [`${tones[tone]}38`, '#00000000'] },
        transition: { seconds: 0.3, easing: 'out' },
      }}
      enter={{ opacity: 0, scale: 0.92 }}
      exit={{ opacity: 0 }}
    >
      {winners.length > 0 ? (
        <panel style={{ flow: 'right', horizontalAlign: 'center', margin: [0, 0, 8, 0] }}>
          {winners.map((f) => (
            <panel key={key(f.seat)} style={{ margin: [0, 3] }}>
              <Portrait hero={heroOf(f.seat)} size={b.final ? 64 : 52} edge={tones[tone]} />
            </panel>
          ))}
        </panel>
      ) : null}
      <Text role="display" tone={tone} style={{ fontSize: b.final ? 56 : 42 }}>
        {b.title}
      </Text>
      <Text role="body">{b.detail}</Text>
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
          <Highlight key={`${c.title}-${c.until}`} callout={c} />
        ))}
    </panel>
  )
}

function Highlight(props: { callout: Callout }) {
  const c = props.callout
  return (
    <panel
      key={`destaque-${c.title}-${c.until}`}
      style={{ flow: 'down', horizontalAlign: 'center', margin: [10, 0, 0, 0], transition: { seconds: 0.25, easing: 'out' } }}
      enter={{ opacity: 0, scale: 1.3 }}
      exit={{ opacity: 0 }}
    >
      <Text role="display" tone="gold" style={{ fontSize: 54 }}>
        {c.title}
      </Text>
      {c.detail ? <Text role="body">{c.detail}</Text> : null}
    </panel>
  )
}

/* ───────── abaixo da mira ───────── */

/** Se a pessoa está de pé fora do círculo agora, quantos metros faltam e para onde virar. */
export function outside(seat: Seat): { meters: number; turn: number } | undefined {
  if (state.phase !== 'live' || !state.ring.center) return undefined
  const f = state.fighters.find((x) => key(x.seat) === key(seat))
  const p = seat.player.pawn()
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
    return pos > 0 ? { title: `Você está na fila · ${pos}ª posição`, detail: 'Você entra quando esta partida acabar.' } : undefined
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
  const bar = (x: number, angle: number) => (
    <panel style={{ x, y: 16, width: 24, height: 5, borderRadius: 2, background: tones.text, rotate: angle }} />
  )
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
        <Text role="title" tone="danger" style={{ margin: [2, 0, 0, 0] }}>
          Fora do círculo
        </Text>
        <Text role="body">{`O gás tira ${Math.round(GAS_SHARE * 100)}% da vida por segundo · ${out.meters} m até o círculo`}</Text>
      </panel>
    )
  }
  const line = personalLine(props.seat)
  if (!line) return null
  return (
    <panel key={line.title.startsWith('Você volta') ? 'volta' : line.title} style={{ flow: 'down', horizontalAlign: 'center' }} enter={{ opacity: 0 }}>
      <Text role="title">{line.title}</Text>
      {line.detail ? (
        <Text role="body" tone="muted">
          {line.detail}
        </Text>
      ) : null}
    </panel>
  )
}

/** A borda vermelha de quem está no gás, pulsando. */
function Vignette() {
  return (
    <panel
      style={{
        x: 0,
        y: 0,
        width: '100%',
        height: '100%',
        boxShadow: { inset: true, blur: 200, spread: 24, color: `${tones.danger}8c` },
      }}
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
      key={`${props.entry.at}-${victim.name}`}
      style={{
        flow: 'right',
        verticalAlign: 'center',
        height: 36,
        margin: [0, 0, 4, 0],
        padding: [4, 12, 4, 4],
        background: '#000000b8',
        borderRadius: 4,
        transition: 0.25,
      }}
      enter={{ opacity: 0, translate: [-30, 0] }}
      exit={{ opacity: 0 }}
    >
      {by ? <Portrait hero={by.hero} size={28} edge={tones[SIDE_TONES[by.side]]} /> : null}
      <Text role="label" tone={by ? SIDE_TONES[by.side] : gas ? 'danger' : 'muted'} plated style={{ margin: [0, 8], verticalAlign: 'center' }}>
        {by ? by.name : gas ? 'Gás' : 'Caiu'}
      </Text>
      <panel style={{ width: 12, height: 2, background: tones.muted, verticalAlign: 'center', margin: [0, 8, 0, 0] }} />
      <Text role="label" tone="muted" plated style={{ margin: [0, 8, 0, 0], verticalAlign: 'center' }}>
        {victim.name}
      </Text>
      <Portrait hero={victim.hero} size={28} dim />
    </panel>
  )
}

function Feed() {
  if (state.phase === 'waiting') return null
  const rows = state.feed.filter((e) => state.now - e.at < FEED_SECONDS).slice(-FEED_SHOWN)
  if (rows.length === 0) return null
  return (
    <panel style={{ x: 0, y: FEED_TOP, flow: 'down' }}>
      {rows.map((e) => (
        <FeedRow key={`${e.at}-${e.victim.name}`} entry={e} />
      ))}
    </panel>
  )
}

/* ───────── tudo junto ───────── */

export function drawHud(): void {
  const here = new Set(state.queue.map(key))
  for (const k of [...held.keys()]) if (!here.has(k)) held.delete(k)
  for (const k of [...hidden.keys()]) if (!here.has(k)) hidden.delete(k)

  const picking = state.phase === 'waiting'
  for (const seat of state.queue) {
    if (seat.bot) continue
    const k = key(seat)
    const menu = state.heroMenu.has(k)
    const pawn = seat.player.pawn()
    // Sem herói (quem assistia), a pessoa não tem o Tab: o cursor fica solto para a escolha.
    holdCursor(seat, menu ? MENU_BLOCK : picking && !pawn ? PICK_BLOCK : 0n)
    hideStock(seat, menu ? PANEL_HIDE : MATCH_HIDE)

    const up = cursorFree(seat.player)
    // Com o Tab segurado na partida, o placar do jogo abre no topo: o nosso sai da frente.
    const fade = !picking && !menu && up === true
    const out = outside(seat)
    show(
      seat.player,
      <panel style={{ width: '100%', height: '100%' }}>
        {out ? <Vignette /> : null}
        <panel
          style={{
            x: 0,
            y: 0,
            width: '100%',
            height: 170,
            gradient: { shape: 'down', colors: ['#000000a6', '#00000000'] },
            opacity: fade ? 0 : 1,
            transition: 0.2,
          }}
        />
        <panel style={{ x: 0, y: 0, width: '100%', flow: 'down' }}>
          <Scoreboard seat={seat} fade={fade} />
          {picking && !menu ? <PickOverlay seat={seat} cursor={up === true} /> : null}
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
        {picking ? null : <MatchControls seat={seat} cursor={!menu && up !== false} />}
        {menu ? <HeroMenu seat={seat} /> : null}
      </panel>,
    )
  }
}
