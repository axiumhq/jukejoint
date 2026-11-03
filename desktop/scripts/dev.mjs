// `npm run dev:front` (o beforeDevCommand do Tauri): sobe o Vite do site (web/, porta 5280, o
// devUrl) e o Vite da tela Instalação (desktop/, porta 5281). Fecha os dois juntos.
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { npmSpawn } from './npm.mjs';

const WEB_PORT = '5280';
const webDir = fileURLToPath(new URL('../../web', import.meta.url));
const root = fileURLToPath(new URL('..', import.meta.url));

const web = npmSpawn(['run', 'dev', '--', '--port', WEB_PORT, '--strictPort'], { cwd: webDir, stdio: 'inherit' });

const ui = await createServer({ root, configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)) });
await ui.listen();
ui.printUrls();

function stop(code = 0) {
  web.kill();
  void ui.close().finally(() => process.exit(code));
}
web.on('exit', (code) => stop(code ?? 1));
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
