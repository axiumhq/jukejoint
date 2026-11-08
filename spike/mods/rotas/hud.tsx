// A faixa do topo de quem está numa rota: o que fazer agora e o relógio. Some quando a pessoa
// não faz nada. show só manda o que mudou, então redesenhar a cada quadro custa pouco.
import { hide, show, Text, TopStrip } from 'modlock'

import { cronometro } from './comum'
import { estado, type Sessao } from './rotas'

const mostrando = new Set<number>()

/** O que a faixa mostra para uma sessão, ou undefined para escondê-la. */
export function faixaDe(s: Sessao): { titulo: string; contador: string; linha: string } | undefined {
  const agora = estado.agora
  if (s.caixas) {
    const c = s.caixas.corrida
    const relogio = c.largada === undefined ? 'O relógio começa ao sair' : cronometro(agora - c.largada)
    return { titulo: 'Rota de caixas', contador: `${c.quebradas}/${c.ordem.length}`, linha: relogio }
  }
  if (s.gravacao) {
    const g = s.gravacao
    return { titulo: 'Gravando a rota', contador: 'REC', linha: `${cronometro(agora - g.amostras[0].t)} · /fim para terminar` }
  }
  if (s.corrida) {
    const p = s.corrida.percurso
    const total = s.corrida.rota.pontos.length
    const linha = p.largada === undefined ? 'Saia da partida para começar' : `${cronometro(agora - p.largada)} · gravação ${cronometro(s.corrida.rota.tempo)}`
    return { titulo: s.corrida.rota.nome ? `Rota ${s.corrida.rota.nome}` : 'Rota de movimento', contador: `${p.proximo}/${total}`, linha }
  }
  if (s.resultado && agora < s.resultado.ate) return { titulo: s.resultado.titulo, contador: 'FIM', linha: s.resultado.linha }
  return undefined
}

export function drawHud(): void {
  for (const s of estado.sessoes.values()) {
    const faixa = faixaDe(s)
    if (!faixa) {
      if (mostrando.delete(s.player.slot)) hide(s.player)
      continue
    }
    mostrando.add(s.player.slot)
    show(
      s.player,
      <panel style={{ flow: 'down', width: '100%', height: '100%' }}>
        <TopStrip heading={faixa.titulo} line={faixa.linha} lineTone="text" keepTeamBar>
          <Text role="title" plated>
            {faixa.contador}
          </Text>
        </TopStrip>
      </panel>,
    )
  }
}

/** Esquece quem saiu, para a próxima pessoa no lugar começar sem faixa. */
export function esqueceHud(slot: number): void {
  mostrando.delete(slot)
}
