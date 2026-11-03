/**
 * Dados de exemplo da prévia no navegador (`npx vite` em desktop/). Só são carregados em dev:
 * o build de produção não inclui este módulo (ver `preview` em api.ts).
 */
import type { AppInfo, CheckReport } from './api';

export const SAMPLE_APP: AppInfo = { name: 'Jukejoint', scheme: 'jukejoint', version: '0.1.0', modlockVersion: 'v0.1.68', dev: true };

export const SAMPLE_CHECK: CheckReport = {
  binary: {
    path: 'C:\\Users\\voce\\AppData\\Local\\Jukejoint\\modlock.exe',
    source: 'ao lado do app',
    folder: 'C:\\Users\\voce\\AppData\\Local\\Jukejoint',
    exists: true,
    vanished: false,
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
    {
      name: 'ENGINE_ORIGIN',
      value: 'http://192.168.0.10:8080',
      scope: 'app',
      purpose: 'Servidor de sinalização passado ao daemon em --origin. O hyperline.gg é recusado.',
    },
    { name: 'ENGINE_STATE_DIR', value: null, scope: 'app', purpose: 'Outra pasta de estado do Modlock (troca o APPDATA só dos processos do Modlock).' },
    {
      name: 'MODLOCK_NO_UPDATE_CHECK',
      value: '1',
      scope: 'modlock',
      purpose: 'Definida pelo app em todo processo do Modlock: a versão é fixada, sem checagem de update.',
    },
  ],
  downloadDir: 'C:\\Users\\voce\\AppData\\Local\\modlock',
  ready: true,
  problems: [],
};
