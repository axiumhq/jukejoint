import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';
import { getModes } from '../data/modes';
import { useFriends } from '../hooks';
import { t } from '../i18n';
import { useLocale } from '../i18n/useLocale';
import { flatHits, fold, searchAll, type SearchHit } from '../lib/search';
import { useSession } from '../state/session';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { ModeCover } from './ModeCover';
import '../styles/social.css';

/**
 * A busca da barra superior: combobox com lista de resultados (padrão ARIA 1.2).
 * Ctrl K (ou ⌘K) foca de qualquer lugar; setas andam, Enter abre, Esc fecha e limpa.
 * Lobby abre a sala, modo filtra a lista da home (`?modo=`), jogador abre a sala onde está.
 * No celular, a lupa abre a busca como painel sob a barra (`open` / `onOpenChange`).
 */
interface SearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function hitTo(h: SearchHit) {
  if (h.kind === 'lobby') return `/sala/${encodeURIComponent(h.lobby.id)}`;
  if (h.kind === 'mode') return `/?modo=${encodeURIComponent(h.mode.slug)}#lobbies`;
  return h.lobby ? `/sala/${encodeURIComponent(h.lobby.id)}` : null;
}

/** Marca no nome o trecho que bateu (sem acento e sem caixa), como o `mark` do design. */
function Marked({ text, q }: { text: string; q: string }) {
  const needle = fold(q.trim());
  if (!needle) return <>{text}</>;
  let folded = '';
  const at: number[] = [];
  Array.from(text).forEach((ch, k) => {
    const f = fold(ch);
    for (let n = 0; n < f.length; n += 1) at.push(k);
    folded += f;
  });
  const i = folded.indexOf(needle);
  if (i < 0) return <>{text}</>;
  const chars = Array.from(text);
  const a = at[i] ?? 0;
  const b = (at[i + needle.length - 1] ?? chars.length - 1) + 1;
  return (
    <>
      {chars.slice(0, a).join('')}
      <mark className="hl">{chars.slice(a, b).join('')}</mark>
      {chars.slice(b).join('')}
    </>
  );
}

export function Search({ open, onOpenChange }: SearchProps) {
  const { locale } = useLocale();
  const { lobbies, user } = useSession();
  const friends = useFriends();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  /** Onde o foco estava antes do Ctrl K (ou da lupa): Esc devolve para lá. */
  const back = useRef<HTMLElement | null>(null);
  /** O foco agendado pelo Ctrl K: Esc antes do próximo quadro não pode ser desfeito por ele. */
  const raf = useRef(0);
  const remember = () => {
    const a = document.activeElement as HTMLElement | null;
    if (a && a !== input.current && a !== document.body) back.current = a;
  };
  const listId = useId();
  const optId = (i: number) => `${listId}-o${i}`;

  const groups = useMemo(() => searchAll(q, lobbies, getModes(), friends, !!user), [q, lobbies, friends, user, locale]);
  const hits = useMemo(() => flatHits(groups), [groups]);
  const expanded = (focused || open) && q.trim() !== '';
  const showPop = focused || open;

  useEffect(() => setActive(0), [q]);

  // Ctrl K / ⌘K: foca a busca (no celular, abre o painel antes).
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        remember();
        onOpenChange(true);
        cancelAnimationFrame(raf.current);
        // Foco já, no mesmo evento: o que se digita logo depois do Ctrl K cai no campo.
        input.current?.focus();
        input.current?.select();
        // No celular o campo só aparece depois de abrir o painel: aí o foco vem no quadro seguinte,
        // sem apagar o que já foi digitado.
        if (document.activeElement !== input.current) {
          raf.current = requestAnimationFrame(() => input.current?.focus());
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onOpenChange]);

  useEffect(() => {
    if (!open) return;
    remember();
    input.current?.focus();
  }, [open]);

  // Clique fora fecha o painel do celular.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node) && !(e.target as Element).closest?.('[data-search-toggle]')) onOpenChange(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, onOpenChange]);

  const close = (restore = false) => {
    cancelAnimationFrame(raf.current);
    setQ('');
    onOpenChange(false);
    const to = back.current;
    back.current = null;
    if (restore && to?.isConnected) to.focus();
    else input.current?.blur();
  };

  const go = (h: SearchHit) => {
    const to = hitTo(h);
    if (!to) return;
    close();
    navigate(to);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && hits.length) {
      e.preventDefault();
      setActive((i) => (i + 1) % hits.length);
    } else if (e.key === 'ArrowUp' && hits.length) {
      e.preventDefault();
      setActive((i) => (i - 1 + hits.length) % hits.length);
    } else if (e.key === 'Enter' && hits[active]) {
      e.preventDefault();
      go(hits[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close(true);
    }
  };

  let i = -1;
  const option = (h: SearchHit) => {
    i += 1;
    const idx = i;
    const to = hitTo(h);
    let sub: string;
    let lead;
    if (h.kind === 'lobby') {
      sub = `${h.mode?.name ?? ''} · ${h.lobby.players} de ${h.lobby.slots} · ${t.regions[h.lobby.region]}`;
      lead = (
        <span className="sr-cv">
          <ModeCover slug={h.lobby.modeSlug} />
        </span>
      );
    } else if (h.kind === 'mode') {
      sub = t.search.playersIn(h.players);
      lead = (
        <span className="sr-cv">
          <ModeCover slug={h.mode.slug} />
        </span>
      );
    } else {
      const place = h.lobby ? (h.host ? t.search.hosting(h.lobby.name) : t.search.inLobby(h.lobby.name)) : t.search.nowhere;
      sub = h.friend ? `${t.search.friend} · ${place}` : place;
      lead = <Avatar name={h.label} size={28} ring={h.friend} />;
    }
    return (
      <li
        key={h.key}
        id={optId(idx)}
        role="option"
        aria-selected={idx === active}
        aria-disabled={to ? undefined : true}
        className="sr-opt"
        onMouseEnter={() => setActive(idx)}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => go(h)}
      >
        {lead}
        <span className="sr-t">
          <b>
            <Marked text={h.label} q={q} />
          </b>
          <small>{sub}</small>
        </span>
        {to && idx === active && (
          <kbd className="sr-enter" aria-hidden="true">
            Enter
          </kbd>
        )}
      </li>
    );
  };

  const group = (key: keyof typeof groups) =>
    groups[key].length > 0 && (
      <li role="presentation" key={key}>
        <span className="cap sr-gt" aria-hidden="true">
          {t.search.groups[key]}
        </span>
        <ul role="group" aria-label={t.search.groups[key]}>
          {groups[key].map(option)}
        </ul>
      </li>
    );

  return (
    <div ref={wrap} className={open ? 'search is-open' : 'search'} role="search">
      <label className="search-field">
        <span className="sr-only">{t.search.label}</span>
        <Icon name="search" />
        <input
          ref={input}
          type="search"
          role="combobox"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={expanded && hits[active] ? optId(active) : undefined}
          placeholder={t.search.placeholder}
          autoComplete="off"
          spellCheck={false}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={onKeyDown}
        />
        <kbd aria-hidden="true">Ctrl K</kbd>
      </label>
      {showPop && (
        <div className="search-pop">
          {q.trim() === '' ? (
            <p className="search-hint">{t.search.hint}</p>
          ) : hits.length === 0 ? (
            <p className="search-hint">{t.search.none(q.trim())}</p>
          ) : null}
          <ul id={listId} role="listbox" aria-label={t.search.label} hidden={!expanded || hits.length === 0}>
            {group('lobbies')}
            {group('modes')}
            {group('players')}
          </ul>
          {expanded && hits.length > 0 && (
            <div className="search-foot" aria-hidden="true">
              <span>{t.search.count(hits.length)}</span>
              <span>
                <kbd>↑↓</kbd>navegar<kbd>Enter</kbd>abrir<kbd>Esc</kbd>fechar
              </span>
            </div>
          )}
        </div>
      )}
      <span className="sr-only" role="status">
        {showPop && q.trim() ? t.search.count(hits.length) : ''}
      </span>
    </div>
  );
}
