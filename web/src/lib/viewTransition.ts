/**
 * Navegação com View Transitions do mesmo documento (Baseline 2025), sem depender do
 * <ViewTransition> do React (ainda experimental) nem do modo "data router".
 *
 * Fluxo: o navegador tira a foto da tela atual, a gente navega, e a promessa só resolve
 * quando a página de destino avisa que montou (markViewReady) ou após um teto curto.
 * Sem suporte ou com prefers-reduced-motion: navegação normal, sem efeito.
 */

interface VT {
  ready: Promise<void>;
  finished: Promise<void>;
  updateCallbackDone: Promise<void>;
  skipTransition: () => void;
}
type StartVT = (cb: () => Promise<void> | void) => VT;
const quiet = () => {};

let pendingReady: (() => void) | null = null;

export function canViewTransition() {
  return (
    typeof document !== 'undefined' &&
    'startViewTransition' in document &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function navigateWithTransition(navigate: (to: string) => void, to: string) {
  if (!canViewTransition()) {
    navigate(to);
    return;
  }
  const start = (document as Document & { startViewTransition: StartVT }).startViewTransition.bind(document);
  let navigated = false;
  const go = () => {
    if (navigated) return;
    navigated = true;
    navigate(to);
  };
  // Se o navegador não pintar (aba em segundo plano, painel oculto), o callback da
  // transição pode demorar: a navegação não fica refém do efeito.
  const fallback = window.setTimeout(() => {
    go();
    transition.skipTransition();
  }, 500);
  const transition = start(
    () =>
      new Promise<void>((resolve) => {
        window.clearTimeout(fallback);
        const done = () => {
          window.clearTimeout(timer);
          pendingReady = null;
          window.scrollTo(0, 0);
          resolve();
        };
        const timer = window.setTimeout(done, 350);
        pendingReady = done;
        go();
      }),
  );
  // Pular a transição rejeita estas promessas; não é erro para quem navega.
  transition.ready.catch(quiet);
  transition.finished.catch(quiet);
  transition.updateCallbackDone.catch(quiet);
}

/** Chamado pela página de destino (em useLayoutEffect) quando o DOM novo está pronto. */
export function markViewReady() {
  pendingReady?.();
}
