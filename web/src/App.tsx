import { lazy, Suspense, useEffect, useState, type ComponentType } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { Layout } from './components/Shell';
import { t } from './i18n';
import { useLocale } from './i18n/useLocale';
import { Home } from './pages/Home';
import { NotFound } from './pages/NotFound';
import { SessionProvider } from './state/session';
import { ThemeProvider } from './state/theme';

/**
 * Uma tela em chunk próprio, com pré-carga. Depois que o chunk chegou, o `lazy` resolve na
 * hora (o thenable chama de volta síncrono) e o Suspense nem mostra o fallback: a tela entra
 * inteira, sem o rodapé pular de lugar. `preloadRoute` cobre a carga direta (main.tsx espera
 * o chunk da URL antes do primeiro render) e a navegação (hover/foco num link).
 */
function lazyRoute<M extends Record<K, ComponentType>, K extends keyof M & string>(load: () => Promise<M>, ...names: K[]) {
  let mod: M | undefined;
  let pending: Promise<M> | undefined;
  const preload = () =>
    (pending ??= load().then(
      (m) => (mod = m),
      (e: unknown) => {
        pending = undefined; // deixa tentar de novo (rede caiu, deploy novo)
        throw e;
      },
    ));
  const views = Object.fromEntries(
    names.map((n) => [
      n,
      lazy(() => {
        if (mod) {
          const m = mod;
          return { then: (ok: (v: { default: ComponentType }) => void) => ok({ default: m[n] }) } as unknown as Promise<{ default: ComponentType }>;
        }
        return preload().then((m) => ({ default: m[n] }));
      }),
    ]),
  ) as unknown as Record<K, ComponentType>;
  return { preload, views };
}

// A home pinta primeiro; as outras telas viram chunks próprios (menos JS na primeira visita).
const modeRoute = lazyRoute(() => import('./pages/Mode'), 'ModesIndex', 'ModePage');
const installRoute = lazyRoute(() => import('./pages/Install'), 'Install');
const newsRoute = lazyRoute(() => import('./pages/News'), 'News');
const roomRoute = lazyRoute(() => import('./pages/Room'), 'Room');
const quickRoute = lazyRoute(() => import('./pages/QuickPlay'), 'QuickPlay');
const { ModesIndex, ModePage } = modeRoute.views;
const { Install } = installRoute.views;
const { News } = newsRoute.views;
const { Room } = roomRoute.views;
const { QuickPlay } = quickRoute.views;

/** Primeiro segmento do caminho → chunk da tela (o mesmo mapa das <Route> abaixo). */
const CHUNKS: Record<string, () => Promise<unknown>> = {
  sala: roomRoute.preload,
  jogar: quickRoute.preload,
  modos: modeRoute.preload,
  instalar: installRoute.preload,
  novidades: newsRoute.preload,
};

/** Baixa o chunk da tela de `pathname`, se ela tiver um. Nunca rejeita. */
export function preloadRoute(pathname: string): Promise<unknown> {
  const load = CHUNKS[pathname.split('/')[1] ?? ''];
  return load ? load().catch(() => undefined) : Promise.resolve();
}

/** Pré-carga na intenção: o ponteiro sobre um link interno ou o foco nele. */
function preloadOnIntent(e: Event) {
  const a = e.target instanceof Element ? e.target.closest('a[href]') : null;
  if (!(a instanceof HTMLAnchorElement) || a.origin !== window.location.origin) return;
  void preloadRoute(a.pathname);
}
if (typeof document !== 'undefined') {
  document.addEventListener('pointerover', preloadOnIntent, { passive: true });
  document.addEventListener('focusin', preloadOnIntent);
}

/**
 * Enquanto a tela carrega (só numa navegação sem pré-carga): nada nos primeiros 300 ms;
 * depois, uma linha discreta. Ocupa a altura da janela, para o rodapé não aparecer no meio
 * e depois descer quando a tela chega.
 */
function RouteWait() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setShow(true), 300);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <div className="page route-wait" aria-busy="true" style={{ minHeight: '100svh' }}>
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
  const { locale } = useLocale();
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

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
