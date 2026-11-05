// O modo Rotas no jogo: os comandos, os marcadores no mundo, o relógio de cada pessoa e o
// arquivo de rotas. As contas ficam em caixas.ts e percurso.ts; aqui só se liga isso ao jogo.
//
// Cada pessoa tem a sua sessão e faz uma coisa por vez: uma rota de caixas, uma gravação ou uma
// corrida. Os marcadores no mundo aparecem só para quem pediu.
import {
  createText,
  entityPosition,
  findEntities,
  log,
  type MovementSample,
  type Player,
  players,
  readFile,
  removeEntities,
  type WorldObject,
  writeFile,
} from 'modlock'
import * as cvar from 'modlock/console'

import { CorridaDeCaixas, caixasPerto, chaveDoLugar, planeja, type Plano, RAIO_MAXIMO, RAIO_MINIMO, RAIO_PADRAO, type Caixa } from './caixas'
import { cronometro, diferenca, type Ponto, Recordes, unidades } from './comum'
import {
  type Acao,
  type Amostra,
  AMOSTRAS_MAXIMAS,
  type ArquivoDeRotas,
  arquivoDoMapa,
  escreveArquivo,
  eTecnica,
  INTERVALO_DA_AMOSTRA,
  leArquivo,
  MAXIMO_DE_ROTAS,
  montaRota,
  nomeDeRota,
  Percurso,
  type Rota,
} from './percurso'

/** A classe das caixas quebráveis das lanes (672 em dl_midtown). */
export const CLASSE_DAS_CAIXAS = 'citadel_breakable_prop'
/** Os marcadores flutuam a esta altura sobre a caixa ou o ponto. */
const ALTURA_DO_MARCADOR = 70
/** De quanto em quanto tempo o modo pergunta ao jogo se as caixas ainda estão lá. */
const CHECAGEM_DAS_CAIXAS = 0.1
/** Quanto tempo o resultado fica na faixa do topo. */
const RESULTADO_NA_TELA = 8

const COR = {
  proxima: 0xffc83cff,
  depois: 0xdcdcdcff,
  partida: 0x5ad2ffff,
  fim: 0x7cf08cff,
} as const

/** Os ajustes do servidor: o mapa como o jogo tem, com caixas e tirolesas, mas sem tropas. */
export const AJUSTES: cvar.Settings = {
  sv_hibernate_when_empty: false,
  citadel_trooper_spawn_enabled: false,
  citadel_solo_bot_match: false,
  citadel_koth_enabled: false,
  citadel_spawn_practice_bots: false,
  citadel_start_players_on_zipline: false,
}

/** Marcas são os textos no mundo de uma sessão, por número, vistos só pela dona da sessão. */
export class Marcas {
  private readonly objetos = new Map<number, WorldObject>()
  criadas = 0
  constructor(private readonly dono: Player) {}

  poe(chave: number, texto: string, p: Ponto, cor: number, tamanho = 110): boolean {
    this.tira(chave)
    const o = createText({
      text: texto,
      position: { x: p.x, y: p.y, z: p.z + ALTURA_DO_MARCADOR },
      faceCamera: true,
      fontSize: tamanho,
      color: cor,
      align: 'center',
      verticalAlign: 'bottom',
    })
    if (!o) return false
    o.showOnlyTo([this.dono.slot])
    this.objetos.set(chave, o)
    this.criadas += 1
    return true
  }

  tira(chave: number): void {
    this.objetos.get(chave)?.remove()
    this.objetos.delete(chave)
  }

  limpa(): void {
    for (const o of this.objetos.values()) o.remove()
    this.objetos.clear()
  }

  get quantas(): number {
    return this.objetos.size
  }
}

export interface RotaDeCaixas {
  readonly corrida: CorridaDeCaixas
  readonly plano: Plano
  readonly chave: string
  readonly raio: number
  readonly marcas: Marcas
  /** quebradasAgora são as caixas que o jogo disse que a pessoa quebrou desde o último quadro. */
  quebradasAgora: number[]
  checadaEm: number
}

export interface Gravacao {
  readonly amostras: Amostra[]
  readonly acoes: Acao[]
  ultimaAmostra: number
}

export interface Corrida {
  readonly rota: Rota
  readonly percurso: Percurso
  readonly marcas: Marcas
}

export interface Sessao {
  readonly player: Player
  caixas?: RotaDeCaixas
  gravacao?: Gravacao
  corrida?: Corrida
  /** ultima é a última rota gravada, salva ou não. */
  ultima?: Rota
  /** resultado é o que a faixa do topo mostra depois de uma corrida, até `ate`. */
  resultado?: { titulo: string; linha: string; ate: number }
}

export const estado = {
  mapa: '',
  agora: 0,
  sessoes: new Map<number, Sessao>(),
  /** Os recordes de caixas desta sessão do servidor, por pessoa e lugar. */
  recordesDeCaixas: new Recordes(),
  arquivo: { versao: 1, rotas: {} } as ArquivoDeRotas,
  /** persiste diz se o último writeFile deu certo; undefined antes de tentar. */
  persiste: undefined as boolean | undefined,
}

function nomeDe(player: Player): string {
  return players().find((c) => c.player.slot === player.slot)?.name ?? `Pessoa ${player.slot}`
}

function sessao(player: Player): Sessao {
  let s = estado.sessoes.get(player.slot)
  if (!s) {
    s = { player }
    estado.sessoes.set(player.slot, s)
  }
  return s
}

function vivo(player: Player): Ponto | undefined {
  const pawn = player.pawn()
  return pawn && pawn.health > 0 ? pawn.position : undefined
}

function acompanhaMovimento(s: Sessao): void {
  s.player.watchMovement(Boolean(s.caixas || s.gravacao))
}

function encerraCaixas(s: Sessao): void {
  s.caixas?.marcas.limpa()
  s.caixas = undefined
}

function encerraCorrida(s: Sessao): void {
  s.corrida?.marcas.limpa()
  s.corrida = undefined
}

/** Termina o que a sessão estiver fazendo; diz o que parou, ou undefined se nada. */
function encerraTudo(s: Sessao): string | undefined {
  const parou = s.caixas ? 'a rota de caixas' : s.gravacao ? 'a gravação' : s.corrida ? 'a corrida' : undefined
  encerraCaixas(s)
  encerraCorrida(s)
  s.gravacao = undefined
  acompanhaMovimento(s)
  return parou
}

/* ───────── comandos ───────── */

export const AJUDA = [
  'Rotas: pratique o caminho mais rápido.',
  '/caixas [raio]: planeja a ordem mais curta para quebrar as caixas perto de você (raio padrão 2500) e marca cada uma com o número.',
  '/gravar: começa a gravar o seu trajeto. /fim: termina e mostra os pontos, o tempo e as técnicas.',
  '/correr [nome]: corre a última rota gravada, ou uma salva. O relógio começa quando você sai da partida.',
  '/salvar <nome>: guarda a última rota gravada. /rotas: lista as rotas salvas deste mapa.',
  '/parar: cancela o que estiver rodando. /ajuda: esta lista.',
]

export function ajuda(player: Player): void {
  for (const linha of AJUDA) player.chat(linha)
}

export function parar(player: Player): void {
  const s = sessao(player)
  const parou = encerraTudo(s)
  player.centerText('')
  player.chat(parou ? `Pronto: ${parou} foi cancelada.` : 'Nada rodando agora.')
}

/** Lê o raio de /caixas: vazio é o padrão; fora da faixa, o limite mais perto. */
export function raioDe(args: string): number | undefined {
  const texto = args.trim()
  if (!texto) return RAIO_PADRAO
  const n = Number(texto.replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0) return undefined
  return Math.min(RAIO_MAXIMO, Math.max(RAIO_MINIMO, Math.round(n)))
}

/** As caixas do mapa que ainda estão de pé, com onde estão. */
export function caixasDoMapa(): Caixa[] {
  const saida: Caixa[] = []
  for (const id of findEntities(CLASSE_DAS_CAIXAS)) {
    const p = entityPosition(id)?.position
    if (p) saida.push({ id, p })
  }
  return saida
}

export function caixas(player: Player, args: string): void {
  const partida = vivo(player)
  if (!partida) return void player.chat('Entre com um herói vivo para usar /caixas.')
  const raio = raioDe(args)
  if (raio === undefined) return void player.chat(`Use /caixas ou /caixas <raio>, com o raio em unidades (${RAIO_MINIMO} a ${RAIO_MAXIMO}).`)
  const perto = caixasPerto(partida, caixasDoMapa(), raio)
  if (perto.length === 0) return void player.chat(`Nenhuma caixa de pé num raio de ${raio}. Ande até uma lane ou aumente o raio, como em /caixas 4000.`)

  const s = sessao(player)
  encerraTudo(s)
  const plano = planeja(partida, perto)
  const chave = chaveDoLugar(estado.mapa, partida, raio)
  const marcas = new Marcas(player)
  plano.ordem.forEach((c, i) => marcas.poe(i + 1, String(i + 1), c.p, i === 0 ? COR.proxima : COR.depois, i === 0 ? 150 : 110))
  s.caixas = { corrida: new CorridaDeCaixas(partida, plano.ordem), plano, chave, raio, marcas, quebradasAgora: [], checadaEm: -Infinity }
  acompanhaMovimento(s)

  const recorde = estado.recordesDeCaixas.melhor(`${nomeDe(player)}|${chave}`)
  player.chat(
    `Rota de caixas: ${plano.ordem.length} ${plano.ordem.length === 1 ? 'caixa' : 'caixas'}, ${unidades(plano.comprimento)} de caminho` +
      (plano.comprimentoIngenuo > plano.comprimento + 1 ? ` (na ordem do mapa seriam ${Math.round(plano.comprimentoIngenuo)}).` : '.'),
  )
  player.chat(`Siga os números. O relógio começa quando você sai do lugar ou quebra a primeira caixa. /parar cancela.${recorde !== undefined ? ` Seu recorde aqui: ${cronometro(recorde)}.` : ''}`)
  log('caixas', nomeDe(player), plano.ordem.length, 'caminho', Math.round(plano.comprimento), 'vizinho', Math.round(plano.comprimentoVizinho), 'ingenuo', Math.round(plano.comprimentoIngenuo), 'lugar', chave, 'marcas', marcas.quantas)
}

export function gravar(player: Player): void {
  const p = vivo(player)
  if (!p) return void player.chat('Entre com um herói vivo para gravar uma rota.')
  const s = sessao(player)
  encerraTudo(s)
  s.gravacao = { amostras: [{ t: estado.agora, p }], acoes: [], ultimaAmostra: estado.agora }
  acompanhaMovimento(s)
  player.chat('Gravando. Faça o atalho do começo ao fim e digite /fim. O relógio da gravação conta da saída da partida até onde você parar.')
  player.centerText('Gravando a rota')
  log('gravar', nomeDe(player), p.x, p.y, p.z)
}

export function fim(player: Player): void {
  const s = sessao(player)
  if (!s.gravacao) return void player.chat('Nenhuma gravação rodando. Comece com /gravar.')
  const g = s.gravacao
  const p = vivo(player)
  if (p && estado.agora > g.ultimaAmostra) g.amostras.push({ t: estado.agora, p })
  s.gravacao = undefined
  acompanhaMovimento(s)
  player.centerText('')
  const r = montaRota(g.amostras, g.acoes, { mapa: estado.mapa, autor: nomeDe(player) })
  if ('erro' in r) return void player.chat(r.erro)
  s.ultima = r.rota
  descreveRota(player, r.rota)
  player.chat('Agora: /correr para tentar bater o tempo, ou /salvar <nome> para guardar.')
  log('rota gravada', nomeDe(player), 'comprimento', Math.round(r.rota.comprimento), 'tempo', r.rota.tempo.toFixed(2), 'pontos', r.rota.pontos.length, 'tecnicas', r.rota.tecnicas.join(',') || '-')
}

function descreveRota(player: Player, rota: Rota): void {
  player.chat(`${rota.nome ? `Rota ${rota.nome}` : 'Rota gravada'}: ${unidades(rota.comprimento)}, ${cronometro(rota.tempo)}, ${rota.pontos.length} pontos de controle.`)
  const tecnicas = rota.tecnicas.length > 0 ? rota.tecnicas.join(' → ') : 'nenhuma, só correndo'
  player.chat(`Técnicas: ${tecnicas}${rota.pousos > 0 ? ` (${rota.pousos} ${rota.pousos === 1 ? 'pouso' : 'pousos'})` : ''}.`)
  if (rota.recorde) player.chat(`Recorde: ${cronometro(rota.recorde.tempo)}, de ${rota.recorde.por}.`)
}

export function correr(player: Player, args: string): void {
  const s = sessao(player)
  const nome = args.trim() ? nomeDeRota(args) : undefined
  if (args.trim() && !nome) return void player.chat('Esse nome não vale. Use letras, números e hífen, até 24.')
  const rota = nome ? estado.arquivo.rotas[nome] : s.ultima
  if (!rota) return void player.chat(nome ? `Não achei a rota ${nome} neste mapa. /rotas lista as salvas.` : 'Nenhuma rota gravada ainda. Use /gravar e /fim, ou /correr <nome>.')
  if (rota.mapa !== estado.mapa) return void player.chat(`A rota ${rota.nome ?? ''} é do mapa ${rota.mapa}.`)
  if (!vivo(player)) return void player.chat('Entre com um herói vivo para correr.')
  encerraTudo(s)

  const marcas = new Marcas(player)
  marcas.poe(0, 'partida', rota.partida, COR.partida, 120)
  rota.pontos.forEach((ponto, k) => marcas.poe(k + 1, rotulo(rota, k), ponto.p, k === 0 ? COR.proxima : k === rota.pontos.length - 1 ? COR.fim : COR.depois, k === 0 ? 150 : 110))
  s.corrida = { rota, percurso: new Percurso(rota.partida, rota.pontos.map((x) => x.p)), marcas }
  const levou = player.teleport(rota.partida, { pitch: 0, yaw: rota.guinada, roll: 0 }, { x: 0, y: 0, z: 0 })
  player.chat(
    `${rota.nome ? `Rota ${rota.nome}` : 'Sua rota'}: ${rota.pontos.length} pontos, tempo gravado ${cronometro(rota.tempo)}${rota.recorde ? `, recorde ${cronometro(rota.recorde.tempo)}` : ''}.` +
      (levou ? ' O relógio começa quando você sai da partida.' : ' Vá até o marcador "partida"; o relógio começa quando você sair dele.'),
  )
  log('correr', nomeDe(player), rota.nome ?? '(última)', 'pontos', rota.pontos.length, 'marcas', marcas.quantas, 'teleporte', levou)
}

function rotulo(rota: Rota, k: number): string {
  const ultimo = k === rota.pontos.length - 1
  const numero = ultimo ? `${k + 1} · fim` : String(k + 1)
  const dicas = rota.pontos[k].dicas
  return dicas.length > 0 ? `${numero}\n${dicas.join(' · ')}` : numero
}

function guardaArquivo(): boolean {
  const ok = writeFile(arquivoDoMapa(estado.mapa), escreveArquivo(estado.arquivo))
  estado.persiste = ok
  return ok
}

export function salvar(player: Player, args: string): void {
  const s = sessao(player)
  if (!s.ultima) return void player.chat('Grave uma rota antes: /gravar e depois /fim.')
  const nome = nomeDeRota(args)
  if (!nome) return void player.chat('Use /salvar <nome>, com letras, números e hífen, até 24.')
  const rotas = estado.arquivo.rotas
  const existia = rotas[nome] !== undefined
  if (!existia && Object.keys(rotas).length >= MAXIMO_DE_ROTAS) return void player.chat(`Este mapa já tem ${MAXIMO_DE_ROTAS} rotas salvas.`)
  const rota: Rota = { ...s.ultima, nome, recorde: s.ultima.recorde }
  rotas[nome] = rota
  s.ultima = rota
  const ok = guardaArquivo()
  player.chat(
    `Rota ${nome} ${existia ? 'substituída' : 'salva'}.` +
      (ok ? ' Fica guardada no servidor para as próximas vezes.' : ' O servidor não guardou o arquivo: a rota vale só até o servidor fechar.'),
  )
  log('salvar', nome, 'arquivo', ok)
}

export function listaRotas(player: Player): void {
  const lista = Object.values(estado.arquivo.rotas)
  if (lista.length === 0) return void player.chat('Nenhuma rota salva neste mapa. Grave com /gravar e /fim, e guarde com /salvar <nome>.')
  player.chat(`Rotas de ${estado.mapa} (${lista.length}):`)
  for (const r of lista.sort((a, b) => (a.nome ?? '').localeCompare(b.nome ?? ''))) {
    player.chat(`${r.nome}: ${unidades(r.comprimento)}, gravada em ${cronometro(r.tempo)} por ${r.autor}${r.recorde ? `, recorde ${cronometro(r.recorde.tempo)} (${r.recorde.por})` : ''}.`)
  }
  player.chat('/correr <nome> para correr uma delas.')
}

/* ───────── a cada quadro ───────── */

function passoDasCaixas(s: Sessao, t: number): void {
  const rc = s.caixas!
  const checa = t - rc.checadaEm >= CHECAGEM_DAS_CAIXAS || rc.quebradasAgora.length > 0
  if (checa) rc.checadaEm = t
  const ditas = rc.quebradasAgora
  rc.quebradasAgora = []
  const eventos = rc.corrida.quadro(t, vivo(s.player), (id) => checa && entityPosition(id) === undefined, ditas)
  for (const e of eventos) {
    if (e.tipo === 'quebrou') {
      rc.marcas.tira(e.numero)
      const proxima = rc.corrida.proxima()
      if (proxima) rc.marcas.poe(proxima.numero, String(proxima.numero), proxima.caixa.p, COR.proxima, 150)
    } else if (e.tipo === 'terminou') {
      terminaCaixas(s, e.tempo, e.foraDeOrdem)
    }
  }
}

function terminaCaixas(s: Sessao, tempo: number, foraDeOrdem: number): void {
  const rc = s.caixas!
  const nome = nomeDe(s.player)
  const marca = estado.recordesDeCaixas.guarda(`${nome}|${rc.chave}`, tempo)
  const n = rc.plano.ordem.length
  const linha = marca.novo
    ? marca.anterior === undefined
      ? 'Primeiro tempo neste lugar'
      : `Novo recorde aqui (${diferenca(tempo, marca.anterior)})`
    : `Recorde aqui: ${cronometro(marca.melhor)} (${diferenca(tempo, marca.melhor)})`
  s.player.announce('Rota de caixas', `${cronometro(tempo)} · ${linha}`)
  s.player.chat(`${n} ${n === 1 ? 'caixa' : 'caixas'} em ${cronometro(tempo)}. ${linha}.${foraDeOrdem > 0 ? ` ${foraDeOrdem} fora da ordem.` : ''} /caixas de novo para repetir.`)
  s.resultado = { titulo: 'Rota de caixas', linha: `${cronometro(tempo)} · ${linha}`, ate: estado.agora + RESULTADO_NA_TELA }
  log('caixas fim', nome, n, 'tempo', tempo.toFixed(2), 'recorde', marca.melhor.toFixed(2), 'fora de ordem', foraDeOrdem, 'lugar', rc.chave)
  encerraCaixas(s)
  acompanhaMovimento(s)
}

function passoDaGravacao(s: Sessao, t: number): void {
  const g = s.gravacao!
  if (t - g.ultimaAmostra < INTERVALO_DA_AMOSTRA - 1e-6) return
  const p = vivo(s.player)
  if (!p) {
    s.gravacao = undefined
    acompanhaMovimento(s)
    s.player.centerText('')
    return void s.player.chat('A gravação parou: o herói morreu. Comece de novo com /gravar.')
  }
  g.amostras.push({ t, p })
  g.ultimaAmostra = t
  if (g.amostras.length >= AMOSTRAS_MAXIMAS) {
    s.player.chat('A gravação chegou ao limite de 10 minutos e terminou sozinha.')
    fim(s.player)
  }
}

function passoDaCorrida(s: Sessao, t: number): void {
  const c = s.corrida!
  const p = vivo(s.player)
  if (!p) {
    encerraCorrida(s)
    return void s.player.chat('A corrida parou: o herói morreu. /correr para tentar de novo.')
  }
  for (const e of c.percurso.quadro(t, p)) {
    if (e.tipo === 'pronto') s.player.centerText('Saia da partida para começar')
    else if (e.tipo === 'largou') {
      s.player.centerText('')
      c.marcas.tira(0)
    } else if (e.tipo === 'ponto') {
      c.marcas.tira(e.indice + 1)
      const k = e.indice + 1
      if (k < c.rota.pontos.length) c.marcas.poe(k + 1, rotulo(c.rota, k), c.rota.pontos[k].p, k === c.rota.pontos.length - 1 ? COR.fim : COR.proxima, 150)
    } else if (e.tipo === 'chegou') terminaCorrida(s, e.tempo)
  }
}

function terminaCorrida(s: Sessao, tempo: number): void {
  const { rota } = s.corrida!
  const nome = nomeDe(s.player)
  const anterior = rota.recorde
  const novo = !anterior || tempo < anterior.tempo
  if (novo) rota.recorde = { tempo, por: nome }
  let guardou: boolean | undefined
  if (novo && rota.nome && estado.arquivo.rotas[rota.nome] === rota) guardou = guardaArquivo()
  const contraGravacao = `gravação ${cronometro(rota.tempo)} (${diferenca(tempo, rota.tempo)})`
  const contraRecorde = novo ? (anterior ? `novo recorde (${diferenca(tempo, anterior.tempo)})` : 'primeiro recorde') : `recorde ${cronometro(anterior!.tempo)} de ${anterior!.por} (${diferenca(tempo, anterior!.tempo)})`
  s.player.announce(rota.nome ? `Rota ${rota.nome}` : 'Rota de movimento', `${cronometro(tempo)} · ${contraRecorde}`)
  s.player.chat(`Chegou em ${cronometro(tempo)}. Contra a ${contraGravacao}; ${contraRecorde}.${guardou === false ? ' O recorde não foi para o arquivo.' : ''} /correr de novo para repetir.`)
  s.resultado = { titulo: rota.nome ? `Rota ${rota.nome}` : 'Rota de movimento', linha: `${cronometro(tempo)} · ${contraRecorde}`, ate: estado.agora + RESULTADO_NA_TELA }
  log('corrida fim', nome, rota.nome ?? '(última)', 'tempo', tempo.toFixed(2), 'gravacao', rota.tempo.toFixed(2), 'recorde', rota.recorde!.tempo.toFixed(2))
  encerraCorrida(s)
}

export function quadro(t: number, movimento: readonly MovementSample[]): void {
  estado.agora = t
  for (const amostra of movimento) {
    const s = estado.sessoes.get(amostra.player.slot)
    if (!s) continue
    if (s.gravacao) for (const a of amostra.actions) if (eTecnica(a)) s.gravacao.acoes.push({ t, acao: a })
    if (s.caixas) for (const i of amostra.interactions) if (i.kind === 'propBroken') s.caixas.quebradasAgora.push(i.entity)
  }
  for (const s of estado.sessoes.values()) {
    if (s.caixas) passoDasCaixas(s, t)
    if (s.gravacao) passoDaGravacao(s, t)
    if (s.corrida) passoDaCorrida(s, t)
  }
}

/* ───────── ganchos do servidor ───────── */

export function mundo(mapa: string): void {
  const recusadas = cvar.apply(AJUSTES)
  if (recusadas.length > 0) log('variáveis recusadas:', recusadas.join(', '))
  const tropas = removeEntities('npc_trooper') ?? 0
  for (const s of estado.sessoes.values()) encerraTudo(s)
  estado.sessoes.clear()
  estado.mapa = mapa
  estado.arquivo = leArquivo(readFile(arquivoDoMapa(mapa)))
  log('mapa', mapa, 'caixas', findEntities(CLASSE_DAS_CAIXAS).length, 'rotas salvas', Object.keys(estado.arquivo.rotas).length, 'tropas tiradas', tropas)
}

export function saiu(player: Player): void {
  const s = estado.sessoes.get(player.slot)
  if (!s) return
  encerraTudo(s)
  estado.sessoes.delete(player.slot)
}

export function entrou(player: Player): void {
  player.chat('Rotas: treine a ordem das caixas e os atalhos do mapa. Digite /ajuda para ver os comandos.')
}
