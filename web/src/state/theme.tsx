import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_THEME, isThemeId, THEMES, type ThemeId, type ThemeInfo } from '../lib/theme';
import { writePref } from '../lib/store';

/**
 * Tema da interface. O script inline de index.html já pôs `data-theme` no <html> antes de
 * pintar (salvo ou `?theme=`); aqui só lemos esse valor e trocamos quando a pessoa escolhe.
 * A escolha vai para `localStorage['lobby.theme']`. O `?theme=` de captura não é salvo.
 * O menu mora na barra superior; `openMenu()` deixa outros lugares abrirem ("Ajustes" no trilho).
 */
interface ThemeValue {
  theme: ThemeId;
  themes: ThemeInfo[];
  setTheme: (id: ThemeId) => void;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  openMenu: () => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

function initialTheme(): ThemeId {
  const v = typeof document !== 'undefined' ? document.documentElement.dataset.theme : undefined;
  return isThemeId(v) ? v : DEFAULT_THEME;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(initialTheme);
  const [menuOpen, setMenuOpen] = useState(false);

  const setTheme = useCallback((id: ThemeId) => {
    document.documentElement.dataset.theme = id;
    writePref('theme', id);
    setThemeState(id);
  }, []);

  const openMenu = useCallback(() => setMenuOpen(true), []);

  const value = useMemo(() => ({ theme, themes: THEMES, setTheme, menuOpen, setMenuOpen, openMenu }), [theme, setTheme, menuOpen, openMenu]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme precisa estar dentro de <ThemeProvider>');
  return ctx;
}
