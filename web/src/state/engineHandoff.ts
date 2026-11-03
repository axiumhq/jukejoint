import { useCallback, useEffect, useRef, useState } from 'react';
import { desktop as D } from '../i18n/desktop';
import type { Intent, LobbyView } from '../lib/api';
import { desktop, DESKTOP_EVENTS, IN_DESKTOP, onDesktop, toEngineError, type EngineError, type SessionEvent } from '../lib/desktop';
import { adoptable, belongsTo, hostingCode, matchKey, myStep, seatStep, type Tracked } from '../lib/handoff';

interface Options {
  /** O lobby em que você está (visão do servidor). */
  view: LobbyView | undefined;
  meId: string | null;
  request: (intent: Intent, quiet?: boolean) => Promise<unknown>;
  pushToast: (message: string) => void;
}

interface Local {
  key: string;
  step: number | null;
  error: EngineError | null;
}

/**
 * A partida de verdade, ao vivo e dentro do app desktop. Quando o servidor passa a sala para o
 * handoff: quem hospeda chama `engine_host` com o modo do lobby e manda o código do evento `hosting`
 * (`set_join_code`); quem entra espera o código na visão do lobby e chama `engine_join`. Cada etapa
 * que o app anuncia (`step` do `engine://event`) vai para o servidor (`handoff_progress`), que para
 * de andar por tempo assim que o app de quem hospeda fala. A sessão de quem hospeda terminou:
 * `end_match` (a sala reabre). Saiu da sala ou a partida acabou: `engine_stop`.
 *
 * Fora do app, nada disso roda e a sala segue o servidor (etapas por tempo), como antes.
 */
export function useEngineHandoff({ view, meId, request, pushToast }: Options) {
  const enabled = IN_DESKTOP;
  const key = enabled ? matchKey(view) : null;
  const isHost = !!view && !!meId && view.hostId === meId;
  const code = view?.joinCode ?? null;

  const [local, setLocal] = useState<Local>({ key: '', step: null, error: null });
  const [attempt, setAttempt] = useState(0);

  const viewRef = useRef(view);
  viewRef.current = view;
  const meRef = useRef(meId);
  meRef.current = meId;
  const keyRef = useRef(key);
  keyRef.current = key;
  const tracked = useRef<(Tracked & { key: string; running: boolean }) | null>(null);
  const lastId = useRef(0);
  const started = useRef<string | null>(null);
  const reported = useRef({ key: '', step: -1 });

  /** Manda a sua etapa ao servidor, só para frente (ele também recusa voltar). */
  const report = useCallback(
    (step: number) => {
      const k = keyRef.current;
      if (!k) return;
      if (reported.current.key !== k) reported.current = { key: k, step: seatStep(viewRef.current, meRef.current) ?? -1 };
      if (step <= reported.current.step) return;
      reported.current.step = step;
      void request({ type: 'handoff_progress', step }, true);
    },
    [request],
  );

  const setStep = useCallback(
    (k: string, step: number) => {
      setLocal((cur) => {
        if (cur.key !== k) return { key: k, step, error: null };
        return (cur.step ?? -1) >= step ? cur : { ...cur, step };
      });
      report(step);
    },
    [report],
  );

  const fail = useCallback((k: string, error: EngineError) => {
    setLocal((cur) => ({ key: k, step: cur.key === k ? cur.step : null, error }));
  }, []);

  /** Encerra a sessão desta partida (sair da sala, partida encerrada). */
  const stop = useCallback(() => {
    const t = tracked.current;
    tracked.current = null;
    started.current = null;
    if (t) void desktop.stop().catch(() => {});
  }, []);

  // Os eventos da sessão: etapa, código de entrada, fim e erros.
  useEffect(() => {
    if (!enabled) return;
    return onDesktop<SessionEvent>(DESKTOP_EVENTS.engine, (e) => {
      const t = tracked.current;
      if (!t || !belongsTo(e, t)) return;
      if (t.id === null) t.id = e.session;
      lastId.current = Math.max(lastId.current, e.session);
      const here = keyRef.current === t.key;
      const hosting = here && t.kind === 'host' && viewRef.current?.hostId === meRef.current;
      const joinCode = hostingCode(e);
      if (joinCode && hosting) void request({ type: 'set_join_code', code: joinCode });
      if (typeof e.step === 'number' && here) setStep(t.key, e.step);
      if (e.stream !== 'fim') {
        if (e.error) pushToast(e.error.message);
        return;
      }
      t.running = false;
      if (t.kind === 'host') {
        // A partida morava no PC de quem hospeda: acabou a sessão, a sala reabre.
        if (hosting) {
          pushToast(e.error?.message ?? D.hostEnded);
          void request({ type: 'end_match' }, true);
        }
      } else if (e.error && here) {
        fail(t.key, e.error);
      }
    });
  }, [enabled, fail, pushToast, request, setStep]);

  // A partida da sua sala: hospedar, entrar ou encerrar.
  useEffect(() => {
    if (!enabled) return;
    if (!key) {
      if (tracked.current) stop();
      return;
    }
    if (tracked.current && tracked.current.key !== key) stop();
    setStep(key, 0);
    const want = isHost ? `${key}|host` : code ? `${key}|join:${code}` : null;
    if (!want || started.current === want) return;
    started.current = want;
    const role = isHost ? 'host' : 'member';
    const kind = isHost ? 'host' : 'join';
    void (async () => {
      try {
        const cur = await desktop.session().catch(() => null);
        if (started.current !== want) return;
        if (cur && adoptable(cur, role, code)) {
          // A página recarregou no meio da partida: a sessão do app continua a mesma.
          tracked.current = { id: cur.id, kind, after: cur.id - 1, key, running: true };
          lastId.current = Math.max(lastId.current, cur.id);
          if (typeof cur.step === 'number') setStep(key, cur.step);
          if (isHost && cur.joinCode && viewRef.current?.joinCode !== cur.joinCode) void request({ type: 'set_join_code', code: cur.joinCode });
          return;
        }
        if (cur?.running) await desktop.stop().catch(() => {});
        tracked.current = { id: null, kind, after: Math.max(lastId.current, cur?.id ?? 0), key, running: true };
        const info = isHost ? await desktop.host(viewRef.current?.modeSlug ?? '') : await desktop.join(code ?? '');
        const t = tracked.current;
        if (t && t.key === key && t.kind === kind) t.id = info.id;
        lastId.current = Math.max(lastId.current, info.id);
      } catch (e) {
        if (started.current !== want) return;
        if (tracked.current?.key === key) tracked.current = null;
        fail(key, toEngineError(e));
      }
    })();
  }, [enabled, key, isHost, code, attempt, fail, request, setStep, stop]);

  const retry = useCallback(() => {
    started.current = null;
    setLocal((cur) => ({ ...cur, error: null }));
    setAttempt((n) => n + 1);
  }, []);

  /** Quem hospeda encerra a partida: fecha a sessão do app e reabre a sala. */
  const endMatch = useCallback(() => {
    stop();
    void request({ type: 'end_match' });
  }, [request, stop]);

  const mine = key !== null && local.key === key;
  return {
    enabled,
    /** A sua etapa (o app e o servidor, a mais adiantada); `null` fora de partida ou fora do app. */
    step: key ? myStep(mine ? local.step : null, seatStep(view, meId)) : null,
    error: mine ? local.error : null,
    retry,
    stop,
    endMatch,
  };
}
