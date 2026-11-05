/**
 * Textos do topo da Home v4: o letreiro da cena e a placa da mesa (o melhor lobby, com as cadeiras).
 * Ficam fora de pt-BR.ts para não disputar o arquivo com o resto do trabalho visual (o mesmo padrão
 * de live.ts). Sobre outras pessoas, sempre neutro.
 */
import { enMesa } from './en-mesa';
import { getLocale } from './locale';

const ptBRMesa = {
  marquee: 'Modos da comunidade para Deadlock',
  /** O rótulo da placa para o leitor de tela. */
  label: 'Melhor lobby para você',
  lastSlot: 'Última vaga',
  missing: (n: number) => (n === 1 ? 'Falta 1' : `Faltam ${n}`),
  full: 'Lotado',
  bestForYou: 'melhor lobby para você',
  openedBy: (name: string) => `aberto por ${name}`,
  /** Entre dois nomes e antes do último ("Ametista e Odete"). */
  and: 'e',
  /** O resto da frase dos amigos, depois dos nomes: ", da sua lista, estão lá, com mais 9 pessoas." */
  friendsTail: (friends: number, others: number) =>
    `, da sua lista, ${friends === 1 ? 'está' : 'estão'} lá${others > 0 ? `, com mais ${others} ${others === 1 ? 'pessoa' : 'pessoas'}` : ''}.`,
  amber: 'Âmbar',
  sapphire: 'Safira',
  versus: '×',
  sidesDrawn: 'lados sorteados ao começar',
  emptyMarquee: 'A casa está abrindo',
  emptyTitle: 'Ninguém abriu lobby ainda.',
  emptyBody: 'Abra o primeiro da noite. Quando a mesa fechar, o app abre o Deadlock com o modo e põe todo mundo no mesmo servidor.',
  you: 'você',
};

export const mesa = new Proxy(ptBRMesa, {
  get(_target, property, receiver) {
    return Reflect.get(getLocale() === 'en' ? enMesa : ptBRMesa, property, receiver);
  },
});
