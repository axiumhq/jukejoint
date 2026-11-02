import { ptBR, type Messages } from './pt-BR';

export const LOCALE = 'pt-BR';

/** Mensagens ativas. Para trocar de idioma, troque o objeto aqui. */
export const t: Messages = ptBR;

const numberFmt = new Intl.NumberFormat(LOCALE);
const dateFmt = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const shortDateFmt = new Intl.DateTimeFormat(LOCALE, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });

export const formatNumber = (n: number) => numberFmt.format(n);
export const formatDate = (iso: string) => dateFmt.format(new Date(iso));
export const formatShortDate = (iso: string) => shortDateFmt.format(new Date(iso)).replace(/\./g, '');
