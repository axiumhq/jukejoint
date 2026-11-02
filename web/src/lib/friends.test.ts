import { describe, expect, it } from 'vitest';
import { lobbies } from '../data/lobbies';
import { friendsIn, friendsOnline } from './friends';

describe('friendsOnline', () => {
  const list = friendsOnline(lobbies);

  it('cada lobby tem tantos amigos quanto a contagem da tabela', () => {
    for (const l of lobbies.filter((x) => !x.locked)) expect(friendsIn(list, l.id)).toHaveLength(l.friends);
  });

  it('ninguém está em dois lugares', () => {
    const names = list.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('o anfitrião amigo aparece como anfitrião do próprio lobby', () => {
    for (const l of lobbies.filter((x) => x.hostIsFriend)) expect(list).toContainEqual({ name: l.host, lobbyId: l.id, host: true });
  });

  it('também mostra amigos online fora de lobby', () => {
    expect(list.filter((f) => f.lobbyId === null).length).toBeGreaterThan(0);
  });

  it('não muda quando você cria um lobby', () => {
    const mine = { ...lobbies[0]!, id: 'meu-1', mine: true, friends: 0, hostIsFriend: false };
    expect(friendsOnline([mine, ...lobbies])).toEqual(list);
  });
});
