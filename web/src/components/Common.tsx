import { useState } from 'react';
import { Link } from 'react-router';
import type { Lobby } from '../data/lobbies';
import type { Mode } from '../data/modes';
import { liveBase } from '../data/stats';
import { useLiveNumber } from '../hooks';
import { formatNumber, t } from '../i18n';
import { isJoinable } from '../lib/lobbies';
import { useSession } from '../state/session';
import { Setback } from './Deco';
import { Icon } from './Icon';
import { LobbyRow } from './LobbyRow';
import { ModeArt } from './ModeArt';

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

/**
 * Painel ao vivo da home: o produto funcionando antes de qualquer instalação.
 * As vagas ocupadas acendem em sequência ao abrir a página (único momento animado da home).
 */
export function LivePanel({ lobbies }: { lobbies: Lobby[] }) {
  return (
    <section className="live-panel" aria-labelledby="live-title">
      <Setback className="live-panel-crown" />
      <div className="live-panel-head">
        <h2 id="live-title" className="live-panel-title">
          {t.home.liveTitle}
        </h2>
        <LiveStrip className="is-inline" />
      </div>
      <ul className="lobby-list is-mini">
        {lobbies.map((l) => (
          <LobbyRow key={l.id} lobby={l} mini />
        ))}
      </ul>
      <Link to="/lobbies" className="text-link live-panel-more">
        {t.home.hotLink}
      </Link>
    </section>
  );
}

interface ModeCardProps {
  mode: Mode;
  headingLevel?: 2 | 3;
  /** card: arte em cima (grade). row: miniatura ao lado (listas). feature: destaque grande. */
  layout?: 'card' | 'row' | 'feature';
}

export function ModeCard({ mode, headingLevel = 3, layout = 'card' }: ModeCardProps) {
  const [hover, setHover] = useState(false);
  const { lobbies } = useSession();
  const openCount = lobbies.filter((l) => l.modeSlug === mode.slug && isJoinable(l)).length;
  const H = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <article
      className={`mode-card is-${layout}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
    >
      <div className="mode-card-art">
        <ModeArt mode={mode} playing={hover} />
      </div>
      <div className="mode-card-body">
        <H className="mode-card-title">
          <Link to={`/modos/${mode.slug}`} className="stretched">
            {mode.name}
          </Link>
        </H>
        <p className="mode-card-tagline">{mode.tagline}</p>
        <p className="mode-card-meta">
          <span>
            <strong className="num">{formatNumber(mode.playersNow)}</strong> {t.modes.playersNow}
          </span>
          <span>{t.modes.openLobbies(openCount)}</span>
        </p>
      </div>
    </article>
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
