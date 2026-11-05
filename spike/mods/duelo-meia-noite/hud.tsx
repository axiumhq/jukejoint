// O placar na tela: a faixa do topo com a rodada, o herói, os pontos e o relógio, e uma faixa
// de destaque quando alguém leva a rodada ou o duelo. show só manda o que mudou, então
// redesenhar a cada quadro custa pouco (o mesmo padrão do exemplo arena do Modlock).
import { Banner, Pips, Score, show, TopStrip } from 'modlock'

import { ROUND_SECONDS, scoreLine, state, WINS_NEEDED } from './duel'

function clock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** A linha sob o placar: o que acontece agora. */
function line(): string {
  switch (state.phase) {
    case 'waiting':
      return state.queue.length < 2 ? 'Esperando mais uma pessoa' : 'Começando'
    case 'starting':
    case 'preparing':
      return `Rodada ${state.round || 1}: preparando os heróis`
    case 'countdown':
      return 'Prepare-se'
    case 'live':
      return clock(Math.min(ROUND_SECONDS, state.roundEndsAt - state.now))
    case 'roundOver':
      return 'Próxima rodada em instantes'
    case 'matchOver':
      return state.queue[1] ? `Próximo: ${state.queue[0]?.name} contra ${state.queue[1].name}` : 'Fim do duelo'
  }
}

export function drawHud(): void {
  const heading = state.duel.length === 2 ? scoreLine() : 'Duelo à Meia-Noite'
  const sub = state.heroTitle && state.phase !== 'waiting' ? `Rodada ${state.round} · ${state.heroTitle}` : ''
  const banner = state.banner && state.now < state.banner.until ? state.banner : undefined
  for (const seat of state.queue) {
    show(
      seat.player,
      <panel style={{ flow: 'down', width: '100%', height: '100%' }}>
        <TopStrip heading={sub ? `${heading} · ${sub}` : heading} line={line()} lineTone={state.phase === 'live' ? 'text' : 'muted'}>
          <Pips filled={state.score[0]} total={WINS_NEEDED} tone="accent" />
          <Score points={[state.score[0], state.score[1]]} />
          <Pips filled={state.score[1]} total={WINS_NEEDED} tone="danger" mirror />
        </TopStrip>
        {banner ? <Banner title={banner.title} detail={banner.detail} /> : null}
      </panel>,
    )
  }
}
