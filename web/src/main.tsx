import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App, preloadRoute } from './App';
// Sistema de tipo v8: Roboto Serif (títulos, logotipo e rótulos espaçados), Geist (interface) e
// Geist Mono (números). Geist via @fontsource, versões fixas; o navegador só baixa o subconjunto
// que a página usa. A Roboto Serif vem em duas instâncias estáticas geradas do @fontsource
// (scripts/display-font.mjs): ~27 kB cada, no lugar dos ~370 kB do arquivo variável.
import '@fontsource-variable/geist/index.css';
import '@fontsource-variable/geist-mono/index.css';
import './fonts/display.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/shell.css';
import './styles/home.css';
import './styles/lobbies.css';
import './styles/pages.css';
import './styles/room.css';
import './styles/dialogs.css';

// Carga direta numa tela em chunk próprio (/instalar, /modos/…): espera o chunk antes do primeiro
// render, para a tela entrar inteira em vez de casca + fallback (o rodapé pulava, CLS ~0,1).
// O chunk começa a baixar aqui, no mesmo instante em que o lazy pediria; na home é imediato.
void preloadRoute(window.location.pathname).then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
);
