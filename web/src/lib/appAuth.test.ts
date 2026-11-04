import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  challengeFor,
  clearPending,
  clearToken,
  devToken,
  exchangeCode,
  hasPending,
  loadToken,
  newVerifier,
  PENDING_TTL_MS,
  saveToken,
  startPending,
  takePending,
  TOKEN_KEY,
} from './appAuth';
import { ApiError, fetchMe, LiveClient, logout, type SocketLike } from './liveClient';

class MemStorage {
  private m = new Map<string, string>();
  getItem = (k: string) => this.m.get(k) ?? null;
  setItem = (k: string, v: string) => void this.m.set(k, v);
  removeItem = (k: string) => void this.m.delete(k);
}

/** Um storage que sempre falha (modo privado, cota, bloqueado). */
const broken = {
  getItem: () => {
    throw new Error('negado');
  },
  setItem: () => {
    throw new Error('negado');
  },
  removeItem: () => {
    throw new Error('negado');
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
  clearToken();
  clearPending();
});

describe('PKCE', () => {
  it('o verifier tem 43 caracteres base64url, sem padding, e muda a cada vez', () => {
    const a = newVerifier();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newVerifier()).not.toBe(a);
  });

  it('o challenge bate com o vetor da RFC 7636', async () => {
    expect(await challengeFor('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('o challenge de um verifier novo tem 43 caracteres', async () => {
    expect(await challengeFor(newVerifier())).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});

describe('token guardado', () => {
  it('grava, lê e apaga no localStorage', () => {
    const ls = new MemStorage();
    vi.stubGlobal('localStorage', ls);
    saveToken('abc');
    expect(ls.getItem(TOKEN_KEY)).toBe('abc');
    expect(loadToken()).toBe('abc');
    clearToken();
    expect(ls.getItem(TOKEN_KEY)).toBeNull();
    expect(loadToken()).toBeNull();
  });

  it('storage que falha não derruba nada e o token vale na memória', () => {
    vi.stubGlobal('localStorage', broken);
    expect(() => saveToken('abc')).not.toThrow();
    expect(loadToken()).toBe('abc');
    expect(() => clearToken()).not.toThrow();
    expect(loadToken()).toBeNull();
  });

  it('sem storage nenhum também funciona', () => {
    expect(() => saveToken('x')).not.toThrow();
    expect(loadToken()).toBe('x');
  });
});

describe('login em andamento', () => {
  beforeEach(() => vi.stubGlobal('sessionStorage', new MemStorage()));

  it('vale uma vez só', () => {
    startPending('v1', 1000);
    expect(hasPending(2000)).toBe(true);
    expect(takePending(2000)).toBe('v1');
    expect(takePending(2000)).toBeNull();
    expect(hasPending(2000)).toBe(false);
  });

  it('vence depois de 10 minutos', () => {
    startPending('v1', 1000);
    expect(hasPending(1000 + PENDING_TTL_MS)).toBe(true);
    expect(takePending(1001 + PENDING_TTL_MS)).toBeNull();
    expect(hasPending(1000)).toBe(false);
  });

  it('sem login iniciado não há o que entregar', () => {
    expect(takePending()).toBeNull();
  });

  it('com sessionStorage quebrado ainda funciona pela memória', () => {
    vi.stubGlobal('sessionStorage', broken);
    expect(() => startPending('v2', 5)).not.toThrow();
    expect(takePending(6)).toBe('v2');
    expect(() => clearPending()).not.toThrow();
  });
});

describe('chamadas', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  it('exchangeCode manda JSON sem cookie e devolve token e usuário', async () => {
    fetchMock.mockResolvedValue(json(200, { token: 't', user: { id: '1', name: 'Ana' } }));
    const s = await exchangeCode('http://api', 'cod', 'ver');
    expect(s).toEqual({ token: 't', user: { id: '1', name: 'Ana' } });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://api/auth/app/token');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('omit');
    expect(JSON.parse(init.body as string)).toEqual({ code: 'cod', verifier: 'ver' });
  });

  it('exchangeCode repassa code e message do servidor', async () => {
    fetchMock.mockResolvedValue(json(400, { code: 'bad_code', message: 'O login expirou ou já foi usado. Tente de novo.' }));
    const err = await exchangeCode('http://api', 'c', 'v').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ code: 'bad_code', message: 'O login expirou ou já foi usado. Tente de novo.' });
  });

  it('erro sem corpo vira mensagem padrão em português', async () => {
    fetchMock.mockResolvedValue(new Response('boom', { status: 502 }));
    const err = await devToken('http://api', 'Teste_A').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe('http');
    expect((err as ApiError).message).toMatch(/Tente de novo/);
  });

  it('devToken manda o nome', async () => {
    fetchMock.mockResolvedValue(json(200, { token: 't', user: { id: 'dev:teste_a', name: 'Teste_A', dev: true } }));
    await devToken('http://api', 'Teste_A');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://api/auth/dev/token');
    expect(JSON.parse(init.body as string)).toEqual({ name: 'Teste_A' });
  });

  it('sem rede vira erro offline', async () => {
    fetchMock.mockRejectedValue(new TypeError('failed'));
    await expect(exchangeCode('http://api', 'c', 'v')).rejects.toMatchObject({ code: 'offline' });
  });
});

describe('liveClient com token', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(() => Promise.resolve(new Response('{"user":null,"devLogin":false,"steamLogin":true}', { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);
  });

  it('fetchMe e logout mandam Bearer e omitem o cookie quando há token', async () => {
    await fetchMe('http://api', 'tok');
    await logout('http://api', 'tok');
    for (const [, init] of fetchMock.mock.calls as [string, RequestInit][]) {
      expect(init.headers).toEqual({ Authorization: 'Bearer tok' });
      expect(init.credentials).toBe('omit');
    }
    expect((fetchMock.mock.calls[1] as [string, RequestInit])[1].method).toBe('POST');
  });

  it('sem token, continua o cookie', async () => {
    await fetchMe('http://api');
    await logout('http://api');
    for (const [, init] of fetchMock.mock.calls as [string, RequestInit][]) {
      expect(init.credentials).toBe('include');
      expect(init.headers).toBeUndefined();
    }
  });

  it('o WebSocket recebe os subprotocolos a cada conexão', () => {
    const seen: (string[] | undefined)[] = [];
    let tok: string | null = 'tok';
    const sock = (): SocketLike => ({ readyState: 0, send() {}, close() {}, onopen: null, onclose: null, onerror: null, onmessage: null });
    const c = new LiveClient({
      url: 'ws://x/api/ws',
      onMessage: () => {},
      factory: (_u, protocols) => {
        seen.push(protocols);
        return sock();
      },
      protocols: () => (tok ? ['jukejoint', `auth.${tok}`] : undefined),
    });
    c.start();
    expect(seen[0]).toEqual(['jukejoint', 'auth.tok']);
    c.stop();
    tok = null;
    c.start();
    expect(seen[1]).toBeUndefined();
    c.stop();
  });
});
