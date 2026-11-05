import { useState, type ReactNode } from 'react';
import { t } from '../i18n';
import { live as L } from '../i18n/live';
import { Icon } from './Icon';

/** Primitivos pequenos: chip, etiqueta, ponto ao vivo, lâmpadas de vaga, esqueleto e título de seção. */

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

/** Dentro de um botão de criar lobby bloqueado: a razão, para leitor de tela (a dica visível é o `title`). */
export function CreateReason({ blocked }: { blocked: boolean }) {
  return blocked ? <span className="sr-only"> ({L.createBlocked})</span> : null;
}

export type TagTone = 'acc' | 'soft' | 'strong' | 'plain' | 'warn' | 'lock' | 'line';

/**
 * Etiqueta curta em Barlow (o .tag do design). `acc` é só para "Você está aqui" e "Entrando…";
 * `strong`/`soft` destacam sem acento ("Falta 2"); `warn` ganha o ponto de "em partida"; `lock`, o cadeado.
 */
export function Tag({ tone = 'plain', children, className }: { tone?: TagTone; children: ReactNode; className?: string }) {
  const cls = ['tag', (tone === 'acc' || tone === 'soft' || tone === 'strong' || tone === 'line') && tone, className].filter(Boolean).join(' ');
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

interface SlotMeterProps {
  /** Vagas ocupadas. */
  taken: number;
  /** Vagas no total. */
  total: number;
  /** A próxima vaga livre pulsa de leve (falta pouco para fechar). */
  pulse?: boolean;
  /** Lâmpadas de 14 px (destaque, sala). */
  large?: boolean;
  className?: string;
}

/** Até onde as lâmpadas vão: acima disso a fileira não cabe no cartão (o número fica no texto ao lado). */
const MAX_BULBS = 24;

/**
 * O medidor de vagas do design: uma lâmpada por vaga, acesa quando ocupada. Decorativo: quem
 * usa escreve ao lado "N de M na sala" (o leitor de tela lê o texto, não as lâmpadas).
 */
export function SlotMeter({ taken, total, pulse = false, large = false, className }: SlotMeterProps) {
  const n = Math.min(Math.max(total, 0), MAX_BULBS);
  const on = Math.min(Math.max(taken, 0), n);
  const cls = ['bulbs', large && 'lg', className].filter(Boolean).join(' ');
  return (
    <span className={cls} aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <i key={i} className={i < on ? 'on' : pulse && i === on ? 'next' : undefined} />
      ))}
    </span>
  );
}

/** Bloco de espera (esqueleto). Decorativo; quem usa anuncia o carregamento em texto. */
export function Skeleton({ className, height }: { className?: string; height?: number }) {
  return <div className={className ? `skel ${className}` : 'skel'} style={height ? { minHeight: height } : undefined} aria-hidden="true" />;
}

interface EmptyStateProps {
  title: ReactNode;
  children?: ReactNode;
  /** A ação (um botão). */
  action?: ReactNode;
  className?: string;
}

/** Estado vazio do design: painel, título em Bodoni, uma linha e uma ação. */
export function EmptyState({ title, children, action, className }: EmptyStateProps) {
  return (
    <div className={className ? `empty ${className}` : 'empty'}>
      <h3>{title}</h3>
      {children != null && <p>{children}</p>}
      {action}
    </div>
  );
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

/** Cabeçalho de seção: título em Bodoni (as duas palavras no mesmo tom, como no design). */
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
