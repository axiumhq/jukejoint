// `npm run build:front` (o beforeBuildCommand do Tauri): monta desktop/dist com o site na raiz
// (build de web/) e a tela Instalação em dist/_app/. O Tauri embute essa pasta no executável.
import { cpSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { npmSync } from './npm.mjs';

const webDir = fileURLToPath(new URL('../../web', import.meta.url));
const webDist = fileURLToPath(new URL('../../web/dist', import.meta.url));
const root = fileURLToPath(new URL('..', import.meta.url));
const dist = fileURLToPath(new URL('../dist', import.meta.url));

rmSync(dist, { recursive: true, force: true });

const r = npmSync(['run', 'build'], { cwd: webDir, stdio: 'inherit' });
if (r.status !== 0 || !existsSync(webDist)) {
  console.error('O build do site (web/) falhou.');
  process.exit(r.status || 1);
}
cpSync(webDist, dist, { recursive: true });

await build({ root, configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)) });
console.log(`Front do app pronto em ${dist}`);
