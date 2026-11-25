// A escolha da Arena e os botões durante a partida, no desenho "Lista com votos"
// (.design/arena-hud/opcoes.html, opção A). Ninguém precisa digitar nada no chat:
// - antes de cada partida, um painel à esquerda, com o meio da tela e a mira livres: o modo numa
//   lista, cada linha com a regra, os votos e uma barra da parte dos votos; a partida (rodadas ou
//   tempo) e os pontos em dois controles lado a lado; o herói; o botão de pronto, quem está na
//   sala e quantos estão prontos. No topo, duas linhas: o que vale pela votação e quando começa.
//   Todo mundo anda pelo mapa enquanto isso e segura o Tab para clicar;
// - a lista de heróis abre por cima, pelo Trocar (ou por Trocar herói na partida), com o retrato
//   grande do herói escolhido ao lado da grade;
// - durante a partida, com o Tab, um quadro pequeno à esquerda troca o herói da próxima rodada e,
//   para quem chegou primeiro à sala, marca o centro do círculo.
// Cada informação aparece uma vez só. As regras e o estado ficam em arena.ts; aqui só o desenho e
// os botões que chamam as regras.
import { findHero, type Hero, heroes, type Player, theme } from 'modlock'

import {
  BEGIN_SECONDS,
  botCount,
  botRoom,
  canChoose,
  type Choice,
  chooseVariant,
  chosenHero,
  clock,
  closeHeroMenu,
  fixed,
  isHost,
  isReady,
  key,
  markArena,
  MIN_PEOPLE,
  missingFor,
  myVote,
  openHeroMenu,
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
import { Heading, L, Outline, P, pct, Rule, surface } from './paleta'

const { sounds } = theme

/** Onde fica o painel da escolha, num HUD de 1080 de altura: à esquerda, abaixo do topo. */
export const PANEL_X = 34
export const PANEL_Y = 135
export const PANEL_WIDTH = 446
/** O respiro de cada seção do painel. */
const PAD = [14, 19]

/** Cada modo: a regra curta da linha. */
export const CARDS: Record<Variant, { sides: string; rule: string }> = {
  duelo: { sides: '1 contra 1, com fila', rule: 'Quem fizer os pontos primeiro vence.' },
  dupla: { sides: '2 contra 2', rule: 'A rodada acaba quando a dupla inteira cai.' },
  times: { sides: 'Até 6 contra 6', rule: 'Os times se misturam; 3 rodadas vencem.' },
  espelho: { sides: 'Todos com o mesmo herói', rule: 'Um herói sorteado a cada rodada, o mesmo para todo mundo.' },
}

const ORDER: readonly Variant[] = ['duelo', 'dupla', 'times', 'espelho']

export { clock }

/** O herói que a pessoa vai usar: o escolhido na tela ou o que ela já tem (0 sem nenhum). */
export function heroOf(seat: Seat): number {
  const chosen = state.chosen.get(key(seat))
  const hero = chosen ? findHero(chosen) : undefined
  return hero?.id ?? seat.player.pawn()?.hero ?? 0
}

export function heroTitle(id: number): string | undefined {
  return id ? heroes.find((h) => h.id === id)?.title : undefined
}

/** "1 voto", "2 votos". */
function votes(n: number): string {
  return n === 1 ? '1 voto' : `${n} votos`
}

/* ───────── o que a escolha diz ───────── */

/** O que vale agora pela votação, em uma linha: "Duelo no círculo · até 5 rodadas". */
export function resultLine(r: Rules): string {
  const title = VARIANTS[r.variant].title
  return r.timed ? `${title} · ${clock(r.seconds)}, com tempo` : `${title} · até ${r.target} ${r.target === 1 ? 'rodada' : 'rodadas'}`
}

/** Quando começa, a segunda linha do topo. */
export function startLine(): string {
  if (state.beginAt !== undefined) return `Começando em ${Math.max(1, Math.ceil(state.beginAt - state.now))}`
  if (state.auto) return 'Começa sozinha quando houver duas pessoas'
  if (state.queue.length < 2) return 'Começa quando houver mais uma pessoa, ou um bot de treino'
  if (missingFor(resolveRules().variant) > 0) return 'O modo mais votado ainda não cabe na sala'
  const n = voters().length
  return n === 1 ? 'Começa quando você estiver pronto' : `Começa quando as ${n} pessoas estiverem prontas`
}

/** Quantos estão prontos e quem falta: "2 de 3 prontos · falta você". */
export function readyLine(viewer: Seat): string {
  const people = voters()
  const missing = people.filter((s) => !state.ready.has(key(s)))
  const head = `${readyCount()} de ${people.length} ${people.length === 1 ? 'pronto' : 'prontos'}`
  if (missing.length === 0) return head
  const names = missing.map((s) => (key(s) === key(viewer) ? 'você' : s.name))
  if (names.length === 1) return `${head} · falta ${names[0]}`
  if (names.length === 2) return `${head} · faltam ${names[0]} e ${names[1]}`
  return `${head} · faltam ${names.length}`
}

/** A regra do modo que vale agora, para quem passa o mouse por cima da linha. */
export function ruleLine(r: Rules): string {
  const win = r.timed ? `Vence quem fizer mais pontos em ${clock(r.seconds)}.` : `Vence quem levar ${r.target} rodadas.`
  return `${CARDS[r.variant].rule} ${win}`
}

/* ───────── peças ───────── */

/** Um retrato pequeno e quadrado, ou um quadrado com a inicial quando não há herói. */
export function Portrait(props: { hero: number; size: number; edge?: string; dim?: boolean; name?: string; round?: boolean }) {
  const { hero, size, edge, dim, round } = props
  const style = {
    width: size,
    height: size,
    borderRadius: round ? size / 2 : 4,
    borderWidth: edge ? 2 : 1,
    borderColor: edge ?? P.line,
    background: P.avatar,
    saturation: dim ? 0 : 1,
    opacity: dim ? 0.35 : 1,
    transition: 0.25,
  }
  if (hero) return <hero hero={hero} look="small" scaling="cover" style={style} />
  return (
    <panel style={style}>
      <L size={Math.round(size * 0.45)} weight="semiBold" color={P.ink} style={{ horizontalAlign: 'center', verticalAlign: 'center' }}>
        {(props.name ?? '').slice(0, 1).toUpperCase()}
      </L>
    </panel>
  )
}

/** A silhueta neutra de quem ainda não tem herói, no lugar do retrato. */
function Silhouette() {
  return (
    <panel style={{ width: 53, height: 67, borderRadius: 4, gradient: { shape: 'down', colors: ['#5b3b62', '#261823'] } }}>
      <panel style={{ x: 17, y: 14, width: 19, height: 19, borderRadius: 10, background: '#e7dccb38' }} />
      <panel style={{ x: 9, y: 38, width: 35, height: 22, borderRadius: 11, background: '#e7dccb38' }} />
    </panel>
  )
}

/** Uma linha do modo: o nome, a regra curta, os votos e a barra da parte dos votos. */
function ModeRow(props: { seat: Seat; variant: Variant; total: number; counts: Map<string, number>; current: Variant }) {
  const { seat, variant, total, counts, current } = props
  const me = seat.player
  const n = counts.get(variant) ?? 0
  const win = variant === current
  const mine = myVote(me, 'variante') === variant
  const missing = missingFor(variant)
  const disabled = !canChoose(me, 'variante')
  const sub = missing > 0 ? `Precisa de ${MIN_PEOPLE[variant]} pessoas · ${missing === 1 ? 'falta 1' : `faltam ${missing}`}` : CARDS[variant].sides
  return (
    <button
      disabled={disabled}
      tooltip={CARDS[variant].rule}
      onPress={(p) => chooseVariant(p, variant)}
      sound={disabled ? undefined : sounds.press}
      hoverSound={disabled ? undefined : sounds.hover}
      style={{
        width: '100%',
        height: 58,
        margin: [0, 0, 7, 0],
        borderRadius: 6,
        borderWidth: 1,
        borderColor: win ? P.brass : P.line,
        opacity: missing > 0 || (disabled && !win) ? 0.55 : 1,
        overflow: 'clip',
        transition: 0.15,
      }}
      hover={disabled ? undefined : { borderColor: win ? P.brass : P.line2 }}
    >
      <panel style={{ x: 0, y: 0, width: pct(total > 0 ? (100 * n) / total : 0), height: '100%', background: P.brassSoft, transition: 0.25 }} />
      <panel style={{ width: '100%', height: '100%', flow: 'right', padding: [0, 14], verticalAlign: 'center' }}>
        <panel style={{ flow: 'down', width: 'fill', verticalAlign: 'center' }}>
          <panel style={{ flow: 'right', verticalAlign: 'center' }}>
            <L size={20} weight="semiBold">
              {VARIANTS[variant].title}
            </L>
            {mine ? (
              <L size={14} weight="semiBold" color={P.brassInk} style={{ background: P.brass, borderRadius: 3, padding: [1, 7], margin: [0, 0, 0, 10], verticalAlign: 'center' }}>
                seu voto
              </L>
            ) : null}
          </panel>
          <L size={16} color={missing > 0 ? P.warn : P.ink3}>
            {sub}
          </L>
        </panel>
        <L size={24} weight="bold" block color={win ? P.brass : P.ink2} style={{ verticalAlign: 'center' }}>
          {n}
        </L>
      </panel>
    </button>
  )
}

/** Um controle de segmentos: cada valor com a contagem embaixo; o que vale fica latão, o voto da pessoa sublinhado. */
function Segments<T>(props: {
  seat: Seat
  choice: Choice
  items: readonly { value: T; label: string; count: string; tooltip: string }[]
  current: T
  onPress: (player: Player, value: T) => void
}) {
  const me = props.seat.player
  const mine = myVote(me, props.choice)
  const disabled = !canChoose(me, props.choice)
  return (
    <panel style={{ flow: 'right', width: '100%', borderWidth: 1, borderColor: P.line2, borderRadius: 6, overflow: 'clip' }}>
      {props.items.map((it, i) => {
        const win = it.value === props.current
        return [
          i > 0 ? <panel key={`s${i}`} style={{ width: 1, height: 58, background: P.line2 }} /> : null,
          <button
            key={String(it.value)}
            disabled={disabled}
            tooltip={it.tooltip}
            onPress={(p) => props.onPress(p, it.value)}
            sound={disabled ? undefined : sounds.press}
            hoverSound={disabled ? undefined : sounds.hover}
            style={{ width: 'fill', height: 58, background: win ? P.brassSoft : P.clear, transition: 0.15 }}
            hover={disabled ? undefined : { background: win ? P.brassSoft : P.chip }}
          >
            <panel style={{ flow: 'down', horizontalAlign: 'center', verticalAlign: 'center' }}>
              <L size={18} weight={win ? 'semiBold' : 'normal'} color={win ? P.ink : P.ink2} style={{ horizontalAlign: 'center' }}>
                {it.label}
              </L>
              <L size={14} color={P.ink3} style={{ horizontalAlign: 'center' }}>
                {it.count}
              </L>
            </panel>
            {mine === String(it.value) ? <panel style={{ width: '100%', height: 3, background: P.brass, verticalAlign: 'bottom' }} /> : null}
          </button>,
        ]
      })}
    </panel>
  )
}

/** Uma pessoa na sala: retrato (ou inicial) e nome; verde quando está pronta. */
function Person(props: { seat: Seat }) {
  const { seat } = props
  const ready = state.ready.has(key(seat))
  return (
    <panel style={{ flow: 'right', verticalAlign: 'center', padding: [5, 10, 5, 5], margin: [0, 10, 10, 0], borderRadius: 20, background: P.chip }}>
      <Portrait hero={heroOf(seat)} size={29} round edge={ready ? P.ok : undefined} name={seat.name} />
      <L size={17} color={ready ? P.ok : P.ink2} style={{ margin: [0, 0, 0, 7], verticalAlign: 'center' }}>
        {seat.bot ? `${seat.name} · bot` : seat.name}
      </L>
    </panel>
  )
}

/** A tecla desenhada como tecla: "Tab". */
function Key(props: { children: string }) {
  return (
    <panel style={{ padding: [2, 10], borderRadius: 4, borderWidth: 1, borderColor: P.line2, background: P.chip, margin: [0, 8, 0, 0], verticalAlign: 'center' }}>
      <L size={16} weight="semiBold" style={{ verticalAlign: 'center' }}>
        {props.children}
      </L>
    </panel>
  )
}

/* ───────── a escolha ───────── */

/** As duas linhas do topo antes da partida: o que vale pela votação e quando começa. */
export function PickHeader() {
  const r = resolveRules()
  const starting = state.beginAt !== undefined
  return (
    <panel style={{ flow: 'down', horizontalAlign: 'center', margin: [22, 0, 0, 0] }}>
      <L size={26} weight="semiBold" shadow style={{ horizontalAlign: 'center' }}>
        {resultLine(r)}
      </L>
      <L size={18} color={starting ? P.brass : P.ink2} shadow style={{ horizontalAlign: 'center', margin: [3, 0, 0, 0] }}>
        {startLine()}
      </L>
    </panel>
  )
}

/** O painel da escolha, à esquerda. */
export function PickPanel(props: { seat: Seat; cursor: boolean }) {
  const { seat } = props
  const me = seat.player
  const rules = resolveRules()
  const v = VARIANTS[rules.variant]
  const counts = voteCounts('variante')
  const total = [...counts.values()].reduce((a, b) => a + b, 0)
  const timeCounts = voteCounts('tempo')
  const pointCounts = voteCounts('pontos')
  const votedPoints = [...pointCounts.keys()].map(Number).filter((n) => Number.isFinite(n))
  const points = [...new Set<number>([...POINT_CHOICES, rules.target, ...votedPoints])].sort((a, b) => a - b)
  const myHero = heroOf(seat)
  const title = heroTitle(myHero)
  const ready = isReady(me)
  const room = botRoom()
  const bots = botCount()
  const locked = fixed('variante')
  return (
    <panel style={{ x: PANEL_X, y: PANEL_Y, width: PANEL_WIDTH, flow: 'down', ...surface }} enter={{ opacity: 0, translate: [-12, 0] }}>
      <panel style={{ flow: 'down', width: '100%', padding: PAD }}>
        <panel style={{ flow: 'right', width: '100%' }}>
          <Heading style={{ width: 'fill' }}>Modo</Heading>
          {locked ? (
            <L size={14} color={P.ink3}>
              definido pelo servidor
            </L>
          ) : null}
        </panel>
        {ORDER.map((variant) => (
          <ModeRow key={variant} seat={seat} variant={variant} total={total} counts={counts} current={rules.variant} />
        ))}
      </panel>
      <Rule />

      <panel style={{ flow: 'right', width: '100%', padding: PAD }}>
        <panel style={{ flow: 'down', width: 160, margin: [0, 12, 0, 0] }}>
          <Heading>Partida</Heading>
          <Segments
            seat={seat}
            choice="tempo"
            current={rules.timed}
            items={[
              { value: false, label: 'Rodadas', count: votes(timeCounts.get('false') ?? 0), tooltip: 'Por rodadas: quem cai espera a próxima rodada.' },
              { value: true, label: 'Tempo', count: votes(timeCounts.get('true') ?? 0), tooltip: `Com tempo: ${clock(rules.seconds)}, o círculo fecha e quem cai volta em instantes.` },
            ]}
            onPress={(p, on) => setTimed(p, on)}
          />
        </panel>
        <panel style={{ flow: 'down', width: 'fill' }}>
          {rules.timed ? (
            <>
              <Heading>Duração</Heading>
              <L size={17} color={P.ink2}>{`${clock(rules.seconds)}, o círculo fecha`}</L>
            </>
          ) : v.perSide > 2 ? (
            <>
              <Heading>Vence com</Heading>
              <L size={17} color={P.ink2}>{`${rules.target} rodadas`}</L>
            </>
          ) : (
            <>
              <Heading>Vence com</Heading>
              <Segments
                seat={seat}
                choice="pontos"
                current={rules.target}
                items={points.map((n) => ({ value: n, label: String(n), count: String(pointCounts.get(String(n)) ?? 0), tooltip: `Até ${n} pontos` }))}
                onPress={(p, n) => setPoints(p, n)}
              />
            </>
          )}
        </panel>
      </panel>
      <Rule />

      <panel style={{ flow: 'right', width: '100%', padding: PAD, verticalAlign: 'center' }}>
        {v.mirror ? (
          <L size={17} color={P.ink2} style={{ width: 'fill' }}>
            No espelho, o herói é sorteado a cada rodada, o mesmo para todo mundo.
          </L>
        ) : (
          <>
            {myHero ? <hero hero={myHero} look="vertical" scaling="cover" style={{ width: 53, height: 67, borderRadius: 4 }} /> : <Silhouette />}
            <panel style={{ flow: 'down', width: 'fill', margin: [0, 0, 0, 14], verticalAlign: 'center' }}>
              <L size={20} weight="semiBold" color={title ? P.ink : P.ink2}>
                {title ?? 'Escolha um herói'}
              </L>
              <L size={16} color={P.ink3}>
                {title ? 'Seu herói' : 'Sem escolha, fica o herói que você tem'}
              </L>
            </panel>
            <Outline onPress={(p) => openHeroMenu(p)} tooltip="Abre a lista de heróis; vale a partir da primeira rodada.">
              Trocar
            </Outline>
          </>
        )}
      </panel>
      <Rule />

      <panel style={{ flow: 'down', width: '100%', padding: PAD }}>
        {state.auto ? null : <ReadyButton on={ready} />}
        <panel style={{ flow: 'rightWrap', width: '100%', margin: [12, 0, 0, 0] }}>
          {state.queue.slice(0, 8).map((s) => (
            <Person key={key(s)} seat={s} />
          ))}
          {state.queue.length > 8 ? <L size={16} color={P.ink3} style={{ verticalAlign: 'center' }}>{`e mais ${state.queue.length - 8}`}</L> : null}
        </panel>
        <panel style={{ flow: 'right', width: '100%', verticalAlign: 'center' }}>
          <L size={17} color={P.ink2} style={{ width: 'fill', verticalAlign: 'center' }}>
            {state.auto ? 'Começa sozinha, sem pronto' : readyLine(seat)}
          </L>
          {props.cursor ? null : (
            <panel style={{ flow: 'right', verticalAlign: 'center' }}>
              <Key>Tab</Key>
              <L size={16} color={P.ink2} style={{ verticalAlign: 'center' }}>
                segure para clicar
              </L>
            </panel>
          )}
        </panel>
        {room > 0 || bots > 0 || (isHost(me) && me.pawn()) ? (
          <panel style={{ flow: 'rightWrap', width: '100%', margin: [12, 0, 0, 0] }}>
            {room > 0 ? (
              <Outline onPress={(p) => trainingBot(p)} style={{ margin: [0, 8, 8, 0] }}>
                {bots === 0 ? 'Treinar com um bot' : 'Mais um bot'}
              </Outline>
            ) : null}
            {bots > 0 ? (
              <Outline onPress={(p) => removeBots(p)} style={{ margin: [0, 8, 8, 0] }}>
                Tirar os bots
              </Outline>
            ) : null}
            {isHost(me) && me.pawn() ? (
              <Outline onPress={(p) => markArena(p)} tooltip="O círculo passa a ter o centro onde você está, a partir da próxima rodada." style={{ margin: [0, 8, 8, 0] }}>
                Marcar o centro aqui
              </Outline>
            ) : null}
          </panel>
        ) : null}
        {state.lastText ? (
          <L size={15} color={P.ink3} style={{ margin: [8, 0, 0, 0] }}>{`Última partida: ${state.lastText}`}</L>
        ) : null}
        {state.beginAt !== undefined ? (
          <L size={15} color={P.ink3} style={{ margin: [8, 0, 0, 0] }}>{`Se alguém cancelar o pronto, a contagem de ${BEGIN_SECONDS} para.`}</L>
        ) : null}
      </panel>
    </panel>
  )
}

/** O botão de pronto: latão cheio; pronto, contorno verde; depois de uma partida, "Jogar de novo". */
function ReadyButton(props: { on: boolean }) {
  const { on } = props
  return (
    <button
      onPress={(p) => toggleReady(p)}
      sound={sounds.press}
      hoverSound={sounds.hover}
      style={{
        width: '100%',
        height: 52,
        borderRadius: 6,
        background: on ? P.clear : P.brass,
        borderWidth: 1,
        borderColor: on ? P.ok : P.brass,
        transition: 0.15,
      }}
      hover={on ? { background: '#9cc98a1a' } : { brightness: 1.08 }}
    >
      <L size={22} weight="bold" color={on ? P.ok : P.brassInk} style={{ horizontalAlign: 'center', verticalAlign: 'center' }}>
        {on ? 'Pronto · clique para cancelar' : state.lastText ? 'Jogar de novo' : 'Estou pronto'}
      </L>
    </button>
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
        borderRadius: 4,
        background: mine ? P.brassSoft : P.chip,
        borderWidth: 1,
        borderColor: mine ? P.brass : P.clear,
        transition: 0.15,
      }}
      hover={mine ? undefined : { borderColor: P.line2 }}
    >
      <hero hero={hero.id} look="vertical" scaling="cover" style={{ width: '100%', height: 78, borderRadius: 3 }} />
      <L size={13} color={mine ? P.brass : P.ink2} style={{ width: '100%', horizontalAlign: 'center', textAlign: 'center', noWrap: true, textOverflow: 'shrink', margin: [3, 0, 0, 0] }}>
        {hero.title}
      </L>
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
  return (
    <panel style={{ x: 0, y: 0, width: '100%', height: '100%', background: '#0d0b0a80' }}>
      <panel style={{ flow: 'down', horizontalAlign: 'center', verticalAlign: 'center', padding: [22, 26], ...surface }} enter={{ opacity: 0, scale: 0.97 }}>
        <panel style={{ flow: 'right', width: '100%', verticalAlign: 'bottom' }}>
          <L size={26} weight="semiBold">
            {picking ? 'Seu herói' : 'Trocar herói'}
          </L>
          <L size={16} color={P.ink3} style={{ margin: [0, 0, 3, 14], verticalAlign: 'bottom' }}>
            {picking ? 'Vale a partir da primeira rodada.' : state.rules.timed ? 'O novo herói entra na próxima partida.' : 'O novo herói entra na próxima rodada.'}
          </L>
        </panel>
        <panel style={{ flow: 'right', margin: [16, 0, 0, 0] }}>
          <panel style={{ flow: 'down', width: 230, margin: [0, 22, 0, 0] }}>
            {id ? (
              <hero hero={id} look="card" scaling="cover" style={{ width: 230, height: 320, borderRadius: 6, borderWidth: 1, borderColor: P.line }} />
            ) : (
              <panel style={{ width: 230, height: 320, borderRadius: 6, background: P.chip, borderWidth: 1, borderColor: P.line }} />
            )}
            <L size={22} weight="semiBold" color={mine ? P.brass : P.ink} style={{ margin: [10, 0, 0, 0] }}>
              {title ?? 'Sem herói'}
            </L>
            <L size={15} color={P.ink3}>
              {mine ? 'Escolhido' : 'O herói que você tem agora'}
            </L>
          </panel>
          <panel style={{ flow: 'rightWrap', width: 700, maxHeight: 620, overflowY: 'scroll' }}>
            {heroes.map((h) => (
              <HeroCell key={h.name} hero={h} mine={mine === h.name} onPick={(p) => pickHero(p, h.name)} />
            ))}
          </panel>
        </panel>
        <panel style={{ flow: 'right', width: '100%', margin: [12, 0, 0, 0] }}>
          <panel style={{ width: 'fill' }} />
          <Outline onPress={(p) => closeHeroMenu(p)}>Fechar</Outline>
        </panel>
      </panel>
    </panel>
  )
}

/* ───────── durante a partida ───────── */

/** Onde fica o quadro do Tab: à esquerda, abaixo do quadro de quedas. */
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
    <panel style={{ x: PANEL_X, y: CONTROLS_TOP, flow: 'down', width: 300, padding: PAD, ...surface }} enter={{ opacity: 0, translate: [-12, 0] }}>
      <L size={15} block upper spacing={1} color={P.ink3} style={{ margin: [0, 0, 10, 0] }}>
        Arena
      </L>
      {heroFree ? (
        <Outline onPress={(p) => openHeroMenu(p)} style={{ width: '100%', margin: [0, 0, 8, 0] }}>
          Trocar herói
        </Outline>
      ) : null}
      {marks ? (
        <Outline onPress={(p) => markArena(p)} style={{ width: '100%', margin: [0, 0, 8, 0] }}>
          Marcar o centro aqui
        </Outline>
      ) : null}
      <L size={15} color={P.ink3}>
        {state.rules.timed ? 'Vale a partir da próxima partida.' : 'Vale a partir da próxima rodada.'}
      </L>
    </panel>
  )
}
