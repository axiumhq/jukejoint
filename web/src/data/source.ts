/**
 * De onde vêm os dados. Com `VITE_API_URL` (ex.: http://localhost:8090) o site fala com a API real
 * (server/): login pela Steam, lobbies e salas ao vivo pelo WebSocket. Sem ela, continua o protótipo
 * com dados simulados (state/session.tsx), que é o que a demo e os testes usam.
 */

function normalize(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().replace(/\/+$/, '');
  return /^https?:\/\/[^/]+$/.test(s) ? s : null;
}

export const API_URL: string | null = normalize(import.meta.env.VITE_API_URL);

/** `true` = API real; `false` = dados simulados. */
export const LIVE = API_URL !== null;

/** O endereço do WebSocket da API (http → ws, https → wss). */
export function wsUrl(api: string) {
  return `${api.replace(/^http/, 'ws')}/api/ws`;
}
