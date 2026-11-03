import { describe, expect, it } from 'vitest';
import type { LobbyView } from './api';
import { desktopInfo, lobbyIdFromLink, toEngineError, type SessionEvent, type SessionInfo } from './desktop';
import { adoptable, belongsTo, hostingCode, INSIDE_STEP, matchKey, myStep, seatStep } from './handoff';

const view = (over: Partial<LobbyView> = {}): LobbyView => ({
  id: 'l1',
  name: 'Sala',
  modeSlug: 'neblina',
  region: 'BR',
  hostId: 'dev:ana',
  hostName: 'Ana',
  players: 2,
  slots: 10,
  minPlayers: 2,
  locked: false,
  beginners: false,
  joinInProgress: true,
  status: 'em-partida',
  phase: 'handoff',
  handoffStep: 0,
  openedAt: 1,
  startedAt: 1000,
  seats: [
    { userId: 'dev:ana', name: 'Ana', host: true, ready: true, step: 1 },
    { userId: 'dev:bia', name: 'Bia', ready: true },
  ],
  ...over,
});

const ev = (over: Partial<SessionEvent>): SessionEvent => ({ session: 1, kind: 'join', stream: 'stdout', event: null, exitCode: null, ...over });

const info = (over: Partial<SessionInfo>): SessionInfo => ({
  id: 3,
  kind: 'host',
  pid: 9,
  target: 'C:\\x',
  joinCode: null,
  running: true,
  exitCode: null,
  ...over,
});

describe('matchKey', () => {
  it('só existe em partida e muda a cada partida', () => {
    expect(matchKey(undefined)).toBeNull();
    expect(matchKey(view({ phase: 'open' }))).toBeNull();
    expect(matchKey(view({ phase: 'countdown' }))).toBeNull();
    expect(matchKey(view())).toBe('l1:1000');
    expect(matchKey(view({ phase: 'playing' }))).toBe('l1:1000');
    expect(matchKey(view({ startedAt: 2000 }))).not.toBe(matchKey(view()));
  });
});

describe('etapas', () => {
  it('lê a sua etapa do servidor', () => {
    expect(seatStep(view(), 'dev:ana')).toBe(1);
    expect(seatStep(view(), 'dev:bia')).toBeNull();
    expect(seatStep(view(), null)).toBeNull();
  });
  it('mostra a mais adiantada entre o app e o servidor', () => {
    expect(myStep(null, null)).toBe(0);
    expect(myStep(2, 1)).toBe(2);
    expect(myStep(1, INSIDE_STEP)).toBe(INSIDE_STEP);
  });
});

describe('sessão do app', () => {
  it('adota a sessão que já estava rodando (página recarregada)', () => {
    expect(adoptable(info({}), 'host', null)).toBe(true);
    expect(adoptable(info({ running: false }), 'host', null)).toBe(false);
    expect(adoptable(info({ kind: 'join', target: 'k7Qx29zz' }), 'member', 'k7Qx29zz')).toBe(true);
    expect(adoptable(info({ kind: 'join', target: 'outro' }), 'member', 'k7Qx29zz')).toBe(false);
    expect(adoptable(info({}), 'member', 'k7Qx29zz')).toBe(false);
    expect(adoptable(null, 'host', null)).toBe(false);
  });
  it('acha o código no evento hosting', () => {
    expect(hostingCode(ev({ kind: 'host', event: { kind: 'hosting', joinCode: 'k7Qx29zz' } }))).toBe('k7Qx29zz');
    expect(hostingCode(ev({ kind: 'host', event: { kind: 'hosting', joinCode: null } }))).toBeNull();
    expect(hostingCode(ev({ kind: 'host', event: { kind: 'note', text: 'x' } }))).toBeNull();
  });
  it('ignora eventos de outra sessão', () => {
    expect(belongsTo(ev({ session: 4 }), null)).toBe(false);
    expect(belongsTo(ev({ session: 4 }), { id: null, kind: 'join', after: 3 })).toBe(true);
    expect(belongsTo(ev({ session: 3, stream: 'fim' }), { id: null, kind: 'join', after: 3 })).toBe(false);
    expect(belongsTo(ev({ session: 4 }), { id: 5, kind: 'join', after: 3 })).toBe(false);
    expect(belongsTo(ev({ session: 5, kind: 'host' }), { id: 5, kind: 'join', after: 3 })).toBe(false);
  });
});

describe('ponte com o app', () => {
  it('detecta o app pelo objeto injetado ou pelo Tauri', () => {
    expect(desktopInfo(undefined)).toBeNull();
    expect(desktopInfo({} as Window)).toBeNull();
    const app = { name: 'Jukejoint', scheme: 'jukejoint', version: '0.1.0', modlockVersion: 'v0.1.68' };
    expect(desktopInfo({ __DESKTOP_APP__: app } as unknown as Window)).toEqual(app);
    expect(desktopInfo({ __TAURI_INTERNALS__: {} } as unknown as Window)?.version).toBe('');
  });
  it('normaliza os erros no formato do app', () => {
    expect(toEngineError({ code: 'jogo_aberto', message: 'Feche o Deadlock.', detail: 'PID 1' })).toEqual({
      code: 'jogo_aberto',
      message: 'Feche o Deadlock.',
      detail: 'PID 1',
    });
    expect(toEngineError({ message: 'x' })).toEqual({ code: 'erro', message: 'x' });
    expect(toEngineError('falhou').detail).toBe('falhou');
  });
  it('só aceita id de lobby válido no deep link', () => {
    expect(lobbyIdFromLink('l2abc')).toBe('l2abc');
    for (const bad of ['', '-x', '../x', 'a b', 'x?y', 3, null, 'a'.repeat(65)]) expect(lobbyIdFromLink(bad)).toBeNull();
  });
});
