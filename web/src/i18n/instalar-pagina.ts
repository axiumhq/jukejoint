/**
 * Textos novos da Instalar (polimento de 2026-11-07): o estado do download, o celular, a conferência
 * do hash e o índice no celular. Como modos-pagina.ts, ficam fora de pt-BR.ts; o inglês está em
 * en-instalar-pagina.ts.
 */
import { BRAND_NAME } from '../config/brand';
import { enInstalarPagina } from './en-instalar-pagina';
import { getLocale } from './locale';

const ptBRInstalarPagina = {
  /** Sem a release do GitHub: o padrão do nome do instalador, com a versão em aberto. */
  anyFile: `${BRAND_NAME}-v…-windows-x64-setup.exe`,
  /** Tamanho do app na tabela quando a release não carregou. */
  sizeOnRelease: 'veja na release',
  // o status, antes e depois de baixar
  idleTitle: 'O app não está aberto neste PC',
  idleHelp: 'Se você já instalou, é só abrir: esta página percebe sozinha. Se não, comece pelo Baixar.',
  dlTitle: 'Download iniciado',
  dlHelp: 'Quando terminar, abra o arquivo e siga o instalador. Esta página percebe sozinha quando o app abrir.',
  stepNow: 'agora',
  // no celular
  phoneTitle: 'O app é para Windows',
  phoneHelp: 'Abra esta página no PC para baixar. Daqui, dá para mandar o link.',
  sendLink: 'Enviar o link para o PC',
  copyLink: 'Copiar o link',
  linkCopied: 'Link copiado',
  // conferir o hash
  checkLabel: 'Cole aqui o hash que o PowerShell mostrou',
  checkHint: 'Pode colar a linha inteira: a página acha o hash nela.',
  checkOk: 'Bate. É exatamente o arquivo que publicamos.',
  checkBad: 'Não bate. Não execute este arquivo: apague e baixe de novo por esta página.',
  checkInvalid: 'Isso não parece um SHA-256 (64 letras e números).',
  checkPath: 'Se você salvou o arquivo em outra pasta, troque o caminho no comando.',
  howToCheck: 'Como conferir',
  // índice no celular
  sheetOpen: 'Nesta página',
  sheetOpenSub: 'Índice e notas do app',
  // trilho: a versão publicada
  thisVersion: 'Esta versão',
  thisVersionNotes: 'As notas desta versão estão no GitHub.',
  readNotes: 'Ler as notas',
};

export type InstalarPagina = typeof ptBRInstalarPagina;

export const instalarPagina: InstalarPagina = new Proxy(ptBRInstalarPagina, {
  get(_target, property, receiver) {
    return Reflect.get(getLocale() === 'en' ? enInstalarPagina : ptBRInstalarPagina, property, receiver);
  },
});
