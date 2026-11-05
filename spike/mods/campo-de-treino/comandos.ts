// Os comandos de chat do Campo de Treino, numa tabela só: main.ts registra cada um (com os
// apelidos e a versão em minúsculas) e /ajuda lista todos a partir dela.
import { type Player } from 'modlock'

import {
  alvos,
  almas,
  bot,
  dificuldade,
  DRILL_SECONDS,
  heroi,
  item,
  MAX_PRACTICE_BOTS,
  parar,
  reply,
  reset,
  semBots,
  semRecarga,
  vida,
} from './campo'

export interface Command {
  readonly name: string
  readonly aliases: readonly string[]
  /** Como se usa, sem a barra: os argumentos entre <> são obrigatórios, entre [] opcionais. */
  readonly usage: string
  readonly help: string
  readonly run: (player: Player, args: string) => void
}

export const COMMANDS: readonly Command[] = [
  { name: 'ajuda', aliases: [], usage: '', help: 'mostra esta lista', run: (p) => ajuda(p) },
  { name: 'alvos', aliases: ['drill'], usage: '[segundos]', help: `treino de alvos (${DRILL_SECONDS} s sem número): acerto vale 1, cabeça vale 2`, run: alvos },
  { name: 'parar', aliases: [], usage: '', help: 'termina o seu treino de alvos', run: (p) => parar(p) },
  { name: 'bot', aliases: [], usage: '[herói]', help: `chama um bot na sua frente (até ${MAX_PRACTICE_BOTS} no campo)`, run: bot },
  { name: 'semBots', aliases: [], usage: '', help: 'tira todos os bots de treino', run: (p) => semBots(p) },
  { name: 'dificuldade', aliases: [], usage: '[parado|passivo|ativo]', help: 'o que os bots fazem: ficam parados, andam, ou andam e atacam', run: dificuldade },
  { name: 'semRecarga', aliases: [], usage: '', help: 'liga ou desliga as habilidades sem recarga, só para você', run: (p) => semRecarga(p) },
  { name: 'vida', aliases: [], usage: '', help: 'liga ou desliga a vida infinita, só para você', run: (p) => vida(p) },
  { name: 'almas', aliases: [], usage: '[quantidade]', help: 'ganha almas (10000 sem número)', run: almas },
  { name: 'item', aliases: [], usage: '<nome>', help: 'ganha um item, pelo nome da loja do jogo', run: item },
  { name: 'heroi', aliases: [], usage: '<nome>', help: 'troca o seu herói', run: heroi },
  { name: 'reset', aliases: [], usage: '', help: 'herói como no começo e ajustes desligados', run: (p) => reset(p) },
]

/** Os nomes que um comando atende: o nome, os apelidos e as versões em minúsculas. */
export function namesOf(c: Command): string[] {
  return [...new Set([c.name, ...c.aliases].flatMap((n) => [n, n.toLowerCase()]))]
}

/** O comando pelo nome que alguém digitou, sem a barra. */
export function findCommand(name: string): Command | undefined {
  const n = name.toLowerCase()
  return COMMANDS.find((c) => namesOf(c).some((x) => x.toLowerCase() === n))
}

export function ajuda(player: Player): void {
  player.chat('Campo de Treino, comandos:')
  for (const c of COMMANDS) {
    const alias = c.aliases.length ? ` (ou /${c.aliases.join(', /')})` : ''
    const usage = c.usage ? ` ${c.usage}` : ''
    player.chat(`/${c.name}${usage}${alias}: ${c.help}`)
  }
  reply(player, 'Sem placar: nada daqui vale ranking.')
}
