import { describe, expect, it } from 'vitest';
import { createBlocked, listStatus } from './connection';

describe('listStatus', () => {
  it('o modo simulado nunca falha', () => {
    expect(listStatus({ live: false, connection: 'mock', synced: false, timedOut: true })).toBe('ok');
  });
  it('ao vivo e com a lista na mão: ok, mesmo se a conexão caiu depois', () => {
    expect(listStatus({ live: true, connection: 'online', synced: true, timedOut: false })).toBe('ok');
    expect(listStatus({ live: true, connection: 'offline', synced: true, timedOut: false })).toBe('ok');
  });
  it('conectando sem lista: esqueleto até o prazo, depois falha', () => {
    expect(listStatus({ live: true, connection: 'connecting', synced: false, timedOut: false })).toBe('loading');
    expect(listStatus({ live: true, connection: 'connecting', synced: false, timedOut: true })).toBe('failed');
  });
  it('sem conexão e sem lista: falha na hora, sem afirmar que não há lobbies', () => {
    expect(listStatus({ live: true, connection: 'offline', synced: false, timedOut: false })).toBe('failed');
  });
});

describe('createBlocked', () => {
  it('só bloqueia ao vivo e fora do ar', () => {
    expect(createBlocked({ live: false, connection: 'mock' })).toBe(false);
    expect(createBlocked({ live: true, connection: 'online' })).toBe(false);
    expect(createBlocked({ live: true, connection: 'connecting' })).toBe(true);
    expect(createBlocked({ live: true, connection: 'offline' })).toBe(true);
  });
});
