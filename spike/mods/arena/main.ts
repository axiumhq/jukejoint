// Arena: duelo no círculo, dupla, times e espelho, com ou sem tempo, num círculo marcado no
// chão com gás do lado de fora. As regras ficam em arena.ts, o círculo e o gás em circulo.ts, a
// tela de escolha em escolha.tsx, o placar na tela em hud.tsx e o autoteste com bots em probe.ts.
//
// O jeito de jogar vem dos argumentos do servidor (`--arg variante=times --arg tempo`), depois do
// que quem abriu a sala escolheu na tela, depois da configuração do lobby dessa pessoa. Tudo se
// escolhe na tela; os comandos abaixo ficam só como reserva e nenhum texto manda ninguém para eles.
import { command, onDamage, onDamaged, onFrame, onPlayerJoin, onPlayerLeave, onStart, onWorld, Strays } from 'modlock'

import {
  chooseHero,
  chooseMode,
  configure,
  damage,
  damaged,
  frame,
  help,
  markArena,
  placar,
  playerJoined,
  playerLeft,
  removeBots,
  trainingBot,
  world,
} from './arena'
import { drawHud } from './hud'
import { Probe } from './probe'

let probe: Probe | undefined
/** Tira do mapa os corpos de herói que ficam sem dono quando o herói troca (no espelho). */
const strays = new Strays()

onStart((args) => {
  configure(args)
  if (args.includes('probe')) probe = new Probe()
})
onWorld((map) => world(map))
onDamage((hit) => damage(hit))
onDamaged((hit) => damaged(hit))
onPlayerJoin(() => playerJoined())
onPlayerLeave((left) => playerLeft(left.connection))
onFrame((f) => {
  frame(f.timeSeconds)
  strays.sweep(f.timeSeconds)
  drawHud()
  probe?.tick(f.timeSeconds)
})

command('placar', placar)
command('arena', markArena)
command('heroi', chooseHero)
command('modo', chooseMode)
command('bot', trainingBot)
command('tirarbots', removeBots)
command('ajuda', help)
