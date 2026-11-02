import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import type { Lobby } from '../../data/lobbies';
import { getMode, modes } from '../../data/modes';
import { t } from '../../i18n';
import { towerBus } from '../../lib/towerBus';
import { canEnter, heatOf, nearestToFull, type TowerFloor } from '../../lib/towerData';
import { useSession } from '../../state/session';
import { Icon } from '../Icon';
import { ModeArt } from '../ModeArt';

/**
 * Cena 2: a lista equivalente da torre, em HTML. A lista é a verdade; a torre ilustra.
 * Passar o mouse ou o foco do teclado numa linha acende o andar dela na cena 3D.
 */

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
/** Nomes do "ao vivo" simulado: o protótipo não tem quem de verdade entrou. */
const JOINERS = ['Ametista', 'Lanterneiro', 'capivara.exe', 'Agulha', 'zé do bonde', 'Ivone', 'Calder', 'Moth', 'Odete', 'Sombra Fina', 'Wren', 'Corvina'];
const JOIN_FRESH_MS = 25000;

interface Joined {
  name: string;
  at: number;
}

/** Quem entrou agora: detecta aumento de jogadores entre atualizações do estado ao vivo. */
function useJoinLog(lobbies: Lobby[]) {
  const prev = useRef(new Map<string, number>());
  const [log, setLog] = useState(() => new Map<string, Joined>());
  useEffect(() => {
    const next = new Map(log);
    let changed = false;
    for (const l of lobbies) {
      const before = prev.current.get(l.id);
      if (before !== undefined && l.players > before) {
        const pool = JOINERS.filter((n) => n !== l.host);
        next.set(l.id, { name: pool[Math.floor(Math.random() * pool.length)]!, at: Date.now() });
        changed = true;
      }
      prev.current.set(l.id, l.players);
    }
    if (changed) setLog(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobbies]);
  // Recalcula de tempos em tempos para o "entrou agora" expirar.
  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 5000);
    return () => window.clearInterval(id);
  }, []);
  return log;
}

function Seal({ slug }: { slug: string }) {
  const mode = getMode(slug);
  if (!mode) return null;
  const n = modes.findIndex((m) => m.slug === slug);
  return (
    <span className="tr-seal" style={{ '--h': mode.hue } as CSSProperties} aria-hidden="true">
      <ModeArt mode={mode} />
      <span className="tr-seal-num">{ROMAN[n] ?? n + 1}</span>
    </span>
  );
}

function RowAction({ lobby }: { lobby: Lobby }) {
  const { requestJoin } = useSession();
  if (lobby.mine) return <span className="tr-state is-mine">{t.home.floors.mine}</span>;
  if (lobby.locked)
    return (
      <span className="tr-state">
        <Icon name="lock" size={15} />
        {t.home.floors.locked}
      </span>
    );
  if (canEnter(lobby))
    return (
      <button type="button" className="tr-enter" aria-label={t.home.floors.enterLabel(lobby.name)} onClick={() => requestJoin({ kind: 'lobby', lobby })}>
        {t.home.floors.enter}
      </button>
    );
  return <span className="tr-state">{lobby.status === 'em-partida' ? t.home.floors.playing : t.home.floors.full}</span>;
}

export function FloorList({ floors, total }: { floors: TowerFloor[]; total: number }) {
  const { lobbies } = useSession();
  const log = useJoinLog(lobbies);
  const now = Date.now();
  const rows = [...floors].sort(
    (a, b) => Number(!!b.lobby.mine) - Number(!!a.lobby.mine) || b.lobby.players + b.lobby.friends * 2 - (a.lobby.players + a.lobby.friends * 2) || a.number - b.number,
  );
  const featured = nearestToFull(floors.map((f) => f.lobby));
  const featuredFloor = featured ? floors.find((f) => f.lobby.id === featured.id) : undefined;
  const focus = (id: string | null) => towerBus.set({ focusId: id });

  return (
    <div className="tr-floorlist">
      {featured && featuredFloor && (
        <div
          className="tr-featured"
          onPointerEnter={() => focus(featured.id)}
          onPointerLeave={() => focus(null)}
          onFocusCapture={() => focus(featured.id)}
          onBlurCapture={() => focus(null)}
        >
          <div className="tr-featured-body">
            <Seal slug={featured.modeSlug} />
            <div>
              <h3 className="tr-featured-name">{featured.name}</h3>
              <p className="tr-featured-why">
                {t.home.floors.featured}, <span className="num">{t.home.floors.floor(featuredFloor.number).toLowerCase()}</span>.{' '}
                {t.home.floors.featuredWhy(featured.slots - featured.players)}.
              </p>
            </div>
            <RowAction lobby={featured} />
          </div>
        </div>
      )}
      <ul className="tr-rows" aria-label={t.home.floors.listLabel}>
        {rows.map((f) => {
          const l = f.lobby;
          const heat = heatOf(l);
          const joined = log.get(l.id);
          const fresh = joined && now - joined.at < JOIN_FRESH_MS;
          return (
            <li
              key={l.id}
              className={`tr-row heat-${heat}${l.mine ? ' is-mine' : ''}`}
              style={{ '--h': f.hue } as CSSProperties}
              onPointerEnter={() => focus(l.id)}
              onPointerLeave={() => focus(null)}
              onFocusCapture={() => focus(l.id)}
              onBlurCapture={() => focus(null)}
            >
              <Seal slug={l.modeSlug} />
              <div className="tr-row-main">
                <h3 className="tr-row-name">
                  {l.name}
                  {l.friends > 0 && <span className="tr-friends">{t.home.floors.friends(l.friends)}</span>}
                </h3>
                <p className="tr-row-sub">
                  <span className="num">{t.home.floors.floor(f.number)}</span>
                  <span>{f.modeName}</span>
                  <span>
                    {t.regions[l.region]} <span className="num">{l.ping} ms</span>
                  </span>
                </p>
              </div>
              <p className="tr-row-live">
                <span className="tr-heat">{t.home.floors.heat[heat]}</span>
                <span className={fresh ? 'tr-joined' : 'tr-ago'}>
                  {fresh && joined ? t.home.floors.joined(joined.name) : t.home.floors.openedAgo(l.minutesAgo)}
                </span>
              </p>
              <p className="tr-row-slots" aria-label={t.home.floors.slotsLabel(l.players, l.slots)}>
                <span className="num" aria-hidden="true">
                  {t.home.floors.slots(l.players, l.slots)}
                </span>
                <span className="tr-pips" aria-hidden="true">
                  {f.windows.map((k, i) => (
                    <i key={i} className={`pip-${k}`} />
                  ))}
                </span>
              </p>
              <div className="tr-row-act">
                <RowAction lobby={l} />
              </div>
            </li>
          );
        })}
      </ul>
      <Link to="/lobbies" className="tr-more">
        {t.home.floors.seeAll(total)}
      </Link>
    </div>
  );
}
