import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

/** Tipos espelhados de src-tauri/src/engine/mod.rs (serde em camelCase). */

export type DaemonState = 'rodando' | 'parado' | 'socketTravado';

export interface EngineError {
  code: string;
  message: string;
}

export interface BinaryCheck {
  path: string | null;
  source: string | null;
  exists: boolean;
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

export function errorOf(e: unknown): EngineError {
  if (e && typeof e === 'object' && 'message' in e) {
    const o = e as { code?: unknown; message: unknown };
    return { code: typeof o.code === 'string' ? o.code : 'erro', message: String(o.message) };
  }
  return { code: 'erro', message: String(e) };
}

export const api = {
  appInfo: () => (inApp ? invoke<AppInfo>('app_info') : Promise.resolve(SAMPLE_APP)),
  check: () => (inApp ? invoke<CheckReport>('engine_check') : delay(SAMPLE_CHECK)),
  daemonStart: () => (inApp ? invoke<DaemonInfo>('engine_daemon_start') : delay(SAMPLE_CHECK.daemon)),
  daemonStop: () => (inApp ? invoke<DaemonInfo>('engine_daemon_stop') : delay(SAMPLE_CHECK.daemon)),
  session: () => (inApp ? invoke<SessionInfo | null>('engine_session') : Promise.resolve(null)),
};

/** Escuta um evento do app; fora do app não faz nada. */
export function on<T>(name: string, fn: (payload: T) => void): Promise<UnlistenFn> {
  if (!inApp) return Promise.resolve(() => {});
  return listen<T>(name, (e) => fn(e.payload));
}

function delay<T>(v: T): Promise<T> {
  return new Promise((r) => window.setTimeout(() => r(v), 250));
}

/* ───────── Dados de exemplo (só fora do app, para revisar o layout no navegador) ───────── */

const SAMPLE_APP: AppInfo = { name: 'Lobby', scheme: 'lobby', version: '0.1.0', modlockVersion: 'v0.1.68', dev: true };

const SAMPLE_CHECK: CheckReport = {
  binary: {
    path: 'C:\\Users\\voce\\AppData\\Local\\Lobby\\modlock.exe',
    source: 'ao lado do app',
    exists: true,
    sizeBytes: 85_352_448,
    sha256: '4148c2fb2a5e5ac39fef61d7766e7854c3ad6e3c5985bc89433c5914742e3381',
    expectedSha256: '4148c2fb2a5e5ac39fef61d7766e7854c3ad6e3c5985bc89433c5914742e3381',
    hashOk: true,
    version: 'v0.1.68',
    expectedVersion: 'v0.1.68',
    versionOk: true,
  },
  daemon: {
    state: 'rodando',
    stateDir: 'C:\\Users\\voce\\AppData\\Roaming\\modlock\\state',
    socketPath: 'C:\\Users\\voce\\AppData\\Roaming\\modlock\\state\\modlock.sock',
    socketPathTooLong: false,
    status: {
      pid: 72128,
      release: 'v0.1.68',
      since: '2026-11-03 13:09:53',
      clients: 1,
      peer: '12D3KooWJgFBUDpUMHnrLnuYhT3VMBagjQzmKdA7seKk61BfYgrS',
      signaling: 'signed out; modlock login signs in to http://192.168.0.10:8080',
      origin: 'http://192.168.0.10:8080',
    },
    expectedOrigin: 'http://192.168.0.10:8080',
    originOk: true,
    startedByApp: true,
    logPath: 'C:\\Users\\voce\\AppData\\Roaming\\modlock\\state\\daemon-app.log',
  },
  game: { exe: 'deadlock.exe', running: false, pids: [] },
  hosts: { path: 'C:\\Windows\\System32\\drivers\\etc\\hosts', host: 'hyperline.gg', readable: true, blocked: false, lines: [] },
  env: [
    { name: 'MODLOCK_BIN', value: null, scope: 'app', purpose: 'Caminho do modlock.exe fixado. Sem ela, o app procura ao lado do próprio executável.' },
    { name: 'ENGINE_ORIGIN', value: 'http://192.168.0.10:8080', scope: 'app', purpose: 'Servidor de sinalização passado ao daemon em --origin. O hyperline.gg é recusado.' },
    { name: 'ENGINE_STATE_DIR', value: null, scope: 'app', purpose: 'Outra pasta de estado do Modlock (troca o APPDATA só dos processos do Modlock).' },
    { name: 'MODLOCK_NO_UPDATE_CHECK', value: '1', scope: 'modlock', purpose: 'Definida pelo app em todo processo do Modlock: a versão é fixada, sem checagem de update.' },
  ],
  ready: true,
  problems: [],
};
