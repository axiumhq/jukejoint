/** Textos novos das páginas de modo: o índice (/modos) e a página de cada modo (/modos/:slug). */
import { enModosPagina } from './en-modos-pagina';
import { getLocale } from './locale';

const ptBRModosPagina = {
  /* página do modo: a linha embaixo da barra de dados */
  here: (name: string) => `Você está em “${name}”.`,
  hereOpen: 'Abrir a sala',
  playTarget: (name: string, region: string, ms: number) => `Jogar agora leva para “${name}” (${region} · ${ms} ms)`,
  playAmong: (n: number) => (n > 1 ? `, o melhor entre ${n} com vaga.` : ', o único com vaga.'),
  signInToCreate: 'Para criar um lobby, entre com a Steam.',
  bestPing: 'Menor ping com vaga',
  noRoom: 'sem vaga',
  sheetOut: (regions: number) => `Entre para ver sua lista · ${regions === 1 ? '1 região' : `${regions} regiões`} com lobby`,
  othersMeta: 'do mais cheio ao mais calmo',
  playing: (n: number) => `${n} jogando`,
  lobbies: (n: number) => (n === 0 ? 'nenhum lobby' : n === 1 ? '1 lobby' : `${n} lobbies`),
  openMode: (name: string) => `Abrir ${name}`,
  /* índice */
  busiest: 'Mais cheio agora',
  seeMode: 'Ver o modo',
  seeLobbies: (n: number) => (n === 1 ? 'Ver o lobby' : n === 0 ? 'Criar o primeiro lobby' : `Ver os ${n} lobbies`),
  restTitle: 'Em cartaz',
  restMeta: 'do mais cheio ao mais calmo',
};

export const modosPagina: typeof ptBRModosPagina = new Proxy(ptBRModosPagina, {
  get(_target, property, receiver) {
    return Reflect.get(getLocale() === 'en' ? enModosPagina : ptBRModosPagina, property, receiver);
  },
});
