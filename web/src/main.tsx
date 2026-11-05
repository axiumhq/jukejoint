import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App, preloadRoute } from './App';
import { IN_DESKTOP } from './lib/desktop';
// Sistema de tipo do redesign: Young Serif (títulos), Hanken Grotesk (interface), Barlow Condensed
// (números e rótulos de dado) e JetBrains Mono (código). Servidas de src/fonts (scripts/display-font.mjs
// gera os arquivos do @fontsource), subconjunto latino, poucas dezenas de kB cada.
import './fonts/display.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/shell.css';
import './styles/home.css';
import './styles/lobbies.css';
import './styles/pages.css';
import './styles/room.css';
import './styles/dialogs.css';

// Dentro do app a janela não tem moldura: a faixa de título própria fica em cima e a página rola
// abaixo dela (shell.css, html.is-desktop).
if (IN_DESKTOP) document.documentElement.classList.add('is-desktop');

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
