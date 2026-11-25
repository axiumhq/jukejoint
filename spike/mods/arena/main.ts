// Arena: duelo no círculo, dupla, times e espelho, com ou sem tempo, num círculo marcado no
// chão com gás do lado de fora. As regras ficam em arena.ts, o círculo e o gás em circulo.ts, a
// tela de escolha em escolha.tsx, o placar na tela em hud.tsx e o autoteste com bots em probe.ts.
//
// O jeito de jogar vem dos argumentos do servidor (`--arg variante=times --arg tempo`), depois da
// votação na tela, depois da configuração do lobby de quem chegou primeiro. Tudo se escolhe na
// tela; os comandos abaixo ficam só como reserva e nenhum texto manda ninguém para eles.
//
// Com `--arg vitrine=<estado>` (só para a prévia do Modlock, vitrine.ts), o modo não joga: monta
// aquele momento com dados de mentira a cada quadro, para a tela da prévia mostrar.
import { command, log, onDamage, onDamaged, onFrame, onPlayerJoin, onPlayerLeave, onStart, onWorld, precache, Strays } from 'modlock'

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
import { RING_RESOURCES } from './circulo'
import { drawHud } from './hud'
import { Probe } from './probe'
import { parseVitrine, showcase, type Vitrine } from './vitrine'

let probe: Probe | undefined
let vitrine: Vitrine | undefined
/** Tira do mapa os corpos de herói que ficam sem dono quando o herói troca (no espelho). */
const strays = new Strays()

onStart((args) => {
  // O laser do anel: o host já traz esse efeito, mas o precache garante que ele carregue com o mapa.
  if (!precache({ resources: RING_RESOURCES })) log('precache do anel recusado')
  configure(args)
  vitrine = parseVitrine(args)
  if (vitrine) log('vitrine', vitrine)
  else if (args.includes('probe')) probe = new Probe()
})
onWorld((map) => world(map))
onDamage((hit) => (vitrine ? undefined : damage(hit)))
onDamaged((hit) => (vitrine ? undefined : damaged(hit)))
onPlayerJoin(() => (vitrine ? undefined : playerJoined()))
onPlayerLeave((left) => (vitrine ? undefined : playerLeft(left.connection)))
onFrame((f) => {
  if (vitrine) showcase(vitrine, f.timeSeconds)
  else frame(f.timeSeconds)
  strays.sweep(f.timeSeconds)
  drawHud()
  probe?.tick(f.timeSeconds)
})

command('placar', placar)
command('arena', markArena)
command('heroi', chooseHero)
command('modo', chooseMode)
command('bot', (p) => (vitrine ? undefined : trainingBot(p)))
command('tirarbots', removeBots)
command('ajuda', help)
