import type { Lobby } from '../data/lobbies';
import type { Mode } from '../data/modes';
import type { FriendPresence } from './friends';

/**
 * A busca da barra superior (Ctrl K): lobbies, modos e jogadores, tudo dos dados da sessão.
 * Pura: recebe a lista e devolve os grupos já ordenados (começo do nome primeiro).
 * Jogadores = anfitriões, quem entrou por último em lobby aberto e, com login, os amigos.
 * Lobby só com convite não expõe quem está dentro (só o anfitrião, que é público).
 */

export type SearchHit =
  | { kind: 'lobby'; key: string; label: string; lobby: Lobby; mode?: Mode }
  | { kind: 'mode'; key: string; label: string; mode: Mode; players: number }
  | { kind: 'player'; key: string; label: string; lobby?: Lobby; host: boolean; friend: boolean };

export interface SearchGroups {
  lobbies: SearchHit[];
  modes: SearchHit[];
  players: SearchHit[];
}

export const SEARCH_LIMITS = { lobbies: 5, modes: 3, players: 5 } as const;

/** Minúsculas e sem acento: "circulo" acha "Círculo". */
export const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** 0 = começa com, 1 = alguma palavra começa com, 2 = contém, -1 = não bate. */
function rank(text: string, q: string) {
  const t = fold(text);
  if (t.startsWith(q)) return 0;
  if (t.split(/[\s_.\-,:]+/).some((w) => w.startsWith(q))) return 1;
  return t.includes(q) ? 2 : -1;
}

function top<T extends { label: string }>(items: T[], q: string, n: number): T[] {
  return items
    .map((it) => ({ it, r: rank(it.label, q) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || a.it.label.localeCompare(b.it.label))
    .slice(0, n)
    .map((x) => x.it);
}

export function searchAll(query: string, lobbies: Lobby[], modes: Mode[], friends: FriendPresence[], signedIn: boolean): SearchGroups {
  const q = fold(query.trim());
  if (!q) return { lobbies: [], modes: [], players: [] };
  const modeOf = (slug: string) => modes.find((m) => m.slug === slug);

  const lobbyHits: SearchHit[] = lobbies.map((l) => ({ kind: 'lobby', key: `l:${l.id}`, label: l.name, lobby: l, mode: modeOf(l.modeSlug) }));
  const modeHits: SearchHit[] = modes.map((m) => ({
    kind: 'mode',
    key: `m:${m.slug}`,
    label: m.name,
    mode: m,
    players: lobbies.filter((l) => l.modeSlug === m.slug).reduce((n, l) => n + l.players, 0),
  }));

  // Uma pessoa aparece uma vez só: amigo > anfitrião > quem entrou.
  const people = new Map<string, Extract<SearchHit, { kind: 'player' }>>();
  const friendNames = new Set(signedIn ? friends.map((f) => f.name) : []);
  const put = (name: string, lobby: Lobby | undefined, host: boolean) => {
    const cur = people.get(name);
    if (cur && (cur.friend || cur.host || !host)) return;
    people.set(name, { kind: 'player', key: `p:${name}`, label: name, lobby, host, friend: friendNames.has(name) });
  };
  if (signedIn) {
    for (const f of friends) {
      const lobby = f.lobbyId ? lobbies.find((l) => l.id === f.lobbyId) : undefined;
      people.set(f.name, { kind: 'player', key: `p:${f.name}`, label: f.name, lobby, host: f.host, friend: true });
    }
  }
  for (const l of lobbies) {
    if (!l.mine) put(l.host, l, true);
    if (l.locked) continue;
    for (const j of l.joins) if (!j.you) put(j.name, l, false);
  }

  return {
    lobbies: top(lobbyHits, q, SEARCH_LIMITS.lobbies),
    modes: top(modeHits, q, SEARCH_LIMITS.modes),
    players: top([...people.values()], q, SEARCH_LIMITS.players),
  };
}

/** Os grupos em sequência, na ordem da lista (para navegar com as setas). */
export const flatHits = (g: SearchGroups) => [...g.lobbies, ...g.modes, ...g.players];
