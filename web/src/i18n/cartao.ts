/**
 * Textos do cartão de lobby "ingresso + cartaz" (Home v4, LobbyCard.tsx e lib/lobbyCard.ts).
 * Ficam fora de pt-BR.ts para não disputar o arquivo com o resto da Home.
 */
import { enCartao } from './en-cartao';
import { getLocale } from './locale';

const ptBRCartao = {
  /** Título da seção de lobbies da Home. */
  title: 'Lobbies abertos',
  /** O número carimbado no alto da arte. */
  num: (n: string) => `Lobby Nº ${n}`,
  /** Os dois lados nos modos de time ("N contra N"). */
  amber: 'Âmbar',
  sapphire: 'Safira',
  /** "Círculo Profano · aberto por k0rvo". */
  openedBy: 'aberto por',
  lastSlot: 'Última vaga',
  missing: (n: number) => `Faltam ${n}`,
  noSlot: 'Sem vaga',
  /** No canhoto, no lugar do botão, quando não há vaga nem entrada no meio. */
  full: 'Lotado',
  roundEnd: 'Vaga abre no fim da rodada',
};

export type CartaoMessages = typeof ptBRCartao;

export const cartao: CartaoMessages = new Proxy(ptBRCartao, {
  get(_target, property, receiver) {
    return Reflect.get(getLocale() === 'en' ? enCartao : ptBRCartao, property, receiver);
  },
});
