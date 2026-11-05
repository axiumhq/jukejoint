import { useEffect, useState } from 'react';
import { t } from '../i18n';
import { desktopInfo, IN_DESKTOP } from '../lib/desktop';
import { Icon } from './Icon';

type Update = import('@tauri-apps/plugin-updater').Update;
type Phase = 'downloading' | 'ready' | 'installing' | 'failed';

/** Procura e baixa atualizações no app desktop; a instalação começa só quando a pessoa confirma. */
export function DesktopUpdateNotice() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [phase, setPhase] = useState<Phase | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!IN_DESKTOP || desktopInfo()?.dev) return;
    let cancelled = false;

    void (async () => {
      try {
        const { check } = await import('@tauri-apps/plugin-updater');
        const found = await check({ timeout: 15_000 });
        if (!found || cancelled) return;
        setUpdate(found);
        setPhase('downloading');
        try {
          await found.download();
          if (!cancelled) setPhase('ready');
        } catch {
          if (!cancelled) setPhase('failed');
        }
      } catch {
        // Sem rede, app antigo ou falha no endpoint: tenta de novo na próxima abertura.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!update || !phase || dismissed) return null;

  const retryDownload = async () => {
    setPhase('downloading');
    try {
      await update.download();
      setPhase('ready');
    } catch {
      setPhase('failed');
    }
  };

  const install = async () => {
    setPhase('installing');
    try {
      await update.install({ restartAfterInstall: true });
    } catch {
      setPhase('failed');
    }
  };

  const message = phase === 'ready'
    ? t.appUpdate.ready(update.version)
    : phase === 'failed'
      ? t.appUpdate.failed
      : phase === 'installing'
        ? t.appUpdate.installing
        : t.appUpdate.downloading(update.version);

  return (
    <div className="desktop-update" role="status" aria-live="polite">
      <span>{message}</span>
      {phase === 'ready' && (
        <button type="button" className="btn btn-s btn-sm" onClick={() => void install()}>
          {t.appUpdate.install}
        </button>
      )}
      {phase === 'failed' && (
        <button type="button" className="btn btn-s btn-sm" onClick={() => void retryDownload()}>
          {t.appUpdate.retry}
        </button>
      )}
      <button
        type="button"
        className="btn-icon"
        onClick={() => {
          setDismissed(true);
          void update.close();
        }}
        aria-label={t.appUpdate.close}
      >
        <Icon name="x" />
      </button>
    </div>
  );
}
