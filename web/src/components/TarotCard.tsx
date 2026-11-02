import { useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { modes, type Mode } from '../data/modes';
import { useTiltAllowed } from '../hooks';
import { formatNumber, t } from '../i18n';
import { isJoinable } from '../lib/lobbies';
import { navigateWithTransition } from '../lib/viewTransition';
import { useSession } from '../state/session';
import { ModeArt } from './ModeArt';

interface TarotCardProps {
  mode: Mode;
  headingLevel?: 2 | 3;
  size?: 'md' | 'sm';
  style?: CSSProperties;
}

/** Nome de transição único por modo: a arte da carta vira a arte do topo da página do modo. */
export const modeTransitionName = (slug: string) => `mode-${slug}`;

/**
 * Card de modo como carta de tarô: número de arcano, moldura dupla de latão, arte num
 * arco escalonado e o nome no rodapé. Com mouse, inclina seguindo o ponteiro e um brilho
 * atravessa a carta. Sem tilt no toque e com prefers-reduced-motion.
 * O tilt escreve variáveis CSS direto no elemento (sem re-render a cada movimento).
 */
export function TarotCard({ mode, headingLevel = 3, size = 'md', style }: TarotCardProps) {
  const { lobbies } = useSession();
  const navigate = useNavigate();
  const tilt = useTiltAllowed();
  const ref = useRef<HTMLElement>(null);
  const [hover, setHover] = useState(false);
  const openCount = lobbies.filter((l) => l.modeSlug === mode.slug && isJoinable(l)).length;
  const arcana = modes.findIndex((m) => m.slug === mode.slug) + 1;
  const H = headingLevel === 2 ? 'h2' : 'h3';
  const to = `/modos/${mode.slug}`;

  const onMove = (e: PointerEvent<HTMLElement>) => {
    if (!tilt || e.pointerType !== 'mouse' || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    const el = ref.current;
    el.style.setProperty('--rx', `${(0.5 - y) * 9}deg`);
    el.style.setProperty('--ry', `${(x - 0.5) * 11}deg`);
    el.style.setProperty('--mx', `${x * 100}%`);
    el.style.setProperty('--my', `${y * 100}%`);
  };

  const reset = () => {
    setHover(false);
    const el = ref.current;
    if (!el) return;
    el.style.removeProperty('--rx');
    el.style.removeProperty('--ry');
  };

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigateWithTransition(navigate, to);
  };

  return (
    <article
      ref={ref}
      className={`tarot tarot-${size}${tilt ? ' can-tilt' : ''}`}
      style={style}
      onPointerEnter={() => setHover(true)}
      onPointerMove={onMove}
      onPointerLeave={reset}
      onFocus={() => setHover(true)}
      onBlur={reset}
    >
      <div className="tarot-face">
        <p className="tarot-arcana" aria-hidden="true">
          {t.modes.arcana(arcana)}
        </p>
        <div className="tarot-window" style={{ viewTransitionName: modeTransitionName(mode.slug) } as CSSProperties}>
          <ModeArt mode={mode} playing={hover} />
        </div>
        <div className="tarot-body">
          <H className="tarot-title">
            <Link to={to} className="stretched" onClick={onClick}>
              {mode.name}
            </Link>
          </H>
          <p className="tarot-tagline">{mode.tagline}</p>
          <p className="tarot-meta">
            <span>
              <strong className="num">{formatNumber(mode.playersNow)}</strong> {t.modes.playersNow}
            </span>
            <span>{t.modes.openLobbies(openCount)}</span>
          </p>
        </div>
        <span className="tarot-sheen" aria-hidden="true" />
      </div>
    </article>
  );
}
