import { describe, expect, it } from 'vitest';
import { lobbies } from '../data/lobbies';
import { missingForQuorum, roster } from './room';

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
    expect(roster(withFriends, base).some((s) => s.friend)).toBe(false);
    expect(roster(withFriends, { ...base, signedIn: true }).filter((s) => s.friend)).toHaveLength(2);
  });
});

describe('missingForQuorum', () => {
  it('conta quantos faltam para o mínimo, nunca negativo', () => {
    expect(missingForQuorum({ ...lobbies[0]!, players: 3, minPlayers: 6 })).toBe(3);
    expect(missingForQuorum({ ...lobbies[0]!, players: 8, minPlayers: 6 })).toBe(0);
  });
});
