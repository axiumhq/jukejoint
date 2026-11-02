import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router';
import { APP_RELEASE } from '../../config/brand';
import type { Lobby } from '../../data/lobbies';
import { modes } from '../../data/modes';
import { releases } from '../../data/patches';
import { formatDate, formatShortDate, t } from '../../i18n';
import { play } from '../../lib/sound';
import { canEnter, nearestToFull } from '../../lib/towerData';
import { useSession } from '../../state/session';
import { Icon } from '../Icon';
import { TarotCard } from '../TarotCard';

/**
 * Cenas 3 a 6 da home em HTML. No 3D (alto e médio) cada bloco tem altura de rolagem
 * própria: é a rolagem que gira o cofre, move o ponteiro e corre a luz na placa.
 * No nível baixo, as mesmas informações em forma compacta com as peças 2D do v3.
 */

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];

/**
 * Palco de rolagem (cofre e elevador): os painéis ficam empilhados num palco fixo
 * (sticky) e só o ativo aparece; a altura de rolagem vem de marcas invisíveis, uma por
 * parada. A marca que cruza o meio da tela define o painel ativo (IntersectionObserver,
 * sem ouvir scroll). Foco de teclado num painel inativo rola até a marca dele.
 */
function useScrolly(count: number) {
  const marks = useRef<(HTMLElement | null)[]>([]);
  const stage = useRef<HTMLOListElement | null>(null);
  const [active, setActive] = useState(0);
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.i));
        }
      },
      { rootMargin: '-50% 0px -50% 0px' },
    );
    marks.current.slice(0, count).forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [count]);
  // A altura do palco entra na conta do `top` (centrado no desktop, acima do HUD no celular).
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(() => el.style.setProperty('--stage-h', `${el.offsetHeight}px`));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const bindMark = (i: number) => (el: HTMLElement | null) => {
    marks.current[i] = el;
  };
  const reveal = (i: number) => {
    if (i !== active) marks.current[i]?.scrollIntoView({ block: 'center' });
  };
  const markers = (
    <div className="tr-marks" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} ref={bindMark(i)} data-i={i} />
      ))}
    </div>
  );
  return { active, stage, reveal, markers };
}

/* ───────── Cena 3: o cofre dos modos ───────── */

export function VaultScene({ lobbies, flat }: { lobbies: Lobby[]; flat: boolean }) {
  const { active, stage, reveal, markers } = useScrolly(modes.length);
  if (flat) {
    return (
      <div className="tr-vault-flat">
        {modes.map((m) => (
          <TarotCard key={m.slug} mode={m} size="sm" />
        ))}
      </div>
    );
  }
  return (
    <div className="tr-scrolly tr-modes-scrolly">
    <ol className="tr-stage-list tr-modes" ref={stage}>
      {modes.map((m, i) => {
        const open = lobbies.filter((l) => l.modeSlug === m.slug && canEnter(l));
        const best = [...open].sort((a, b) => b.players - a.players)[0];
        return (
          <li key={m.slug} className={`tr-mode${active === i ? ' is-active' : ''}`} style={{ '--h': m.hue } as CSSProperties} onFocus={() => reveal(i)}>
            <div className="tr-panel tr-mode-panel">
              <h3 className="tr-mode-name">
                <span className="tr-mode-num" aria-hidden="true">
                  {ROMAN[i]}
                </span>
                {m.name}
              </h3>
              <p className="tr-mode-line">{m.tagline}</p>
              <p className="tr-mode-now">
                {best ? (
                  <>
                    {t.home.vault.nowShowing}{' '}
                    <Link to={`/lobbies?modo=${m.slug}`} className="tr-inline-link">
                      {best.name}
                    </Link>{' '}
                    <span className="num">({t.home.floors.slots(best.players, best.slots)})</span>
                    <span className="tr-mode-count"> {t.home.vault.open(open.length)}.</span>
                  </>
                ) : (
                  t.home.vault.none
                )}
              </p>
              <Link to={`/modos/${m.slug}`} className="tr-link">
                {t.home.vault.view(m.name)}
              </Link>
            </div>
          </li>
        );
      })}
    </ol>
    {markers}
    </div>
  );
}

/* ───────── Cena 4: o elevador (no lugar dos "3 passos") ───────── */

/** Mostrador déco em meia-lua. Só no nível baixo (no 3D o mostrador é a peça da cena). */
function Dial({ stop, label }: { stop: number; label: string }) {
  const angles = [150, 90, 30];
  const a = ((angles[stop] ?? 90) * Math.PI) / 180;
  return (
    <svg className="tr-dial" viewBox="0 0 200 112" role="img" aria-label={label}>
      <path className="tr-dial-face" d="M10 104 A90 90 0 0 1 190 104 Z" />
      <path className="tr-dial-rim" d="M4 104 A96 96 0 0 1 196 104" />
      {Array.from({ length: 31 }, (_, i) => {
        const ta = Math.PI * (i / 30);
        const r1 = i % 5 === 0 ? 70 : 78;
        return <line key={i} className="tr-dial-tick" x1={100 + Math.cos(ta) * r1} y1={104 - Math.sin(ta) * r1} x2={100 + Math.cos(ta) * 86} y2={104 - Math.sin(ta) * 86} />;
      })}
      {angles.map((deg, i) => {
        const r = (deg * Math.PI) / 180;
        return <circle key={deg} className={`tr-dial-lamp${i === stop ? ' is-on' : ''}`} cx={100 + Math.cos(r) * 52} cy={104 - Math.sin(r) * 52} r={6} />;
      })}
      <line className="tr-dial-needle" x1={100} y1={104} x2={100 + Math.cos(a) * 80} y2={104 - Math.sin(a) * 80} />
      <circle className="tr-dial-hub" cx={100} cy={104} r={7} />
    </svg>
  );
}

export function ElevatorScene({ lobbies, flat }: { lobbies: Lobby[]; flat: boolean }) {
  const stops = t.home.elevator.stops;
  const { active, stage, reveal, markers } = useScrolly(stops.length);
  const lobby = nearestToFull(lobbies);
  const { requestJoin } = useSession();
  const lastStop = useRef(active);
  useEffect(() => {
    if (active !== lastStop.current) play('ding');
    lastStop.current = active;
  }, [active]);

  const inside = (
    <div className={`tr-car${flat || active === stops.length - 1 ? ' is-open' : ''}`}>
      <p className="tr-car-title">{t.home.elevator.inside}</p>
      {lobby ? (
        <>
          <p className="tr-car-name">{lobby.name}</p>
          <p className="tr-car-meta">
            {modes.find((m) => m.slug === lobby.modeSlug)?.name}, <span className="num">{t.home.floors.slots(lobby.players, lobby.slots)}</span>
          </p>
          <button type="button" className="btn btn-primary" onClick={() => requestJoin({ kind: 'lobby', lobby })} aria-label={t.home.floors.enterLabel(lobby.name)}>
            {t.home.floors.enter}
          </button>
        </>
      ) : (
        <p className="tr-car-meta">{t.home.elevator.empty}</p>
      )}
    </div>
  );

  if (flat) {
    return (
      <div className="tr-elev-flat">
        <ol className="tr-stops-flat">
          {stops.map((s, i) => (
            <li key={s.name}>
              <Dial stop={i} label={t.home.elevator.dialLabel(s.name)} />
              <h3 className="tr-stop-name">{s.name}</h3>
              <p>{s.line}</p>
            </li>
          ))}
        </ol>
        {inside}
      </div>
    );
  }

  return (
    <div className="tr-scrolly tr-stops-scrolly">
    <ol className="tr-stage-list tr-stops" ref={stage}>
      {stops.map((s, i) => (
        <li key={s.name} className={`tr-stop${active === i ? ' is-active' : ''}`} onFocus={() => reveal(i)}>
          <div className="tr-panel tr-stop-panel">
            <h3 className="tr-stop-name">{s.name}</h3>
            <p>{s.line}</p>
            {i === 1 && (
              <Link to="/instalar" className="tr-link">
                {t.home.plate.link}
              </Link>
            )}
          </div>
          {i === stops.length - 1 && inside}
        </li>
      ))}
    </ol>
    {markers}
    </div>
  );
}

/* ───────── Cena 5: a placa de latão ───────── */

export function PlateScene() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(APP_RELEASE.sha256);
      setCopied(true);
      play('click');
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* sem permissão de área de transferência: o hash continua selecionável */
    }
  };
  const p = t.home.plate;
  return (
    <div className="tr-plate">
      <span className="tr-plate-screw" aria-hidden="true" />
      <span className="tr-plate-screw" aria-hidden="true" />
      <span className="tr-plate-screw" aria-hidden="true" />
      <span className="tr-plate-screw" aria-hidden="true" />
      <h2 className="tr-plate-title" id="placa-title">
        {p.title}
      </h2>
      <dl className="tr-plate-facts">
        <div>
          <dt>{p.version}</dt>
          <dd className="num">{APP_RELEASE.version}</dd>
        </div>
        <div>
          <dt>{p.size}</dt>
          <dd className="num">{APP_RELEASE.sizeMb.toLocaleString('pt-BR')} MB</dd>
        </div>
        <div>
          <dt>{p.date}</dt>
          <dd className="num">{formatShortDate(APP_RELEASE.releasedAt)}</dd>
        </div>
      </dl>
      <div className="tr-plate-hash">
        <p className="tr-plate-hash-label">{p.hash}</p>
        <code className="tr-hash">{APP_RELEASE.sha256}</code>
        <button type="button" className="tr-copy" onClick={copy} aria-label={p.copyHash}>
          <Icon name={copied ? 'check' : 'copy'} size={16} />
          <span aria-live="polite">{copied ? t.install.copied : t.install.copy}</span>
        </button>
      </div>
      <p className="tr-plate-av">{p.av}</p>
      <p className="tr-plate-foot">
        <Link to="/instalar" className="tr-plate-link">
          {p.link}
        </Link>
        <span>{p.disclaimer}</span>
      </p>
    </div>
  );
}

/* ───────── Cena 6: a rua e a Gazeta ───────── */

export function StreetScene() {
  const [lead, ...rest] = releases;
  if (!lead) return null;
  return (
    <div className="tr-gazette">
      <h2 className="tr-gazette-mast" id="rua-title">
        {t.news.masthead}
      </h2>
      <article className="tr-gazette-lead">
        <h3>
          <Link to="/novidades">{lead.headline}</Link>
        </h3>
        <p className="tr-gazette-meta num">{t.home.street.edition(lead.version, formatDate(lead.date))}</p>
        <p className="tr-gazette-tldr">{lead.tldr}</p>
      </article>
      <ul className="tr-gazette-more">
        {rest.slice(0, 2).map((r) => (
          <li key={r.version}>
            <Link to="/novidades">{r.headline}</Link>
            <span className="tr-gazette-meta num">{t.home.street.edition(r.version, formatShortDate(r.date))}</span>
          </li>
        ))}
      </ul>
      <Link to="/novidades" className="tr-link">
        {t.home.street.link}
      </Link>
    </div>
  );
}

/** Seção de cena: registra-se no roteiro (para a câmera) e no HUD. */
export function SceneSection({
  index,
  id,
  className,
  labelledBy,
  register,
  children,
}: {
  index: number;
  id: string;
  className: string;
  labelledBy: string;
  register: (i: number, el: HTMLElement | null) => void;
  children: ReactNode;
}) {
  return (
    <section id={id} data-cena={index} className={`tr-scene ${className}`} aria-labelledby={labelledBy} ref={(el) => register(index, el)}>
      {children}
    </section>
  );
}
