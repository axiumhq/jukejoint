import { useEffect, useId, useRef, type KeyboardEvent } from 'react';
import { t } from '../i18n';
import { useTheme } from '../state/theme';
import { Icon } from './Icon';

/**
 * Seletor de tema (ícone de paleta na barra). Menu com itens de rádio (padrão ARIA de menu):
 * abrir leva o foco ao tema atual; setas, Home e End andam; Enter ou espaço escolhem (o menu
 * fica aberto para comparar); Esc ou Tab fecham e devolvem o foco ao botão. Também abre pelo
 * "Ajustes" do trilho (`useTheme().openMenu()`).
 */
export function ThemeMenu() {
  const { theme, themes, setTheme, menuOpen, setMenuOpen } = useTheme();
  const wrap = useRef<HTMLSpanElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();

  const items = () => [...(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [])];

  useEffect(() => {
    if (!menuOpen) return;
    const checked = items().find((b) => b.getAttribute('aria-checked') === 'true') ?? items()[0];
    checked?.focus();
    const onDoc = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
    // só ao abrir: escolher um tema não rouba o foco de novo
  }, [menuOpen]);

  const close = (focusBtn = true) => {
    setMenuOpen(false);
    if (focusBtn) btn.current?.focus();
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const list = items();
    const i = list.indexOf(document.activeElement as HTMLButtonElement);
    const to = (n: number) => list[(n + list.length) % list.length]?.focus();
    if (e.key === 'ArrowDown') to(i + 1);
    else if (e.key === 'ArrowUp') to(i - 1);
    else if (e.key === 'Home') to(0);
    else if (e.key === 'End') to(list.length - 1);
    else if (e.key === 'Escape') close();
    else if (e.key === 'Tab') return close(false);
    else return;
    e.preventDefault();
  };

  return (
    <span className="theme-pop" ref={wrap}>
      <button
        ref={btn}
        type="button"
        className="icon-btn"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-controls={menuOpen ? id : undefined}
        aria-label={t.theme.button}
        title={t.theme.button}
        onClick={() => setMenuOpen(!menuOpen)}
      >
        <Icon name="palette" />
      </button>
      {menuOpen && (
        <div ref={menu} id={id} className="pop theme-menu" role="menu" aria-label={t.theme.title} onKeyDown={onKey}>
          <div className="cap" aria-hidden="true">
            {t.theme.title}
          </div>
          {themes.map((th) => (
            <button
              key={th.id}
              type="button"
              role="menuitemradio"
              aria-checked={th.id === theme}
              tabIndex={-1}
              className="theme-opt"
              onClick={() => setTheme(th.id)}
            >
              <span className="sw" style={{ background: `linear-gradient(135deg, ${th.swatch[0]} 0 55%, ${th.swatch[1]} 55%)` }} aria-hidden="true" />
              <span>
                <b>{th.name}</b>
                <small>{th.note}</small>
              </span>
              <Icon name="check" />
            </button>
          ))}
        </div>
      )}
    </span>
  );
}
