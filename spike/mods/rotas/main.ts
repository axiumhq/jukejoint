// Rotas: um modo de prática para achar o caminho mais rápido. A rota de caixas planeja a ordem
// mais curta para quebrar as caixas perto de você e cronometra; a rota de movimento grava um
// atalho, vira pontos de controle e cronometra quem corre por ele. As contas ficam em caixas.ts
// e percurso.ts, o jogo em rotas.ts, a faixa do topo em hud.tsx e o autoteste em probe.ts.
//
// Comandos no chat: /caixas [raio], /parar, /gravar, /fim, /correr [nome], /salvar <nome>,
// /rotas e /ajuda.
import { command, onDamaged, onFrame, onPlayerJoin, onPlayerLeave, onStart, onWorld } from 'modlock'

import { drawHud, esqueceHud } from './hud'
import { Probe } from './probe'
import { ajuda, caixas, correr, entrou, fim, gravar, listaRotas, mundo, parar, quadro, saiu, salvar } from './rotas'

let probe: Probe | undefined

onStart((args) => {
  if (args.includes('probe')) probe = new Probe()
})
onWorld((mapa) => mundo(mapa))
onPlayerJoin((e) => entrou(e.connection.player))
onPlayerLeave((e) => {
  saiu(e.connection.player)
  esqueceHud(e.connection.player.slot)
})
onDamaged((hit) => probe?.golpe(hit.victim, hit.attacker))
onFrame((f) => {
  quadro(f.timeSeconds, f.movement)
  drawHud()
  probe?.tick(f.timeSeconds)
})

command('ajuda', ajuda)
command('caixas', caixas)
command('parar', parar)
command('gravar', gravar)
command('fim', fim)
command('correr', correr)
command('salvar', salvar)
command('rotas', listaRotas)
