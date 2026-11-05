// Campo de Treino: um mapa vazio para testar heróis e itens, sem placar. As regras ficam em
// campo.ts, o treino de alvos em drill.ts (adaptado do exemplo drill do Modlock, MIT,
// paralin/modlock), os comandos em comandos.ts, a linha dos ajustes na tela em hud.tsx e o
// autoteste com bots em probe.ts. /ajuda lista os comandos no jogo.
import { command, onDamage, onFrame, onStart, onWorld } from 'modlock'

import { damage, frame, world } from './campo'
import { COMMANDS, namesOf } from './comandos'
import { drawHud } from './hud'
import { Probe } from './probe'

let probe: Probe | undefined

onStart((args) => {
  if (args.includes('probe')) probe = new Probe()
})
onWorld((map) => world(map))
onDamage((hit) => damage(hit))
onFrame((f) => {
  frame(f.timeSeconds)
  drawHud()
  probe?.tick(f.timeSeconds)
})

for (const c of COMMANDS) for (const name of namesOf(c)) command(name, c.run)
