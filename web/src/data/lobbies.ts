import type { Region } from './modes';

export type LobbyStatus = 'aberto' | 'em-partida' | 'cheio';

export interface Lobby {
  id: string;
  name: string;
  modeSlug: string;
  host: string;
  hostIsFriend: boolean;
  region: Region;
  ping: number;
  players: number;
  slots: number;
  /** Quantos amigos (da conta simulada) estão no lobby. */
  friends: number;
  status: LobbyStatus;
  joinInProgress: boolean;
  locked: boolean;
  minutesAgo: number;
  /** Criado pela conta simulada nesta sessão. */
  mine?: boolean;
}

/**
 * Lobbies fictícios. Pings simulam um jogador em São Paulo.
 * O status é derivado de players/slots quando o lobby não está em partida.
 */
export const lobbies: Lobby[] = [
  { id: 'l01', name: 'Círculo da madrugada', modeSlug: 'circulo-profano', host: 'Ametista', hostIsFriend: false, region: 'BR', ping: 14, players: 9, slots: 12, friends: 2, status: 'aberto', joinInProgress: false, locked: false, minutesAgo: 3 },
  { id: 'l02', name: 'Só mira, sem choro', modeSlug: 'circulo-profano', host: 'k0rvo', hostIsFriend: true, region: 'BR', ping: 22, players: 11, slots: 12, friends: 1, status: 'aberto', joinInProgress: false, locked: false, minutesAgo: 6 },
  { id: 'l03', name: 'Bonde lotado', modeSlug: 'ultimo-bonde', host: 'Maquinista', hostIsFriend: false, region: 'BR', ping: 18, players: 10, slots: 12, friends: 0, status: 'aberto', joinInProgress: false, locked: false, minutesAgo: 2 },
  { id: 'l04', name: 'Neblina iniciantes', modeSlug: 'neblina', host: 'luz_baixa', hostIsFriend: true, region: 'BR', ping: 26, players: 6, slots: 10, friends: 1, status: 'aberto', joinInProgress: false, locked: false, minutesAgo: 9 },
  { id: 'l05', name: 'Cofre ranqueado BR', modeSlug: 'cerco-ao-cofre', host: 'Gazua', hostIsFriend: false, region: 'BR', ping: 16, players: 10, slots: 10, friends: 0, status: 'em-partida', joinInProgress: false, locked: false, minutesAgo: 14 },
  { id: 'l06', name: 'Treino de duelo', modeSlug: 'duelo-meia-noite', host: 'Ponteiro', hostIsFriend: false, region: 'BR', ping: 12, players: 5, slots: 8, friends: 0, status: 'aberto', joinInProgress: false, locked: false, minutesAgo: 1 },
  { id: 'l07', name: 'Trilho sul, sem tóxico', modeSlug: 'ultimo-bonde', host: 'ferrugem', hostIsFriend: false, region: 'BR', ping: 31, players: 12, slots: 12, friends: 0, status: 'cheio', joinInProgress: false, locked: false, minutesAgo: 11 },
  { id: 'l08', name: 'Círculo casual', modeSlug: 'circulo-profano', host: 'mariposa_', hostIsFriend: false, region: 'BR', ping: 41, players: 4, slots: 12, friends: 0, status: 'aberto', joinInProgress: false, locked: false, minutesAgo: 1 },
  { id: 'l09', name: 'Rodada rápida', modeSlug: 'neblina', host: 'Sombra Fina', hostIsFriend: false, region: 'BR', ping: 19, players: 8, slots: 10, friends: 0, status: 'em-partida', joinInProgress: true, locked: false, minutesAgo: 7 },
  { id: 'l10', name: 'Clã Vigília (privado)', modeSlug: 'cerco-ao-cofre', host: 'Tranca', hostIsFriend: false, region: 'BR', ping: 24, players: 7, slots: 10, friends: 0, status: 'aberto', joinInProgress: false, locked: true, minutesAgo: 20 },
  { id: 'l11', name: 'Testando build de arma', modeSlug: 'campo-de-treino', host: 'Odete', hostIsFriend: true, region: 'BR', ping: 15, players: 2, slots: 6, friends: 1, status: 'aberto', joinInProgress: true, locked: false, minutesAgo: 25 },
  { id: 'l12', name: 'Chile + Argentina', modeSlug: 'circulo-profano', host: 'Tano', hostIsFriend: false, region: 'BR', ping: 58, players: 7, slots: 12, friends: 0, status: 'aberto', joinInProgress: false, locked: false, minutesAgo: 4 },
  { id: 'l13', name: 'East coast escort', modeSlug: 'ultimo-bonde', host: 'Rook', hostIsFriend: false, region: 'NA', ping: 128, players: 9, slots: 12, friends: 0, status: 'aberto', joinInProgress: false, locked: false, minutesAgo: 5 },
  { id: 'l14', name: 'Fog night', modeSlug: 'neblina', host: 'Wren', hostIsFriend: false, region: 'NA', ping: 141, players: 10, slots: 10, friends: 0, status: 'cheio', joinInProgress: false, locked: false, minutesAgo: 13 },
  { id: 'l15', name: 'Vault practice', modeSlug: 'cerco-ao-cofre', host: 'Mercer', hostIsFriend: false, region: 'NA', ping: 136, players: 6, slots: 10, friends: 0, status: 'aberto', joinInProgress: false, locked: false, minutesAgo: 8 },
  { id: 'l16', name: 'Ring FFA EU', modeSlug: 'circulo-profano', host: 'Vesper', hostIsFriend: false, region: 'EU', ping: 198, players: 8, slots: 12, friends: 0, status: 'em-partida', joinInProgress: true, locked: false, minutesAgo: 10 },
  { id: 'l17', name: 'Tram night', modeSlug: 'ultimo-bonde', host: 'Halden', hostIsFriend: false, region: 'EU', ping: 204, players: 7, slots: 12, friends: 0, status: 'aberto', joinInProgress: false, locked: false, minutesAgo: 2 },
  { id: 'l18', name: 'Heist EU', modeSlug: 'cerco-ao-cofre', host: 'Fennick', hostIsFriend: false, region: 'EU', ping: 211, players: 9, slots: 10, friends: 0, status: 'aberto', joinInProgress: false, locked: false, minutesAgo: 16 },
];
