import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Chip, LiveDot, SectionTitle, Tag, type TagTone } from '../components/Common';
import { Icon } from '../components/Icon';
import { PageHead } from '../components/PageHead';
import { APP_RELEASE } from '../config/brand';
import { getMode, modes } from '../data/modes';
import { PLATFORM_SCOPE, releases, type Change, type ChangeCategory, type Release } from '../data/patches';
import { useDocumentTitle, useLiveStats } from '../hooks';
import { formatDate, formatNumber, LOCALE, t } from '../i18n';
import { busiestMode } from '../lib/stats';

/**
 * "Hoje" (/novidades) no v8: uma barra de dados com o agora da plataforma (as mesmas contagens
 * do topo) e as notas de versão numa linha do tempo. Filtro de modo na URL (?modo=), de tipo local.
 * A versão mais nova abre sozinha; as outras ficam recolhidas até alguém filtrar.
 */

const CATS: ChangeCategory[] = ['novo', 'correcao', 'balanceamento'];
const CAT_TONE: Record<ChangeCategory, TagTone> = { novo: 'soft', correcao: 'line', balanceamento: 'plain' };
const DAY = 86_400_000;

const scopeName = (scope: string) => (scope === PLATFORM_SCOPE ? t.news.platform : (getMode(scope)?.name ?? scope));

const dayMonth = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', timeZone: 'UTC' });
/** "28 out" (sem o "de" nem o ponto da abreviação). */
function shortDay(iso: string) {
  const parts = dayMonth.formatToParts(new Date(iso));
  const d = parts.find((p) => p.type === 'day')?.value ?? '';
  const m = (parts.find((p) => p.type === 'month')?.value ?? '').replace('.', '');
  return `${d} ${m}`;
}

function daysSince(iso: string) {
  const start = new Date(`${iso}T00:00:00Z`).getTime();
  const today = new Date();
  return Math.floor((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - start) / DAY);
}

const anchor = (v: string) => `v${v.replace(/\./g, '-')}`;

/** O agora da plataforma: as mesmas contagens do topo e da home. */
function TodayBar() {
  const stats = useLiveStats();
  const top = busiestMode(stats);
  const topCount = stats.byMode[top.slug]?.players ?? 0;
  const latest = releases[0]!;
  return (
    <section className="today" aria-label={t.news.today}>
      <dl className="dbar">
        <div className="dc">
          <dt className="lbl">{t.news.stat.players}</dt>
          <dd>
            <LiveDot small />
            <span className="dc-big num">{formatNumber(stats.players)}</span>
          </dd>
        </div>
        <div className="dc">
          <dt className="lbl">{t.news.stat.lobbies}</dt>
          <dd>
            <span className="dc-big num">{formatNumber(stats.lobbies)}</span>
            <span className="dc-sub">{t.news.withRoom(stats.withRoom)}</span>
          </dd>
        </div>
        <div className="dc">
          <dt className="lbl">{t.news.stat.busiest}</dt>
          <dd>
            <span className="mdot" aria-hidden="true" />
            <Link to={`/modos/${top.slug}`} className="dc-link">
              {top.name}
            </Link>
            <span className="dc-sub">{t.news.playing(topCount)}</span>
          </dd>
        </div>
        <div className="dc">
          <dt className="lbl">{t.news.stat.latest}</dt>
          <dd>
            <a href={`#${anchor(latest.version)}`} className="dc-link num">
              {latest.version}
            </a>
            <span className="dc-sub">{t.news.ago(daysSince(latest.date))}</span>
          </dd>
        </div>
      </dl>
    </section>
  );
}

/** Uma versão na linha do tempo: data e número à esquerda; manchete, resumo, etiquetas e as mudanças. */
function Entry({ release, changes, open }: { release: Release; changes: Change[]; open: boolean }) {
  const counts = CATS.map((c) => [c, changes.filter((x) => x.category === c).length] as const).filter(([, n]) => n > 0);
  const scopes = [...new Set(release.changes.map((c) => c.scope))];
  const current = release.version === APP_RELEASE.version;
  const id = anchor(release.version);
  return (
    <li className={current ? 'tl is-current' : 'tl'}>
      <article aria-labelledby={`${id}-t`} id={id}>
        <p className="tl-when">
          <time dateTime={release.date} className="tl-day display">
            {shortDay(release.date)}
          </time>
          <span className="tl-meta num">
            {release.date.slice(0, 4)} · v{release.version}
          </span>
        </p>
        <span className="tl-node" aria-hidden="true" />
        <div className="tl-body">
          <h3 id={`${id}-t`} className="tl-title display">
            {release.headline}
            <span className="sr-only">
              {', '}
              {t.news.version} {release.version}, {formatDate(release.date)}
            </span>
          </h3>
          {current && (
            <p className="tl-cur">
              <Tag tone="acc">{t.news.current}</Tag>
            </p>
          )}
          <p className="tl-tldr">{release.tldr}</p>
          <div className="tl-tags">
            {counts.map(([c, n]) => (
              <Tag key={c} tone={CAT_TONE[c]}>
                {t.news.catCount[c](n)}
              </Tag>
            ))}
          </div>
          <details className="tl-changes" open={open || undefined}>
            <summary>
              {t.news.showChanges(changes.length)}
              <Icon name="chevronDown" size={14} />
            </summary>
            <ul>
              {changes.map((c) => (
                <li key={c.text}>
                  <span className="tl-cat">
                    <Tag tone={CAT_TONE[c.category]}>{t.categories[c.category]}</Tag>
                  </span>
                  <span>
                    {c.text} <span className="tl-scope">{scopeName(c.scope)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </details>
          <p className="tl-aff">
            <span className="lbl">{t.news.affects}</span>
            {scopes.map((sc) =>
              sc === PLATFORM_SCOPE ? (
                <span key={sc} className="tl-sc">
                  {scopeName(sc)}
                </span>
              ) : (
                <Link key={sc} to={`/modos/${sc}`} className="tl-sc">
                  <span className="mdot" aria-hidden="true" />
                  {scopeName(sc)}
                </Link>
              ),
            )}
          </p>
        </div>
      </article>
    </li>
  );
}

export function News() {
  useDocumentTitle(t.meta.news);
  const [params, setParams] = useSearchParams();
  const [cats, setCats] = useState<ChangeCategory[]>([]);
  const scope = params.get('modo') ?? '';

  const setScope = (value: string) => {
    const p = new URLSearchParams(params);
    if (value) p.set('modo', value);
    else p.delete('modo');
    setParams(p, { replace: true });
  };

  const filtered = scope !== '' || cats.length > 0;
  const shown = releases
    .map((r) => ({
      r,
      changes: [...r.changes]
        .sort((a, b) => CATS.indexOf(a.category) - CATS.indexOf(b.category))
        .filter((c) => (!scope || c.scope === scope) && (cats.length === 0 || cats.includes(c.category))),
    }))
    .filter(({ changes }) => changes.length > 0);
  const toggleCat = (c: ChangeCategory) => setCats((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));

  return (
    <>
      <PageHead words={t.news.titleWords} lead={t.news.lead} />
      <TodayBar />

      <section className="sec" aria-labelledby="notes-title">
        <SectionTitle id="notes-title" words={t.news.notesWords} meta={t.news.count(shown.length)} />
        <div className="nw-ctl" role="group" aria-label={t.news.filters}>
          <label className="sel">
            <span className="sr-only">{t.news.mode}</span>
            <select value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="">{t.news.allModes}</option>
              <option value={PLATFORM_SCOPE}>{t.news.platform}</option>
              {modes.map((m) => (
                <option key={m.slug} value={m.slug}>
                  {m.name}
                </option>
              ))}
            </select>
            <Icon name="chev" />
          </label>
          <div className="nw-cats" role="group" aria-label={t.news.categories}>
            {CATS.map((c) => (
              <Chip key={c} pressed={cats.includes(c)} onClick={() => toggleCat(c)}>
                {t.categories[c]}
              </Chip>
            ))}
          </div>
          <span className="sp" />
          <p className="nw-count" aria-live="polite">
            <span className="sr-only">{t.news.count(shown.length)}</span>
            {filtered && (
              <button
                type="button"
                className="link"
                onClick={() => {
                  setCats([]);
                  setScope('');
                }}
              >
                <Icon name="x" />
                {t.news.clear}
              </button>
            )}
          </p>
        </div>

        {shown.length > 0 ? (
          <ol className="tline">
            {shown.map(({ r, changes }, i) => (
              <Entry key={r.version} release={r} changes={changes} open={filtered || i === 0} />
            ))}
          </ol>
        ) : (
          <div className="nw-empty">
            <h3>{t.news.emptyTitle}</h3>
            <p>{t.news.emptyBody}</p>
            <button
              type="button"
              className="btn btn-s"
              onClick={() => {
                setCats([]);
                setScope('');
              }}
            >
              {t.news.clear}
            </button>
          </div>
        )}
      </section>
    </>
  );
}
