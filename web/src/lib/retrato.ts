/**
 * Retrato de reserva: a silhueta de uma pessoa no estilo das cenas (gente na porta do juke joint),
 * com a luz de latão vindo da esquerda. Vale quando a conta não tem avatar da Steam (ou a foto não
 * carrega) e no protótipo com dados simulados. Determinístico pelo nome: tom do fundo, acessório
 * (chapéu, boné, cabelo, coque, gorro, fone, capuz) e o lado para onde a pessoa olha.
 * Desenhado num quadro de 40×40, legível de 20 px (pilhas) a 46 px.
 */
import { hashName } from './avatar';

/** Pares [claro, escuro] do fundo, tirados das cenas noturnas; não mudam com o tema (é a pessoa). */
export const RETRATO_TONS: readonly (readonly [string, string])[] = [
  ['#5b4566', '#2a1f30'], // ameixa
  ['#3f5a63', '#1b282d'], // petróleo
  ['#6e4a36', '#2e1f17'], // ferrugem
  ['#56553a', '#262618'], // oliva
  ['#45507a', '#1c2135'], // ardósia
  ['#6a3a4a', '#2c1820'], // vinho
  ['#6f5a36', '#2f2616'], // ocre
  ['#3d5a4a', '#1a2820'], // musgo
];

const ACESSORIOS = [
  // cabelo curto
  'M13.2 16.2c0-4.6 3-7.6 6.8-7.6s6.8 3 6.8 7.6c-1.2-2.6-3.6-3.9-6.8-3.9s-5.6 1.3-6.8 3.9z',
  // chapéu de aba
  'M8.5 12.6c3.4-1.3 19.6-1.3 23 0 .6.9-.3 1.5-1.6 1.5H10.1c-1.3 0-2.2-.6-1.6-1.5zM14 12.4c.2-4 1.6-6.4 6-6.4s5.8 2.4 6 6.4z',
  // boné
  'M13 15.6c-.2-4.8 2.6-7.6 7-7.6s7.2 2.8 7 7.6zM26 14.2c2.6 0 4.6.4 5.6 1.2.3.5-.2.9-.9.9H26z',
  // cabelo comprido
  'M12.8 26.4c-.7-1.8-.8-5.2-.3-8.8.7-5.2 3.5-8.6 7.5-8.6s6.8 3.4 7.5 8.6c.5 3.6.4 7-.3 8.8-1.4.8-3 1.2-4.6 1.2h-5.2c-1.6 0-3.2-.4-4.6-1.2z',
  // coque
  'M13.2 16c0-4.4 3-7.4 6.8-7.4s6.8 3 6.8 7.4c-1.2-2.4-3.6-3.7-6.8-3.7s-5.6 1.3-6.8 3.7zM20 3.6a3.4 3.4 0 1 1 0 6.8 3.4 3.4 0 0 1 0-6.8z',
  // gorro
  'M12.8 15.4c-.4-5.6 2.8-9 7.2-9s7.6 3.4 7.2 9c-2-.9-4.4-1.3-7.2-1.3s-5.2.4-7.2 1.3zM18.6 4.6a1.6 1.6 0 1 1 2.8 0 1.6 1.6 0 0 1-2.8 0z',
  // fone
  'M11.4 18.2c0-6 3.8-9.8 8.6-9.8s8.6 3.8 8.6 9.8h-1.6c0-5-3-8.2-7-8.2s-7 3.2-7 8.2zM10.2 16.4h3.2v5.4h-3.2a1 1 0 0 1-1-1v-3.4a1 1 0 0 1 1-1zM26.6 16.4h3.2a1 1 0 0 1 1 1v3.4a1 1 0 0 1-1 1h-3.2z',
  // capuz
  'M10.6 31c-.7-3.2-.7-8.4.5-12.6C12.5 13 15.9 8.8 20 8.8s7.5 4.2 8.9 9.6c1.2 4.2 1.2 9.4.5 12.6z',
] as const;

const CABECA = 'M20 9.6a6.6 6.6 0 1 1 0 13.2 6.6 6.6 0 0 1 0-13.2z';
const OMBROS = 'M5.5 40c.6-7.6 6.4-12.2 14.5-12.2S33.9 32.4 34.5 40z';
const PESCOCO = 'M17.2 21.4h5.6l1 7.4h-7.6z';

export interface Retrato {
  claro: string;
  escuro: string;
  /** Cabeça, ombros e acessório: o contorno que recebe a luz. */
  forma: string;
  /** A silhueta inteira (a forma mais o pescoço, que fica fora da luz para não virar listra). */
  silhueta: string;
  /** Olha para a esquerda (espelhado). */
  espelho: boolean;
}

export function retrato(name: string): Retrato {
  const h = hashName(name);
  const [claro, escuro] = RETRATO_TONS[h % RETRATO_TONS.length]!;
  const forma = `${CABECA} ${OMBROS} ${ACESSORIOS[(h >>> 5) % ACESSORIOS.length]!}`;
  return { claro, escuro, forma, silhueta: `${forma} ${PESCOCO}`, espelho: ((h >>> 9) & 1) === 1 };
}
