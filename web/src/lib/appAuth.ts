import { live as L } from '../i18n/live';
import { ApiError } from './liveClient';

/*
 * Login do app desktop (RFC 8252 + PKCE). Dentro do app o cookie da API não viaja (o site fica em outra
 * origem), então o login passa pelo navegador do sistema, volta por deep link com um código de uso único
 * e vira um token Bearer guardado aqui. Tudo que mexe em storage é try/catch: sem storage, o login vale
 * só até fechar o app.
 */

export const TOKEN_KEY = 'jukejoint.session';
const PENDING_KEY = 'jukejoint.login';
/** Quanto tempo o login iniciado no navegador espera pela volta. */
export const PENDING_TTL_MS = 10 * 60_000;

/* ───────── Token ───────── */

let memoryToken: string | null = null;

export function loadToken(): string | null {
  try {
    const v = localStorage.getItem(TOKEN_KEY);
    if (v) return v;
  } catch {
    /* sem storage */
  }
  return memoryToken;
}

export function saveToken(token: string) {
  memoryToken = token;
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* sem storage: fica só na memória */
  }
}

export function clearToken() {
  memoryToken = null;
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* sem storage */
  }
}

/* ───────── PKCE ───────── */

function base64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** 32 bytes aleatórios em base64url sem padding (43 caracteres). */
export function newVerifier(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

/** base64url(SHA-256(verifier)), sem padding. */
export async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

/* ───────── Login em andamento ───────── */

interface Pending {
  verifier: string;
  startedAt: number;
}

let memoryPending: Pending | null = null;

function readPending(): Pending | null {
  if (memoryPending) return memoryPending;
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Pending>;
    if (typeof p.verifier === 'string' && typeof p.startedAt === 'number') return { verifier: p.verifier, startedAt: p.startedAt };
  } catch {
    /* sem storage ou registro ilegível */
  }
  return null;
}

export function startPending(verifier: string, now = Date.now()) {
  memoryPending = { verifier, startedAt: now };
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(memoryPending));
  } catch {
    /* sem storage */
  }
}

export function clearPending() {
  memoryPending = null;
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* sem storage */
  }
}

/** Há um login esperando a volta do navegador (e ainda dentro dos 10 min). */
export function hasPending(now = Date.now()): boolean {
  const p = readPending();
  if (!p) return false;
  if (now - p.startedAt > PENDING_TTL_MS) {
    clearPending();
    return false;
  }
  return true;
}

/** Entrega o verifier do login em andamento e apaga o registro (uso único). `null` se não há ou venceu. */
export function takePending(now = Date.now()): string | null {
  const p = hasPending(now) ? readPending() : null;
  clearPending();
  return p ? p.verifier : null;
}

/* ───────── Chamadas ───────── */

export interface AppSession {
  token: string;
  user: { id: string; name: string; avatar?: string; dev?: boolean };
}

async function postJson(url: string, body: unknown): Promise<AppSession> {
  let res: Response;
  try {
    res = await fetch(url, { method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    throw new ApiError('offline', L.offlineError);
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* corpo vazio ou não-JSON */
  }
  if (!res.ok) {
    const o = (data && typeof data === 'object' ? data : {}) as { code?: unknown; message?: unknown };
    throw new ApiError(typeof o.code === 'string' ? o.code : 'http', typeof o.message === 'string' && o.message ? o.message : L.appLoginFailed);
  }
  const s = data as Partial<AppSession> | null;
  if (!s || typeof s.token !== 'string' || !s.token || !s.user) throw new ApiError('http', L.appLoginFailed);
  return { token: s.token, user: s.user };
}

/** Troca o código do deep link (com o verifier do início) pelo token. */
export const exchangeCode = (api: string, code: string, verifier: string) => postJson(`${api}/auth/app/token`, { code, verifier });

/** Login de teste no app (só com DEV_LOGIN=1 no servidor). */
export const devToken = (api: string, name: string) => postJson(`${api}/auth/dev/token`, { name });

/** Os nomes de teste oferecidos no app. */
export const DEV_NAMES: readonly string[] = ['Teste_A', 'Teste_B', 'Teste_C'];
