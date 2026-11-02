import { useState } from 'react';
import { Link } from 'react-router';
import { liveBase } from '../data/stats';
import { useLiveNumber } from '../hooks';
import { formatNumber, t } from '../i18n';
import { isJoinable } from '../lib/lobbies';
import { useSession } from '../state/session';
import { Icon } from './Icon';

/** Faixa "ao vivo": jogadores online, lobbies abertos e lobbies com vaga. */
export function LiveStrip({ className }: { className?: string }) {
  const { lobbies } = useSession();
  const players = useLiveNumber(liveBase.playersOnline, liveBase.playersJitter, liveBase.intervalMs);
  const open = lobbies.filter((l) => l.status !== 'cheio').length;
  const withSlots = lobbies.filter(isJoinable).length;
  return (
    <dl className={className ? `live-strip ${className}` : 'live-strip'} aria-label={t.live.label}>
      <div>
        <dt>
          <span className="live-dot" aria-hidden="true" />
          {t.live.online}
        </dt>
        <dd className="num">{formatNumber(players)}</dd>
      </div>
      <div>
        <dt>{t.live.lobbies}</dt>
        <dd className="num">{formatNumber(open)}</dd>
      </div>
      <div>
        <dt>{t.live.withSlots}</dt>
        <dd className="num">{formatNumber(withSlots)}</dd>
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
      /* fallback silencioso: o texto continua selecionável */
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="copy-field" id={id}>
      <code aria-label={label}>{value}</code>
      <button type="button" className="btn btn-ghost btn-sm" onClick={copy} aria-label={copied ? t.install.copied : copyLabel}>
        <Icon name={copied ? 'check' : 'copy'} size={16} />
        <span aria-hidden="true">{copied ? t.install.copied : t.install.copy}</span>
      </button>
      <span className="sr-only" role="status">
        {copied ? t.install.copied : ''}
      </span>
    </div>
  );
}

export function SectionHead({ title, id, link }: { title: string; id: string; link?: { to: string; label: string } }) {
  return (
    <div className="section-head">
      <h2 id={id}>{title}</h2>
      {link && (
        <Link to={link.to} className="text-link">
          {link.label}
        </Link>
      )}
    </div>
  );
}
