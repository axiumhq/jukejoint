import { daySessions, type DaySession } from '../data/sessions';
import { getMode } from '../data/modes';
import { useNow } from '../hooks/useNow';
import { t } from '../i18n';
import { useSession } from '../state/session';
import { Icon } from './Icon';
import { ModeSeal, modeHue } from './ModeSeal';

const DAY = 24 * 60;

/** Minutos desde a meia-noite em Brasília (o horário das sessões). */
export function brasiliaMinutes(now: number) {
  const parts = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(now));
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
}

/** Minutos até a próxima ocorrência; sessões que abriram há menos de 30 min contam como "abrindo agora" (negativo). */
export function untilSession(s: DaySession, nowMin: number) {
  const [h, m] = s.time.split(':').map(Number) as [number, number];
  const at = h * 60 + m;
  let diff = (at - nowMin + DAY) % DAY;
  if (diff > DAY - 30) diff -= DAY;
  return diff;
}

const sessionKey = (s: DaySession) => `sessao:${s.id}`;

/**
 * Sessões do dia: horários fixos em que a casa abre lobby. É a estratégia de população baixa:
 * transforma "tem gente?" em "quando?". Cada linha é um horário de partida, como num quadro de bonde.
 */
export function DaySessions({ mode, headingLevel = 2, limit }: { mode?: string; headingLevel?: 2 | 3; limit?: number }) {
  const { notify, toggleNotify } = useSession();
  const now = useNow(30_000);
  const nowMin = brasiliaMinutes(now);
  const list = daySessions
    .filter((s) => !mode || s.modeSlug === mode)
    .map((s) => ({ s, until: untilSession(s, nowMin) }))
    .sort((a, b) => a.until - b.until)
    .slice(0, limit);
  if (list.length === 0) return null;
  const H = headingLevel === 3 ? 'h3' : 'h2';
  const id = `sessions-title${mode ? `-${mode}` : ''}`;

  return (
    <section className="sessions" aria-labelledby={id}>
      <H id={id} className="sessions-title">
        {t.sessions.title}
      </H>
      <p className="sessions-lead">{t.sessions.lead}</p>
      <ol className="sessions-board">
        {list.map(({ s, until }) => {
          const m = getMode(s.modeSlug);
          const on = notify.has(sessionKey(s));
          const going = s.going + (on ? 1 : 0);
          const when = until <= 0 ? t.sessions.now : t.sessions.in(Math.floor(until / 60), until % 60);
          return (
            <li key={s.id} className={`session has-mode${until <= 0 ? ' is-now' : ''}`} style={modeHue(m)}>
              <p className="session-time">
                <time className="num">{s.time}</time>
                <span className="session-when">{when}</span>
              </p>
              <ModeSeal mode={s.modeSlug} size="sm" link />
              <div className="session-copy">
                <p className="session-mode">{m?.name}</p>
                <p className="session-going">
                  {t.sessions.going(going)}, {t.regions[s.region]}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-quiet btn-sm session-btn"
                aria-pressed={on}
                aria-label={t.sessions.markLabel(m?.name ?? '', s.time)}
                onClick={() => toggleNotify(sessionKey(s), t.sessions.markedToast(m?.name ?? '', s.time))}
              >
                <Icon name={on ? 'check' : 'bell'} size={16} />
                {on ? t.sessions.marked : t.sessions.mark}
              </button>
            </li>
          );
        })}
      </ol>
      <p className="sessions-tz">{t.sessions.timeZone}</p>
    </section>
  );
}

/** "Avise-me quando houver 3": pedido de quórum por modo, para quando não há lobby. */
export function QuorumAsk({ mode, className = 'btn btn-ghost' }: { mode: string; className?: string }) {
  const { notify, toggleNotify } = useSession();
  const m = getMode(mode);
  const key = `quorum:${mode}`;
  const on = notify.has(key);
  return (
    <button type="button" className={className} aria-pressed={on} onClick={() => toggleNotify(key, t.sessions.quorumToast(m?.name ?? ''))}>
      <Icon name={on ? 'check' : 'bell'} size={18} />
      {on ? t.sessions.quorumOn : t.sessions.quorumAsk}
    </button>
  );
}
