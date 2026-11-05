import { useEffect, useState } from 'react';

/**
 * A faixa de título da janela sem moldura do app (o Rust abre a janela com `decorations(false)`).
 * Fica no topo da janela inteira: a faixa toda arrasta a janela, o clique duplo maximiza ou
 * restaura, e os três botões ficam no canto direito, na ordem do Windows. Só existe no app;
 * `html.is-desktop` (main.tsx) põe a rolagem da página abaixo dela.
 */

type Win = {
  minimize(): Promise<void>;
  toggleMaximize(): Promise<void>;
  close(): Promise<void>;
  startDragging(): Promise<void>;
  isMaximized(): Promise<boolean>;
  onResized(cb: () => void): Promise<() => void>;
};

async function win(): Promise<Win> {
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  return getCurrentWindow() as unknown as Win;
}

export function TitleBar() {
  const [maximized, setMaximized] = useState(false);

  // O ícone do meio mostra o que o clique faz: maximizar ou restaurar.
  useEffect(() => {
    let off: (() => void) | undefined;
    let alive = true;
    win()
      .then(async (w) => {
        const sync = () => void w.isMaximized().then((m) => alive && setMaximized(m), () => {});
        sync();
        const un = await w.onResized(sync);
        if (alive) off = un;
        else un();
      })
      // Sem a janela do Tauri (fora do app), o ícone do meio só fica em maximizar.
      .catch(() => {});
    return () => {
      alive = false;
      off?.();
    };
  }, []);

  const act = (action: 'minimize' | 'toggleMaximize' | 'close') =>
    void win()
      .then((w) => w[action]())
      .catch(() => {});

  return (
    <div
      className="titlebar"
      onMouseDown={(e) => {
        // Só o botão esquerdo, e não em cima dos botões: o segundo clique de um duplo fica para o onDoubleClick.
        if (e.button !== 0 || e.detail > 1 || (e.target as HTMLElement).closest('button')) return;
        void win()
          .then((w) => w.startDragging())
          .catch(() => {});
      }}
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest('button')) return;
        act('toggleMaximize');
      }}
    >
      <div className="titlebar-drag" />
      <div className="window-controls">
        <button type="button" aria-label="Minimizar" title="Minimizar" onClick={() => act('minimize')}>
          <svg viewBox="0 0 10 10" aria-hidden="true">
            <path d="M0 5.5h10" />
          </svg>
        </button>
        <button
          type="button"
          aria-label={maximized ? 'Restaurar' : 'Maximizar'}
          title={maximized ? 'Restaurar' : 'Maximizar'}
          onClick={() => act('toggleMaximize')}
        >
          {maximized ? (
            <svg viewBox="0 0 10 10" aria-hidden="true">
              <path d="M2.5 2.5V.5h7v7h-2M.5 2.5h7v7h-7z" />
            </svg>
          ) : (
            <svg viewBox="0 0 10 10" aria-hidden="true">
              <path d="M.5.5h9v9h-9z" />
            </svg>
          )}
        </button>
        <button type="button" className="is-close" aria-label="Fechar" title="Fechar" onClick={() => act('close')}>
          <svg viewBox="0 0 10 10" aria-hidden="true">
            <path d="M.5.5l9 9M9.5.5l-9 9" />
          </svg>
        </button>
      </div>
    </div>
  );
}
