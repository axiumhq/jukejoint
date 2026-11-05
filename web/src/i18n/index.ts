import { en } from './en';
import { getLocale, type Locale } from './locale';
import { ptBR, type Messages } from './pt-BR';

type Dictionary = Record<string, unknown>;

function merge(base: Dictionary, override: Dictionary): Dictionary {
  const result: Dictionary = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const baseValue = result[key];
    if (value && baseValue && !Array.isArray(value) && !Array.isArray(baseValue) && typeof value === 'object' && typeof baseValue === 'object') {
      result[key] = merge(baseValue as Dictionary, value as Dictionary);
    } else {
      result[key] = value;
    }
  }
  return result;
}

const catalogs: Record<Locale, Messages> = {
  'pt-BR': ptBR,
  en: merge(ptBR as unknown as Dictionary, en as Dictionary) as Messages,
};

export const getMessages = (locale = getLocale()) => catalogs[locale];

/** Existing screens can keep importing `t`; reads resolve against the selected catalog. */
export const t: Messages = new Proxy(ptBR, {
  get(_target, property, receiver) {
    return Reflect.get(getMessages(), property, receiver);
  },
});

const numberFormatters = new Map<Locale, Intl.NumberFormat>();
const dateFormatters = new Map<Locale, Intl.DateTimeFormat>();
const shortDateFormatters = new Map<Locale, Intl.DateTimeFormat>();
const intlLocale = (locale: Locale) => (locale === 'pt-BR' ? 'pt-BR' : 'en-US');

export const LOCALE = getLocale();

export function formatNumber(value: number) {
  const locale = getLocale();
  let formatter = numberFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(intlLocale(locale));
    numberFormatters.set(locale, formatter);
  }
  return formatter.format(value);
}

export function formatDate(iso: string) {
  const locale = getLocale();
  let formatter = dateFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(intlLocale(locale), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
    dateFormatters.set(locale, formatter);
  }
  return formatter.format(new Date(iso));
}

export function formatShortDate(iso: string) {
  const locale = getLocale();
  let formatter = shortDateFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(intlLocale(locale), { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
    shortDateFormatters.set(locale, formatter);
  }
  return formatter.format(new Date(iso)).replace(/\./g, '');
}
