// O autoteste das Rotas, no servidor do jogo. Iniciado com o argumento probe
// (`modlock dev --no-game --arg probe`), o modo põe um bot perto das caixas da lane em
// dl_midtown, roda /caixas para ele e tira as caixas na ordem do plano: o damage da SDK recusa
// props, e a caixa não tem a entrada Break, então o autoteste usa a entrada Kill, que tira a
// entidade do mapa como uma caixa quebrada. Confere que cada uma sai da lista e que o tempo fecha.
// Depois grava uma rota levando o bot por três pernas, salva, corre por ela mais rápido e
// confere o tempo. No fim apaga a rota do autoteste e sai com PASS ou FAIL.
import { addBot, fireInput, ground, heroes, log, type Player, ProbeRun, readField, readFile, writeFile } from 'modlock'

import { comprimento, distancia, interpola, type Ponto } from './comum'
import { arquivoDoMapa, escreveArquivo } from './percurso'
import { caixas, correr, estado, fim, gravar, salvar } from './rotas'

type Passo = 'sentar' | 'levar' | 'planejar' | 'quebrar' | 'gravar' | 'salvar' | 'correr' | 'chegar'

const espera: Record<Passo, string> = {
  sentar: 'o bot entrar com herói',
  levar: 'o bot chegar perto das caixas',
  planejar: 'o plano de caixas',
  quebrar: 'as caixas quebrarem e o tempo fechar',
  gravar: 'a gravação da rota',
  salvar: 'salvar a rota',
  correr: 'a corrida começar',
  chegar: 'a corrida terminar',
}

/** Um trecho de lane com caixas em dl_midtown, lido no servidor de verdade. */
const PERTO_DAS_CAIXAS: Ponto = { x: -1000, y: -3000, z: 384 }
/** As pernas da rota do autoteste, a partir de onde o bot está. */
const PERNAS: Ponto[] = [
  { x: 0, y: 0, z: 0 },
  { x: 900, y: 0, z: 0 },
  { x: 900, y: 700, z: 0 },
  { x: 200, y: 700, z: 0 },
]
const VELOCIDADE_DA_GRAVACAO = 600
const VELOCIDADE_DA_CORRIDA = 800
const NOME = 'autoteste'

export class Probe {
  private readonly run = new ProbeRun('Rotas', 300)
  private passo: Passo = 'sentar'
  private bot: Player | undefined
  private desde = 0
  private chave = ''
  private total = 0
  private batida: { id: number; em: number; kill: boolean } | undefined
  private porBreak = 0
  private porKill = 0
  private breakRecusado = false
  private caminho: Ponto[] = []
  private iniciado = false

  tick(agora: number): void {
    this.run.tick(agora, espera[this.passo], () => this.avanca(agora), () => this.descreve())
  }

  private descreve(): string {
    const s = this.bot && estado.sessoes.get(this.bot.slot)
    const c = s?.caixas?.corrida
    return `passo ${this.passo}, caixas ${c ? `${c.quebradas}/${c.ordem.length}` : '-'}, corrida ${s?.corrida ? `${s.corrida.percurso.estado} ${s.corrida.percurso.proximo}/${s.corrida.rota.pontos.length}` : '-'}, posição ${JSON.stringify(this.bot?.pawn()?.position)}`
  }

  private arquivos(): void {
    // A SDK guarda arquivos do mod no host. Um contador mostra se o arquivo sobrevive de uma
    // execução para a outra: rode o autoteste duas vezes e veja "execução anterior".
    const antes = readFile('autoteste.txt')
    const vez = (Number(antes) || 0) + 1
    const escreveu = writeFile('autoteste.txt', String(vez))
    const releu = readFile('autoteste.txt')
    log('arquivo', 'execução anterior', antes ?? '(nenhuma)', 'esta', vez, 'writeFile', escreveu, 'releu', releu ?? '(nada)')
  }

  private avanca(agora: number): boolean | string {
    if (!this.iniciado) {
      this.iniciado = true
      this.arquivos()
    }
    switch (this.passo) {
      case 'sentar': {
        if (!this.bot) {
          const heroi = heroes[0]?.name
          this.bot = addBot({ name: 'Bot Rotas', team: 2, hero: heroi, position: PERTO_DAS_CAIXAS })
          log('bot', heroi, this.bot?.slot)
          if (!this.bot) return 'addBot não criou o bot'
          return false
        }
        if (!this.bot.pawn()) return false
        const chao = ground({ ...PERTO_DAS_CAIXAS, z: PERTO_DAS_CAIXAS.z + 200 }, { above: 64, below: 2048 }) ?? PERTO_DAS_CAIXAS
        this.bot.teleport(chao, { pitch: 0, yaw: 0, roll: 0 }, { x: 0, y: 0, z: 0 })
        this.desde = agora
        this.passo = 'levar'
        return false
      }
      case 'levar': {
        const p = this.bot!.pawn()?.position
        if (!p || agora - this.desde < 1) return false
        if (distancia(p, PERTO_DAS_CAIXAS) > 600) return `o bot ficou longe das caixas: ${JSON.stringify(p)}`
        this.passo = 'planejar'
        return false
      }
      case 'planejar': {
        caixas(this.bot!, '')
        const rc = estado.sessoes.get(this.bot!.slot)?.caixas
        if (!rc) return 'o /caixas não montou uma rota perto do bot'
        const { plano } = rc
        log('plano', plano.ordem.length, 'caixas', 'caminho', Math.round(plano.comprimento), 'vizinho', Math.round(plano.comprimentoVizinho), 'ingenuo', Math.round(plano.comprimentoIngenuo), 'marcas', rc.marcas.criadas)
        const primeira = plano.ordem[0]
        log('caixa 1', primeira.id, 'm_iHealth', String(readField(primeira.id, 'CBaseEntity', 'm_iHealth', 'int32')))
        if (plano.ordem.length < 2) return `só ${plano.ordem.length} caixa perto do bot`
        if (plano.comprimento > plano.comprimentoIngenuo + 1e-6) return `o plano (${plano.comprimento}) saiu pior que a ordem do mapa (${plano.comprimentoIngenuo})`
        if (rc.marcas.criadas !== plano.ordem.length) return `marcas criadas ${rc.marcas.criadas} de ${plano.ordem.length}`
        this.chave = rc.chave
        this.total = plano.ordem.length
        this.desde = agora
        this.passo = 'quebrar'
        return false
      }
      case 'quebrar': {
        const s = estado.sessoes.get(this.bot!.slot)!
        const proxima = s.caixas?.corrida.proxima()
        if (this.batida && this.batida.id !== proxima?.caixa.id) {
          // O modo já tirou da lista a caixa batida: ela sumiu do mapa.
          if (this.batida.kill) this.porKill += 1
          else this.porBreak += 1
          this.batida = undefined
          this.desde = agora
        }
        if (!s.caixas) {
          const tempo = estado.recordesDeCaixas.melhor(`Bot Rotas|${this.chave}`)
          // Uma caixa que some junto com a vizinha conta no total, mas não foi batida.
          log('caixas quebradas', this.total, 'por Break', this.porBreak, 'por Kill', this.porKill, 'sem batida', this.total - this.porBreak - this.porKill, 'tempo', tempo?.toFixed(2))
          if (tempo === undefined || !(tempo > 0)) return `a rota de caixas terminou sem tempo (${tempo})`
          return this.comecaGravacao(agora)
        }
        if (!proxima) return false
        const id = proxima.caixa.id
        if (!this.batida) {
          if (agora - this.desde < 0.25) return false
          // O damage da SDK recusa props (o cliente cai com o dano neles); a entrada Break quebra
          // a caixa como um golpe faria. Se ela não sumir, Kill tira a entidade do mapa.
          // No servidor v0.1.73 a caixa não tem a entrada Break: depois da primeira recusa, o
          // autoteste vai direto ao Kill.
          const usaKill = this.breakRecusado
          const ok = fireInput(id, usaKill ? 'Kill' : 'Break')
          this.batida = { id, em: agora, kill: usaKill }
          if (!ok && !usaKill) {
            this.breakRecusado = true
            log('Break recusado na caixa', id, '- as próximas vão por Kill')
          }
          return false
        }
        // Quem confere se a caixa sumiu é o próprio modo, que a tira da lista.
        if (!this.batida.kill && agora - this.batida.em > 0.6) {
          log('caixa', id, 'ficou depois do Break; tentando Kill')
          fireInput(id, 'Kill')
          this.batida = { id, em: agora, kill: true }
          return false
        }
        if (agora - this.batida.em > 2) return `a caixa ${id} não sumiu nem com Break nem com Kill`
        return false
      }
      case 'gravar': {
        const s = estado.sessoes.get(this.bot!.slot)!
        const d = (agora - this.desde) * VELOCIDADE_DA_GRAVACAO
        this.leva(d)
        if (d < comprimento(this.caminho) + 300) return false
        fim(this.bot!)
        const rota = s.ultima
        if (!rota) return 'o /fim não montou a rota'
        log('rota', 'comprimento', Math.round(rota.comprimento), 'tempo', rota.tempo.toFixed(2), 'pontos', rota.pontos.length, 'esperado', Math.round(comprimento(this.caminho)), 'tecnicas', rota.tecnicas.join(',') || '-')
        if (rota.pontos.length < 3) return `só ${rota.pontos.length} pontos de controle`
        if (Math.abs(rota.comprimento - comprimento(this.caminho)) > 0.25 * comprimento(this.caminho)) return `comprimento ${Math.round(rota.comprimento)} longe do esperado ${Math.round(comprimento(this.caminho))}`
        this.passo = 'salvar'
        return false
      }
      case 'salvar': {
        salvar(this.bot!, NOME)
        const salva = estado.arquivo.rotas[NOME]
        if (!salva) return 'o /salvar não guardou a rota'
        const lido = readFile(arquivoDoMapa(estado.mapa))
        log('salvar', 'writeFile', estado.persiste, 'arquivo tem a rota', Boolean(lido?.includes(`"${NOME}"`)))
        correr(this.bot!, NOME)
        const s = estado.sessoes.get(this.bot!.slot)!
        if (!s.corrida) return 'o /correr não começou a corrida'
        if (s.corrida.marcas.criadas !== salva.pontos.length + 1) return `marcas da corrida ${s.corrida.marcas.criadas} de ${salva.pontos.length + 1}`
        this.desde = agora
        this.passo = 'correr'
        return false
      }
      case 'correr': {
        const s = estado.sessoes.get(this.bot!.slot)!
        if (!s.corrida) return 'a corrida acabou antes de começar'
        if (s.corrida.percurso.estado !== 'pronto') return agora - this.desde > 3 ? `o bot não chegou à partida (${s.corrida.percurso.estado})` : false
        if (agora - this.desde < 0.5) return false
        this.desde = agora
        this.passo = 'chegar'
        return false
      }
      case 'chegar': {
        const s = estado.sessoes.get(this.bot!.slot)!
        const rota = estado.arquivo.rotas[NOME]!
        if (s.corrida) {
          const d = (agora - this.desde) * VELOCIDADE_DA_CORRIDA
          this.leva(d)
          return d > comprimento(this.caminho) + 1500 ? `a corrida não fechou: ${s.corrida.percurso.proximo}/${rota.pontos.length}` : false
        }
        log('corrida', 'tempo', rota.recorde?.tempo.toFixed(2), 'gravacao', rota.tempo.toFixed(2))
        if (!rota.recorde) return 'a corrida terminou sem tempo'
        if (!(rota.recorde.tempo < rota.tempo)) return `a corrida mais rápida (${VELOCIDADE_DA_CORRIDA} contra ${VELOCIDADE_DA_GRAVACAO}) não bateu a gravação: ${rota.recorde.tempo} contra ${rota.tempo}`
        // Tira a rota do autoteste do arquivo, para ela não aparecer no /rotas de ninguém.
        delete estado.arquivo.rotas[NOME]
        log('limpeza', 'writeFile', writeFile(arquivoDoMapa(estado.mapa), escreveArquivo(estado.arquivo)))
        return true
      }
    }
  }

  private comecaGravacao(agora: number): boolean | string {
    const inicio = this.bot!.pawn()?.position
    if (!inicio) return 'o bot ficou sem herói'
    this.caminho = PERNAS.map((d) => ({ x: inicio.x + d.x, y: inicio.y + d.y, z: inicio.z + d.z }))
    gravar(this.bot!)
    if (!estado.sessoes.get(this.bot!.slot)?.gravacao) return 'o /gravar não começou'
    this.desde = agora
    this.passo = 'gravar'
    return false
  }

  /** Leva o bot até a distância d ao longo do caminho, com um teleporte por quadro. */
  private leva(d: number): void {
    let resta = Math.max(0, d)
    let p = this.caminho[this.caminho.length - 1]
    for (let i = 1; i < this.caminho.length; i++) {
      const perna = distancia(this.caminho[i - 1], this.caminho[i])
      if (resta <= perna) {
        p = interpola(this.caminho[i - 1], this.caminho[i], resta / perna)
        break
      }
      resta -= perna
    }
    this.bot!.teleport(p, { pitch: 0, yaw: 0, roll: 0 }, { x: 0, y: 0, z: 0 })
  }
}
