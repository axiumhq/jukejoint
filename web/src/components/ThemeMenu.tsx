import { useEffect, useId, useRef, type KeyboardEvent } from 'react';
import { t } from '../i18n';
import { useLocale } from '../i18n/useLocale';
import { useTheme } from '../state/theme';
import { Icon } from './Icon';

const IDIOMAS = [
  { id: 'pt-BR', name: 'Português (Brasil)' },
  { id: 'en', name: 'English' },
] as const;

/**
 * Tema e idioma em menu (ícone de paleta na barra superior), em toda largura: fora da navegação,
 * como preferência. Menu com itens de rádio (padrão ARIA de menu):
 * abrir leva o foco ao tema atual; setas, Home e End andam; Enter ou espaço escolhem (o menu
 * fica aberto para comparar); Esc ou Tab fecham e devolvem o foco ao botão. Também abre pelo
 * "Ajustes" do trilho (`useTheme().openMenu()`).
 */
export function ThemeMenu() {
  const { theme, themes, setTheme, menuOpen, setMenuOpen } = useTheme();
  const { locale, setLocale } = useLocale();
  const wrap = useRef<HTMLSpanElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();

  const items = () => [...(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [])];

  useEffect(() => {
    if (!menuOpen) return;
    // Barra lateral aberta: o botão do menu está escondido e as amostras estão à vista. O
    // "Ajustes" da sua lista leva o foco para a amostra do tema atual em vez de abrir o menu.
    if (btn.current && btn.current.offsetParent === null) {
      setMenuOpen(false);
      document.querySelector<HTMLButtonElement>('.theme-sw [aria-pressed="true"]')?.focus();
      return;
    }
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
              {/* data-theme no próprio elemento: a amostra lê --swatch e --acc do bloco desse tema em tokens.css */}
              <span className="sw" data-theme={th.id} aria-hidden="true" />
              <span>
                <b>{th.name}</b>
                <small>{th.note}</small>
              </span>
              <Icon name="check" />
            </button>
          ))}
          <div className="cap" aria-hidden="true">
            {t.theme.language}
          </div>
          {IDIOMAS.map((l) => (
            <button
              key={l.id}
              type="button"
              role="menuitemradio"
              aria-checked={l.id === locale}
              tabIndex={-1}
              className="theme-opt is-lang"
              onClick={() => setLocale(l.id)}
            >
              <span>
                <b>{l.name}</b>
              </span>
              <Icon name="check" />
            </button>
          ))}
        </div>
      )}
    </span>
  );
}
