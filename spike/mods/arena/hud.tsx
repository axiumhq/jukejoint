// O que cada pessoa vê: antes da partida, a tela de escolha (escolha.tsx); durante a partida, a
// faixa do topo com o jeito de jogar, a rodada ou o relógio, os pontos de cada lado, uma faixa de
// destaque quando um lado leva a rodada ou a partida, e o quadro pequeno do Tab. show troca a
// interface inteira e só manda o que mudou, então redesenhar a cada quadro custa pouco (o mesmo
// padrão do exemplo arena do Modlock, MIT, paralin/modlock, e do nosso Duelo à Meia-Noite).
//
// Com a tela de escolha aberta, o cursor fica solto sem o Tab e os botões de ataque ficam presos,
// para um clique na tela não virar tiro. Com a lista de heróis aberta na partida, o mesmo, só com
// os dois botões do mouse.
import { Banner, Buttons, cursorFree, freeCursor, Pips, Score, show, TopStrip } from 'modlock'

import { info, key, scoreLine, type Seat, state } from './arena'
import { HeroMenu, MatchControls, PickScreen } from './escolha'

/** Os pontos só viram marcadores até este alvo; acima disso, só o número. */
const MAX_PIPS = 7

/** O que fica preso com a tela de escolha aberta: atirar, golpear e as habilidades. */
export const PICK_BLOCK =
  Buttons.attack | Buttons.altFire | Buttons.melee | Buttons.ability1 | Buttons.ability2 | Buttons.ability3 | Buttons.ultimate
/** Com a lista de heróis aberta na partida, só os botões do mouse. */
export const MENU_BLOCK = Buttons.attack | Buttons.altFire

function clock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** A linha sob o placar: o que acontece agora. */
export function line(): string {
  switch (state.phase) {
    case 'waiting':
      return state.queue.length < 2 ? 'Esperando mais uma pessoa' : 'Escolhendo o jeito de jogar'
    case 'starting':
    case 'preparing':
      return state.rules.timed ? 'Preparando os heróis' : `Rodada ${state.round || 1}: preparando os heróis`
    case 'countdown':
      return 'Prepare-se'
    case 'live':
      return clock(state.endsAt - state.now)
    case 'roundOver':
      return 'Próxima rodada em instantes'
    case 'matchOver':
      return 'Fim da partida'
  }
}

/** O título da faixa: o jeito de jogar, a rodada (ou "com tempo") e o herói do espelho. */
export function heading(): string {
  if (state.phase === 'waiting' || state.fighters.length === 0) return 'Arena'
  const parts = [scoreLine(), info().title]
  parts.push(state.rules.timed ? 'com tempo' : `rodada ${state.round || 1}`)
  if (info().mirror && state.heroTitle) parts.push(state.heroTitle)
  return parts.join(' · ')
}

/** Os botões que cada pessoa tem presos agora, enquanto o cursor está solto por nós. */
const held = new Map<string, bigint>()

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

export function drawHud(): void {
  const here = new Set(state.queue.map(key))
  for (const k of [...held.keys()]) if (!here.has(k)) held.delete(k)

  const picking = state.phase === 'waiting'
  const banner = state.banner && state.now < state.banner.until ? state.banner : undefined
  const pips = !state.rules.timed && state.rules.target <= MAX_PIPS
  const head = heading()
  const sub = line()
  for (const seat of state.queue) {
    const menu = !picking && state.heroMenu.has(key(seat))
    if (!seat.bot) holdCursor(seat, picking ? PICK_BLOCK : menu ? MENU_BLOCK : 0n)
    if (picking) {
      show(
        seat.player,
        <panel style={{ width: '100%', height: '100%' }}>
          <PickScreen seat={seat} />
        </panel>,
      )
      continue
    }
    // O quadro do Tab: aparece enquanto o cursor está solto, e também sem herói (quem assiste).
    const cursor = !seat.bot && !menu && cursorFree(seat.player) !== false
    show(
      seat.player,
      <panel style={{ flow: 'down', width: '100%', height: '100%' }}>
        <TopStrip heading={head} line={sub} lineTone={state.phase === 'live' ? 'text' : 'muted'}>
          {pips ? <Pips filled={state.score[0]} total={state.rules.target} tone="accent" /> : null}
          <Score points={[state.score[0], state.score[1]]} />
          {pips ? <Pips filled={state.score[1]} total={state.rules.target} tone="danger" mirror /> : null}
        </TopStrip>
        {banner ? <Banner title={banner.title} detail={banner.detail} /> : null}
        <MatchControls seat={seat} cursor={cursor} />
        {menu ? <HeroMenu seat={seat} /> : null}
      </panel>,
    )
  }
}
