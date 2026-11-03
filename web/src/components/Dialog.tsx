import { useEffect, useId, useRef, type ReactNode } from 'react';
import { t } from '../i18n';
import { Icon } from './Icon';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Linha curta sob o título (o que este diálogo resolve). */
  lead?: ReactNode;
  /** `wide` no criar lobby. */
  size?: 'wide';
  /** Classe extra (compatibilidade: `is-wide` vira `size="wide"`). */
  className?: string;
}

/**
 * Diálogo modal v8 sobre o <dialog> nativo: foco preso no diálogo, fundo inerte, Esc e clique no fundo fecham.
 * Ao fechar, o foco volta para quem abriu (o nativo nem sempre devolve quando o diálogo fecha por estado).
 */
export function Dialog({ open, onClose, title, children, lead, size, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const leadId = useId();
  const wide = size === 'wide' || className?.includes('is-wide');

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      opener.current = document.activeElement as HTMLElement | null;
      el.showModal();
    }
    if (!open && el.open) el.close();
    if (!open && opener.current) {
      const back = opener.current;
      opener.current = null;
      if (back.isConnected) back.focus({ preventScroll: true });
    }
  }, [open]);

  const cls = ['dlg', wide && 'is-wide', className?.replace('is-wide', '').trim()].filter(Boolean).join(' ');
  return (
    <dialog
      ref={ref}
      className={cls}
      aria-labelledby={titleId}
      aria-describedby={lead ? leadId : undefined}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="dlg-in">
        <header className="dlg-h">
          <div className="dlg-ht">
            <h2 id={titleId} className="display">
              {title}
            </h2>
            {lead && (
              <p id={leadId} className="dlg-lead">
                {lead}
              </p>
            )}
          </div>
          <button type="button" className="icon-btn dlg-x" onClick={onClose} aria-label={t.common.close}>
            <Icon name="x" />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
