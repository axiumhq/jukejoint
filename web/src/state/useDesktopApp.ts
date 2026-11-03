import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { desktop as D } from '../i18n/desktop';
import { DESKTOP_EVENTS, desktop, desktopInfo, IN_DESKTOP, lobbyIdFromLink, onDesktop, toEngineError, type EngineCheck } from '../lib/desktop';
import type { AppCheck } from './sessionContext';

/**
 * O app desktop visto pela sessão (simulada ou ao vivo): se o site está dentro dele, a checagem do
 * motor (`engine_check`, com os problemas em duas camadas), os deep links (navegam pelo React Router,
 * sem recarregar) e a tela Instalação. Fora do app devolve `desktop: false` e não faz nada.
 */
export function useDesktopApp(pushToast: (message: string) => void) {
  const navigate = useNavigate();
  const [check, setCheck] = useState<AppCheck | null>(() => (IN_DESKTOP ? { status: 'checking', problems: [] } : null));

  const apply = useCallback((r: EngineCheck) => {
    setCheck({ status: r.ready ? 'ready' : 'problems', problems: r.problems ?? [], modes: r.modes });
  }, []);

  const recheck = useCallback(() => {
    if (!IN_DESKTOP) return;
    setCheck((c) => ({ status: 'checking', problems: c?.problems ?? [], modes: c?.modes }));
    desktop
      .check()
      .then(apply)
      .catch((e: unknown) => setCheck({ status: 'problems', problems: [toEngineError(e)] }));
  }, [apply]);

  useEffect(() => {
    if (!IN_DESKTOP) return;
    recheck();
    // A primeira checagem que o app faz sozinho ao abrir também chega como evento.
    const offCheck = onDesktop<EngineCheck>(DESKTOP_EVENTS.check, apply);
    const offLink = onDesktop<unknown>(DESKTOP_EVENTS.deepLink, (payload) => {
      const id = lobbyIdFromLink(payload);
      if (id) navigate(`/sala/${encodeURIComponent(id)}`);
      else pushToast(D.invalidLink);
    });
    const offBad = onDesktop<unknown>(DESKTOP_EVENTS.deepLinkInvalid, () => pushToast(D.invalidLink));
    return () => {
      offCheck();
      offLink();
      offBad();
    };
  }, [apply, navigate, pushToast, recheck]);

  const openInstall = useCallback(() => {
    desktop.openInstallWindow().catch((e: unknown) => pushToast(toEngineError(e).message));
  }, [pushToast]);

  return { desktop: IN_DESKTOP, version: desktopInfo()?.version || null, check, recheck, openInstall };
}
