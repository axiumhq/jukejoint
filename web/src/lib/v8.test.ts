import { describe, expect, it } from 'vitest';
import type { Lobby } from '../data/lobbies';
import { lobbies } from '../data/lobbies';
import { modes } from '../data/modes';
import { avatarArt, hashName } from './avatar';
import { coverFraming, loadScene, modeIcon, prepareScene, sceneId, sceneSlug, SCENE_SLUGS } from './cover';
import { friendsOnline, incomingInvite, OFFLINE_FRIENDS } from './friends';
import { cardTag, lobbyNum } from './lobbyCard';
import { EMPTY_FILTERS, filterLobbies, isJoinable, lobbyState, nearestAlternatives } from './lobbies';
import { flatHits, fold, searchAll } from './search';
import { DEFAULT_THEME, resolveTheme, THEMES } from './theme';

const NOW = 1_800_000_000_000;

function lobby(p: Partial<Lobby> = {}): Lobby {
  return {
    id: 'l07',
    name: 'Sala',
    modeSlug: 'circulo-profano',
    host: 'Anfitriã',
    hostIsFriend: false,
    region: 'BR',
    ping: 20,
    players: 6,
    slots: 12,
    friends: 0,
    status: 'aberto',
    joinInProgress: false,
    locked: false,
    minutesAgo: 5,
    openedAt: NOW - 5 * 60_000,
    minPlayers: 6,
    joins: [],
    ...p,
  };
}

describe('temas', () => {
  it('o Carvão neutro é o padrão e o primeiro da lista', () => {
    expect(DEFAULT_THEME).toBe('carvao');
    expect(THEMES[0]!.id).toBe('carvao');
    expect(THEMES.map((x) => x.id)).toEqual(['carvao', 'noite', 'ameixa', 'vinho']);
  });

  it('?theme= ganha do salvo, o salvo ganha do padrão e lixo cai no padrão', () => {
    expect(resolveTheme('"noite"', '?theme=vinho')).toBe('vinho');
    expect(resolveTheme('"noite"', '')).toBe('noite');
    expect(resolveTheme(null, '')).toBe('carvao');
    expect(resolveTheme('"neon"', '?theme=nada')).toBe('carvao');
    expect(resolveTheme('{quebrado', '')).toBe('carvao');
    // ids dos temas antigos (v8) caem no padrão
    expect(resolveTheme('"deadlock"', '')).toBe('carvao');
  });
});

describe('avatar gerado', () => {
  it('é determinístico e muda com o nome', () => {
    expect(avatarArt('Odete')).toEqual(avatarArt('Odete'));
    expect(avatarArt('Odete')).not.toEqual(avatarArt('Tordo'));
    expect(hashName('k0rvo')).toBe(hashName('k0rvo'));
  });

  it('usa cores próprias, nunca tokens do tema (não muda quando o tema muda)', () => {
    const a = avatarArt('Corvo_Noturno');
    expect(JSON.stringify(a)).not.toContain('var(--');
    expect(a.bg).toMatch(/^hsl\(/);
  });
});

describe('capas dos modos', () => {
  it('tem cena e ícones para cada modo, sem cair no fallback', () => {
    for (const m of modes) {
      expect(SCENE_SLUGS).toContain(m.slug);
      expect(sceneSlug(m.slug)).toBe(m.slug);
      expect(sceneId(m.slug)).toBe(`jjsc-${m.slug}`);
      expect(modeIcon(m.slug, 'glyph').viewBox).toBe('0 0 24 24');
      expect(modeIcon(m.slug, 'detalhe').viewBox).toBe('0 0 48 48');
      expect(modeIcon(m.slug, 'glyph').inner).toContain('<');
      expect(modeIcon(m.slug, 'detalhe').inner).toContain('<');
    }
    expect(sceneSlug('nao-existe')).toBe('circulo-profano');
  });

  it('enquadra por modo: janela dentro da cena, centrada no foco e ancorada à direita nos cartões', () => {
    for (const m of modes) {
      for (const v of ['card', 'wide', 'strip'] as const) {
        const [x, y, w, h] = coverFraming(m.slug, v).viewBox.split(' ').map(Number) as [number, number, number, number];
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(x + w).toBeLessThanOrEqual(1600);
        expect(y + h).toBeLessThanOrEqual(900);
      }
    }
    expect(coverFraming('neblina', 'card').preserveAspectRatio).toBe('xMaxYMid slice');
    // neblina: a faixa larga centra perto de y 400 (lanterna ~300, cabeça ~465)
    const [, ny, , nh] = coverFraming('neblina', 'wide').viewBox.split(' ').map(Number) as [number, number, number, number];
    expect(ny + nh / 2).toBeCloseTo(400, -1);
    // último bonde: a torre do relógio (x ~1360) fica dentro da faixa larga
    const [ux, , uw] = coverFraming('ultimo-bonde', 'wide').viewBox.split(' ').map(Number) as [number, number, number];
    expect(ux + uw).toBeGreaterThan(1400);
  });

  it('prefixa ids, classes e referências para as cenas conviverem no documento', () => {
    const raw =
      '<svg xmlns="x" viewBox="0 0 1600 900"><style>.c0{stop-color:var(--a,#000)}.c1{fill:var(--b,#fff) .5}</style><defs><linearGradient id="g1"><stop class="c0"/></linearGradient></defs><rect class="c1 c0" fill="url(#g1)"/><use href="#g1"/></svg>';
    const { css, body } = prepareScene(raw, 'p_');
    expect(css).toBe('.p_c0{stop-color:var(--a,#000)}.p_c1{fill:var(--b,#fff) .5}');
    expect(body).toContain('id="p_g1"');
    expect(body).toContain('url(#p_g1)');
    expect(body).toContain('href="#p_g1"');
    expect(body).toContain('class="p_c1 p_c0"');
    expect(body).not.toContain('<style');
  });

  it('cada cena é pintada com tokens (var com fallback), sem id nem classe repetidos entre cenas', async () => {
    const ids = new Set<string>();
    for (const s of SCENE_SLUGS) {
      const { css, body } = await loadScene(s);
      expect(css).toMatch(/var\(--[a-z0-9-]+,\s*#/i);
      expect(body).toContain('<');
      for (const [, id] of body.matchAll(/\bid="([^"]+)"/g)) {
        expect(ids.has(id!)).toBe(false);
        ids.add(id!);
      }
      // toda referência url(#x) aponta para um id da própria cena
      for (const [, ref] of body.matchAll(/url\(#([^)]+)\)/g)) expect(body).toContain(`id="${ref}"`);
    }
  });
});

describe('busca da barra superior', () => {
  const friends = friendsOnline(lobbies);

  it('acha lobby e modo sem acento', () => {
    const g = searchAll('circulo', lobbies, modes, friends, true);
    expect(g.modes.map((h) => h.label)).toContain('Círculo Profano');
    expect(g.lobbies.length).toBeGreaterThan(0);
    expect(g.lobbies.every((h) => fold(h.label).includes('circulo'))).toBe(true);
  });

  it('acha jogadores pelo nome e marca amigos só com login', () => {
    const on = searchAll('k0r', lobbies, modes, friends, true).players;
    expect(on[0]).toMatchObject({ label: 'k0rvo', friend: true, host: true });
    const off = searchAll('k0r', lobbies, modes, friends, false).players;
    expect(off[0]).toMatchObject({ label: 'k0rvo', friend: false });
  });

  it('lobby só com convite não expõe quem entrou', () => {
    const locked = lobby({ id: 'zz', locked: true, host: 'Porteira', joins: [{ name: 'Escondida', at: NOW }] });
    const g = searchAll('escondida', [locked], modes, [], false);
    expect(g.players).toHaveLength(0);
    expect(searchAll('porteira', [locked], modes, [], false).players).toHaveLength(1);
  });

  it('vazio não devolve nada e respeita os limites', () => {
    expect(flatHits(searchAll('  ', lobbies, modes, friends, true))).toHaveLength(0);
    expect(searchAll('a', lobbies, modes, friends, true).lobbies.length).toBeLessThanOrEqual(5);
  });
});

describe('cartão de lobby', () => {
  it('número do lobby vem do id de exemplo', () => {
    expect(lobbyNum(lobby({ id: 'l04' }))).toBe('04');
    expect(lobbyNum(lobby({ id: 'meu-123' }))).toBeNull();
  });

  it('etiqueta: falta N, da sua lista (só com login), convite, partida e você', () => {
    const near = lobby({ players: 11 });
    expect(cardTag(near, lobbyState(near, {}, NOW), true, NOW)).toEqual({ text: 'Última vaga', tone: 'acc' });
    const fr = lobby({ friends: 2 });
    expect(cardTag(fr, lobbyState(fr, {}, NOW), true, NOW)).toEqual({ text: '2 da sua lista', tone: 'soft' });
    expect(cardTag(fr, lobbyState(fr, {}, NOW), false, NOW)).toBeNull();
    const priv = lobby({ locked: true });
    expect(cardTag(priv, lobbyState(priv, {}, NOW), true, NOW)?.tone).toBe('lock');
    const play = lobby({ status: 'em-partida', joinInProgress: true, round: { current: 3, total: 5, startedAt: NOW } });
    expect(cardTag(play, lobbyState(play, {}, NOW), true, NOW)?.text).toBe('Em partida · rodada 3 de 5');
    const here = lobby();
    expect(cardTag(here, lobbyState(here, { hereId: here.id }, NOW), true, NOW)?.text).toBe('Você está aqui');
  });
});

describe('chips da home', () => {
  it('iniciantes, em partida e ping baixo filtram e têm vizinho no vazio', () => {
    const list = [lobby({ id: 'a', beginners: true, ping: 40 }), lobby({ id: 'b', status: 'em-partida', ping: 12 }), lobby({ id: 'c', ping: 18 })];
    const ids = (f: Partial<typeof EMPTY_FILTERS>) => filterLobbies(list, { ...EMPTY_FILTERS, ...f }, true, {}, NOW).map((l) => l.id);
    expect(ids({ beginners: true })).toEqual(['a']);
    expect(ids({ playing: true })).toEqual(['b']);
    expect(ids({ lowPing: true }).sort()).toEqual(['b', 'c']);
    expect(ids({ beginners: true, lowPing: true })).toEqual([]);
    const alt = nearestAlternatives(list, { ...EMPTY_FILTERS, beginners: true, lowPing: true }, true);
    expect(alt.map((s) => Object.keys(s.patch)[0])).toEqual(['beginners', 'lowPing']);
  });
});

describe('trilho social', () => {
  it('o convite recebido vem de um amigo que abriu lobby com vaga', () => {
    const friends = friendsOnline(lobbies);
    const inv = incomingInvite(friends, lobbies, isJoinable);
    expect(inv).not.toBeNull();
    expect(inv!.lobby.host).toBe(inv!.from);
    expect(isJoinable(inv!.lobby)).toBe(true);
    expect(incomingInvite(friends, lobbies, isJoinable, new Set(friends.filter((f) => f.host).map((f) => f.lobbyId!)))).toBeNull();
  });

  it('a lista offline tem 23 e ninguém dela está online', () => {
    expect(OFFLINE_FRIENDS).toHaveLength(23);
    const online = new Set(friendsOnline(lobbies).map((f) => f.name));
    expect(OFFLINE_FRIENDS.some((n) => online.has(n))).toBe(false);
  });
});
