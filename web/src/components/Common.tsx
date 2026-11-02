import { useState, type ReactNode } from 'react';
import { t } from '../i18n';
import { Icon } from './Icon';

/** Primitivos pequenos do v8: chip, etiqueta, ponto ao vivo e título de seção em dois tons. */

interface ChipProps {
  children: ReactNode;
  /** Ligado ou não (vira `aria-pressed`). */
  pressed: boolean;
  onClick: () => void;
  /** Texto pequeno em mono ao lado (contagem, faixa de ping). */
  count?: ReactNode;
  label?: string;
  className?: string;
}

export function Chip({ children, pressed, onClick, count, label, className }: ChipProps) {
  return (
    <button type="button" className={className ? `chip ${className}` : 'chip'} aria-pressed={pressed} aria-label={label} onClick={onClick}>
      {children}
      {count != null && <span className="c">{count}</span>}
    </button>
  );
}

export type TagTone = 'acc' | 'soft' | 'plain' | 'warn' | 'lock' | 'line';

/** Etiqueta curta sobre capa ou cartão. `warn` ganha o ponto de "em partida"; `lock`, o cadeado. */
export function Tag({ tone = 'plain', children, className }: { tone?: TagTone; children: ReactNode; className?: string }) {
  const cls = ['tag', (tone === 'acc' || tone === 'soft' || tone === 'line') && tone, className].filter(Boolean).join(' ');
  return (
    <span className={cls}>
      {tone === 'warn' && <span className="dot" aria-hidden="true" />}
      {tone === 'lock' && <Icon name="lock" />}
      {children}
    </span>
  );
}

export function LiveDot({ small = false }: { small?: boolean }) {
  return <span className={small ? 'dot-live sm' : 'dot-live'} aria-hidden="true" />;
}

interface SectionTitleProps {
  id: string;
  /** [palavra comum, palavra de acento]: "Modos *ao vivo*". */
  words: readonly [string, string];
  /** Rótulo de dado ao lado do título ("6 modos · 143 jogando"). */
  meta?: ReactNode;
  /** Selo logo depois do título (ex.: o chip "ao vivo"). */
  badge?: ReactNode;
  /** Ações à direita (link, botão). */
  children?: ReactNode;
}

/** Cabeçalho de seção: título em serifa condensada com a segunda palavra no acento. */
export function SectionTitle({ id, words, meta, badge, children }: SectionTitleProps) {
  return (
    <div className="sec-h">
      <h2 className="display two" id={id}>
        {words[0]} <em>{words[1]}</em>
      </h2>
      {badge}
      {meta != null && <span className="lbl">{meta}</span>}
      <span className="sp" />
      {children}
    </div>
  );
}

export function CopyField({ value, label, copyLabel, id }: { value: string; label: string; copyLabel: string; id?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      /* sem permissão: o texto continua selecionável */
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="copy-field" id={id}>
      <code className="num" aria-label={label}>
        {value}
      </code>
      <button type="button" className="btn btn-quiet btn-sm" onClick={copy} aria-label={copied ? t.install.copied : copyLabel}>
        <Icon name={copied ? 'check' : 'copy'} size={14} />
        <span aria-hidden="true">{copied ? t.install.copied : t.install.copy}</span>
      </button>
      <span className="sr-only" role="status">
        {copied ? t.install.copied : ''}
      </span>
    </div>
  );
}
