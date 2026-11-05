// Duelo à Meia-Noite: um contra um, melhor de cinco, com fila. As regras ficam em duel.ts, o
// placar na tela em hud.tsx e o autoteste com bots em probe.ts.
//
// Comandos no chat: /placar mostra o placar, a fila e a sua sessão; /arena muda o lugar do
// duelo para onde você está; /bot põe um bot na fila (só com menos de duas pessoas).
import { command, onDamage, onDamaged, onFrame, onStart, onWorld } from 'modlock'

import { damage, damaged, frame, markArena, placar, trainingBot, world } from './duel'
import { drawHud } from './hud'
import { Probe } from './probe'

let probe: Probe | undefined

onStart((args) => {
  if (args.includes('probe')) probe = new Probe()
})
onWorld((map) => world(map))
onDamage((hit) => damage(hit))
onDamaged((hit) => damaged(hit))
onFrame((f) => {
  frame(f.timeSeconds)
  drawHud()
  probe?.tick(f.timeSeconds)
})

command('placar', placar)
command('arena', markArena)
command('bot', trainingBot)
