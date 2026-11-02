import { getMode, type Region } from './modes';

export type LobbyStatus = 'aberto' | 'em-partida' | 'cheio';

/** Alguém entrou no lobby. A lista mostra o mais recente ("Ametista entrou agora"). */
export interface JoinEvent {
  name: string;
  /** Epoch em ms. */
  at: number;
  friend?: boolean;
  /** A própria conta simulada. */
  you?: boolean;
}

/** Rodada de uma partida em andamento. Sem `total`, o modo não tem rodadas (mostra o tempo). */
export interface RoundInfo {
  current: number;
  total?: number;
  /** Epoch em ms em que a partida começou. */
  startedAt: number;
}

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
  /** Quantos amigos (da conta simulada) estão no lobby, contando o anfitrião se ele for amigo. */
  friends: number;
  status: LobbyStatus;
  joinInProgress: boolean;
  /** Só com convite: quem não foi convidado bate na porta e o anfitrião decide. */
  locked: boolean;
  /** Mantido por compatibilidade (ordenação "recentes"); a verdade é `openedAt`. */
  minutesAgo: number;
  /** Epoch em ms em que o lobby abriu. */
  openedAt: number;
  /** Quórum: a partida só começa com este mínimo. Até lá, as janelas ficam vazadas. */
  minPlayers: number;
  /** Entradas recentes, da mais antiga para a mais nova (no máximo 6). */
  joins: JoinEvent[];
  round?: RoundInfo;
  /** Epoch em ms em que lotou (para "lotou há 1 min"). */
  fullSince?: number;
  /** Criado pela conta simulada nesta sessão. */
  mine?: boolean;
}

/** Momento de carga do protótipo: as idades dos dados de exemplo contam a partir daqui. */
const T0 = Date.now();
const MIN = 60_000;

interface Seed extends Omit<Lobby, 'openedAt' | 'minPlayers' | 'joins' | 'round' | 'fullSince'> {
  /** Entradas recentes como [nome, segundos atrás, amigo?]. */
  recent?: [string, number, boolean?][];
  minPlayers?: number;
  round?: { current: number; total?: number; minutes: number };
  fullMinutes?: number;
}

/**
 * Lobbies fictícios. Pings simulam um jogador em São Paulo.
 * O status é derivado de players/slots quando o lobby não está em partida.
 * `recent` alimenta o calor: 3 entradas em 2 min = "Esquentando", e assim por diante (ver lib/lobbies.ts).
 */
const seeds: Seed[] = [
  { id: 'l01', name: 'Círculo da madrugada', modeSlug: 'circulo-profano', host: 'Ametista', hostIsFriend: false, region: 'BR', ping: 14, players: 9, slots: 12, friends: 2, status: 'aberto', joinInProgress: false, locked: false, minutesAgo: 3, recent: [['Lanterneiro', 100], ['capivara.exe', 70], ['Odete', 35, true]] },
  { id: 'l02', name: 'Só mira, sem choro', modeSlug: 'circulo-profano', host: 'k0rvo', hostIsFriend: true, region: 'BR', ping: 22, players: 11, slots: 12, friends: 1, status: 'aberto', joinInProgress: false, locked: false, minutesAgo: 6, recent: [['Agulha', 80]] },
  { id: 'l03', name: 'Bonde das 23h', modeSlug: 'ultimo-bonde', host: 'Maquinista', hostIsFriend: false, region: 'BR', ping: 18, players: 10, slots: 12, friends: 0, status: 'aberto', joinInProgress: false, locked: false, minutesAgo: 2, recent: [['zé do bonde', 95], ['Ivone', 60], ['ferro_velho', 22]] },
  { id: 'l04', name: 'Neblina sem lanterna, iniciantes ok', modeSlug: 'neblina', host: 'luz_baixa', hostIsFriend: true, region: 'BR', ping: 26, players: 6, slots: 10, friends: 1, status: 'aberto', joinInProgress: false, locked: false, minutesAgo: 9, recent: [['Moth', 260]] },
  { id: 'l05', name: 'Cofre com call, sem flame', modeSlug: 'cerco-ao-cofre', host: 'Gazua', hostIsFriend: false, region: 'BR', ping: 16, players: 10, slots: 10, friends: 0, status: 'em-partida', joinInProgress: false, locked: false, minutesAgo: 14, round: { current: 2, total: 2, minutes: 9 } },
  { id: 'l06', name: 'x1 até o sol nascer', modeSlug: 'duelo-meia-noite', host: 'Ponteiro', hostIsFriend: false, region: 'BR', ping: 12, players: 5, slots: 8, friends: 0, status: 'aberto', joinInProgress: false, locked: false, minutesAgo: 1, recent: [['Agulha', 40]] },
  { id: 'l07', name: 'Trilho sul, sem tóxico', modeSlug: 'ultimo-bonde', host: 'ferrugem', hostIsFriend: false, region: 'BR', ping: 31, players: 12, slots: 12, friends: 0, status: 'cheio', joinInProgress: false, locked: false, minutesAgo: 11, recent: [['Brasa', 75]], fullMinutes: 1 },
  { id: 'l08', name: 'Círculo sem pressa', modeSlug: 'circulo-profano', host: 'mariposa_', hostIsFriend: false, region: 'BR', ping: 41, players: 4, slots: 12, friends: 0, status: 'aberto', joinInProgress: false, locked: false, minutesAgo: 1, recent: [['Sereno', 30]] },
  { id: 'l09', name: 'Caçada rápida', modeSlug: 'neblina', host: 'Sombra Fina', hostIsFriend: false, region: 'BR', ping: 19, players: 8, slots: 10, friends: 0, status: 'em-partida', joinInProgress: true, locked: false, minutesAgo: 7, round: { current: 3, total: 5, minutes: 6 } },
  { id: 'l10', name: 'Clã Vigília', modeSlug: 'cerco-ao-cofre', host: 'Tranca', hostIsFriend: false, region: 'BR', ping: 24, players: 7, slots: 10, friends: 0, status: 'aberto', joinInProgress: false, locked: true, minutesAgo: 20 },
  { id: 'l11', name: 'Testando build de arma', modeSlug: 'campo-de-treino', host: 'Garoa', hostIsFriend: true, region: 'BR', ping: 15, players: 2, slots: 6, friends: 1, status: 'aberto', joinInProgress: true, locked: false, minutesAgo: 25, recent: [['Garoa', 25 * 60, true]] },
  { id: 'l12', name: 'Chile + Argentina', modeSlug: 'circulo-profano', host: 'Tano', hostIsFriend: false, region: 'BR', ping: 58, players: 7, slots: 12, friends: 0, status: 'aberto', joinInProgress: false, locked: false, minutesAgo: 4, recent: [['Pehuén', 150]] },
  { id: 'l13', name: 'East coast escort', modeSlug: 'ultimo-bonde', host: 'Rook', hostIsFriend: false, region: 'NA', ping: 128, players: 9, slots: 12, friends: 0, status: 'aberto', joinInProgress: false, locked: false, minutesAgo: 5, recent: [['Ash', 190]] },
  { id: 'l14', name: 'Fog night', modeSlug: 'neblina', host: 'Wren', hostIsFriend: false, region: 'NA', ping: 141, players: 10, slots: 10, friends: 0, status: 'cheio', joinInProgress: false, locked: false, minutesAgo: 13, fullMinutes: 4 },
  { id: 'l15', name: 'Vault practice', modeSlug: 'cerco-ao-cofre', host: 'Mercer', hostIsFriend: false, region: 'NA', ping: 136, players: 6, slots: 10, friends: 0, status: 'aberto', joinInProgress: false, locked: false, minutesAgo: 8, recent: [['Juniper', 420]] },
  { id: 'l16', name: 'Ring FFA EU', modeSlug: 'circulo-profano', host: 'Vesper', hostIsFriend: false, region: 'EU', ping: 198, players: 8, slots: 12, friends: 0, status: 'em-partida', joinInProgress: true, locked: false, minutesAgo: 10, round: { current: 1, minutes: 7 } },
  { id: 'l17', name: 'Tram night', modeSlug: 'ultimo-bonde', host: 'Halden', hostIsFriend: false, region: 'EU', ping: 204, players: 7, slots: 12, friends: 0, status: 'aberto', joinInProgress: false, locked: false, minutesAgo: 2, recent: [['Calder', 85]] },
  { id: 'l18', name: 'Heist EU', modeSlug: 'cerco-ao-cofre', host: 'Fennick', hostIsFriend: false, region: 'EU', ping: 211, players: 9, slots: 10, friends: 0, status: 'aberto', joinInProgress: false, locked: false, minutesAgo: 16, recent: [['Moth', 13 * 60]] },
];

function hydrate({ recent = [], minPlayers, round, fullMinutes, ...s }: Seed): Lobby {
  return {
    ...s,
    openedAt: T0 - s.minutesAgo * MIN,
    minPlayers: minPlayers ?? getMode(s.modeSlug)?.minPlayers ?? 1,
    joins: recent.map(([name, secondsAgo, friend]) => ({ name, at: T0 - secondsAgo * 1000, friend: friend || undefined })),
    round: round ? { current: round.current, total: round.total, startedAt: T0 - round.minutes * MIN } : undefined,
    fullSince: fullMinutes !== undefined ? T0 - fullMinutes * MIN : undefined,
  };
}

export const lobbies: Lobby[] = seeds.map(hydrate);

/** Nomes que o "ao vivo" simulado usa para quem entra. */
export const passersby = [
  'Brasa', 'Sereno', 'Lanterneiro', 'capivara.exe', 'Agulha', 'Ivone', 'Moth', 'Calder', 'Juniper', 'ferro_velho',
  'Pehuén', 'Ash', 'Tinta', 'Quina', 'Ribalta', 'Nanquim', 'Vitral', 'Zinco', 'Marquise', 'Arandela',
];
