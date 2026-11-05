import { describe, expect, it } from 'vitest';
import type { Lobby } from '../data/lobbies';
import { lobbies } from '../data/lobbies';
import { modes } from '../data/modes';
import { avatarArt, hashName } from './avatar';
import { COVERS, coverMarkup } from './cover';
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
  it('tem uma capa para cada modo', () => {
    for (const m of modes) expect(COVERS[m.slug]).toBeDefined();
  });

  it('é pintada só com tokens do tema (fora o branco da máscara)', () => {
    for (const m of modes) {
      for (const wide of [false, true]) {
        const { inner } = coverMarkup(m.slug, 'x', wide);
        const colors = inner.match(/(#[0-9a-f]{3,6}\b|hsl\(|rgb\()/gi) ?? [];
        expect(colors.every((c) => c.toLowerCase() === '#fff')).toBe(true);
        expect(inner).toMatch(/var\(--k0\)/);
      }
    }
  });

  it('ids únicos por instância e saída estável', () => {
    const a = coverMarkup('neblina', ':r1:');
    const b = coverMarkup('neblina', ':r2:');
    expect(a.inner).not.toBe(b.inner);
    expect(a.inner).not.toContain(':r1:');
    expect(coverMarkup('neblina', ':r1:')).toEqual(a);
    expect(coverMarkup('neblina', 'x', true).viewBox).toBe('-300 0 700 240');
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
    expect(cardTag(near, lobbyState(near, {}, NOW), true, NOW)).toEqual({ text: 'Falta 1', tone: 'acc' });
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
