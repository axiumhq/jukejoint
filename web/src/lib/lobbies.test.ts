import { describe, expect, it } from 'vitest';
import type { Lobby } from '../data/lobbies';
import { liveTick } from '../state/session';
import {
  activity,
  filterCounts,
  filterLobbies,
  heat,
  isJoinable,
  lobbyState,
  nearestAlternatives,
  pickBestLobby,
  EMPTY_FILTERS,
  type KnockStatus,
} from './lobbies';

const NOW = 1_800_000_000_000;
const MIN = 60_000;

function lobby(p: Partial<Lobby> = {}): Lobby {
  return {
    id: 'x',
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
    openedAt: NOW - 5 * MIN,
    minPlayers: 6,
    joins: [{ name: 'A', at: NOW - 4 * MIN }],
    ...p,
  };
}

describe('lobbyState: a tabela de estados do brief v4', () => {
  it('aberto: sem rótulo, verbo Entrar', () => {
    const s = lobbyState(lobby(), {}, NOW);
    expect(s).toMatchObject({ kind: 'open', label: null, verb: 'Entrar', canJoin: true });
  });

  it('seu lobby: "Você está aqui" com Convidar e Fechar, nunca Entrar', () => {
    const s = lobbyState(lobby({ mine: true }), {}, NOW);
    expect(s).toMatchObject({ kind: 'mine', label: 'Você está aqui', verb: 'Convidar', secondary: 'close', canJoin: false, you: true });
  });

  it('já entrou: "Você está aqui" com Sair', () => {
    const s = lobbyState(lobby({ id: 'a' }), { hereId: 'a' }, NOW);
    expect(s).toMatchObject({ kind: 'joined', label: 'Você está aqui', verb: 'Sair', action: 'leave', canJoin: false });
  });

  it('privado: "Com convite" e Bater na porta; não entra direto', () => {
    const l = lobby({ locked: true });
    expect(isJoinable(l)).toBe(false);
    expect(lobbyState(l, {}, NOW)).toMatchObject({ kind: 'private', label: 'Com convite', verb: 'Bater na porta', canJoin: false });
  });

  it('privado: pedido pendente e depois porta aberta', () => {
    const l = lobby({ id: 'p', locked: true });
    const pending = new Map<string, KnockStatus>([['p', 'pending']]);
    const accepted = new Map<string, KnockStatus>([['p', 'accepted']]);
    expect(lobbyState(l, { knocks: pending }, NOW)).toMatchObject({ kind: 'knocking', verb: 'Pedido enviado', canJoin: false });
    expect(lobbyState(l, { knocks: accepted }, NOW)).toMatchObject({ kind: 'invited', label: 'Porta aberta', verb: 'Entrar', canJoin: true });
  });

  it('cheio: Lotado e Avisar quando vagar (ligado vira Aviso ligado)', () => {
    const l = lobby({ id: 'c', players: 12, status: 'cheio' });
    expect(lobbyState(l, {}, NOW)).toMatchObject({ kind: 'full', label: 'Lotado', verb: 'Avisar quando vagar' });
    expect(lobbyState(l, { notify: new Set(['lobby:c']) }, NOW)).toMatchObject({ verb: 'Aviso ligado', notifyOn: true });
  });

  it('em partida: rodada no rótulo; entra no meio só se aceitar', () => {
    const round = { current: 3, total: 5, startedAt: NOW - 6 * MIN };
    const open = lobbyState(lobby({ status: 'em-partida', joinInProgress: true, round }), {}, NOW);
    expect(open).toMatchObject({ kind: 'playing-open', label: 'Em partida, rodada 3 de 5', verb: 'Entrar no meio', canJoin: true });
    const closed = lobbyState(lobby({ status: 'em-partida', joinInProgress: false, round }), {}, NOW);
    expect(closed).toMatchObject({ kind: 'playing-closed', verb: 'Avisar quando acabar', canJoin: false });
  });

  it('cheio tem precedência sobre privado (não adianta bater numa sala lotada)', () => {
    expect(lobbyState(lobby({ locked: true, players: 12, status: 'cheio' }), {}, NOW).kind).toBe('full');
  });
});

describe('heat()', () => {
  it('Lotando: 80% ou mais e alguém entrou em 2 min', () => {
    expect(heat(lobby({ players: 10, joins: [{ name: 'a', at: NOW - 60_000 }] }), NOW)).toBe('lotando');
  });
  it('Esquentando: 3 entradas em 2 min', () => {
    const joins = [1, 2, 3].map((i) => ({ name: `j${i}`, at: NOW - i * 20_000 }));
    expect(heat(lobby({ players: 5, joins }), NOW)).toBe('esquentando');
  });
  it('Recém-aberto: aberto há menos de 2 min', () => {
    expect(heat(lobby({ openedAt: NOW - 60_000, joins: [] }), NOW)).toBe('recem');
  });
  it('Quieto: ninguém entra há 10 min', () => {
    expect(heat(lobby({ openedAt: NOW - 30 * MIN, joins: [{ name: 'a', at: NOW - 12 * MIN }] }), NOW)).toBe('quieto');
  });
  it('privado, cheio e em partida não têm calor', () => {
    expect(heat(lobby({ locked: true, players: 10, joins: [{ name: 'a', at: NOW }] }), NOW)).toBeNull();
    expect(heat(lobby({ players: 12, status: 'cheio' }), NOW)).toBeNull();
    expect(heat(lobby({ status: 'em-partida' }), NOW)).toBeNull();
  });
});

describe('activity()', () => {
  it('"entrou agora" só para evento fresco e lobby público', () => {
    const l = lobby({ joins: [{ name: 'Ametista', at: NOW - 2000 }] });
    expect(activity(l, lobbyState(l, {}, NOW), NOW)).toMatchObject({ text: 'Ametista entrou agora', fresh: true });
    const p = lobby({ locked: true, joins: [{ name: 'Ametista', at: NOW - 2000 }] });
    expect(activity(p, lobbyState(p, {}, NOW), NOW).text).toBe('aberto há 5 min');
  });
  it('seu lobby conta quem entrou desde que você abriu', () => {
    const l = lobby({ mine: true, joins: [{ name: 'eu', at: NOW - 4 * MIN, you: true }, { name: 'b', at: NOW - MIN }] });
    expect(activity(l, lobbyState(l, {}, NOW), NOW).text).toBe('1 entrou desde que você abriu');
  });
});

describe('pickBestLobby(): o "Jogar agora" usa o mesmo pool da lista', () => {
  const pool = [
    lobby({ id: 'privado', locked: true, friends: 3 }),
    lobby({ id: 'cheio', players: 12, status: 'cheio', friends: 2 }),
    lobby({ id: 'meu', mine: true }),
    lobby({ id: 'longe', region: 'EU', ping: 200 }),
    lobby({ id: 'amigos', friends: 2, ping: 40 }),
    lobby({ id: 'perto', ping: 10 }),
  ];
  it('nunca escolhe privado, cheio ou o seu; prefere amigos', () => {
    expect(pickBestLobby(pool, { now: NOW })?.id).toBe('amigos');
  });
  it('ignora o lobby em que você já está', () => {
    expect(pickBestLobby(pool, { now: NOW, ctx: { hereId: 'amigos' } })?.id).toBe('perto');
  });
  it('filtra por modo e devolve undefined quando não há candidato', () => {
    expect(pickBestLobby(pool, { now: NOW, mode: 'neblina' })).toBeUndefined();
  });
});

describe('filtros', () => {
  const pool = [lobby({ id: 'a', region: 'BR' }), lobby({ id: 'b', region: 'NA', ping: 130 }), lobby({ id: 'c', region: 'EU', modeSlug: 'neblina', ping: 190 })];
  it('contagens por opção mantêm as outras escolhas', () => {
    const c = filterCounts(pool, { ...EMPTY_FILTERS, mode: 'circulo-profano' }, false);
    expect(c.regions).toEqual({ BR: 1, NA: 1, EU: 0 });
    expect(c.modes['neblina']).toBe(1);
  });
  it('vazio filtrado sugere o vizinho mais próximo, por ping', () => {
    const s = nearestAlternatives(pool, { ...EMPTY_FILTERS, mode: 'circulo-profano', regions: ['EU'] }, false);
    expect(s[0]?.label).toBe('Em BR/SA tem 1 (20 ms)');
  });
  it('ordem "ativos": você primeiro, depois quem dá para entrar', () => {
    const list = [lobby({ id: 'cheio', players: 12, status: 'cheio' }), lobby({ id: 'aberto', players: 3 }), lobby({ id: 'aqui', players: 2 })];
    const out = filterLobbies(list, EMPTY_FILTERS, false, { hereId: 'aqui' }, NOW).map((l) => l.id);
    expect(out).toEqual(['aqui', 'aberto', 'cheio']);
  });
});

describe('liveTick()', () => {
  it('reserva a vaga de quem está entrando', () => {
    const list = [lobby({ id: 'j', players: 11, slots: 12 })];
    for (let i = 0; i < 50; i++) {
      const out = liveTick(list, null, NOW, 'j');
      expect(out[0]!.players).toBeLessThanOrEqual(11);
    }
  });
});
