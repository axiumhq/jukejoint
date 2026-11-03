import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Mesmas fontes, tokens e base do site (importados de web/src, sem cópia).
import '@fontsource-variable/geist/index.css';
import '@fontsource-variable/geist-mono/index.css';
import '@fontsource-variable/roboto-serif/standard.css';
import '@web/styles/tokens.css';
import '@web/styles/base.css';
import { BRAND_NAME } from '@web/config/brand';
import { THEME_KEY, resolveTheme } from '@web/lib/theme';
import './install.css';
import { Install } from './Install';

// Tema igual ao do site: o salvo (mesma chave) ou o Deadlock.
let stored: string | null = null;
try {
  stored = window.localStorage.getItem(THEME_KEY);
} catch {
  /* sem storage: fica o padrão */
}
document.documentElement.dataset.theme = resolveTheme(stored, window.location.search);
document.title = `Instalação · ${BRAND_NAME}`;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Install />
  </StrictMode>,
);
