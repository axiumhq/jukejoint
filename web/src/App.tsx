import { BrowserRouter, Route, Routes } from 'react-router';
import { Layout } from './components/Shell';
import { Home } from './pages/Home';
import { Install } from './pages/Install';
import { Lobbies } from './pages/Lobbies';
import { ModePage, ModesIndex } from './pages/Mode';
import { News } from './pages/News';
import { NotFound } from './pages/NotFound';
import { SessionProvider } from './state/session';

export function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="lobbies" element={<Lobbies />} />
            <Route path="modos" element={<ModesIndex />} />
            <Route path="modos/:slug" element={<ModePage />} />
            <Route path="instalar" element={<Install />} />
            <Route path="novidades" element={<News />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </SessionProvider>
    </BrowserRouter>
  );
}
