/**
 * A ponte com o app desktop (desktop/, Tauri v2). Dentro do app a janela do site tem
 * `window.__DESKTOP_APP__` (nome, esquema, versões) e `__TAURI_INTERNALS__`; fora dele nada aqui
 * roda. O `@tauri-apps/api` (2.12.4, a mesma versão do desktop/) entra por import dinâmico: o
 * bundle do site no navegador não carrega código do Tauri.
 *
 * Comandos e eventos: desktop/README.md, "Comandos (Tauri)". Erros chegam como
 * `{ code, message, detail? }`: `message` é para quem joga, `detail` é o técnico.
 */

export interface DesktopInfo {
  name: string;
  scheme: string;
  version: string;
  modlockVersion: string;
}

export interface EngineError {
  code: string;
  message: string;
  detail?: string;
}

/** O que o site usa da checagem (`engine_check`). */
export interface EngineCheck {
  ready: boolean;
  problems: EngineError[];
  modes?: { testMode: boolean; testSlugs?: string[]; testProject: string; testProjectOk: boolean };
}

export type SessionKind = 'host' | 'join';

export interface SessionInfo {
  id: number;
  kind: SessionKind;
  pid: number;
  target: string;
  joinCode: string | null;
  running: boolean;
  exitCode: number | null;
  step?: number | null;
}

/** Uma linha da sessão, já lida pelo app (`engine://event`). */
export interface SessionEvent {
  session: number;
  kind: SessionKind;
  stream: 'stdout' | 'stderr' | 'fim';
  event: ({ kind: string } & Record<string, unknown>) | null;
  exitCode: number | null;
  /** A etapa do handoff, quando este evento a fez avançar. */
  step?: number;
  error?: EngineError;
}

type Win = Window & { __DESKTOP_APP__?: DesktopInfo; __TAURI_INTERNALS__?: unknown };

/** Dentro do app: as informações dele; fora, `null`. */
export function desktopInfo(w: Win | undefined = typeof window === 'undefined' ? undefined : window): DesktopInfo | null {
  if (!w) return null;
  const info = w.__DESKTOP_APP__;
  if (info && typeof info === 'object' && typeof info.version === 'string') return info;
  if ('__TAURI_INTERNALS__' in w) return { name: '', scheme: '', version: '', modlockVersion: '' };
  return null;
}

/** O site está rodando dentro do app desktop. Fixo durante a página. */
export const IN_DESKTOP = desktopInfo() !== null;

type Tauri = {
  invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
  listen: <T>(event: string, handler: (e: { payload: T }) => void) => Promise<() => void>;
};

let tauri: Promise<Tauri> | null = null;
function api(): Promise<Tauri> {
  if (!IN_DESKTOP) return Promise.reject(toEngineError({ code: 'fora_do_app', message: 'Só funciona dentro do app.' }));
  return (tauri ??= Promise.all([import('@tauri-apps/api/core'), import('@tauri-apps/api/event')]).then(([core, event]) => ({
    invoke: core.invoke,
    listen: event.listen,
  })));
}

/** Qualquer falha vira `{ code, message, detail? }` (o formato do app). */
export function toEngineError(e: unknown): EngineError {
  if (e && typeof e === 'object' && 'message' in e) {
    const o = e as { code?: unknown; message: unknown; detail?: unknown };
    return {
      code: typeof o.code === 'string' ? o.code : 'erro',
      message: String(o.message),
      ...(typeof o.detail === 'string' && o.detail ? { detail: o.detail } : {}),
    };
  }
  if (typeof e === 'string') return { code: 'erro', message: 'O app não respondeu como esperado. Feche e abra o app de novo.', detail: e };
  return { code: 'erro', message: 'O app não respondeu como esperado. Feche e abra o app de novo.', detail: String(e) };
}

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const t = await api();
  try {
    return await t.invoke<T>(cmd, args);
  } catch (e) {
    throw toEngineError(e);
  }
}

export const desktop = {
  check: () => call<EngineCheck>('engine_check'),
  /** Hospeda o modo pelo slug; o app resolve a pasta do projeto (o site nunca manda caminho). */
  host: (mode: string) => call<SessionInfo>('engine_host', { mode }),
  join: (code: string) => call<SessionInfo>('engine_join', { code }),
  stop: () => call<unknown>('engine_stop'),
  session: () => call<SessionInfo | null>('engine_session'),
  openInstallWindow: () => call<void>('open_install_window'),
  /** Abre o login da Steam no navegador do sistema (o app monta a URL com o `challenge` do PKCE). */
  authOpenBrowser: (challenge: string) => call<void>('auth_open_browser', { challenge }),
};

/** Escuta um evento do app. Fora do app, não faz nada. Devolve a função que para de escutar. */
export function onDesktop<T>(event: string, fn: (payload: T) => void): () => void {
  if (!IN_DESKTOP) return () => {};
  let off: (() => void) | null = null;
  let stopped = false;
  void api()
    .then((t) => t.listen<T>(event, (e) => fn(e.payload)))
    .then((u) => {
      if (stopped) u();
      else off = u;
    })
    .catch(() => {});
  return () => {
    stopped = true;
    off?.();
  };
}

export const DESKTOP_EVENTS = {
  engine: 'engine://event',
  check: 'engine://check',
  deepLink: 'app://deep-link',
  deepLinkInvalid: 'app://deep-link-invalido',
  authCode: 'app://auth-code',
} as const;

/** O código de login que volta do navegador (`jukejoint://auth/<código>`). Devolve a função que para de escutar. */
export const onAuthCode = (cb: (code: string) => void) =>
  onDesktop<unknown>(DESKTOP_EVENTS.authCode, (payload) => {
    if (typeof payload === 'string' && payload) cb(payload);
  });

/** Id de lobby que o app manda no deep link (`[A-Za-z0-9][A-Za-z0-9_-]{0,63}`, como o Rust confere). */
export function lobbyIdFromLink(payload: unknown): string | null {
  return typeof payload === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(payload) ? payload : null;
}
