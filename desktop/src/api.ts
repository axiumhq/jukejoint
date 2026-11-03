import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

/** Tipos espelhados de src-tauri/src/engine/mod.rs (serde em camelCase). */

export type DaemonState = 'rodando' | 'parado' | 'socketTravado';

/** `message` é para quem joga (o que houve e o que fazer); `detail` é o técnico (variável, caminho, saída). */
export interface EngineError {
  code: string;
  message: string;
  detail?: string;
}

export interface BinaryCheck {
  path: string | null;
  source: string | null;
  /** Pasta onde o modlock.exe está ou deveria estar (a do app, sem caminho). */
  folder: string | null;
  exists: boolean;
  /** Existia e sumiu: quase sempre o antivírus em quarentena. */
  vanished: boolean;
  sizeBytes: number | null;
  sha256: string | null;
  expectedSha256: string;
  hashOk: boolean;
  version: string | null;
  expectedVersion: string;
  versionOk: boolean;
}

export interface DaemonStatus {
  pid: number | null;
  release: string | null;
  since: string | null;
  clients: number | null;
  peer: string | null;
  signaling: string | null;
  origin: string | null;
}

export interface DaemonInfo {
  state: DaemonState;
  stateDir: string;
  socketPath: string;
  socketPathTooLong: boolean;
  status: DaemonStatus | null;
  expectedOrigin: string | null;
  originOk: boolean;
  startedByApp: boolean;
  logPath: string;
}

export interface CheckReport {
  binary: BinaryCheck;
  daemon: DaemonInfo;
  game: { exe: string; running: boolean; pids: number[] };
  hosts: { path: string; host: string; readable: boolean; blocked: boolean; lines: string[] };
  env: { name: string; value: string | null; scope: 'app' | 'modlock'; purpose: string }[];
  /** %LOCALAPPDATA%\modlock, onde o Modlock baixa o servidor do jogo. */
  downloadDir: string | null;
  ready: boolean;
  problems: EngineError[];
}

export interface SessionInfo {
  id: number;
  kind: 'host' | 'join';
  pid: number;
  startedAt: number;
  target: string;
  joinCode: string | null;
  running: boolean;
  exitCode: number | null;
}

export interface AppInfo {
  name: string;
  scheme: string;
  version: string;
  modlockVersion: string;
  dev: boolean;
}

/** Dentro do app (Tauri) ou numa aba comum do navegador (prévia com dados de exemplo). */
export const inApp = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/** Por que a janela abriu sozinha (`checagem`: a primeira checagem ao abrir o app achou problema). */
export const openedBy: string | null =
  typeof window !== 'undefined' ? (((window as { __INSTALL_OPENED_BY__?: unknown }).__INSTALL_OPENED_BY__ as string | undefined) ?? null) : null;

export function errorOf(e: unknown): EngineError {
  if (e && typeof e === 'object' && 'message' in e) {
    const o = e as { code?: unknown; message: unknown; detail?: unknown };
    return {
      code: typeof o.code === 'string' ? o.code : 'erro',
      message: String(o.message),
      ...(typeof o.detail === 'string' ? { detail: o.detail } : {}),
    };
  }
  return { code: 'erro', message: 'O app não conseguiu falar com o motor. Feche e abra o app de novo.', detail: String(e) };
}

export const api = {
  appInfo: () => (inApp ? invoke<AppInfo>('app_info') : preview((s) => s.SAMPLE_APP, 0)),
  check: () => (inApp ? invoke<CheckReport>('engine_check') : preview((s) => s.SAMPLE_CHECK)),
  daemonStart: () => (inApp ? invoke<DaemonInfo>('engine_daemon_start') : preview((s) => s.SAMPLE_CHECK.daemon)),
  daemonStop: () => (inApp ? invoke<DaemonInfo>('engine_daemon_stop') : preview((s) => s.SAMPLE_CHECK.daemon)),
  session: () => (inApp ? invoke<SessionInfo | null>('engine_session') : Promise.resolve(null)),
};

/**
 * Fora do app: em dev, os dados de exemplo de `sample.ts`; no build de produção o
 * `import.meta.env.DEV` vira `false`, o ramo some e o módulo de exemplo não entra no bundle.
 */
function preview<T>(pick: (s: typeof import('./sample')) => T, ms = 250): Promise<T> {
  if (!import.meta.env.DEV) {
    return Promise.reject({ code: 'fora_do_app', message: 'Esta tela só funciona dentro do app.' } satisfies EngineError);
  }
  return import('./sample').then((s) => delay(pick(s), ms));
}

/** Escuta um evento do app; fora do app não faz nada. */
export function on<T>(name: string, fn: (payload: T) => void): Promise<UnlistenFn> {
  if (!inApp) return Promise.resolve(() => {});
  return listen<T>(name, (e) => fn(e.payload));
}

function delay<T>(v: T, ms: number): Promise<T> {
  return new Promise((r) => window.setTimeout(() => r(v), ms));
}
