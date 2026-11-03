import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

/**
 * O trilho da direita (API para as telas).
 *
 *   <Rail title="Sala">…conteúdo…</Rail>
 *
 * Qualquer tela renderiza `<Rail>` em qualquer lugar da sua árvore; o conteúdo vai, por portal,
 * para o trilho fixo da casca. Sem `<Rail>` na tela, a casca mostra o trilho social padrão.
 * Abaixo de 960 px o trilho vira folha de baixo: `useRail().openSheet()` abre (passe o botão
 * que abriu, para o foco voltar nele); fecha pelo ×, pelo fundo ou com Esc.
 * `title` é o título da folha no celular (no desktop o trilho não tem cabeçalho).
 */

interface RailValue {
  /** Nó do trilho onde o conteúdo das telas entra (null até a casca montar). */
  target: HTMLElement | null;
  setTarget: (el: HTMLElement | null) => void;
  /** Quantos `<Rail>` estão montados (0 = trilho padrão). */
  slots: number;
  claim: (title: string) => () => void;
  title: string | null;
  sheetOpen: boolean;
  openSheet: (opener?: HTMLElement | null) => void;
  closeSheet: () => void;
  /** Elemento que abriu a folha (para devolver o foco). */
  opener: RefObject<HTMLElement | null>;
  /** O trilho mostra o convite de login (a barra superior então não repete o botão). */
  signInShown: boolean;
  claimSignIn: () => () => void;
}

const RailContext = createContext<RailValue | null>(null);

export function RailProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [claims, setClaims] = useState<{ id: number; title: string }[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const seq = useRef(0);

  const claim = useCallback((title: string) => {
    const id = ++seq.current;
    setClaims((c) => [...c, { id, title }]);
    return () => setClaims((c) => c.filter((x) => x.id !== id));
  }, []);

  const openSheet = useCallback((el?: HTMLElement | null) => {
    opener.current = el ?? (document.activeElement as HTMLElement | null);
    setSheetOpen(true);
  }, []);

  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const [signIns, setSignIns] = useState(0);
  const claimSignIn = useCallback(() => {
    setSignIns((n) => n + 1);
    return () => setSignIns((n) => n - 1);
  }, []);

  const value = useMemo<RailValue>(
    () => ({
      target,
      setTarget,
      slots: claims.length,
      claim,
      title: claims.at(-1)?.title ?? null,
      sheetOpen,
      openSheet,
      closeSheet,
      opener,
      signInShown: signIns > 0,
      claimSignIn,
    }),
    [target, claims, claim, sheetOpen, openSheet, closeSheet, signIns, claimSignIn],
  );
  return <RailContext.Provider value={value}>{children}</RailContext.Provider>;
}

export function useRail() {
  const ctx = useContext(RailContext);
  if (!ctx) throw new Error('useRail precisa estar dentro de <RailProvider>');
  return ctx;
}

/**
 * Chame em quem mostra um botão de login dentro do trilho: enquanto estiver montado, a barra superior
 * esconde o dela no desktop (no celular o trilho é folha fechada e a barra volta a mostrar).
 */
export function useRailSignIn() {
  const { claimSignIn } = useRail();
  useLayoutEffect(() => claimSignIn(), [claimSignIn]);
}

/** Põe `children` no trilho da casca enquanto a tela estiver montada. */
export function Rail({ title, children }: { title: string; children: ReactNode }) {
  const { target, claim } = useRail();
  useLayoutEffect(() => claim(title), [claim, title]);
  return target ? createPortal(children, target) : null;
}

/** Foco: abrir a folha leva o foco para o ×; fechar devolve para quem abriu. */
export function useSheetFocus(closeBtn: RefObject<HTMLButtonElement | null>) {
  const { sheetOpen, opener, closeSheet } = useRail();
  const was = useRef(false);
  useEffect(() => {
    if (sheetOpen) closeBtn.current?.focus();
    else if (was.current) opener.current?.focus?.();
    was.current = sheetOpen;
  }, [sheetOpen, closeBtn, opener]);
  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeSheet();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sheetOpen, closeSheet]);
}
