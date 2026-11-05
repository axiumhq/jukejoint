import { BRAND_NAME } from '../config/brand';

export type Motif = 'rings' | 'rails' | 'fog' | 'clock' | 'vault' | 'grid';
export type Region = 'BR' | 'NA' | 'EU';

export interface LeaderboardEntry {
  player: string;
  region: Region;
  wins: number;
  rating: number;
}

export interface Mode {
  slug: string;
  name: string;
  tagline: string;
  description: string[];
  rules: string[];
  format: string;
  minPlayers: number;
  maxPlayers: number;
  durationMin: number;
  author: string;
  updatedAt: string;
  /** Uma frase só, para a linha de modos da home e o índice. */
  line: string;
  motif: Motif;
  leaderboard: LeaderboardEntry[];
}

export const modes: Mode[] = [
  {
    slug: 'circulo-profano',
    line: 'Doze num anel ritual que fecha a cada minuto.',
    name: 'Círculo Profano',
    tagline: 'Até doze num anel ritual que fecha a cada minuto. Do lado de fora, ninguém dura.',
    description: [
      'Até doze pessoas começam num anel ritual no centro do mapa. A cada minuto o círculo fecha um pouco e quem fica do lado de fora perde vida rápido.',
      'Não tem loja nem farm: cada abate dá um item aleatório do mesmo nível para todo mundo. Partidas curtas, decididas no posicionamento.',
    ],
    rules: [
      'Todos contra todos, sem times.',
      'O círculo encolhe a cada 60 segundos; o último fechamento leva 90. Fora dele, você perde 8% da vida por segundo.',
      'Cada abate concede um item aleatório. Itens não podem ser vendidos.',
      'Vence quem tiver mais abates quando o círculo fechar, ou o último vivo.',
    ],
    format: 'Todos contra todos',
    minPlayers: 6,
    maxPlayers: 12,
    durationMin: 12,
    author: 'velha_guarda',
    updatedAt: '2026-10-28',
    motif: 'rings',
    leaderboard: [
      { player: 'Ametista', region: 'BR', wins: 184, rating: 2412 },
      { player: 'k0rvo', region: 'BR', wins: 171, rating: 2388 },
      { player: 'Lanterneiro', region: 'NA', wins: 160, rating: 2301 },
      { player: 'mariposa_', region: 'BR', wins: 149, rating: 2276 },
      { player: 'Vesper', region: 'EU', wins: 142, rating: 2240 },
    ],
  },
  {
    slug: 'ultimo-bonde',
    line: 'Escolte o bonde até o fim da linha antes da meia-noite.',
    name: 'Último Bonde',
    tagline: 'Escolte o bonde até o fim da linha antes da meia-noite.',
    description: [
      'Dois times de seis. Um escolta um bonde pelos trilhos da cidade, o outro tenta pará-lo. O bonde só anda com um escoltador por perto.',
      'A cada estação vencida, os atacantes ganham tempo extra. Depois de duas rodadas os times trocam de lado.',
    ],
    rules: [
      'Dois times de 6, duas rodadas com troca de lado.',
      'O bonde avança enquanto houver ao menos um atacante a até 8 metros.',
      'Cada estação vencida adiciona 90 segundos ao relógio.',
      'Vence o time que levar o bonde mais longe somando as duas rodadas.',
    ],
    format: '6 contra 6',
    minPlayers: 8,
    maxPlayers: 12,
    durationMin: 18,
    author: 'trilho_sul',
    updatedAt: '2026-10-14',
    motif: 'rails',
    leaderboard: [
      { player: 'Maquinista', region: 'BR', wins: 96, rating: 2190 },
      { player: 'ferrugem', region: 'BR', wins: 91, rating: 2154 },
      { player: 'Halden', region: 'EU', wins: 88, rating: 2131 },
      { player: 'capivara.exe', region: 'BR', wins: 84, rating: 2098 },
      { player: 'Rook', region: 'NA', wins: 79, rating: 2062 },
    ],
  },
  {
    slug: 'neblina',
    line: 'Doze metros de visão, um caçador e três minutos.',
    name: 'Neblina',
    tagline: 'Doze metros de visão, um caçador e três minutos para não ser pego.',
    description: [
      'A cidade é coberta por uma névoa que reduz a visão a poucos metros. Uma pessoa vira o caçador; as demais têm três minutos para sobreviver.',
      'Quem é pego vira caçador também. Sons de passos aparecem no mapa do caçador a cada 20 segundos.',
    ],
    rules: [
      'De 5 a 10 pessoas. Um caçador sorteado por rodada.',
      'Visão limitada a 12 metros para todos.',
      'Quem for pego passa para o time do caçador.',
      'Sobreviventes ao fim de três minutos pontuam. Cinco rodadas por partida.',
    ],
    format: 'Caçador contra todos',
    minPlayers: 5,
    maxPlayers: 10,
    durationMin: 15,
    author: 'nevoeiro',
    updatedAt: '2026-10-02',
    motif: 'fog',
    leaderboard: [
      { player: 'Sombra Fina', region: 'BR', wins: 120, rating: 1988 },
      { player: 'luz_baixa', region: 'BR', wins: 112, rating: 1950 },
      { player: 'Wren', region: 'NA', wins: 101, rating: 1912 },
      { player: 'Odete', region: 'BR', wins: 97, rating: 1880 },
      { player: 'Moth', region: 'EU', wins: 90, rating: 1845 },
    ],
  },
  {
    slug: 'duelo-meia-noite',
    line: 'x1 com o mesmo herói, melhor de cinco.',
    name: 'Duelo à Meia-Noite',
    tagline: 'x1, mesmo herói, melhor de cinco. Perdeu, volta para a fila.',
    description: [
      'Duelos rápidos para treinar mecânica. Os dois participantes recebem o mesmo herói, sorteado a cada rodada, com itens fixos.',
      'Quem vencer três rodadas leva. Há fila de espera: quem perde volta para o fim da fila do lobby.',
    ],
    rules: [
      'Um contra um, melhor de cinco rodadas.',
      'Herói sorteado a cada rodada, igual para os dois.',
      'Itens fixos por rodada, sem loja.',
      'Rodada sem abate em 90 segundos: vence quem tiver mais vida.',
      'Lobby funciona como fila: até 8 pessoas se revezando.',
    ],
    format: '1 contra 1 com fila',
    minPlayers: 2,
    maxPlayers: 8,
    durationMin: 6,
    author: 'relojoeiro',
    updatedAt: '2026-09-21',
    motif: 'clock',
    leaderboard: [
      { player: 'Ponteiro', region: 'BR', wins: 302, rating: 2560 },
      { player: 'Agulha', region: 'BR', wins: 288, rating: 2511 },
      { player: 'Calder', region: 'EU', wins: 270, rating: 2470 },
      { player: 'zé do bonde', region: 'BR', wins: 251, rating: 2402 },
      { player: 'Ash', region: 'NA', wins: 240, rating: 2377 },
    ],
  },
  {
    slug: 'cerco-ao-cofre',
    line: 'Três trancas: arrombe o cofre ou segure a porta.',
    name: 'Cerco ao Cofre',
    tagline: 'Três trancas, dois minutos cada. Arrombe o cofre ou segure a porta.',
    description: [
      'Ataque e defesa em um banco fechado. Os atacantes precisam abrir três trancas em sequência; os defensores só precisam segurar até o tempo acabar.',
      'Cada tranca aberta libera uma nova entrada para os atacantes e reduz a vida máxima dos defensores.',
    ],
    rules: [
      'Dois times de 5. Uma rodada de ataque para cada time.',
      'Três trancas em sequência, 2 minutos por tranca.',
      'Defensores renascem só enquanto a tranca atual estiver fechada.',
      'Desempate pelo tempo restante na última tranca aberta.',
    ],
    format: '5 contra 5',
    minPlayers: 6,
    maxPlayers: 10,
    durationMin: 20,
    author: 'cofre_forte',
    updatedAt: '2026-10-28',
    motif: 'vault',
    leaderboard: [
      { player: 'Gazua', region: 'BR', wins: 77, rating: 2044 },
      { player: 'Tranca', region: 'BR', wins: 73, rating: 2010 },
      { player: 'Mercer', region: 'NA', wins: 70, rating: 1996 },
      { player: 'Ivone', region: 'BR', wins: 66, rating: 1958 },
      { player: 'Fennick', region: 'EU', wins: 61, rating: 1921 },
    ],
  },
  {
    slug: 'campo-de-treino',
    line: 'Todos os itens, bots no seu ritmo e nenhum placar.',
    name: 'Campo de Treino',
    tagline: 'Todos os itens liberados, bots no seu ritmo e nenhum placar olhando.',
    description: [
      'Um mapa aberto para testar heróis e combinações de itens sem pressão. Todos os itens liberados, cooldowns opcionais e bots com dificuldade ajustável.',
      'Funciona sozinho ou com contatos. É também o modo usado em "Jogar com bots".',
    ],
    rules: [
      'De 1 a 6 pessoas, sem placar.',
      'Todos os itens disponíveis desde o início.',
      'Comandos de chat para ajustar bots, cooldown e vida.',
    ],
    format: 'Livre, com bots',
    minPlayers: 1,
    maxPlayers: 6,
    durationMin: 0,
    author: `equipe ${BRAND_NAME}`,
    updatedAt: '2026-10-14',
    motif: 'grid',
    leaderboard: [],
  },
];

export const getMode = (slug: string | undefined) => modes.find((m) => m.slug === slug);
