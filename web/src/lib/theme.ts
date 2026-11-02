/**
 * Os cinco temas do v8 (tokens em styles/tokens.css, um bloco `[data-theme]` cada).
 * O Deadlock é o padrão: abre sem nada salvo e é o primeiro da lista.
 * Para adicionar um tema: o bloco em tokens.css com os mesmos 28 tokens, uma linha aqui
 * e o id na lista do script inline de index.html.
 */
export type ThemeId = 'deadlock' | 'carmim' | 'pergaminho' | 'gelo' | 'grafite';

export interface ThemeInfo {
  id: ThemeId;
  name: string;
  note: string;
  /** Amostra do menu: [fundo, acento]. */
  swatch: [string, string];
}

export const THEMES: ThemeInfo[] = [
  { id: 'deadlock', name: 'Deadlock', note: 'Verde-fumaça, pergaminho e âmbar. Padrão.', swatch: ['hsl(170 16% 7%)', 'hsl(35 85% 56%)'] },
  { id: 'carmim', name: 'Carmim', note: 'Vinho e carmim.', swatch: ['hsl(345 30% 6%)', 'hsl(350 76% 49%)'] },
  { id: 'pergaminho', name: 'Pergaminho', note: 'Quase preto quente e creme.', swatch: ['hsl(20 10% 7%)', 'hsl(42 60% 84%)'] },
  { id: 'gelo', name: 'Gelo', note: 'Frio, herdeiro da pele B.', swatch: ['hsl(218 30% 6%)', 'hsl(190 92% 70%)'] },
  { id: 'grafite', name: 'Grafite', note: 'Neutro e calmo, para longas sessões.', swatch: ['hsl(225 6% 11%)', 'hsl(20 50% 64%)'] },
];

export const DEFAULT_THEME: ThemeId = 'deadlock';
/** Chave no localStorage (a mesma do protótipo; o valor é JSON, ex.: "\"gelo\""). */
export const THEME_KEY = 'lobby.theme';

export const isThemeId = (v: unknown): v is ThemeId => typeof v === 'string' && THEMES.some((th) => th.id === v);

/**
 * O tema que abre: `?theme=` (capturas) ganha do salvo, que ganha do padrão.
 * `stored` é o valor cru do storage (JSON); valores inválidos caem no padrão.
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
