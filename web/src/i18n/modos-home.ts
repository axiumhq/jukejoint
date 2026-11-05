/** Textos da seção "Modos" da home (lista compacta e cartões da cidade vazia). */
import { enModosHome } from './en-modos-home';
import { getLocale } from './locale';

const ptBRModosHome = {
  title: 'Modos',
  sub: 'Escolha um e abra o primeiro lobby da noite.',
  none: 'Nenhum lobby agora',
  lobbies: (n: number) => (n === 1 ? '1 lobby' : `${n} lobbies`),
  playing: (n: number) => `${n} jogando`,
  filterLabel: (name: string) => `${name}: filtrar os lobbies`,
  openLabel: (name: string) => `${name}: abrir um lobby`,
  meta: (format: string, min: number, max: number) => `${format} · ${min === max ? max : `${min} a ${max}`} pessoas`,
};

export const modosHome: typeof ptBRModosHome = new Proxy(ptBRModosHome, {
  get(_target, property, receiver) {
    return Reflect.get(getLocale() === 'en' ? enModosHome : ptBRModosHome, property, receiver);
  },
});
