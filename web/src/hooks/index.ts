import { useEffect, useState } from 'react';

const RM_QUERY = '(prefers-reduced-motion: reduce)';

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
  return useMediaQuery(RM_QUERY);
}

/** Ponteiro fino com hover (mouse) e movimento liberado: só aí vale tilt e brilho. */
export function useTiltAllowed() {
  return useMediaQuery('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
}

/** Número que oscila em torno de uma base, simulando dado ao vivo. */
export function useLiveNumber(base: number, jitter: number, intervalMs: number) {
  const [value, setValue] = useState(base);
  useEffect(() => {
    if (jitter === 0) {
      setValue(base);
      return;
    }
    const id = window.setInterval(() => {
      setValue((v) => {
        const drift = Math.round((Math.random() - 0.5) * jitter);
        const pull = Math.round((base - v) * 0.25);
        return Math.max(0, v + drift + pull);
      });
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [base, jitter, intervalMs]);
  return value;
}

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title;
  }, [title]);
}

export type Theme = 'dark' | 'light';
const THEME_KEY = 'projeto-theme';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      /* armazenamento indisponível */
    }
    return 'dark';
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignora */
    }
  }, [theme]);
  return [theme, setTheme] as const;
}
