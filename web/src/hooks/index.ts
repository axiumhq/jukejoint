import { useCallback, useEffect, useMemo, useState } from 'react';
import { cannotRunApp } from '../lib/device';
import { friendsOnline, incomingInvite } from '../lib/friends';
import { lobbyState } from '../lib/lobbies';
import { readPref, writePref } from '../lib/store';
import { liveStats } from '../lib/stats';
import { useSession } from '../state/session';

/** Estado de uma media query, atualizado quando ela muda. */
export function useMediaQuery(query: string) {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}

/** Celular ou tablet: o app (só Windows) não roda aqui. Regra em lib/device.ts. */
export function useCannotRunApp() {
  const coarse = useMediaQuery('(pointer: coarse)');
  const narrow = useMediaQuery('(max-width: 760px)');
  return useMemo(() => {
    const nav = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
    return cannotRunApp({ userAgent: nav.userAgent, uaMobile: nav.userAgentData?.mobile, coarse, narrow });
  }, [coarse, narrow]);
}

export function useReducedMotion() {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title;
  }, [title]);
}

/** Contagens ao vivo (cabeçalho, lista, modos e home leem daqui: os números batem). */
export function useLiveStats() {
  const { lobbies } = useSession();
  return useMemo(() => liveStats(lobbies), [lobbies]);
}

/** Amigos online (só para quem entrou com a Steam). Mesma fonte da tabela e da sala. */
export function useFriends() {
  const { lobbies, user, presence } = useSession();
  // Ao vivo, a presença vem do servidor; simulado, sai dos próprios lobbies.
  return useMemo(() => presence ?? (user ? friendsOnline(lobbies) : []), [presence, lobbies, user]);
}

/** O convite recebido que o trilho mostra (lib/friends.ts `incomingInvite`), já sem os recusados. */
export function useIncomingInvite() {
  const { lobbies, user, lobbyCtx, declinedInvites, incoming } = useSession();
  const friends = useFriends();
  return useMemo(() => {
    // Ao vivo: o convite de verdade, vindo do servidor.
    if (incoming !== undefined) return incoming;
    return user ? incomingInvite(friends, lobbies, (l) => l.id !== lobbyCtx.hereId && lobbyState(l, lobbyCtx).canJoin, declinedInvites) : null;
  }, [incoming, user, friends, lobbies, lobbyCtx, declinedInvites]);
}

/** Lobbies favoritos, salvos neste navegador (`lobby.favs`). */
export function useFavorites() {
  const [favs, setFavs] = useState<ReadonlySet<string>>(() => new Set(readPref<string[]>('favs', [])));
  const toggle = useCallback((id: string) => {
    setFavs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writePref('favs', [...next]);
      return next;
    });
  }, []);
  return { favs, toggle };
}

/** Uma preferência local com estado (visão da lista, aviso dispensado). */
export function usePref<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => readPref(key, fallback));
  const set = useCallback(
    (v: T) => {
      setValue(v);
      writePref(key, v);
    },
    [key],
  );
  return [value, set] as const;
}
