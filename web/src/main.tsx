import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import '@fontsource-variable/big-shoulders/opsz.css';
import '@fontsource-variable/newsreader/wght.css';
import '@fontsource-variable/libre-franklin/wght.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/pages.css';
import './styles/city.css';
import './styles/cards.css';
import './styles/gazette.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
