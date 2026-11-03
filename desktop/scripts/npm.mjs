// Roda o npm sem shell: o npm-cli.js pelo próprio Node quando o script veio de `npm run`
// (npm_execpath). Fora disso, `npm` direto (no Windows o npm é um .cmd e precisa de shell; os
// argumentos são sempre fixos, nada vindo de fora).
import { spawn, spawnSync } from 'node:child_process';

function resolve(args) {
  const cli = process.env.npm_execpath;
  if (cli && cli.endsWith('.js')) return { cmd: process.execPath, argv: [cli, ...args], shell: false };
  return { cmd: 'npm', argv: args, shell: process.platform === 'win32' };
}

export function npmSync(args, opts) {
  const { cmd, argv, shell } = resolve(args);
  return spawnSync(cmd, argv, { ...opts, shell });
}

export function npmSpawn(args, opts) {
  const { cmd, argv, shell } = resolve(args);
  return spawn(cmd, argv, { ...opts, shell });
}
