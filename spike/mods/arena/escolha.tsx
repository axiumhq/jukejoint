// A escolha da Arena e os botões durante a partida. Ninguém precisa digitar nada no chat:
// - antes de cada partida, um quadro compacto logo abaixo do placar, como num modo do próprio jogo:
//   os jeitos de jogar, o tempo e os pontos em botões curtos, cada um com quantos votos tem; a
//   regra do mais votado em uma linha; quem está na sala com o herói de cada um; os bots de treino
//   e o Pronto. Todo mundo anda pelo mapa enquanto isso e segura o Tab para clicar. Cada pessoa
//   vota em cada grupo; a partida começa quando todo mundo aperta Pronto;
// - a lista de heróis abre por cima, pelo botão do herói (ou por Trocar herói na partida), com o
//   retrato grande do herói escolhido ao lado da grade;
// - durante a partida, com o Tab, um quadro pequeno à esquerda troca o herói da próxima rodada e,
//   para quem chegou primeiro à sala, marca o centro do círculo.
// As regras e o estado ficam em arena.ts; aqui só o desenho e os botões que chamam as regras.
import { Action, type Hero, findHero, heroes, type Player, Text, theme } from 'modlock'

import {
  BEGIN_SECONDS,
  botCount,
  botRoom,
  canChoose,
  type Choice,
  chooseVariant,
  chosenHero,
  closeHeroMenu,
  fixed,
  isHost,
  isReady,
  key,
  markArena,
  missingFor,
  myVote,
  openHeroMenu,
  perSideFor,
  pickHero,
  POINT_CHOICES,
  readyCount,
  removeBots,
  resolveRules,
  type Rules,
  type Seat,
  setPoints,
  setTimed,
  state,
  toggleReady,
  trainingBot,
  type Variant,
  VARIANTS,
  voteCounts,
  voters,
} from './arena'

const { tones, shades, sizes, sounds } = theme

/** A largura do quadro da escolha, num HUD de 1080 de altura (cabe também em 1366×768). */
export const OVERLAY_WIDTH = 800
/** O fundo dos quadros sobre o mapa: escuro o bastante para ler sobre um céu claro. */
const FILL = '#0b0d09d9'
/** O fundo de um botão curto parado. */
const CHIP_FILL = '#000000a6'

/** Cada jeito: quantas pessoas de cada lado e a regra em uma linha. */
export const CARDS: Record<Variant, { sides: string; rule: string }> = {
  duelo: { sides: '1 contra 1', rule: 'Quem fizer os pontos primeiro vence.' },
  dupla: { sides: '2 contra 2', rule: 'A rodada acaba quando a dupla inteira cai.' },
  times: { sides: 'até 6 contra 6', rule: 'Os times se misturam; 3 rodadas vencem.' },
  espelho: { sides: 'até 6 contra 6', rule: 'Todo mundo com o mesmo herói, sorteado a cada rodada.' },
}

const ORDER: readonly Variant[] = ['duelo', 'dupla', 'times', 'espelho']

export function clock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function minutes(r: Rules): string {
  const m = Math.round(r.seconds / 60)
  return m === 1 ? '1 minuto' : `${m} minutos`
}

/** O herói que a pessoa vai usar: o escolhido na tela ou o que ela já tem (0 sem nenhum). */
export function heroOf(seat: Seat): number {
  const chosen = state.chosen.get(key(seat))
  const hero = chosen ? findHero(chosen) : undefined
  return hero?.id ?? seat.player.pawn()?.hero ?? 0
}

export function heroTitle(id: number): string | undefined {
  return id ? heroes.find((h) => h.id === id)?.title : undefined
}

/* ───────── peças ───────── */

/**
 * Um botão de voto em capitulares: o valor que a votação dá fica cheio no tom de destaque, o voto
 * da própria pessoa ganha a borda clara, e ao lado do nome vai quantos votos ele tem.
 */
function VoteChip(props: {
  label: string
  /** O valor que vale agora pela votação (ou pelo lobby, ou pelo servidor). */
  leading: boolean
  /** O voto da própria pessoa. */
  mine: boolean
  count: number
  disabled: boolean
  tooltip?: string
  /** Quantas pessoas faltam para este jeito começar. */
  missing?: number
  onPress: (player: Player) => void
}) {
  const { leading, mine, count, disabled } = props
  const ink = leading ? tones.onAccent : tones.text
  return (
    <button
      disabled={disabled}
      tooltip={mine ? `${props.tooltip ? `${props.tooltip} ` : ''}Seu voto.` : props.tooltip}
      onPress={props.onPress}
      sound={disabled ? undefined : sounds.press}
      hoverSound={disabled ? undefined : sounds.hover}
      style={{
        flow: 'right',
        height: 30,
        padding: [0, 12],
        margin: [0, 3],
        borderRadius: sizes.radius,
        background: leading ? tones.accent : CHIP_FILL,
        borderWidth: mine ? 2 : 1,
        borderColor: mine ? tones.text : leading ? tones.accent : shades.faint,
        opacity: disabled && !leading ? 0.5 : 1,
        transition: 0.15,
      }}
      hover={disabled ? undefined : { background: leading ? tones.accent : shades.lit, borderColor: tones.text }}
    >
      <label style={{ face: 'block', fontSize: 15, uppercase: true, letterSpacing: 1, color: ink, verticalAlign: 'center', noWrap: true }}>
        {props.label}
      </label>
      {count > 0 ? (
        <label
          style={{
            face: 'block',
            fontSize: 12,
            color: ink,
            background: leading ? '#00000026' : shades.lit,
            borderRadius: 3,
            padding: [1, 5],
            margin: [0, 0, 0, 8],
            verticalAlign: 'center',
          }}
        >
          {count}
        </label>
      ) : null}
      {props.missing ? (
        <label style={{ face: 'body', fontSize: 12, color: leading ? tones.onAccent : tones.muted, margin: [0, 0, 0, 8], verticalAlign: 'center', noWrap: true }}>
          {`faltam ${props.missing}`}
        </label>
      ) : null}
    </button>
  )
}

/** Um grupo de votos: cada valor vira um botão com a contagem dele. */
function Votes<T>(props: {
  seat: Seat
  choice: Choice
  values: readonly T[]
  current: T
  label: (value: T) => string
  tooltip?: (value: T) => string
  missing?: (value: T) => number
  onPress: (player: Player, value: T) => void
}) {
  const me = props.seat.player
  const counts = voteCounts(props.choice)
  const mine = myVote(me, props.choice)
  const disabled = !canChoose(me, props.choice)
  return (
    <panel style={{ flow: 'right', verticalAlign: 'center' }}>
      {props.values.map((value) => (
    <VoteChip
      key={String(value)}
      label={props.label(value)}
      tooltip={props.tooltip?.(value)}
      leading={value === props.current}
      mine={mine === String(value)}
      count={counts.get(String(value)) ?? 0}
      disabled={disabled}
      missing={props.missing?.(value)}
      onPress={(p) => props.onPress(p, value)}
    />
      ))}
    </panel>
  )
}

/** Pronto: liga e desliga. Depois de uma partida, o mesmo botão diz "Jogar de novo". */
function ReadyButton(props: { on: boolean }) {
  const { on } = props
  return (
    <button
      tooltip={on ? 'Clique de novo para tirar o pronto.' : undefined}
      onPress={(p) => toggleReady(p)}
      sound={sounds.press}
      hoverSound={sounds.hover}
      style={{
        width: 200,
        height: 40,
        borderRadius: sizes.radius,
        background: on ? tones.accent : tones.text,
        borderWidth: 1,
        borderColor: on ? tones.accent : tones.text,
        transition: 0.15,
      }}
      hover={{ background: on ? tones.accent : shades.white, brightness: on ? 1.1 : 1 }}
    >
      <label style={{ face: 'block', fontSize: 17, uppercase: true, letterSpacing: 1, color: tones.onAccent, horizontalAlign: 'center', verticalAlign: 'center', noWrap: true }}>
        {on ? 'Pronto' : state.lastText ? 'Jogar de novo' : 'Pronto'}
      </label>
    </button>
  )
}

/** Um retrato pequeno e quadrado, ou um quadrado vazio sem herói. */
export function Portrait(props: { hero: number; size: number; edge?: string; dim?: boolean }) {
  const { hero, size, edge, dim } = props
  const style = {
    width: size,
    height: size,
    borderRadius: sizes.radius,
    borderWidth: edge ? 2 : 1,
    borderColor: edge ?? shades.hairline,
    background: shades.raised,
    saturation: dim ? 0 : 1,
    opacity: dim ? 0.35 : 1,
    transition: 0.25,
  }
  return hero ? <hero hero={hero} look="small" scaling="cover" style={style} /> : <panel style={style} />
}

/** Uma pessoa na sala: o retrato do herói, o nome, o herói e se está pronta. */
function RoomEntry(props: { seat: Seat; me: boolean }) {
  const { seat, me } = props
  const hero = heroOf(seat)
  const ready = state.ready.has(key(seat))
  const tag = seat.bot ? 'bot de treino' : `${heroTitle(hero) ?? 'sem herói'}${ready ? ' · pronto' : ''}`
  return (
    <panel style={{ flow: 'right', verticalAlign: 'center', margin: [0, 14, 6, 0] }}>
      <Portrait hero={hero} size={30} edge={ready ? tones.success : me ? tones.text : undefined} />
      <panel style={{ flow: 'down', margin: [0, 0, 0, 8], verticalAlign: 'center' }}>
        <Text role="body" plated style={{ horizontalAlign: 'left', textAlign: 'left', fontSize: 15 }}>
          {seat.name}
        </Text>
        <Text role="caption" tone={ready ? 'success' : 'muted'} plated style={{ horizontalAlign: 'left', textAlign: 'left', fontSize: 12 }}>
          {tag}
        </Text>
      </panel>
    </panel>
  )
}

/** A linha de quem vai lutar: quantos de cada lado e quantas pessoas esperam. */
export function lineup(r: Rules): string {
  const queued = state.queue.length
  if (queued < 2) return 'Falta mais uma pessoa (ou um bot) para começar.'
  const missing = missingFor(r.variant)
  if (missing > 0) return `${queued} na sala: ${VARIANTS[r.variant].title} precisa de mais ${missing}.`
  const n = perSideFor(r.variant, queued)
  const waiting = queued - 2 * n
  const rest = waiting === 0 ? '' : waiting === 1 ? ', e 1 pessoa espera na fila' : `, e ${waiting} pessoas esperam na fila`
  return `${queued} na sala: vai ser ${n} contra ${n}${rest}.`
}

/** A regra da próxima partida em uma linha. */
export function ruleLine(r: Rules): string {
  const card = CARDS[r.variant]
  const win = r.timed ? `Vence quem fizer mais pontos em ${minutes(r)}.` : `Vence quem levar ${r.target} rodadas.`
  const mirror = VARIANTS[r.variant].mirror ? ' No espelho, o herói é sorteado a cada rodada, o mesmo para todo mundo.' : ''
  return `${VARIANTS[r.variant].title}, ${card.sides} · ${win}${mirror}`
}

/** A linha grande do quadro: falta gente, quantos estão prontos, ou a contagem "Começando". */
export function readyLine(): string {
  if (state.auto) return 'A partida começa sozinha'
  if (state.beginAt !== undefined) return `Começando em ${Math.max(1, Math.ceil(state.beginAt - state.now))}`
  const missing = Math.max(2 - state.queue.length, missingFor(resolveRules().variant))
  if (missing > 0) return missing === 1 ? 'Falta mais uma pessoa' : `Faltam ${missing} pessoas`
  return `${readyCount()} de ${voters().length} ${voters().length === 1 ? 'pronto' : 'prontos'}`
}

/* ───────── a escolha, debaixo do placar ───────── */

export function PickOverlay(props: { seat: Seat; cursor: boolean }) {
  const me = props.seat.player
  const rules = resolveRules()
  const v = VARIANTS[rules.variant]
  const locked = fixed('variante') || fixed('tempo')
  const room = botRoom()
  const bots = botCount()
  const myHero = chosenHero(me)
  const myHeroTitle = myHero ? findHero(myHero)?.title : undefined
  const shown = state.queue.slice(0, 8)
  const points = [...new Set<number>([...POINT_CHOICES, rules.target])].sort((a, b) => a - b)
  const starting = state.beginAt !== undefined

  return (
    <panel
      style={{
        flow: 'down',
        width: OVERLAY_WIDTH,
        horizontalAlign: 'center',
        margin: [10, 0, 0, 0],
        padding: [12, 16],
        background: FILL,
        borderRadius: sizes.panelRadius,
        borderWidth: 1,
        borderColor: shades.hairline,
      }}
      enter={{ opacity: 0, translate: [0, -8] }}
    >
      <panel style={{ flow: 'right', horizontalAlign: 'center' }}>
        <Votes
          seat={props.seat}
          choice="variante"
          values={ORDER}
          current={rules.variant}
          label={(x) => VARIANTS[x].title}
          tooltip={(x) => `${CARDS[x].sides} · ${CARDS[x].rule}`}
          missing={(x) => missingFor(x)}
          onPress={(p, x) => chooseVariant(p, x)}
        />
      </panel>
      <panel style={{ flow: 'right', horizontalAlign: 'center', verticalAlign: 'center', margin: [8, 0, 0, 0] }}>
        <Votes
          seat={props.seat}
          choice="tempo"
          values={[false, true]}
          current={rules.timed}
          label={(on) => (on ? `Com tempo ${clock(rules.seconds)}` : 'Por rodadas')}
          tooltip={(on) => (on ? 'O círculo fecha durante a partida inteira; quem cai volta em instantes.' : 'Quem cai espera a próxima rodada.')}
          onPress={(p, on) => setTimed(p, on)}
        />
        {v.perSide <= 2 && !rules.timed ? (
          <panel style={{ flow: 'right', verticalAlign: 'center', margin: [0, 0, 0, 12] }}>
            <Votes
              seat={props.seat}
              choice="pontos"
              values={points}
              current={rules.target}
              label={(n) => `Até ${n}`}
              tooltip={(n) => `Vence quem fizer ${n} pontos primeiro.`}
              onPress={(p, n) => setPoints(p, n)}
            />
          </panel>
        ) : null}
        {v.mirror ? null : (
          <panel style={{ flow: 'right', margin: [0, 0, 0, 12] }}>
            <VoteChip
              label={myHeroTitle ? `Herói · ${myHeroTitle}` : 'Escolher herói'}
              tooltip={myHeroTitle ? `${myHeroTitle}, a partir da primeira rodada` : 'Sem escolha, fica o herói que você já tem'}
              leading={false}
              mine={false}
              count={0}
              disabled={false}
              onPress={(p) => openHeroMenu(p)}
            />
          </panel>
        )}
      </panel>

      <Text role="caption" plated style={{ margin: [8, 0, 0, 0] }}>
        {locked ? `${ruleLine(rules)} Jeito definido pelo servidor.` : ruleLine(rules)}
      </Text>
      <Text role="caption" tone="muted" plated>
        {locked ? 'O servidor definiu o jeito de jogar.' : props.cursor ? 'Clique para votar; clique de novo para tirar o voto.' : 'Segure Tab e clique para votar'}
      </Text>

      <panel style={{ width: '100%', height: 1, background: shades.hairline, margin: [10, 0, 8, 0] }} />

      <panel style={{ flow: 'right', width: '100%', verticalAlign: 'center' }}>
        <Text role="label" plated style={{ horizontalAlign: 'left', margin: [0, 12, 0, 0], verticalAlign: 'center' }}>
          Na sala
        </Text>
        <panel style={{ flow: 'rightWrap', width: 'fill' }}>
          {shown.map((s) => (
            <RoomEntry key={key(s)} seat={s} me={key(s) === key(props.seat)} />
          ))}
          {state.queue.length > shown.length ? (
            <Text role="caption" tone="muted" plated style={{ verticalAlign: 'center' }}>
              {`e mais ${state.queue.length - shown.length}`}
            </Text>
          ) : null}
        </panel>
      </panel>
      <Text role="caption" tone="muted" plated style={{ horizontalAlign: 'left', textAlign: 'left' }}>
        {lineup(rules)}
      </Text>

      <panel style={{ flow: 'right', width: '100%', verticalAlign: 'center', margin: [10, 0, 0, 0] }}>
        <panel style={{ flow: 'down', width: 'fill', verticalAlign: 'center' }}>
          <Text
            role="title"
            tone={starting ? 'accent' : 'text'}
            plated
            style={{ horizontalAlign: 'left', textAlign: 'left', noWrap: true, textOverflow: 'shrink', width: '100%' }}
          >
            {readyLine()}
          </Text>
          {starting ? (
            <Text role="caption" tone="muted" plated style={{ horizontalAlign: 'left', textAlign: 'left' }}>
              {`Se alguém tirar o pronto, a contagem de ${BEGIN_SECONDS} para.`}
            </Text>
          ) : null}
        </panel>
        {room > 0 ? (
          <Action kind="secondary" onPress={(p) => trainingBot(p)} style={{ margin: [0, 8, 0, 0] }}>
            {bots === 0 ? 'Treinar com um bot' : 'Mais um bot'}
          </Action>
        ) : null}
        {bots > 0 ? (
          <Action kind="quiet" onPress={(p) => removeBots(p)} style={{ margin: [0, 8, 0, 0] }}>
            Tirar os bots
          </Action>
        ) : null}
        {isHost(me) && me.pawn() ? (
          <Action kind="quiet" onPress={(p) => markArena(p)} style={{ margin: [0, 8, 0, 0] }}>
            Marcar o centro aqui
          </Action>
        ) : null}
        {state.auto || props.seat.bot ? null : <ReadyButton on={isReady(me)} />}
      </panel>

      {state.lastText ? (
        <panel style={{ flow: 'right', horizontalAlign: 'center', margin: [8, 0, 0, 0] }}>
          <Text role="caption" tone="muted" plated style={{ margin: [0, 6, 0, 0] }}>
            Última partida
          </Text>
          <Text role="caption" plated>
            {state.lastText}
          </Text>
        </panel>
      ) : null}
    </panel>
  )
}

/* ───────── a lista de heróis ───────── */

function HeroCell(props: { hero: Hero; mine: boolean; onPick: (player: Player) => void }) {
  const { hero, mine, onPick } = props
  return (
    <button
      tooltip={hero.title}
      onPress={onPick}
      sound={sounds.press}
      hoverSound={sounds.hover}
      style={{
        flow: 'down',
        width: 68,
        margin: [0, 6, 8, 0],
        padding: 3,
        borderRadius: sizes.radius,
        background: mine ? shades.lit : shades.raised,
        borderWidth: 2,
        borderColor: mine ? tones.accent : shades.clear,
        transition: 0.15,
      }}
      hover={mine ? undefined : { background: shades.lit, borderColor: shades.faint }}
    >
      <hero hero={hero.id} look="vertical" scaling="cover" style={{ width: '100%', height: 78, borderRadius: 3, brightness: mine ? 1.05 : 0.9 }} />
      <label
        style={{
          face: 'body',
          fontSize: 12,
          color: mine ? tones.accent : tones.text,
          width: '100%',
          horizontalAlign: 'center',
          textAlign: 'center',
          noWrap: true,
          textOverflow: 'shrink',
          margin: [3, 0, 0, 0],
        }}
      >
        {hero.title}
      </label>
    </button>
  )
}

/**
 * A lista de heróis, por cima de tudo: a grade com o nome de cada um e, ao lado, o retrato grande
 * do escolhido. Na escolha vale da primeira rodada; na partida, da próxima.
 */
export function HeroMenu(props: { seat: Seat }) {
  const me = props.seat.player
  const picking = state.phase === 'waiting'
  const mine = chosenHero(me)
  const id = heroOf(props.seat)
  const title = heroTitle(id)
  const gridWidth = 700
  return (
    <panel style={{ x: 0, y: 0, width: '100%', height: '100%', background: '#0b0d0980' }}>
      <panel
        style={{
          flow: 'down',
          horizontalAlign: 'center',
          verticalAlign: 'center',
          padding: [22, 26],
          background: shades.veil,
          borderRadius: sizes.panelRadius,
          borderWidth: 1,
          borderColor: shades.hairline,
        }}
        enter={{ opacity: 0, scale: 0.97 }}
      >
        <panel style={{ flow: 'right', width: '100%', verticalAlign: 'bottom' }}>
          <Text role="title" plated style={{ horizontalAlign: 'left' }}>
            {picking ? 'Seu herói' : 'Trocar herói'}
          </Text>
          <Text role="caption" tone="muted" plated style={{ margin: [0, 0, 3, 14] }}>
            {picking ? 'Vale a partir da primeira rodada.' : 'O novo herói entra na próxima rodada.'}
          </Text>
        </panel>
        <panel style={{ flow: 'right', margin: [14, 0, 0, 0] }}>
          <panel style={{ flow: 'down', width: 230, margin: [0, 22, 0, 0] }}>
            {id ? (
              <hero hero={id} look="card" scaling="cover" style={{ width: 230, height: 320, borderRadius: sizes.panelRadius, borderWidth: 1, borderColor: shades.hairline }} />
            ) : (
              <panel style={{ width: 230, height: 320, borderRadius: sizes.panelRadius, background: shades.plate, borderWidth: 1, borderColor: shades.hairline }} />
            )}
            <Text role="title" tone={mine ? 'accent' : 'text'} plated style={{ margin: [10, 0, 0, 0] }}>
              {title ?? 'Sem herói'}
            </Text>
            <Text role="caption" tone="muted" plated>
              {mine ? 'Escolhido' : 'O herói que você tem agora'}
            </Text>
          </panel>
          <panel style={{ flow: 'rightWrap', width: gridWidth, maxHeight: 620, overflowY: 'scroll' }}>
            {heroes.map((h) => (
              <HeroCell key={h.name} hero={h} mine={mine === h.name} onPick={(p) => pickHero(p, h.name)} />
            ))}
          </panel>
        </panel>
        <panel style={{ flow: 'right', width: '100%', margin: [12, 0, 0, 0] }}>
          <panel style={{ width: 'fill' }} />
          <Action kind="secondary" onPress={(p) => closeHeroMenu(p)}>
            Fechar
          </Action>
        </panel>
      </panel>
    </panel>
  )
}

/* ───────── durante a partida ───────── */

/** Onde fica o quadro do Tab: à esquerda, abaixo do quadro de quedas e acima dos números do jogo. */
export const CONTROLS_TOP = 330

/**
 * O quadro pequeno à esquerda, que aparece com o cursor (Tab): trocar o herói da próxima rodada e,
 * para quem chegou primeiro à sala, marcar o centro do círculo onde o herói está.
 */
export function MatchControls(props: { seat: Seat; cursor: boolean }) {
  const me = props.seat.player
  const heroFree = !VARIANTS[state.rules.variant].mirror
  const marks = isHost(me) && me.pawn() !== undefined
  if (!props.cursor || (!heroFree && !marks)) return null
  return (
    <panel
      style={{
        x: 24,
        y: CONTROLS_TOP,
        flow: 'down',
        width: 290,
        padding: [12, 14],
        background: FILL,
        borderRadius: sizes.panelRadius,
        borderWidth: 1,
        borderColor: shades.hairline,
      }}
      enter={{ opacity: 0, translate: [-12, 0] }}
    >
      <Text role="label" plated style={{ horizontalAlign: 'left', letterSpacing: 1 }}>
        Arena
      </Text>
      {heroFree ? (
        <Action kind="secondary" onPress={(p) => openHeroMenu(p)} style={{ width: '100%', margin: [8, 0, 0, 0] }}>
          Trocar herói
        </Action>
      ) : null}
      {marks ? (
        <Action kind="secondary" onPress={(p) => markArena(p)} style={{ width: '100%', margin: [6, 0, 0, 0] }}>
          Marcar o centro aqui
        </Action>
      ) : null}
      <Text role="caption" tone="muted" plated style={{ horizontalAlign: 'left', textAlign: 'left', margin: [8, 0, 0, 0] }}>
        Vale a partir da próxima rodada.
      </Text>
    </panel>
  )
}
