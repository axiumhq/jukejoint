import { useEffect, useState } from 'react';

const RM_QUERY = '(prefers-reduced-motion: reduce)';

export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia(RM_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(RM_QUERY);
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
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
