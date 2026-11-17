// A tela de escolha da Arena e os botões durante a partida. Ninguém precisa digitar nada no chat:
// - antes de cada partida, a tela mostra os quatro jeitos de jogar, o tempo, os pontos, os heróis,
//   os bots de treino e o Começar. Quem abriu a sala escolhe o jeito e começa; as outras pessoas
//   veem a mesma tela, só para ler, e escolhem o próprio herói;
// - durante a partida, com o Tab (o jogo mostra o cursor), um quadro pequeno à esquerda troca o
//   herói da próxima rodada e, para quem abriu a sala, marca o centro do círculo.
// As regras e o estado ficam em arena.ts; aqui só o desenho e os botões que chamam as regras.
import { Action, type Hero, heroes, type Player, Text, theme } from 'modlock'

import {
  begin,
  botCount,
  botRoom,
  canBegin,
  canChoose,
  chooseVariant,
  chosenHero,
  closeHeroMenu,
  fixed,
  hostSeat,
  isHost,
  markArena,
  MAX_POINTS,
  MIN_POINTS,
  openHeroMenu,
  perSideFor,
  pickHero,
  removeBots,
  resolveRules,
  type Rules,
  type Seat,
  stepPoints,
  setTimed,
  state,
  trainingBot,
  type Variant,
  VARIANTS,
} from './arena'

const { tones, shades, sizes, sounds } = theme

/** A largura da tela de escolha, num HUD de 1080 de altura. */
const WIDTH = 1100

/** Cada cartão: quantas pessoas de cada lado e a regra em uma linha. */
const CARDS: Record<Variant, { sides: string; rule: string }> = {
  duelo: { sides: '1 contra 1', rule: 'Quem fizer os pontos primeiro vence.' },
  dupla: { sides: '2 contra 2', rule: 'A rodada acaba quando a dupla inteira cai.' },
  times: { sides: 'até 6 contra 6', rule: 'Os times se misturam; 3 rodadas vencem.' },
  espelho: { sides: 'até 6 contra 6', rule: 'Todo mundo com o mesmo herói, sorteado a cada rodada.' },
}

const ORDER: readonly Variant[] = ['duelo', 'dupla', 'times', 'espelho']

function minutes(r: Rules): string {
  const m = Math.round(r.seconds / 60)
  return m === 1 ? '1 minuto' : `${m} minutos`
}

/* ───────── peças ───────── */

function Section(props: { title: string; note?: string }) {
  return (
    <panel style={{ flow: 'right', width: '100%', margin: [18, 0, 8, 0], verticalAlign: 'bottom' }}>
      <Text role="label" tone="muted" plated>
        {props.title}
      </Text>
      {props.note ? (
        <Text role="caption" tone="muted" plated style={{ margin: [0, 0, 0, 12] }}>
          {props.note}
        </Text>
      ) : null}
    </panel>
  )
}

function VariantCard(props: { variant: Variant; selected: boolean; editable: boolean }) {
  const { variant, selected, editable } = props
  const card = CARDS[variant]
  return (
    <button
      disabled={!editable}
      onPress={(p) => chooseVariant(p, variant)}
      sound={editable ? sounds.press : undefined}
      hoverSound={editable ? sounds.hover : undefined}
      style={{
        flow: 'down',
        width: 257,
        height: 124,
        margin: [0, 10, 0, 0],
        padding: [14, 16],
        borderRadius: sizes.panelRadius,
        background: selected ? shades.lit : shades.plate,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? tones.accent : shades.hairline,
        opacity: selected || editable ? 1 : 0.7,
        transition: 0.15,
      }}
      hover={editable && !selected ? { background: shades.raised, borderColor: shades.faint } : undefined}
    >
      <Text role="title" tone={selected ? 'accent' : 'text'} plated style={{ noWrap: true, textOverflow: 'shrink', width: '100%' }}>
        {VARIANTS[variant].title}
      </Text>
      <Text role="label" tone="muted" plated>
        {card.sides}
      </Text>
      <Text role="body" plated style={{ margin: [8, 0, 0, 0], width: '100%' }}>
        {card.rule}
      </Text>
    </button>
  )
}

/** Os pontos para vencer: menos, o número e mais. */
function Points(props: { value: number; editable: boolean }) {
  const { value, editable } = props
  return (
    <panel style={{ flow: 'right', verticalAlign: 'center', margin: [0, 0, 0, 32] }}>
      <Text role="body" plated style={{ margin: [0, 12, 0, 0], verticalAlign: 'center' }}>
        Pontos para vencer
      </Text>
      <Action kind="secondary" disabled={!editable || value <= MIN_POINTS} onPress={(p) => stepPoints(p, -1)} style={{ width: 36 }}>
        −
      </Action>
      <Text role="title" plated style={{ width: 48, textAlign: 'center', verticalAlign: 'center' }}>
        {value}
      </Text>
      <Action kind="secondary" disabled={!editable || value >= MAX_POINTS} onPress={(p) => stepPoints(p, 1)} style={{ width: 36 }}>
        +
      </Action>
    </panel>
  )
}

function HeroCell(props: { hero: Hero; mine: boolean; onPick: (player: Player) => void }) {
  const { hero, mine, onPick } = props
  return (
    <button
      tooltip={hero.title}
      onPress={onPick}
      sound={sounds.press}
      hoverSound={sounds.hover}
      style={{
        width: 50,
        height: 68,
        margin: [0, 6, 6, 0],
        borderRadius: sizes.radius,
        background: shades.raised,
        borderWidth: 2,
        borderColor: mine ? tones.accent : shades.clear,
        brightness: mine ? 1 : 0.8,
        transition: 0.15,
      }}
      hover={{ brightness: 1.1, borderColor: mine ? tones.accent : shades.faint }}
    >
      <hero hero={hero.id} look="vertical" scaling="cover" style={{ width: '100%', height: '100%' }} />
    </button>
  )
}

/** A grade de heróis: a pessoa clica no seu. */
function HeroGrid(props: { mine: string | undefined; width: number }) {
  return (
    <panel style={{ flow: 'rightWrap', width: props.width }}>
      {heroes.map((h) => (
        <HeroCell key={h.name} hero={h} mine={props.mine === h.name} onPick={(p) => pickHero(p, h.name)} />
      ))}
    </panel>
  )
}

/** A linha de quem vai lutar: quantos de cada lado e quantas pessoas esperam. */
function lineup(r: Rules): string {
  const queued = state.queue.length
  if (queued < 2) return 'Falta mais uma pessoa (ou um bot) para começar.'
  const n = perSideFor(r.variant, queued)
  const waiting = queued - 2 * n
  const rest = waiting === 0 ? '' : waiting === 1 ? ', e 1 pessoa espera na fila' : `, e ${waiting} pessoas esperam na fila`
  return `${queued} na sala: vai ser ${n} contra ${n}${rest}.`
}

/* ───────── a tela de escolha ───────── */

export function PickScreen(props: { seat: Seat }) {
  const me = props.seat.player
  const host = hostSeat()
  const mine = isHost(me)
  const rules = resolveRules()
  const v = VARIANTS[rules.variant]
  const lockedVariant = fixed('variante')

  const who = state.auto && lockedVariant
    ? 'O servidor definiu o jeito de jogar. A partida começa quando houver duas pessoas.'
    : mine
      ? 'Você abriu a sala, então escolhe o jeito de jogar e quando começar.'
      : `Quem abriu a sala escolhe o jeito de jogar${host ? `: ${host.name}` : ''}.`

  const room = botRoom()
  const bots = botCount()
  const myHero = chosenHero(me)
  const myHeroTitle = myHero ? heroes.find((h) => h.name === myHero)?.title : undefined

  return (
    <panel style={{ x: 0, y: 0, width: '100%', height: '100%' }}>
      <panel
        style={{
          flow: 'down',
          width: WIDTH,
          horizontalAlign: 'center',
          verticalAlign: 'center',
          padding: [26, 30],
          background: shades.veil,
          borderRadius: sizes.panelRadius,
          borderWidth: 1,
          borderColor: shades.hairline,
        }}
      >
        <panel style={{ flow: 'right', width: '100%' }}>
          <panel style={{ flow: 'down', width: 'fill' }}>
            <Text role="title" plated>
              Arena
            </Text>
            <Text role="body" tone="muted" plated>
              {who}
            </Text>
          </panel>
          {state.lastText ? (
            <panel style={{ flow: 'down', maxWidth: 380, horizontalAlign: 'right' }}>
              <Text role="caption" tone="muted" plated style={{ textAlign: 'right' }}>
                Última partida
              </Text>
              <Text role="body" plated style={{ textAlign: 'right' }}>
                {state.lastText}
              </Text>
            </panel>
          ) : null}
        </panel>

        <Section title="Jeito de jogar" note={lockedVariant ? 'definido pelo servidor' : undefined} />
        <panel style={{ flow: 'right', width: '100%' }}>
          {ORDER.map((variant) => (
            <VariantCard key={variant} variant={variant} selected={rules.variant === variant} editable={canChoose(me, 'variante')} />
          ))}
        </panel>

        <panel style={{ flow: 'right', width: '100%', height: 40, margin: [14, 0, 0, 0] }}>
          <toggle
            on={rules.timed}
            disabled={!canChoose(me, 'tempo')}
            onChange={(p, on) => setTimed(p, on)}
            style={{ verticalAlign: 'center', color: tones.text }}
          >
            {`Com tempo: ${minutes(rules)}, o círculo fecha`}
          </toggle>
          {v.perSide <= 2 && !rules.timed ? (
            <Points value={rules.target} editable={canChoose(me, 'pontos')} />
          ) : (
            <Text role="body" tone="muted" plated style={{ margin: [0, 0, 0, 32], verticalAlign: 'center' }}>
              {rules.timed ? `Vence quem fizer mais pontos em ${minutes(rules)}.` : `Vence quem levar ${rules.target} rodadas.`}
            </Text>
          )}
        </panel>

        {v.mirror ? (
          <panel style={{ flow: 'down', width: '100%' }}>
            <Section title="Herói" />
            <Text role="body" plated>
              No espelho, o herói é sorteado a cada rodada, o mesmo para todo mundo.
            </Text>
          </panel>
        ) : (
          <panel style={{ flow: 'down', width: '100%' }}>
            <Section
              title="Seu herói"
              note={myHeroTitle ? `${myHeroTitle}, a partir da primeira rodada` : 'Sem escolha, fica o herói que você já tem'}
            />
            <HeroGrid mine={myHero} width={WIDTH - 60} />
          </panel>
        )}

        <panel style={{ width: '100%', height: 1, background: shades.hairline, margin: [14, 0, 14, 0] }} />

        <panel style={{ flow: 'right', width: '100%', verticalAlign: 'center' }}>
          <panel style={{ flow: 'down', width: 'fill', verticalAlign: 'center' }}>
            <Text role="body" plated>
              {lineup(rules)}
            </Text>
          </panel>
          {room > 0 ? (
            <Action kind="secondary" onPress={(p) => trainingBot(p)} style={{ margin: [0, 10, 0, 0] }}>
              {bots === 0 ? 'Treinar com um bot' : 'Mais um bot'}
            </Action>
          ) : null}
          {bots > 0 ? (
            <Action kind="quiet" onPress={(p) => removeBots(p)} style={{ margin: [0, 10, 0, 0] }}>
              Tirar os bots
            </Action>
          ) : null}
          {mine && me.pawn() ? (
            <Action kind="quiet" onPress={(p) => markArena(p)} style={{ margin: [0, 10, 0, 0] }}>
              Marcar o centro aqui
            </Action>
          ) : null}
          {state.auto ? null : mine ? (
            <Action kind="primary" disabled={!canBegin()} onPress={(p) => begin(p)} style={{ width: 180 }}>
              Começar
            </Action>
          ) : (
            <Text role="body" tone="muted" plated style={{ verticalAlign: 'center' }}>
              Esperando quem abriu a sala começar
            </Text>
          )}
        </panel>
      </panel>
    </panel>
  )
}

/* ───────── durante a partida ───────── */

/**
 * O quadro pequeno à esquerda, que aparece com o cursor (Tab): trocar o herói da próxima rodada e,
 * para quem abriu a sala, marcar o centro do círculo onde o herói está.
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
        y: '42%',
        flow: 'down',
        width: 220,
        padding: [10, 12],
        background: shades.veil,
        borderRadius: sizes.panelRadius,
        borderWidth: 1,
        borderColor: shades.hairline,
      }}
    >
      <Text role="caption" tone="muted" plated>
        Arena
      </Text>
      {heroFree ? (
        <Action kind="secondary" onPress={(p) => openHeroMenu(p)} style={{ width: '100%', margin: [6, 0, 0, 0] }}>
          Trocar herói
        </Action>
      ) : null}
      {marks ? (
        <Action kind="quiet" onPress={(p) => markArena(p)} style={{ width: '100%', margin: [6, 0, 0, 0] }}>
          Marcar o centro aqui
        </Action>
      ) : null}
    </panel>
  )
}

/** A lista de heróis aberta por Trocar herói: vale a partir da próxima rodada. */
export function HeroMenu(props: { seat: Seat }) {
  const me = props.seat.player
  const width = 760
  return (
    <panel style={{ x: 0, y: 0, width: '100%', height: '100%' }}>
      <panel
        style={{
          flow: 'down',
          width,
          horizontalAlign: 'center',
          verticalAlign: 'center',
          padding: [22, 26],
          background: shades.veil,
          borderRadius: sizes.panelRadius,
          borderWidth: 1,
          borderColor: shades.hairline,
        }}
      >
        <Text role="title" plated>
          Trocar herói
        </Text>
        <Text role="body" tone="muted" plated style={{ margin: [0, 0, 14, 0] }}>
          O novo herói entra na próxima rodada.
        </Text>
        <HeroGrid mine={chosenHero(me)} width={width - 52} />
        <panel style={{ flow: 'right', width: '100%', margin: [10, 0, 0, 0] }}>
          <panel style={{ width: 'fill' }} />
          <Action kind="quiet" onPress={(p) => closeHeroMenu(p)}>
            Fechar
          </Action>
        </panel>
      </panel>
    </panel>
  )
}
