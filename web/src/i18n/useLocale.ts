import { useSyncExternalStore } from 'react';
import { getLocale, getServerLocale, setLocale, subscribeLocale } from './locale';

export function useLocale() {
  const locale = useSyncExternalStore(subscribeLocale, getLocale, getServerLocale);
  return { locale, setLocale };
}
