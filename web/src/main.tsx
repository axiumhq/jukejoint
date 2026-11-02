import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
// Sistema de tipo v6: Bodoni Moda (títulos, com eixo de tamanho óptico), Mona Sans (texto e interface)
// e Fragment Mono (só números). Auto-hospedadas via @fontsource; só o subconjunto latino é baixado.
import '@fontsource-variable/bodoni-moda/opsz.css';
import '@fontsource-variable/mona-sans/wght.css';
import '@fontsource/fragment-mono/latin-400.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/home.css';
import './styles/lobbies.css';
import './styles/pages.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
