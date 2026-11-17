// O placar na tela: a faixa do topo com o jeito de jogar, a rodada ou o relógio, os pontos de
// cada lado, e uma faixa de destaque quando um lado leva a rodada ou a partida. show só manda o
// que mudou, então redesenhar a cada quadro custa pouco (o mesmo padrão do exemplo arena do
// Modlock, MIT, paralin/modlock, e do nosso Duelo à Meia-Noite).
import { Banner, Pips, Score, show, TopStrip } from 'modlock'

import { info, scoreLine, state } from './arena'

/** Os pontos só viram marcadores até este alvo; acima disso, só o número. */
const MAX_PIPS = 7

function clock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** A linha sob o placar: o que acontece agora. */
export function line(): string {
  switch (state.phase) {
    case 'waiting':
      return state.queue.length < 2 ? 'Esperando mais uma pessoa' : 'Começando'
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

export function drawHud(): void {
  const banner = state.banner && state.now < state.banner.until ? state.banner : undefined
  const pips = !state.rules.timed && state.rules.target <= MAX_PIPS
  const head = heading()
  const sub = line()
  for (const seat of state.queue) {
    show(
      seat.player,
      <panel style={{ flow: 'down', width: '100%', height: '100%' }}>
        <TopStrip heading={head} line={sub} lineTone={state.phase === 'live' ? 'text' : 'muted'}>
          {pips ? <Pips filled={state.score[0]} total={state.rules.target} tone="accent" /> : null}
          <Score points={[state.score[0], state.score[1]]} />
          {pips ? <Pips filled={state.score[1]} total={state.rules.target} tone="danger" mirror /> : null}
        </TopStrip>
        {banner ? <Banner title={banner.title} detail={banner.detail} /> : null}
      </panel>,
    )
  }
}
