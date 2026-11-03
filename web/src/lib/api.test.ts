import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LIVE, wsUrl } from '../data/source';
import { backoffMs, confirmations, EMPTY_LIVE, pickInvite, reduce, toLobby, toPresence, type LiveState, type LobbyView, type ServerMsg } from './api';
import { LiveClient, type SocketLike } from './liveClient';
import { roster } from './room';

const NOW = 1_800_000_000_000;

function view(p: Partial<LobbyView> = {}): LobbyView {
  return {
    id: 'l1',
    name: 'Duelo',
    modeSlug: 'duelo-meia-noite',
    region: 'BR',
    hostId: 'dev:ana',
    hostName: 'Ana',
    players: 2,
    slots: 8,
    minPlayers: 2,
    locked: false,
    beginners: false,
    joinInProgress: true,
    status: 'aberto',
    phase: 'open',
    openedAt: NOW - 3 * 60_000,
    seats: [
      { userId: 'dev:ana', name: 'Ana', host: true, ready: true },
      { userId: 'dev:bia', name: 'Bia', ready: false },
    ],
    joins: [
      { userId: 'dev:ana', name: 'Ana', at: NOW - 3 * 60_000 },
      { userId: 'dev:bia', name: 'Bia', at: NOW - 1000 },
    ],
    ...p,
  };
}

const run = (msgs: ServerMsg[], from: LiveState = EMPTY_LIVE, now = NOW) => msgs.reduce((s, m) => reduce(s, m, now), from);

describe('fonte de dados', () => {
  it('sem VITE_API_URL o site continua simulado', () => {
    expect(LIVE).toBe(false);
  });
  it('troca http por ws no endereço do socket', () => {
    expect(wsUrl('http://localhost:8090')).toBe('ws://localhost:8090/api/ws');
    expect(wsUrl('https://api.exemplo.com')).toBe('wss://api.exemplo.com/api/ws');
  });
});

describe('reduce', () => {
  const me = { id: 'dev:bia', name: 'Bia' };

  it('o welcome zera o estado; a lista marca como sincronizado', () => {
    const dirty: LiveState = { ...EMPTY_LIVE, synced: true, lobbies: { x: view({ id: 'x' }) }, hereId: 'x' };
    const s = run([{ type: 'welcome', me, here: null, serverNow: NOW }], dirty);
    expect(s).toMatchObject({ synced: false, me, hereId: null, lobbies: {} });
    const t = run([{ type: 'lobbies', lobbies: [view()] }], s);
    expect(t.synced).toBe(true);
    expect(Object.keys(t.lobbies)).toEqual(['l1']);
  });

  it('a contagem vira um fim no relógio local', () => {
    const s = run([{ type: 'lobby', lobby: view({ phase: 'countdown', countdownMs: 4200 }) }]);
    expect(s.countdownEnds.l1).toBe(NOW + 4200);
    const t = run([{ type: 'lobby', lobby: view({ phase: 'open' }) }], s);
    expect(t.countdownEnds.l1).toBeUndefined();
  });

  it('lobby removido some da lista, da sala, dos convites e das portas', () => {
    const s = run([
      { type: 'welcome', me, here: 'l1', serverNow: NOW, knocks: { l1: 'pending' } },
      { type: 'lobbies', lobbies: [view()] },
      { type: 'invite', invite: { fromId: 'dev:ana', fromName: 'Ana', lobbyId: 'l1', lobbyName: 'Duelo', at: NOW } },
      { type: 'lobby_removed', lobbyId: 'l1', reason: 'closed' },
    ]);
    expect(s).toMatchObject({ hereId: null, lobbies: {}, invites: [], knocks: {} });
  });

  it('presença entra, muda de lugar e sai', () => {
    const s = run([
      { type: 'friends', friends: [{ id: 'dev:caio', name: 'Caio' }] },
      { type: 'friend', friend: { id: 'dev:ana', name: 'Ana', lobbyId: 'l1', host: true } },
      { type: 'friend', friend: { id: 'dev:caio', name: 'Caio', lobbyId: 'l1' } },
    ]);
    expect(s.friends.map((f) => [f.name, f.lobbyId])).toEqual([
      ['Ana', 'l1'],
      ['Caio', 'l1'],
    ]);
    expect(run([{ type: 'friend_gone', id: 'dev:ana' }], s).friends.map((f) => f.name)).toEqual(['Caio']);
  });

  it('a batida na porta: pendente, aceita; recusada apaga', () => {
    const s = run([{ type: 'knock', lobbyId: 'l9', lobbyName: 'Clã', status: 'pending' }]);
    expect(s.knocks.l9).toBe('pending');
    expect(run([{ type: 'knock', lobbyId: 'l9', lobbyName: 'Clã', status: 'accepted' }], s).knocks.l9).toBe('accepted');
    expect(run([{ type: 'knock', lobbyId: 'l9', lobbyName: 'Clã', status: 'declined' }], s).knocks.l9).toBeUndefined();
  });

  it('mensagem desconhecida não muda nada', () => {
    const s = run([{ type: 'lobbies', lobbies: [view()] }]);
    expect(reduce(s, { type: 'ack', req: 1 }, NOW)).toBe(s);
  });
});

describe('toLobby', () => {
  const ctx = { meId: 'dev:bia', friendIds: new Set(['dev:ana']), now: NOW };

  it('traduz a visão do servidor para o Lobby da tela', () => {
    const l = toLobby(view(), ctx);
    expect(l).toMatchObject({ id: 'l1', host: 'Ana', hostId: 'dev:ana', hostIsFriend: true, friends: 1, ping: 11, minutesAgo: 3, players: 2 });
    expect(l.mine).toBeUndefined();
    expect(l.joins.at(-1)).toMatchObject({ name: 'Bia', you: true });
    expect(l.seats).toEqual([
      { id: 'dev:ana', name: 'Ana', host: true, friend: true, ready: true, you: undefined },
      { id: 'dev:bia', name: 'Bia', host: false, friend: false, ready: false, you: true },
    ]);
  });

  it('quem abriu vê o lobby como seu; partida tem rodada', () => {
    const l = toLobby(view({ phase: 'playing', status: 'em-partida', startedAt: NOW - 60_000, handoffStep: 3 }), { ...ctx, meId: 'dev:ana' });
    expect(l.mine).toBe(true);
    expect(l.round).toEqual({ current: 1, startedAt: NOW - 60_000 });
  });

  it('privado visto de fora: só a contagem, sem nomes', () => {
    const l = toLobby(view({ locked: true, hidden: true, seats: undefined, joins: undefined, players: 3 }), { ...ctx, meId: 'dev:zé' });
    expect(l.seats).toHaveLength(3);
    expect(l.seats!.every((s) => s.hidden && s.name && !s.name.includes('Ana'))).toBe(true);
    expect(l.joins).toEqual([]);
  });

  it('roster usa as vagas do servidor (sem simular gente) e completa com vagas livres', () => {
    const l = toLobby(view(), ctx);
    const seats = roster(l, { you: 'Bia', youHere: true, youReady: false, signedIn: true, now: NOW });
    expect(seats).toHaveLength(8);
    expect(seats.filter((s) => s.name).map((s) => s.name)).toEqual(['Ana', 'Bia']);
  });
});

describe('convites e confirmações', () => {
  it('pickInvite pula recusados, a sala atual e lobby que não existe mais', () => {
    const lobby = toLobby(view({ id: 'l2' }), { meId: 'dev:bia', friendIds: new Set(), now: NOW });
    const s: LiveState = {
      ...EMPTY_LIVE,
      hereId: 'l1',
      invites: [
        { fromId: 'a', fromName: 'Ana', lobbyId: 'l2', lobbyName: 'Duelo', at: NOW - 5 },
        { fromId: 'c', fromName: 'Caio', lobbyId: 'l1', lobbyName: 'Aqui', at: NOW - 3 },
        { fromId: 'd', fromName: 'Duda', lobbyId: 'sumiu', lobbyName: 'X', at: NOW - 1 },
      ],
    };
    expect(pickInvite(s, [lobby], new Set())).toEqual({ from: 'Ana', lobby });
    expect(pickInvite(s, [lobby], new Set(['l2']))).toBeNull();
  });

  it('confirmations: quem confirmou, sem o anfitrião e sem você', () => {
    const v = view({
      seats: [
        { userId: 'a', name: 'Ana', host: true, ready: true, readyAt: 1 },
        { userId: 'b', name: 'Bia', ready: true, readyAt: 2 },
        { userId: 'c', name: 'Caio', ready: true, readyAt: 3 },
        { userId: 'd', name: 'Duda', ready: false },
      ],
    });
    expect([...confirmations(v, 'b')]).toEqual([['Caio', 3]]);
  });

  it('toPresence mantém id e lugar', () => {
    expect(
      toPresence([
        { id: 'x', name: 'X' },
        { id: 'y', name: 'Y', lobbyId: 'l1', host: true },
      ]),
    ).toEqual([
      { id: 'x', name: 'X', lobbyId: null, host: false },
      { id: 'y', name: 'Y', lobbyId: 'l1', host: true },
    ]);
  });
});

describe('backoffMs', () => {
  it('cresce e para em 15 s', () => {
    expect(backoffMs(0, 0.5)).toBe(500);
    expect(backoffMs(3, 0.5)).toBe(4000);
    expect(backoffMs(20, 0.5)).toBe(15000);
    expect(backoffMs(20, 1)).toBeLessThanOrEqual(18000);
  });
});

/* ───────── LiveClient com um socket falso ───────── */

class FakeSocket implements SocketLike {
  static all: FakeSocket[] = [];
  readyState = 0;
  sent: Record<string, unknown>[] = [];
  onopen: ((ev: unknown) => void) | null = null;
  onclose: ((ev: unknown) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  constructor(readonly url: string) {
    FakeSocket.all.push(this);
  }
  send(data: string) {
    this.sent.push(JSON.parse(data) as Record<string, unknown>);
  }
  close() {
    this.readyState = 3;
    this.onclose?.({});
  }
  open() {
    this.readyState = 1;
    this.onopen?.({});
  }
  push(m: unknown) {
    this.onmessage?.({ data: JSON.stringify(m) });
  }
}

describe('LiveClient', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeSocket.all = [];
  });
  afterEach(() => vi.useRealTimers());

  const make = () => {
    const got: ServerMsg[] = [];
    const statuses: string[] = [];
    const c = new LiveClient({ url: 'ws://x/api/ws', factory: (u) => new FakeSocket(u), onMessage: (m) => got.push(m), onStatus: (s) => statuses.push(s) });
    c.start();
    return { c, got, statuses, sock: () => FakeSocket.all.at(-1)! };
  };

  it('pedido resolve no ack e rejeita no erro; o resto vai para onMessage', async () => {
    const { c, got, sock } = make();
    sock().open();
    const ok = c.request({ type: 'join', lobbyId: 'l1' });
    const bad = c.request({ type: 'start' });
    const [a, b] = sock().sent;
    expect(a).toMatchObject({ type: 'join', lobbyId: 'l1', req: 1 });
    sock().push({ type: 'lobby', lobby: view() });
    sock().push({ type: 'ack', req: a!.req, lobbyId: 'l1' });
    sock().push({ type: 'error', req: b!.req, code: 'not_host', message: 'Só quem abriu.' });
    await expect(ok).resolves.toMatchObject({ lobbyId: 'l1' });
    await expect(bad).rejects.toMatchObject({ code: 'not_host', message: 'Só quem abriu.' });
    expect(got.map((m) => m.type)).toEqual(['lobby']);
  });

  it('ignora lixo do socket', () => {
    const { got, sock } = make();
    sock().open();
    sock().onmessage?.({ data: 'não é json' });
    sock().onmessage?.({ data: JSON.stringify(42) });
    expect(got).toEqual([]);
  });

  it('sem conexão o pedido falha na hora; queda rejeita os pendentes e reconecta com atraso', async () => {
    const { c, statuses, sock } = make();
    await expect(c.request({ type: 'ping' })).rejects.toMatchObject({ code: 'offline' });
    sock().open();
    const pending = c.request({ type: 'ping' });
    sock().close();
    await expect(pending).rejects.toMatchObject({ code: 'offline' });
    expect(statuses).toEqual(['online', 'offline']);
    expect(FakeSocket.all).toHaveLength(1);
    vi.advanceTimersByTime(1000);
    expect(FakeSocket.all).toHaveLength(2);
    sock().open();
    expect(statuses.at(-1)).toBe('online');
  });

  it('pedido sem resposta expira', async () => {
    const { c, sock } = make();
    sock().open();
    const p = c.request({ type: 'ping' });
    vi.advanceTimersByTime(8001);
    await expect(p).rejects.toMatchObject({ code: 'timeout' });
  });

  it('stop não reconecta', () => {
    const { c, sock } = make();
    sock().open();
    c.stop();
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.all).toHaveLength(1);
  });
});
