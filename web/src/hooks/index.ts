import { useEffect, useMemo, useState } from 'react';
import { liveStats } from '../lib/stats';
import { useSession } from '../state/session';

/** Estado de uma media query, atualizado quando ela muda. */
export function useMediaQuery(query: string) {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}

export function useReducedMotion() {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title;
  }, [title]);
}

/** Contagens ao vivo (cabeçalho, lista, modos e home leem daqui: os números batem). */
export function useLiveStats() {
  const { lobbies } = useSession();
  return useMemo(() => liveStats(lobbies), [lobbies]);
}
