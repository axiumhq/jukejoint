import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { Layout } from './components/Shell';
import { t } from './i18n';
import { Home } from './pages/Home';
import { NotFound } from './pages/NotFound';
import { SessionProvider } from './state/session';
import { ThemeProvider } from './state/theme';

// A home pinta primeiro; as outras telas viram chunks próprios (menos JS na primeira visita).
const ModesIndex = lazy(() => import('./pages/Mode').then((m) => ({ default: m.ModesIndex })));
const ModePage = lazy(() => import('./pages/Mode').then((m) => ({ default: m.ModePage })));
const Install = lazy(() => import('./pages/Install').then((m) => ({ default: m.Install })));
const News = lazy(() => import('./pages/News').then((m) => ({ default: m.News })));
const Room = lazy(() => import('./pages/Room').then((m) => ({ default: m.Room })));
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
      <div className="wrap">{show && <p className="fine">{t.common.opening}</p>}</div>
    </div>
  );
}

/** /lobbies virou a home: links antigos (convites, filtros) caem na lista, com os mesmos filtros. */
function ToBrowser() {
  const { search } = useLocation();
  return <Navigate to={{ pathname: '/', search, hash: '#lobbies' }} replace />;
}

export function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <SessionProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="lobbies" element={<ToBrowser />} />
              <Route
                path="sala/:id"
                element={
                  <Suspense fallback={<RouteWait />}>
                    <Room />
                  </Suspense>
                }
              />
              <Route
                path="jogar"
                element={
                  <Suspense fallback={<RouteWait />}>
                    <QuickPlay />
                  </Suspense>
                }
              />
              <Route
                path="modos"
                element={
                  <Suspense fallback={<RouteWait />}>
                    <ModesIndex />
                  </Suspense>
                }
              />
              <Route
                path="modos/:slug"
                element={
                  <Suspense fallback={<RouteWait />}>
                    <ModePage />
                  </Suspense>
                }
              />
              <Route
                path="instalar"
                element={
                  <Suspense fallback={<RouteWait />}>
                    <Install />
                  </Suspense>
                }
              />
              <Route
                path="novidades"
                element={
                  <Suspense fallback={<RouteWait />}>
                    <News />
                  </Suspense>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </SessionProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
