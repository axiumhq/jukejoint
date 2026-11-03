import { describe, expect, it } from 'vitest';
import { lobbies } from '../data/lobbies';
import { handoffState, missingForQuorum, nextToConfirm, readyCount, roomPhase, roster, ruleIcon } from './room';

const base = { you: 'Corvo', youHere: false, youReady: false, signedIn: false, now: Date.now() + 60_000 };

describe('roster', () => {
  const l = lobbies.find((x) => !x.mine && x.players >= 3 && x.players < x.slots)!;

  it('ocupa exatamente as vagas do lobby, sem nomes repetidos', () => {
    const seats = roster(l, base);
    expect(seats).toHaveLength(l.slots);
    const names = seats.filter((s) => s.name).map((s) => s.name);
    expect(names).toHaveLength(l.players);
    expect(new Set(names).size).toBe(names.length);
  });

  it('é estável: a mesma sala mostra as mesmas pessoas', () => {
    expect(roster(l, base).map((s) => s.name)).toEqual(roster(l, base).map((s) => s.name));
  });

  it('o anfitrião vem primeiro e está pronto', () => {
    const [first] = roster(l, base);
    expect(first).toMatchObject({ name: l.host, host: true, ready: true });
  });

  it('você aparece com o seu pronto quando está na sala', () => {
    const inside = { ...l, players: l.players + 1 };
    const seats = roster(inside, { ...base, youHere: true, youReady: true });
    expect(seats.filter((s) => s.you)).toEqual([expect.objectContaining({ name: 'Corvo', ready: true })]);
  });

  it('amigos só aparecem para quem entrou com a Steam', () => {
    const withFriends = { ...l, friends: 2, locked: false };
    const friends = ['Tordo', 'Lume'];
    expect(roster(withFriends, { ...base, friends }).some((s) => s.friend)).toBe(false);
    const seats = roster(withFriends, { ...base, signedIn: true, friends });
    expect(seats.filter((s) => s.friend).map((s) => s.name)).toEqual(friends);
  });
});

describe('missingForQuorum', () => {
  it('conta quantos faltam para o mínimo, nunca negativo', () => {
    expect(missingForQuorum({ ...lobbies[0]!, players: 3, minPlayers: 6 })).toBe(3);
    expect(missingForQuorum({ ...lobbies[0]!, players: 8, minPlayers: 6 })).toBe(0);
  });
});

describe('confirmações simuladas', () => {
  const l = lobbies.find((x) => !x.mine && x.players >= 4 && x.players < x.slots)!;
  const inside = { ...l, players: l.players + 1 };
  const opts = { ...base, youHere: true };

  it('quem está em `confirmed` fica pronto, e nextToConfirm anda pela fila', () => {
    const seats = roster(inside, opts);
    const next = nextToConfirm(seats);
    if (!next) return; // sala sem ninguém pendente: nada a simular
    const after = roster(inside, { ...opts, confirmed: new Set([next]) });
    expect(after.find((s) => s.name === next)?.ready).toBe(true);
    expect(readyCount(after)).toBe(readyCount(seats) + 1);
    expect(nextToConfirm(after)).not.toBe(next);
  });

  it('você nunca é confirmado pela simulação', () => {
    const seats = roster(inside, opts);
    expect(nextToConfirm(seats)).not.toBe('Corvo');
    const all = new Set(seats.filter((s) => s.name).map((s) => s.name!));
    expect(roster(inside, { ...opts, confirmed: all }).find((s) => s.you)?.ready).toBe(false);
    expect(nextToConfirm(roster(inside, { ...opts, confirmed: all }))).toBeNull();
  });
});

describe('roomPhase', () => {
  const p = { players: 10, minPlayers: 8, ready: 5, playing: false, countdown: false, handoff: false };
  it('segue as quatro fases', () => {
    expect(roomPhase({ ...p, players: 5 })).toEqual({ step: 1, key: 'gathering' });
    expect(roomPhase(p)).toEqual({ step: 2, key: 'waiting' });
    expect(roomPhase({ ...p, countdown: true })).toEqual({ step: 3, key: 'countdown' });
    expect(roomPhase({ ...p, playing: true, handoff: true })).toEqual({ step: 4, key: 'opening' });
    expect(roomPhase({ ...p, playing: true })).toEqual({ step: 4, key: 'playing' });
  });

  it('com o mínimo confirmado, não diz que começa: espera quem abriu', () => {
    expect(roomPhase({ ...p, ready: 8 })).toEqual({ step: 2, key: 'quorum' });
    expect(roomPhase({ ...p, ready: 9 })).toEqual({ step: 2, key: 'quorum' });
    // gente de menos ganha de confirmados (o mínimo é de jogadores na sala)
    expect(roomPhase({ ...p, players: 7, ready: 7, minPlayers: 8 })).toEqual({ step: 1, key: 'gathering' });
  });

  it('não diz "em partida" enquanto o app ainda abre o jogo', () => {
    // a sala já está em partida no servidor, mas você ainda está no handoff
    expect(roomPhase({ ...p, playing: true, handoff: true }).key).toBe('opening');
  });
});

describe('handoffState', () => {
  it('abrindo até a última etapa, dentro depois', () => {
    expect(handoffState(null, 3)).toBeNull();
    expect(handoffState(0, 3)).toBe('opening');
    expect(handoffState(2, 3)).toBe('opening');
    expect(handoffState(3, 3)).toBe('inside');
  });
});

describe('ruleIcon', () => {
  it('escolhe o ícone pelo assunto da regra', () => {
    expect(ruleIcon('Todos contra todos, sem times.')).toBe('swords');
    expect(ruleIcon('O círculo encolhe a cada 60 segundos.')).toBe('shrink');
    expect(ruleIcon('Cada abate concede um item aleatório.')).toBe('dice');
    expect(ruleIcon('Cada estação vencida adiciona 90 segundos ao relógio.')).toBe('clock');
    expect(ruleIcon('Todos os itens disponíveis desde o início.')).toBe('info');
  });
});
