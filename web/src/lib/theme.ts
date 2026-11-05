/**
 * Os quatro temas do redesign (tokens em styles/tokens.css, um bloco `[data-theme]` cada).
 * O Carvão neutro é o padrão: abre sem nada salvo e é o primeiro da lista.
 * Para adicionar um tema: o bloco em tokens.css com os mesmos tokens de cor, uma linha aqui
 * e o id na lista do script inline de index.html.
 * A amostra não tem cor própria aqui: o elemento leva `data-theme` e lê `--swatch` do bloco do
 * tema (ThemeMenu, ThemeSwatches e `.sw` em shell.css). Mudou o token, mudou a amostra.
 */
export type ThemeId = 'carvao' | 'noite' | 'ameixa' | 'vinho';

export interface ThemeInfo {
  id: ThemeId;
  name: string;
  note: string;
}

export const THEMES: ThemeInfo[] = [
  { id: 'carvao', name: 'Carvão neutro', note: 'Carvão, marfim e latão. Padrão.' },
  { id: 'noite', name: 'Azul meia-noite', note: 'Azul-noite frio e latão claro.' },
  { id: 'ameixa', name: 'Ameixa suave', note: 'Ameixa baixa e quente.' },
  { id: 'vinho', name: 'Vinho e latão', note: 'A barra lateral em vinho, a cor da marca.' },
];

export const DEFAULT_THEME: ThemeId = 'carvao';
/** Chave no localStorage (a mesma do protótipo; o valor é JSON, ex.: "\"noite\""). */
export const THEME_KEY = 'lobby.theme';

export const isThemeId = (v: unknown): v is ThemeId => typeof v === 'string' && THEMES.some((th) => th.id === v);

/**
 * O tema que abre: `?theme=` (capturas) ganha do salvo, que ganha do padrão.
 * `stored` é o valor cru do storage (JSON); valores inválidos (inclusive os ids dos temas
 * antigos, como "deadlock") caem no padrão.
 */
export function resolveTheme(stored: string | null, search = ''): ThemeId {
  const q = new URLSearchParams(search).get('theme');
  if (isThemeId(q)) return q;
  if (stored) {
    try {
      const v: unknown = JSON.parse(stored);
      if (isThemeId(v)) return v;
    } catch {
      /* valor antigo ou corrompido: usa o padrão */
    }
  }
  return DEFAULT_THEME;
}
