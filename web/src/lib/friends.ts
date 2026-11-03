import type { Lobby } from '../data/lobbies';

/**
 * Amigos online da conta simulada, derivados dos próprios lobbies: assim o trilho de amigos,
 * as janelinhas verdes da tabela e as vagas da sala sempre contam as mesmas pessoas.
 * Por lobby: o anfitrião (se for amigo), quem entrou marcado como amigo e, se faltar, nomes
 * da lista abaixo. Mais dois amigos fora de lobby (no menu do Deadlock). Offline não aparece.
 * No produto, isto vem da lista de amigos da Steam com a presença do app.
 */

export interface FriendPresence {
  /** Ao vivo: o ID da conta (para chamar). */
  id?: string;
  name: string;
  /** Lobby em que está; `null` = online, fora de lobby. */
  lobbyId: string | null;
  host: boolean;
}

const POOL = ['Tordo', 'Lume', 'Pixote', 'Bigorna', 'Cerol', 'Faísca', 'Quaresma', 'Rosário'];
const IDLE = 2;

export function friendsOnline(lobbies: Lobby[]): FriendPresence[] {
  const out: FriendPresence[] = [];
  const used = new Set<string>();
  const pool = POOL.filter((n) => !lobbies.some((l) => l.host === n));
  const next = () => {
    const n = pool.find((x) => !used.has(x));
    if (n) used.add(n);
    return n;
  };

  // Ordem fixa por id: criar ou fechar um lobby não troca o nome dos amigos dos outros.
  for (const l of [...lobbies].sort((a, b) => a.id.localeCompare(b.id))) {
    if (l.mine || l.locked || l.friends <= 0) continue;
    const names: { name: string; host: boolean }[] = [];
    if (l.hostIsFriend) names.push({ name: l.host, host: true });
    for (const j of [...l.joins].reverse()) {
      if (names.length >= l.friends) break;
      if (j.friend && !j.you && j.name !== l.host) names.push({ name: j.name, host: false });
    }
    while (names.length < l.friends) {
      const n = next();
      if (!n) break;
      names.push({ name: n, host: false });
    }
    for (const f of names) {
      if (used.has(f.name) && !POOL.includes(f.name)) continue;
      used.add(f.name);
      out.push({ name: f.name, lobbyId: l.id, host: f.host });
    }
  }
  for (let i = 0; i < IDLE; i++) {
    const n = next();
    if (n) out.push({ name: n, lobbyId: null, host: false });
  }
  return out;
}

/** Os nomes dos amigos que estão em `lobbyId` (para marcar as vagas da sala). */
export function friendsIn(friends: FriendPresence[], lobbyId: string) {
  return friends.filter((f) => f.lobbyId === lobbyId).map((f) => f.name);
}

/**
 * Amigos offline (v8: "Offline · 23", recolhido). Só nomes, sem presença: no produto,
 * vêm da lista de amigos da Steam. Nenhum deles aparece online em lobby nenhum.
 */
export const OFFLINE_FRIENDS = [
  'Abrolho',
  'Bruma',
  'Cachimbo',
  'Dobradiça',
  'Estopa',
  'Farol',
  'Gengibre',
  'Hera',
  'Ipê',
  'Jacarandá',
  'Lacre',
  'Mandacaru',
  'Novelo',
  'Orvalho',
  'Pedregulho',
  'Quintal',
  'Rapadura',
  'Sabugo',
  'Taramela',
  'Umbu',
  'Varanda',
  'Xaxim',
  'Zabumba',
];

/**
 * O convite recebido do trilho: um amigo que abriu um lobby em que ainda dá para entrar
 * (e em que você não está). `null` quando não há nenhum, ou quando o convite foi recusado.
 */
export function incomingInvite(friends: FriendPresence[], lobbies: Lobby[], canJoin: (l: Lobby) => boolean, dismissed: ReadonlySet<string> = new Set()) {
  for (const f of friends) {
    if (!f.host || !f.lobbyId || dismissed.has(f.lobbyId)) continue;
    const lobby = lobbies.find((l) => l.id === f.lobbyId);
    if (lobby && canJoin(lobby)) return { from: f.name, lobby };
  }
  return null;
}
