// O autoteste do duelo, no jogo de verdade. Iniciado com o argumento probe
// (`modlock dev --no-game --arg probe`), o modo põe dois bots no servidor, espera a rodada
// valer, confere que os dois têm o mesmo herói e estão frente a frente na arena, derruba o
// segundo bot três vezes e confere o placar e a fila no fim. Sai com PASS ou FAIL.
// O formato vem do exemplo arena do Modlock (MIT, paralin/modlock).
import { addBot, log, ProbeRun, vector } from 'modlock'

import { HALF_GAP, state, WINS_NEEDED } from './duel'

type Step = 'seat' | 'live' | 'fall' | 'scored' | 'over'

const waits: Record<Step, string> = {
  seat: 'os dois bots',
  live: 'a rodada valer',
  fall: 'o segundo bot cair',
  scored: 'o ponto entrar no placar',
  over: 'o fim do duelo',
}

export class Probe {
  private readonly run = new ProbeRun('Duelo à Meia-Noite', 300)
  private step: Step = 'seat'
  private since = 0
  private falls = 0

  tick(now: number): void {
    this.run.tick(now, waits[this.step], () => this.advance(now), () => `fase ${state.phase}, rodada ${state.round}, placar ${state.score.join('×')}, fila ${state.queue.map((s) => s.name).join(',')}`)
  }

  private advance(now: number): boolean | string {
    switch (this.step) {
      case 'seat':
        log('bots', addBot({ name: 'Bot Um', team: 2 })?.slot, addBot({ name: 'Bot Dois', team: 3 })?.slot)
        this.step = 'live'
        return false
      case 'live': {
        if (state.phase !== 'live') return false
        const [a, b] = state.duel.map((s) => s.player.pawn())
        if (!a || !b) return 'a rodada valeu sem os dois heróis'
        if (a.hero !== b.hero) return `heróis diferentes: ${a.hero} e ${b.hero}`
        if (a.team === b.team) return `os dois no time ${a.team}`
        const gap = vector.distance(a.position, b.position)
        log('rodada', state.round, 'herói', state.hero, 'distância', Math.round(gap), 'kit', state.kit.join(','))
        if (Math.abs(gap - 2 * HALF_GAP) > 400) return `distância entre os duelistas fora do esperado: ${Math.round(gap)}`
        this.since = now
        this.step = 'fall'
        return false
      }
      case 'fall': {
        if (now - this.since < 1) return false
        const victim = state.duel[1]
        if (!victim) return 'o duelo acabou sem o segundo bot'
        if (victim.player.kill()) {
          this.falls += 1
          this.step = 'scored'
        }
        return false
      }
      case 'scored':
        if (state.score[0] !== this.falls) return state.phase === 'live' ? false : `placar ${state.score.join('×')} depois de ${this.falls} abates`
        if (this.falls >= WINS_NEEDED) {
          this.step = 'over'
          return false
        }
        this.step = 'live'
        return false
      case 'over':
        if (state.phase !== 'matchOver' && state.phase !== 'starting') return false
        if (state.queue[0]?.name !== 'Bot Um') return `quem venceu não ficou na frente da fila: ${state.queue.map((s) => s.name).join(',')}`
        return true
    }
  }
}
