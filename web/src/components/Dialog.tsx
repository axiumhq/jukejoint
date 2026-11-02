import { useEffect, useId, useRef, type ReactNode } from 'react';
import { t } from '../i18n';
import { Icon } from './Icon';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Classe extra (ex.: `is-wide` no criar lobby). */
  className?: string;
}

/** Diálogo modal nativo (<dialog>): foco preso, Esc fecha, fundo inerte. */
export function Dialog({ open, onClose, title, children, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={className ? `dialog ${className}` : 'dialog'}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="dialog-body">
        <header className="dialog-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="btn-icon" onClick={onClose} aria-label={t.common.close}>
            <Icon name="close" />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
