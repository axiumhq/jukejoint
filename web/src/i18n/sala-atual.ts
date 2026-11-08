/** Aviso do diálogo "Criar lobby" quando você já está dentro de um lobby. */
import { enSalaAtual } from './en-sala-atual';
import { getLocale } from './locale';

const ptBRSalaAtual = {
  inOther: (name: string) => `Você está em “${name}”. Ao abrir este lobby, você sai de lá e libera sua vaga.`,
  inMine: (name: string) => `Seu lobby “${name}” está aberto. Ao abrir este, ele fecha e quem está lá precisa achar outro.`,
  submit: 'Sair e abrir lobby',
};

export const salaAtual: typeof ptBRSalaAtual = new Proxy(ptBRSalaAtual, {
  get(_target, property, receiver) {
    return Reflect.get(getLocale() === 'en' ? enSalaAtual : ptBRSalaAtual, property, receiver);
  },
});
