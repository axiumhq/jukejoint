import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { Layout } from './components/Shell';
import { Home } from './pages/Home';
import { NotFound } from './pages/NotFound';
import { SessionProvider } from './state/session';

// A home pinta primeiro; as outras telas viram chunks próprios (menos JS na primeira visita).
const Lobbies = lazy(() => import('./pages/Lobbies').then((m) => ({ default: m.Lobbies })));
const ModesIndex = lazy(() => import('./pages/Mode').then((m) => ({ default: m.ModesIndex })));
const ModePage = lazy(() => import('./pages/Mode').then((m) => ({ default: m.ModePage })));
const Install = lazy(() => import('./pages/Install').then((m) => ({ default: m.Install })));
const News = lazy(() => import('./pages/News').then((m) => ({ default: m.News })));
const QuickPlay = lazy(() => import('./pages/QuickPlay').then((m) => ({ default: m.QuickPlay })));

/** Enquanto a tela carrega: nada nos primeiros 300 ms; depois, uma linha discreta. */
function RouteWait() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setShow(true), 300);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <div className="page route-wait" aria-busy="true">
      <div className="wrap">{show && <p className="fine">Abrindo…</p>}</div>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="lobbies" element={<Suspense fallback={<RouteWait />}><Lobbies /></Suspense>} />
            <Route path="jogar" element={<Suspense fallback={<RouteWait />}><QuickPlay /></Suspense>} />
            <Route path="modos" element={<Suspense fallback={<RouteWait />}><ModesIndex /></Suspense>} />
            <Route path="modos/:slug" element={<Suspense fallback={<RouteWait />}><ModePage /></Suspense>} />
            <Route path="instalar" element={<Suspense fallback={<RouteWait />}><Install /></Suspense>} />
            <Route path="novidades" element={<Suspense fallback={<RouteWait />}><News /></Suspense>} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </SessionProvider>
    </BrowserRouter>
  );
}
