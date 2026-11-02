import { useState } from 'react';
import { formatNumber, t } from '../i18n';
import type { Counts } from '../lib/stats';
import { Icon } from './Icon';

/**
 * As três contagens ao vivo como créditos de filme: número em Fragment Mono, papel em Mona Sans.
 * Os valores vêm sempre de `useLiveStats()`, a mesma fonte do cabeçalho, da lista e dos modos.
 */
export function Credits({ counts, className }: { counts: Counts; className?: string }) {
  return (
    <dl className={className ? `credits ${className}` : 'credits'} aria-label={t.stats.label}>
      <div>
        <dt>{t.stats.players}</dt>
        <dd className="num">{formatNumber(counts.players)}</dd>
      </div>
      <div>
        <dt>{t.stats.lobbies(counts.lobbies)}</dt>
        <dd className="num">{formatNumber(counts.lobbies)}</dd>
      </div>
      <div>
        <dt>{t.stats.withRoom}</dt>
        <dd className="num">{formatNumber(counts.withRoom)}</dd>
      </div>
    </dl>
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
