import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
// Sistema de tipo v8: Roboto Serif (títulos, logotipo e rótulos espaçados; "standard" traz os eixos
// de largura e tamanho óptico), Geist (interface) e Geist Mono (números). Auto-hospedadas via
// @fontsource, versões fixas; o navegador só baixa o subconjunto que a página usa.
import '@fontsource-variable/geist/index.css';
import '@fontsource-variable/geist-mono/index.css';
import '@fontsource-variable/roboto-serif/standard.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/shell.css';
import './styles/home.css';
import './styles/lobbies.css';
import './styles/pages.css';
import './styles/room.css';
import './styles/dialogs.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
