import { live as L } from '../i18n/live';
import { backoffMs, type Intent, type ServerMsg } from './api';

/*
 * A conexão com a API: um WebSocket que reconecta sozinho (com atraso crescente) e pedidos com
 * resposta (`request` devolve uma Promise resolvida pelo `ack` ou rejeitada pelo `error` do servidor).
 * O resto das mensagens (estado dos lobbies, presença, convites) vai para `onMessage`.
 */

export type Connection = 'connecting' | 'online' | 'offline';

/** O que usamos de um WebSocket (o do navegador serve; os testes passam um falso). */
export interface SocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(): void;
  onopen: ((ev: unknown) => void) | null;
  onclose: ((ev: unknown) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
}

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export type Ack = Extract<ServerMsg, { type: 'ack' }>;

interface Pending {
  resolve: (a: Ack) => void;
  reject: (e: ApiError) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface ClientOptions {
  url: string;
  onMessage: (m: ServerMsg) => void;
  onStatus?: (s: Connection) => void;
  factory?: (url: string) => SocketLike;
  /** Quanto um pedido espera pela resposta. */
  timeoutMs?: number;
}

const OPEN = 1;

export class LiveClient {
  private ws: SocketLike | null = null;
  private attempt = 0;
  private seq = 0;
  private stopped = true;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private pending = new Map<number, Pending>();
  status: Connection = 'connecting';

  constructor(private readonly opts: ClientOptions) {}

  start() {
    this.stopped = false;
    this.connect();
  }

  stop() {
    this.stopped = true;
    if (this.retry) clearTimeout(this.retry);
    this.retry = null;
    this.ws?.close();
    this.ws = null;
    this.failPending();
  }

  /** Fecha e abre de novo já (depois de sair da conta, por exemplo). */
  reconnect() {
    if (this.stopped) return;
    this.attempt = 0;
    this.ws?.close();
  }

  private setStatus(s: Connection) {
    if (this.status === s) return;
    this.status = s;
    this.opts.onStatus?.(s);
  }

  private connect() {
    if (this.stopped) return;
    this.setStatus(this.attempt === 0 ? 'connecting' : 'offline');
    const make = this.opts.factory ?? ((url: string) => new WebSocket(url) as unknown as SocketLike);
    let ws: SocketLike;
    try {
      ws = make(this.opts.url);
    } catch {
      this.scheduleRetry();
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      this.attempt = 0;
      this.setStatus('online');
    };
    ws.onmessage = (ev) => this.receive(ev.data);
    ws.onerror = () => {
      /* o close vem logo depois e cuida da reconexão */
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.failPending();
      this.scheduleRetry();
    };
  }

  private scheduleRetry() {
    if (this.stopped) return;
    this.setStatus('offline');
    const wait = backoffMs(this.attempt++);
    this.retry = setTimeout(() => {
      this.retry = null;
      this.connect();
    }, wait);
  }

  private failPending() {
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new ApiError('offline', L.offlineError));
    }
    this.pending.clear();
  }

  private receive(data: unknown) {
    if (typeof data !== 'string') return;
    let m: ServerMsg;
    try {
      m = JSON.parse(data) as ServerMsg;
    } catch {
      return;
    }
    if (!m || typeof m !== 'object' || typeof m.type !== 'string') return;
    if ((m.type === 'ack' || m.type === 'error') && typeof m.req === 'number' && this.pending.has(m.req)) {
      const p = this.pending.get(m.req)!;
      this.pending.delete(m.req);
      clearTimeout(p.timer);
      if (m.type === 'ack') p.resolve(m);
      else p.reject(new ApiError(m.code, m.message));
      return;
    }
    this.opts.onMessage(m);
  }

  /** Manda um pedido e espera a resposta do servidor. */
  request(intent: Intent): Promise<Ack> {
    const ws = this.ws;
    if (!ws || ws.readyState !== OPEN) return Promise.reject(new ApiError('offline', L.offlineError));
    const req = ++this.seq;
    return new Promise<Ack>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(req);
        reject(new ApiError('timeout', L.timeoutError));
      }, this.opts.timeoutMs ?? 8000);
      this.pending.set(req, { resolve, reject, timer });
      ws.send(JSON.stringify({ ...intent, req }));
    });
  }
}

/* ───────── HTTP (login, conta) ───────── */

export interface Me {
  user: { id: string; name: string; avatar?: string; dev?: boolean } | null;
  devLogin: boolean;
  steamLogin: boolean;
}

export async function fetchMe(api: string): Promise<Me> {
  const res = await fetch(`${api}/api/me`, { credentials: 'include' });
  if (!res.ok) throw new ApiError('http', `HTTP ${res.status}`);
  return (await res.json()) as Me;
}

export async function logout(api: string) {
  await fetch(`${api}/auth/logout`, { method: 'POST', credentials: 'include' });
}

/** O caminho atual, para voltar a ele depois do login. */
export const herePath = () => `${window.location.pathname}${window.location.search}`;

export const steamLoginUrl = (api: string, back: string) => `${api}/auth/steam/login?return=${encodeURIComponent(back)}`;

export const devLoginUrl = (api: string, back: string) => `${api}/auth/dev?return=${encodeURIComponent(back)}`;
