// `npm run build:live` e `npm run dev:live`: o app falando com a API de verdade.
//
//   APP_API_URL=<origem da API> [APP_ENGINE_ORIGIN=<servidor de sinalização>] [APP_SITE_URL=<site público>] npm run build:live
//   APP_API_URL=<origem da API> [APP_ENGINE_ORIGIN=...] npm run dev:live
//   (com --dry-run no fim: só confere e mostra o que rodaria)
//
// As duas variáveis são de build: entram no Rust (build.rs → `auth_open_browser`, padrão de
// ENGINE_ORIGIN), no build do site (VITE_API_URL) e na CSP (`connect-src` com a origem da API e
// a ws(s) equivalente), passada ao Tauri CLI por `--config` com um arquivo temporário (um JSON
// merge patch sobre o tauri.conf.json; o arquivo do repositório não muda).
//
// `build:live` roda `tauri build --no-bundle` e monta `out/<Marca>/` para mandar a um amigo: o
// exe, o modlock.exe (conferido pelo SHA-256 fixado), `modos/hello` e um LEIA-ME.txt.
// Processos sem shell: o CLI do Tauri roda pelo próprio Node.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, copyFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const desktop = fileURLToPath(new URL('..', import.meta.url));
const repo = join(desktop, '..');
const tauriDir = join(desktop, 'src-tauri');
const DEV_SITE = 'http://localhost:5280';

const [mode, ...flags] = process.argv.slice(2);
const dryRun = flags.includes('--dry-run');

function usage(msg) {
  if (msg) console.error(`\n${msg}\n`);
  console.error(`Uso (PowerShell, em desktop/):

  $env:APP_API_URL = 'http://localhost:8291'          # obrigatória: a API (só esquema, host e porta)
  $env:APP_ENGINE_ORIGIN = 'http://192.168.0.10:8080'  # opcional: padrão do ENGINE_ORIGIN no exe
  $env:APP_SITE_URL = 'https://jukejoint.gg'          # opcional: o site público, para os links de convite
  npm run build:live     # exe + pasta out/ para mandar a um amigo
  npm run dev:live       # tauri dev com a API

O servidor precisa aceitar a origem do app em WEB_ORIGIN: http://tauri.localhost (exe) e/ou
${DEV_SITE} (tauri dev).`);
  process.exit(2);
}

/** Mesmas regras do build.rs: http(s)://host[:porta], uma barra final opcional, sem o resto. */
function origin(name, raw) {
  let s = raw.trim();
  if (s.endsWith('/')) s = s.slice(0, -1);
  const bad = (why) => usage(`${name} inválida (${why}): ${JSON.stringify(raw)}`);
  if (s.length > 200 || !/^[\x21-\x7e]*$/.test(s)) bad('tamanho, espaços ou caracteres fora do ASCII');
  const m = /^(https?):\/\/(.*)$/.exec(s);
  if (!m) bad('precisa começar com http:// ou https://');
  const rest = m[2];
  if (!rest || /[/?#@\\%]/.test(rest)) bad('só esquema, host e porta');
  const [host, port, extra] = rest.split(':');
  if (extra !== undefined) bad('porta');
  if (port !== undefined && (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535)) bad('porta');
  if (!host || /^[-.]|[-.]$/.test(host) || !/^[A-Za-z0-9.-]+$/.test(host)) bad('host');
  const lower = host.toLowerCase();
  if (lower === 'hyperline.gg' || lower.endsWith('.hyperline.gg')) bad('a plataforma não usa o hyperline.gg');
  return s;
}

if (mode !== 'build' && mode !== 'dev') usage('Diga build ou dev (use npm run build:live ou npm run dev:live).');
if (!process.env.APP_API_URL?.trim()) usage('Falta APP_API_URL.');
const api = origin('APP_API_URL', process.env.APP_API_URL);
const engineOrigin = process.env.APP_ENGINE_ORIGIN?.trim() ? origin('APP_ENGINE_ORIGIN', process.env.APP_ENGINE_ORIGIN) : '';
// Sem site público, os convites copiados no app saem como <esquema>://join/<id> (web/src/lib/invite.ts).
const siteUrl = process.env.APP_SITE_URL?.trim() ? origin('APP_SITE_URL', process.env.APP_SITE_URL) : '';
const ws = api.replace(/^http/, 'ws');

const connectSrc = `'self' ipc: http://ipc.localhost ${api} ${ws}`;
const patch = { app: { security: { csp: { 'connect-src': connectSrc } } } };

const conf = JSON.parse(readFileSync(join(tauriDir, 'tauri.conf.json'), 'utf8'));
const brand = conf.productName;
const modRs = readFileSync(join(tauriDir, 'src', 'engine', 'mod.rs'), 'utf8');
const pinned = /pub const MODLOCK_SHA256: &str = "([0-9a-f]{64})";/.exec(modRs)?.[1];
const version = /pub const MODLOCK_VERSION: &str = "(v[0-9.]+)";/.exec(modRs)?.[1];
if (!brand || !pinned || !version) {
  console.error('Não achei productName no tauri.conf.json ou MODLOCK_SHA256/MODLOCK_VERSION em src-tauri/src/engine/mod.rs.');
  process.exit(1);
}

const require = createRequire(import.meta.url);
const cliPkg = require.resolve('@tauri-apps/cli/package.json');
const cliJs = join(dirname(cliPkg), JSON.parse(readFileSync(cliPkg, 'utf8')).bin.tauri);

const patchFile = join(tmpdir(), `${brand.toLowerCase()}-live-${process.pid}.json`);
const args = mode === 'build' ? ['build', '--no-bundle', '--config', patchFile] : ['dev', '--config', patchFile];
const env = { ...process.env, APP_API_URL: api, APP_ENGINE_ORIGIN: engineOrigin, VITE_API_URL: api, VITE_SITE_URL: siteUrl };

console.log(`API: ${api}`);
console.log(`ENGINE_ORIGIN padrão: ${engineOrigin || '(nenhum: o exe vai pedir ENGINE_ORIGIN)'}`);
console.log(`Site público (convites): ${siteUrl || '(nenhum: convites saem como deep link do app)'}`);
console.log(`connect-src: ${connectSrc}`);
console.log(`tauri ${args.slice(0, -1).join(' ')} <${patchFile}>`);
console.log(`Lembrete: o servidor precisa de WEB_ORIGIN com ${mode === 'build' ? 'http://tauri.localhost' : DEV_SITE}.`);
if (dryRun) {
  console.log(`\n--dry-run: nada foi rodado. Patch da configuração:\n${JSON.stringify(patch, null, 2)}`);
  process.exit(0);
}

writeFileSync(patchFile, JSON.stringify(patch));
let r;
try {
  r = spawnSync(process.execPath, [cliJs, ...args], { cwd: desktop, env, stdio: 'inherit' });
} finally {
  rmSync(patchFile, { force: true });
}
if (r.error) throw r.error;
if (r.status !== 0) process.exit(r.status ?? 1);
if (mode === 'dev') process.exit(0);

// --- Pasta para mandar a um amigo -------------------------------------------------------------
const out = join(desktop, 'out', brand);
const exe = join(tauriDir, 'target', 'release', 'app-desktop.exe');
const modlock = join(repo, 'tools', `modlock-${version}`, 'modlock.exe');
const hello = join(repo, 'spike', 'mods', 'hello');

for (const [what, p] of [['o exe do build', exe], [`o modlock.exe ${version} (scripts/install-modlock.ps1 baixa)`, modlock], ['o projeto de teste', hello]]) {
  if (!existsSync(p)) {
    console.error(`Falta ${what}: ${p}`);
    process.exit(1);
  }
}
const sha = createHash('sha256').update(readFileSync(modlock)).digest('hex');
if (sha !== pinned) {
  console.error(`O modlock.exe em ${modlock} NÃO é o fixado.\n  SHA-256: ${sha}\n  esperado: ${pinned}\nNão mande este arquivo. Baixe de novo com scripts/install-modlock.ps1.`);
  process.exit(1);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'modos'), { recursive: true });
copyFileSync(exe, join(out, `${brand}.exe`));
copyFileSync(modlock, join(out, 'modlock.exe'));
cpSync(hello, join(out, 'modos', 'hello'), {
  recursive: true,
  filter: (src) => !['node_modules', '.git', 'dist'].includes(basename(src)),
});

const leiaMe = `${brand}: cópia de teste do app
==============================

Esta pasta é o app ${brand} para Windows. Ele fala com a API em ${api}.
${engineOrigin ? `Servidor que liga os PCs: ${engineOrigin}.` : 'Esta cópia não traz o servidor que liga os PCs: defina ENGINE_ORIGIN antes de abrir o app.'}

Mantenha as 3 coisas juntas, na mesma pasta:
  ${brand}.exe     o app
  modlock.exe      o motor (versão ${version}, conferida pelo app)
  modos\\          os modos (por enquanto só o de teste, hello)

Para os links de convite e o login pela Steam voltarem para o app, registre o link uma vez
(PowerShell, nesta pasta):
  $env:APP_REGISTER_SCHEME = '1'; .\\${brand}.exe
Se mudar a pasta de lugar, registre de novo.

O Windows (SmartScreen) pode avisar que o app é de um editor desconhecido: o exe ainda não é
assinado. Clique em "Mais informações" e depois em "Executar assim mesmo".
`;
writeFileSync(join(out, 'LEIA-ME.txt'), '\ufeff' + leiaMe.replace(/\n/g, '\r\n'));

console.log(`\nPronto: ${out}\n  ${brand}.exe, modlock.exe (SHA-256 conferido), modos\\hello, LEIA-ME.txt`);
