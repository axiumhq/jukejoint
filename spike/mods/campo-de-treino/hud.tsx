// Na tela, sem placar: só uma linha pequena com os ajustes ligados de cada pessoa. show só manda o
// que mudou, então redesenhar a cada quadro custa pouco (o mesmo padrão do duelo).
import { Plate, show, Text } from 'modlock'

import { state, type Toggles } from './campo'

/** A linha dos ajustes ligados, ou vazio sem nenhum. */
export function togglesLine(t: Toggles | undefined): string {
  if (!t) return ''
  const on: string[] = []
  if (t.noCooldown) on.push('Sem recarga')
  if (t.godMode) on.push('Vida infinita')
  return on.join(' · ')
}

export function drawHud(): void {
  for (const [k, person] of state.people) {
    const line = togglesLine(state.toggles.get(k))
    show(
      person.player,
      <panel style={{ width: '100%', height: '100%' }}>
        {line ? (
          <Plate style={{ x: 24, y: '58%' }}>
            <Text role="caption" plated>
              {line}
            </Text>
          </Plate>
        ) : null}
      </panel>,
    )
  }
}
