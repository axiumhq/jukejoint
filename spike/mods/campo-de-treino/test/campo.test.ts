import { fake, type FakePlayer } from './fake-modlock'

// Each test loads a fresh copy of the mode against a fresh fake world.
async function load() {
  vi.resetModules()
  const f = await import('./fake-modlock')
  await import('../main')
  const campo = await import('../campo')
  const comandos = await import('../comandos')
  const drill = await import('../drill')
  f.fake.loadWorld()
  return { w: f.fake, campo, comandos, drill }
}

type Loaded = Awaited<ReturnType<typeof load>>

/** A person in the field with a hero, past the greeting. */
function person(w: typeof fake, name = 'Ana', slot = 0) {
  const p = w.join(name, slot)
  w.seat(p)
  w.tick(1.1)
  return p
}

function last(p: FakePlayer) {
  return p.chats().at(-1) ?? ''
}

function drillOf(l: Loaded, p: FakePlayer) {
  return l.campo.state.drills.get(p.slot)!
}

/** A target's player, by index, once the drill placed it. */
function target(l: Loaded, p: FakePlayer, i: number) {
  return drillOf(l, p).targets[i].bot as unknown as FakePlayer
}

describe('Campo de Treino', () => {
  let l: Loaded
  let w: typeof fake
  beforeEach(async () => {
    l = await load()
    w = l.w
  })

  describe('chegada e mapa', () => {
    it('quem entra é recebido, ganha um herói no time 2 e volta a cada queda', () => {
      const a = w.join('Ana', 0)
      w.tick(3.5)
      expect(a.said('Digite /ajuda')).toBe(true)
      expect(a.pawnState?.team).toBe(2)
      expect(a.said('Você entrou com')).toBe(true)
      a.kill()
      w.tick(2)
      expect(a.pawnState!.health).toBe(0)
      w.tick(1.5)
      expect(a.pawnState!.health).toBe(600)
    })

    it('quem já tem herói fica com ele', () => {
      const a = w.join('Ana', 0)
      w.seat(a, 'hero_dois')
      w.tick(3.5)
      expect(a.pawnState?.hero).toBe('hero_dois')
      expect(a.said('Você entrou com')).toBe(false)
    })

    it('o mapa novo esvazia o campo, libera heróis repetidos e deixa os bots parados', () => {
      expect(w.world.cvars.get('sv_hibernate_when_empty')).toBe(false)
      expect(w.world.cvars.get('citadel_allow_duplicate_heroes')).toBe(true)
      expect(w.world.cvars.get('citadel_bot_brain_disable_movement')).toBe(true)
      expect(w.world.cvars.get('citadel_bot_brain_disable_attacks')).toBe(true)
    })
  })

  describe('/ajuda', () => {
    it('lista todos os comandos, com os apelidos', () => {
      const a = person(w)
      w.type(a, '/ajuda')
      const text = a.chats().join('\n')
      for (const c of l.comandos.COMMANDS) expect(text).toContain(`/${c.name}`)
      expect(text).toContain('(ou /drill)')
      expect(last(a)).toContain('Sem placar')
    })

    it('cada comando atende pelo nome, pelos apelidos e em minúsculas', () => {
      for (const c of l.comandos.COMMANDS) {
        for (const n of [c.name, c.name.toLowerCase(), ...c.aliases]) expect(w.world.commands.has(n)).toBe(true)
      }
      expect(w.world.commands.has('drill')).toBe(true)
      expect(w.world.commands.has('sembots')).toBe(true)
      expect(w.world.commands.has('semrecarga')).toBe(true)
    })
  })

  describe('treino de alvos', () => {
    it('/alvos põe três alvos parados no outro time, no arco à frente', () => {
      const a = person(w)
      w.type(a, '/alvos')
      expect(last(a)).toContain('Treino de alvos: 30 s')
      w.tick(0.3)
      const d = drillOf(l, a)
      expect(d.targets).toHaveLength(l.drill.TARGET_COUNT)
      for (const t of d.targets) {
        const bot = t.bot as unknown as FakePlayer
        expect(bot.pawnState?.team).toBe(3)
        expect(bot.pawnState?.hero).toBe('hero_wraith')
        const gap = Math.hypot(bot.pawnState!.position.x, bot.pawnState!.position.y)
        expect(gap).toBeGreaterThanOrEqual(l.drill.NEAR - 1)
        expect(gap).toBeLessThanOrEqual(l.drill.FAR + 1)
        // O arco fica à frente (a pessoa olha para +x): no máximo 35 graus para cada lado.
        expect(bot.pawnState!.position.x).toBeGreaterThan(0)
        expect(bot.driven).toMatchObject({ forward: 0, left: 0, held: 0n })
        expect(t.entity).toBe(bot.pawnState!.entity)
      }
      expect(a.said('center:0 pontos')).toBe(true)
    })

    it('acerto no corpo vale 1, na cabeça vale 2, e o alvo pula sem tomar dano', () => {
      const a = person(w)
      w.type(a, '/drill')
      w.tick(0.3)
      const t0 = target(l, a, 0)
      const before = { ...t0.pawnState!.position }
      expect(w.hit(t0, 50, a, 2)).toBe(true)
      expect(t0.pawnState!.health).toBe(600)
      expect(drillOf(l, a).score).toBe(1)
      expect(t0.pawnState!.position).not.toEqual(before)
      w.hit(target(l, a, 1), 50, a, 1)
      expect(drillOf(l, a).score).toBe(3)
      expect(drillOf(l, a).headshots).toBe(1)
      expect(a.said('sound:Damage.Send.Crit')).toBe(true)
      w.tick(0.2)
      expect(a.said('center:3 pontos')).toBe(true)
    })

    it('o centro da tela só muda quando os pontos ou o segundo mudam', () => {
      const a = person(w)
      w.type(a, '/alvos 10')
      w.tick(2)
      const centers = a.log.filter((x) => x.startsWith('center:'))
      expect(centers).toEqual(['center:0 pontos · 10 s', 'center:0 pontos · 9 s', 'center:0 pontos · 8 s'])
    })

    it('o tiro de outra pessoa num alvo não pontua e não fere o alvo', () => {
      const a = person(w, 'Ana', 0)
      const b = person(w, 'Bia', 1)
      w.type(a, '/alvos')
      w.tick(0.3)
      const t0 = target(l, a, 0)
      expect(w.hit(t0, 50, b, 1)).toBe(true)
      expect(w.hit(t0, 50)).toBe(true)
      expect(t0.pawnState!.health).toBe(600)
      expect(drillOf(l, a).score).toBe(0)
    })

    it('no fim do relógio os alvos saem, o resultado aparece e o melhor fica guardado', () => {
      const a = person(w)
      w.type(a, '/alvos 10')
      w.tick(0.3)
      const bots = drillOf(l, a).targets.map((t) => t.bot as unknown as FakePlayer)
      w.hit(bots[0], 10, a, 1)
      w.hit(bots[1], 10, a, 2)
      w.tick(10)
      expect(l.campo.state.drills.has(a.slot)).toBe(false)
      expect(bots.every((b) => b.removed)).toBe(true)
      expect(w.bots()).toHaveLength(0)
      expect(a.said('announce:Fim do treino de alvos:3 pontos, 1 na cabeça. Seu novo recorde!')).toBe(true)
      expect(last(a)).toBe('Treino de alvos: 3 pontos, 1 na cabeça. Seu melhor nesta sessão: 3.')

      // Um resultado pior não apaga o melhor; um melhor passa a valer.
      w.type(a, '/alvos 10')
      expect(last(a)).toContain('Seu melhor: 3.')
      w.tick(0.3)
      w.hit(target(l, a, 0), 10, a, 2)
      w.tick(10)
      expect(last(a)).toBe('Treino de alvos: 1 pontos, 0 na cabeça. Seu melhor nesta sessão: 3.')
      w.type(a, '/alvos 10')
      w.tick(0.3)
      for (let i = 0; i < 4; i++) w.hit(target(l, a, i % 3), 10, a, 1)
      w.tick(10)
      expect(last(a)).toBe('Treino de alvos: 8 pontos, 4 na cabeça. Seu melhor nesta sessão: 8.')
    })

    it('o melhor é de cada pessoa', () => {
      const a = person(w, 'Ana', 0)
      const b = person(w, 'Bia', 1)
      w.type(a, '/alvos 10')
      w.tick(0.3)
      w.hit(target(l, a, 0), 10, a, 1)
      w.tick(10)
      w.type(b, '/alvos 10')
      expect(last(b)).not.toContain('Seu melhor')
      w.tick(10.3)
      expect(last(b)).toBe('Treino de alvos: 0 pontos, 0 na cabeça. Seu melhor nesta sessão: 0.')
      expect(l.campo.bestOf(a as never)).toBe(2)
    })

    it('/parar termina antes do tempo; sem treino, explica', () => {
      const a = person(w)
      w.type(a, '/parar')
      expect(last(a)).toContain('Você não está num treino de alvos')
      w.type(a, '/alvos')
      w.tick(1)
      w.type(a, '/parar')
      expect(l.campo.state.drills.has(a.slot)).toBe(false)
      expect(w.bots()).toHaveLength(0)
      expect(last(a)).toContain('Seu melhor nesta sessão: 0')
    })

    it('recusa duração fora dos limites, treino repetido e quem está sem herói', () => {
      const a = person(w)
      w.type(a, '/alvos 5')
      expect(last(a)).toContain('de 10 a 120')
      w.type(a, '/alvos abc')
      expect(last(a)).toContain('de 10 a 120')
      w.type(a, '/alvos')
      w.type(a, '/alvos')
      expect(last(a)).toContain('já está rodando')
      const b = w.join('Bia', 1)
      w.type(b, '/alvos')
      expect(last(b)).toContain('Entre com um herói vivo')
    })

    it('o treino acaba se quem treina cai', () => {
      const a = person(w)
      w.type(a, '/alvos')
      w.tick(0.3)
      a.kill()
      w.tick(0.2)
      expect(l.campo.state.drills.has(a.slot)).toBe(false)
      expect(w.bots()).toHaveLength(0)
    })

    it('um alvo que sai do lugar volta para ele', () => {
      const a = person(w)
      w.type(a, '/alvos')
      w.tick(0.3)
      const t = drillOf(l, a).targets[0]
      const bot = t.bot as unknown as FakePlayer
      bot.pawnState!.position = { x: 5000, y: 5000, z: 0 }
      w.tick(0.2)
      expect(bot.pawnState!.position).toEqual(t.spot)
    })

    it('alvos que não entram no servidor não começam o treino', () => {
      const a = person(w)
      w.world.botsRefused = true
      w.type(a, '/alvos')
      expect(last(a)).toBe('Os alvos não entraram no servidor.')
      expect(l.campo.state.drills.size).toBe(0)
    })
  })

  describe('bots de treino', () => {
    it('/bot <herói> chama aquele herói na frente, no outro time, e avisa os outros', () => {
      const a = person(w, 'Ana', 0)
      const b = person(w, 'Bia', 1)
      w.type(a, '/bot dois')
      expect(last(a)).toContain('Herói Dois entrou na sua frente')
      expect(b.said('Ana chamou um bot (Herói Dois)')).toBe(true)
      w.tick(0.3)
      const bot = l.campo.state.bots[0].player as unknown as FakePlayer
      expect(bot.pawnState?.hero).toBe('hero_dois')
      expect(bot.pawnState?.team).toBe(3)
      expect(bot.pawnState?.position).toEqual({ x: l.campo.BOT_DISTANCE, y: 0, z: 0 })
    })

    it('sem nome vem um herói sorteado; com nome que não existe também, e diz', () => {
      const a = person(w)
      w.type(a, '/bot')
      expect(last(a)).toContain('entrou na sua frente')
      w.type(a, '/bot zzz')
      expect(last(a)).toContain('Não achei o herói "zzz", então veio um sorteado')
      expect(w.bots()).toHaveLength(2)
    })

    it('tem limite de bots de treino', () => {
      const a = person(w)
      for (let i = 0; i < l.campo.MAX_PRACTICE_BOTS; i++) w.type(a, '/bot')
      w.type(a, '/bot')
      expect(last(a)).toContain(`Já tem ${l.campo.MAX_PRACTICE_BOTS} bots no campo`)
      expect(w.bots()).toHaveLength(l.campo.MAX_PRACTICE_BOTS)
    })

    it('bots de treino e alvos juntos não passam do teto do modo', () => {
      const ps = [0, 1, 2, 3].map((i) => person(w, `P${i}`, i))
      for (let i = 0; i < l.campo.MAX_PRACTICE_BOTS; i++) w.type(ps[0], '/bot')
      w.type(ps[0], '/alvos')
      w.type(ps[1], '/alvos')
      expect(l.campo.modBots()).toBe(l.campo.MAX_MOD_BOTS - 2)
      w.type(ps[2], '/alvos')
      expect(last(ps[2])).toContain('O campo está cheio de bots')
      expect(l.campo.modBots()).toBeLessThanOrEqual(l.campo.MAX_MOD_BOTS)
    })

    it('um bot de treino que cai volta em 3 segundos, no mesmo lugar', () => {
      const a = person(w)
      w.type(a, '/bot')
      w.tick(0.3)
      const bot = l.campo.state.bots[0].player as unknown as FakePlayer
      bot.kill()
      bot.pawnState!.position = { x: -9000, y: 0, z: 0 }
      w.tick(2.5)
      expect(bot.pawnState!.health).toBe(0)
      w.tick(1)
      expect(bot.pawnState!.health).toBe(600)
      expect(bot.pawnState!.position).toEqual({ x: l.campo.BOT_DISTANCE, y: 0, z: 0 })
    })

    it('/semBots tira os bots de treino e deixa os alvos', () => {
      const a = person(w, 'Ana', 0)
      const b = person(w, 'Bia', 1)
      w.type(a, '/semBots')
      expect(last(a)).toBe('Não tem bot de treino no campo.')
      w.type(a, '/bot')
      w.type(a, '/bot')
      w.type(a, '/alvos')
      w.type(b, '/sembots')
      expect(last(b)).toBe('Tirei os 2 bots de treino.')
      expect(a.said('Bia tirou os bots de treino.')).toBe(true)
      expect(l.campo.state.bots).toHaveLength(0)
      expect(w.bots()).toHaveLength(l.drill.TARGET_COUNT)
    })

    it('/bot pede um herói a quem está sem', () => {
      const a = w.join('Ana', 0)
      w.type(a, '/bot')
      expect(last(a)).toContain('Entre com um herói')
    })

    it('/dificuldade muda o que os bots fazem, para todos', () => {
      const a = person(w, 'Ana', 0)
      const b = person(w, 'Bia', 1)
      w.type(a, '/dificuldade')
      expect(last(a)).toContain('ficam parados e não atacam (parado)')
      w.type(a, '/dificuldade ativo')
      expect(last(a)).toBe('Agora os bots andam e atacam. Vale para todos os bots do servidor.')
      expect(b.said('Ana mudou os bots: agora eles andam e atacam.')).toBe(true)
      expect(w.world.cvars.get('citadel_bot_brain_disable_attacks')).toBe(false)
      expect(w.world.cvars.get('citadel_bot_brain_disable_movement')).toBe(false)
      w.type(a, '/dificuldade passivo')
      expect(w.world.cvars.get('citadel_bot_brain_disable_attacks')).toBe(true)
      expect(w.world.cvars.get('citadel_bot_brain_disable_movement')).toBe(false)
      w.type(a, '/bot')
      expect(last(a)).toContain('Os bots andam, mas não atacam')
      w.type(a, '/dificuldade difícil')
      expect(last(a)).toContain('Não conheço "difícil"')
    })

    it('se o servidor recusa a dificuldade, os bots ficam como estavam', () => {
      const a = person(w)
      w.world.refuse.add('citadel_bot_brain_disable_attacks')
      w.type(a, '/dificuldade ativo')
      expect(last(a)).toContain('O servidor recusou a mudança')
      expect(l.campo.state.level).toBe('parado')
    })
  })

  describe('ajustes de cada um', () => {
    it('/semRecarga zera a recarga de quem pediu, e só dela', () => {
      const a = person(w, 'Ana', 0)
      const b = person(w, 'Bia', 1)
      w.type(a, '/semRecarga')
      expect(last(a)).toContain('Sem recarga: ligado')
      a.setAbility({ ability: 'ab1', cooldownEnd: 99 })
      a.setAbility({ ability: 'ab2', rechargeEnd: 50 })
      b.setAbility({ ability: 'ab1', cooldownEnd: 99 })
      w.tick(0.1)
      expect(a.abilities().find((x) => x.name === 'ab1')!.cooldownEnd).toBe(0)
      expect(a.abilities().find((x) => x.name === 'ab2')!.rechargeEnd).toBe(0)
      expect(b.abilities().find((x) => x.name === 'ab1')!.cooldownEnd).toBe(99)
      // A cada uso, de novo.
      a.setAbility({ ability: 'ab1', cooldownEnd: 120 })
      w.tick(0.1)
      expect(a.abilities().find((x) => x.name === 'ab1')!.cooldownEnd).toBe(0)
      w.type(a, '/semrecarga')
      expect(last(a)).toContain('desligado')
      a.setAbility({ ability: 'ab1', cooldownEnd: 99 })
      w.tick(0.5)
      expect(a.abilities().find((x) => x.name === 'ab1')!.cooldownEnd).toBe(99)
    })

    it('sem refreshAbility, zera a recarga pelo setAbility', () => {
      const a = person(w)
      a.refreshAbility = () => false
      w.type(a, '/semRecarga')
      a.setAbility({ ability: 'ab0', cooldownEnd: 80 })
      w.tick(0.1)
      expect(a.abilities().find((x) => x.name === 'ab0')!.cooldownEnd).toBe(0)
    })

    it('/vida barra o golpe que mata e devolve a vida; desligada, o golpe mata', () => {
      const a = person(w)
      w.type(a, '/vida')
      expect(last(a)).toContain('Vida infinita: ligada')
      expect(w.hit(a, 100)).toBe(false)
      expect(a.pawnState!.health).toBe(500)
      w.tick(0.1)
      expect(a.pawnState!.health).toBe(600)
      expect(w.hit(a, 10_000)).toBe(true)
      expect(w.hit(a, 300)).toBe(true)
      expect(a.pawnState!.health).toBe(600)
      w.type(a, '/vida')
      expect(last(a)).toBe('Vida infinita: desligada.')
      expect(w.hit(a, 10_000)).toBe(false)
      expect(a.pawnState!.health).toBe(0)
    })

    it('com /vida, quem cai mesmo assim volta na hora, no mesmo lugar', () => {
      const a = person(w)
      w.type(a, '/vida')
      a.pawnState!.position = { x: 321, y: 654, z: 0 }
      w.tick(0.1)
      a.kill()
      // A volta normal leva 3 segundos e começa na base.
      a.respawn = () => {
        a.pawnState!.health = 600
        a.pawnState!.position = { x: 2000, y: 0, z: 0 }
        return true
      }
      w.tick(0.3)
      expect(a.pawnState!.health).toBe(600)
      expect(a.pawnState!.position).toEqual({ x: 321, y: 654, z: 0 })
    })

    it('com /vida, um golpe no mesmo quadro em que ligou também volta para o lugar', () => {
      const a = person(w)
      a.pawnState!.position = { x: 77, y: 88, z: 0 }
      w.type(a, '/vida')
      a.kill()
      a.respawn = () => {
        a.pawnState!.health = 600
        a.pawnState!.position = { x: 2000, y: 0, z: 0 }
        return true
      }
      w.tick(0.3)
      expect(a.pawnState!.position).toEqual({ x: 77, y: 88, z: 0 })
    })

    it('/vida vale só para quem pediu', () => {
      const a = person(w, 'Ana', 0)
      const b = person(w, 'Bia', 1)
      w.type(a, '/vida')
      expect(w.hit(b, 10_000)).toBe(false)
      expect(b.pawnState!.health).toBe(0)
    })

    it('/almas dá almas: 10000 sem número, o número pedido com número', () => {
      const a = person(w)
      w.type(a, '/almas')
      expect(a.pawnState!.souls).toBe(10_000)
      w.type(a, '/almas 2.500')
      expect(last(a)).toBe('Mais 2500 almas.')
      expect(a.pawnState!.souls).toBe(12_500)
      for (const bad of ['0', '-5', 'muito', '1000000']) {
        w.type(a, `/almas ${bad}`)
        expect(last(a)).toContain('Use /almas')
      }
      expect(a.pawnState!.souls).toBe(12_500)
    })

    it('/item dá o item pelo nome da loja, inteiro ou em parte', () => {
      const a = person(w)
      w.type(a, '/item headshot_booster')
      expect(last(a)).toBe('Você ganhou headshot_booster.')
      w.type(a, '/item upgrade_extra_health')
      w.type(a, '/item velocity')
      w.type(a, '/item mystic burst')
      expect(a.items).toEqual(['upgrade_headshot_booster', 'upgrade_extra_health', 'upgrade_high_velocity_mag', 'upgrade_mystic_burst'])
    })

    it('/item com vários ou nenhum item explica', () => {
      const a = person(w)
      w.type(a, '/item extra')
      expect(last(a)).toBe('2 itens com "extra": extra_health, extra_stamina. Digite um deles.')
      w.type(a, '/item espada')
      expect(last(a)).toContain('Nenhum item com "espada"')
      w.type(a, '/item')
      expect(last(a)).toContain('Use /item <nome>')
      expect(a.items).toEqual([])
    })

    it('/heroi troca o herói no mesmo time e mantém os ajustes', () => {
      const a = person(w)
      w.type(a, '/vida')
      w.type(a, '/heroi dois')
      expect(last(a)).toBe('Trocando para Herói Dois. Seus ajustes continuam.')
      w.tick(0.1)
      expect(a.pawnState?.hero).toBe('hero_dois')
      expect(a.pawnState?.team).toBe(2)
      expect(l.campo.togglesOf(a as never).godMode).toBe(true)
      w.type(a, '/heroi zzz')
      expect(last(a)).toBe('Não achei o herói "zzz".')
      w.type(a, '/heroi')
      expect(last(a)).toContain('Use /heroi <nome>')
    })

    it('/reset devolve o herói ao começo e desliga os ajustes', () => {
      const a = person(w)
      w.type(a, '/semRecarga')
      w.type(a, '/vida')
      w.type(a, '/almas 500')
      w.type(a, '/item headshot')
      w.type(a, '/reset')
      expect(last(a)).toContain('Herói como no começo')
      expect(a.items).toEqual([])
      expect(a.pawnState!.souls).toBe(0)
      expect(l.campo.togglesOf(a as never)).toEqual({ noCooldown: false, godMode: false })
      expect(w.hit(a, 10_000)).toBe(false)
    })

    it('quem sai perde os ajustes; quem entra na vaga começa do zero', () => {
      const a = person(w)
      w.type(a, '/vida')
      w.leave(a)
      w.tick(1.1)
      expect(l.campo.state.toggles.size).toBe(0)
      const b = w.join('Bia', 0)
      w.seat(b)
      w.tick(1.1)
      expect(w.hit(b, 10_000)).toBe(false)
    })

    it('a linha na tela mostra os ajustes ligados, e nada sem eles', () => {
      const a = person(w)
      w.tick(0.1)
      expect(JSON.stringify(a.ui)).not.toContain('Sem recarga')
      w.type(a, '/semRecarga')
      w.type(a, '/vida')
      w.tick(0.1)
      expect(JSON.stringify(a.ui)).toContain('Sem recarga · Vida infinita')
      w.type(a, '/reset')
      w.tick(0.1)
      expect(JSON.stringify(a.ui)).not.toContain('Vida infinita')
    })
  })
})
