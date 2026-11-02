import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import { getMode, type Mode } from '../data/modes';
import { t } from '../i18n';
import { modeArcana } from '../lib/lobbies';
import { Icon } from './Icon';
import { ModeGlyph } from './ModeArt';
import './lobbyStyles';

export type SealState = 'locked' | 'playing' | 'full' | null;

interface ModeSealProps {
  mode: Mode | string;
  /** sm = 32 px (celular, filtros), md = 40 px (linhas), lg = 56 px (destaque, diálogos). */
  size?: 'sm' | 'md' | 'lg';
  state?: SealState;
  /** Vira link para a página do modo (alvo inteiro do selo, rótulo acessível próprio). */
  link?: boolean;
  className?: string;
}

/** Estilo com o matiz do modo: o friso e o selo leem `--mode-h`. Nunca chega nas janelas. */
export const modeHue = (mode: Mode | undefined) => ({ '--mode-h': mode?.hue ?? 60 }) as CSSProperties;

/**
 * Selo do modo: placa com o topo escalonado (o mesmo recuo da torre), o motivo recortado
 * da arte da carta e o numeral do arcano. Decorativo quando não é link: o nome do modo
 * sempre aparece em texto ao lado.
 */
export function ModeSeal({ mode: m, size = 'md', state = null, link = false, className }: ModeSealProps) {
  const mode = typeof m === 'string' ? getMode(m) : m;
  if (!mode) return null;
  const arcana = t.modes.arcana(modeArcana(mode.slug));
  const cls = `seal has-mode seal-${size}${state ? ` is-${state}` : ''}${className ? ` ${className}` : ''}`;
  const body = (
    <>
      <svg className="seal-frame" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
        <path className="seal-plate" d="M.75 39.25V8.5h11V4.75h4V.75h8.5v4h4V8.5h11v30.75z" />
        <ModeGlyph motif={mode.motif} x={7} y={9.5} size={26} className="seal-glyph" />
        <path className="seal-rule" d="M4 31.5h32" />
        <text className="seal-num" x="20" y="37.6">
          {arcana}
        </text>
        {state === 'playing' && <rect className="seal-orbit" x="2.5" y="10" width="35" height="27.5" rx="1" />}
      </svg>
      {state === 'locked' && (
        <span className="seal-lock" aria-hidden="true">
          <Icon name="lock" size={11} />
        </span>
      )}
    </>
  );

  if (link) {
    return (
      <Link to={`/modos/${mode.slug}`} className={`${cls} seal-link`} style={modeHue(mode)} aria-label={t.lobbies.sealLink(mode.name)}>
        {body}
      </Link>
    );
  }
  return (
    <span className={cls} style={modeHue(mode)} aria-hidden="true">
      {body}
    </span>
  );
}
