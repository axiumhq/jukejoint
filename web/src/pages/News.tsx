import { useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Icon } from '../components/Icon';
import { ModeArt } from '../components/ModeArt';
import { getMode, modes } from '../data/modes';
import { PLATFORM_SCOPE, releases, type Change, type ChangeCategory, type Release } from '../data/patches';
import { useDocumentTitle } from '../hooks';
import { formatDate, t } from '../i18n';

const CATS: ChangeCategory[] = ['novo', 'correcao', 'balanceamento'];
const VISIBLE = 4;

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('pt-BR');

function highlight(text: string, q: string): ReactNode {
  if (!q) return text;
  // Normaliza caractere a caractere para manter os índices alinhados ao texto original.
  const hay = text
    .split('')
    .map((ch) => norm(ch).charAt(0) || ch)
    .join('');
  const needle = norm(q);
  if (!needle) return text;
  const parts: ReactNode[] = [];
  let i = 0;
  let k = 0;
  for (;;) {
    const at = hay.indexOf(needle, i);
    if (at < 0) break;
    parts.push(text.slice(i, at), <mark key={k++}>{text.slice(at, at + needle.length)}</mark>);
    i = at + needle.length;
  }
  parts.push(text.slice(i));
  return parts;
}

const scopeName = (scope: string) => (scope === PLATFORM_SCOPE ? t.news.platform : (getMode(scope)?.name ?? scope));

/** Modo mais citado numa versão (para a gravura da manchete). */
function mainMode(release: Release) {
  const counts = new Map<string, number>();
  for (const c of release.changes) if (c.scope !== PLATFORM_SCOPE) counts.set(c.scope, (counts.get(c.scope) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return top ? getMode(top[0]) : undefined;
}

interface StoryProps {
  release: Release;
  changes: Change[];
  q: string;
  filtered: boolean;
  lead: boolean;
}

function Story({ release, changes, q, filtered, lead }: StoryProps) {
  const [expanded, setExpanded] = useState(false);
  const limit = lead ? VISIBLE + 4 : VISIBLE;
  const showAll = expanded || filtered || changes.length <= limit + 1;
  const visible = showAll ? changes : changes.slice(0, limit);
  const counts = CATS.map((c) => [c, changes.filter((x) => x.category === c).length] as const).filter(([, n]) => n > 0);
  const scopes = [...new Set(release.changes.map((c) => c.scope))];
  const listId = `changes-${release.version}`;
  const figureMode = lead ? mainMode(release) : undefined;
  const H = lead ? 'h2' : 'h3';

  return (
    <article className={`story${lead ? ' is-lead' : ''}`} aria-labelledby={`rel-${release.version}`}>
      <header className="story-head">
        <p className="story-dateline">
          <span className="story-version num">{t.news.editionVersion(release.version)}</span>
          <time dateTime={release.date}>{formatDate(release.date)}</time>
        </p>
        <H id={`rel-${release.version}`} className="story-headline">
          {release.headline}
        </H>
        <ul className="release-counts" aria-label={t.news.categories}>
          {counts.map(([c, n]) => (
            <li key={c} className={`cat cat-${c}`}>
              {t.categories[c]} <span className="cat-n">{n}</span>
            </li>
          ))}
        </ul>
      </header>
      <p className="story-tldr">
        <strong>{t.news.tldr}</strong> {highlight(release.tldr, q)}
      </p>
      {figureMode && (
        <figure className="story-figure">
          <div className="halftone">
            <ModeArt mode={figureMode} />
          </div>
          <figcaption>{t.news.figure(figureMode.name)}</figcaption>
        </figure>
      )}
      <div className="story-body">
        <ul className="changes" id={listId}>
          {visible.map((c) => (
            <li key={c.text} className="change">
              <span className={`cat cat-${c.category}`}>{t.categories[c.category]}</span>
              <span className="change-text">
                {highlight(c.text, q)}
                <span className="change-scope">{scopeName(c.scope)}</span>
              </span>
            </li>
          ))}
        </ul>
        {!filtered && changes.length > limit + 1 && (
          <button type="button" className="link-btn" aria-expanded={expanded} aria-controls={listId} onClick={() => setExpanded((v) => !v)}>
            {expanded ? t.news.showLess : t.news.showMore(changes.length - limit)}
          </button>
        )}
        <p className="release-scopes">
          {t.news.affects}:{' '}
          {scopes.map((sc, i) => (
            <span key={sc}>
              {sc === PLATFORM_SCOPE ? scopeName(sc) : <Link to={`/modos/${sc}`}>{scopeName(sc)}</Link>}
              {i < scopes.length - 1 ? ', ' : ''}
            </span>
          ))}
        </p>
      </div>
    </article>
  );
}

export function News() {
  useDocumentTitle(t.meta.news);
  const [params, setParams] = useSearchParams();
  const [cats, setCats] = useState<ChangeCategory[]>([]);
  const q = params.get('q') ?? '';
  const scope = params.get('modo') ?? '';

  const set = (key: string, value: string) => {
    const p = new URLSearchParams(params);
    if (value) p.set(key, value);
    else p.delete(key);
    setParams(p, { replace: true });
  };

  const nq = norm(q.trim());
  const filtered = nq !== '' || scope !== '' || cats.length > 0;
  const shown = releases
    .map((r) => {
      const tldrHit = nq !== '' && (norm(r.tldr).includes(nq) || norm(r.headline).includes(nq));
      const changes = [...r.changes]
        .sort((a, b) => CATS.indexOf(a.category) - CATS.indexOf(b.category))
        .filter(
          (c) =>
            (!scope || c.scope === scope) &&
            (cats.length === 0 || cats.includes(c.category)) &&
            (nq === '' || tldrHit || norm(c.text).includes(nq)),
        );
      return { r, changes };
    })
    .filter(({ changes }) => changes.length > 0);

  const toggleCat = (c: ChangeCategory) => setCats((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));
  const latest = releases[0]!;
  const [front, ...rest] = shown;

  return (
    <div className="container page gazette">
      <header className="masthead">
        <ul className="masthead-strip">
          <li>{t.news.edition(formatDate(latest.date))}</li>
          <li className="num">{t.news.editionVersion(latest.version)}</li>
          <li>{t.news.editionPrice}</li>
        </ul>
        <h1 className="masthead-title">
          <span className="sr-only">{t.news.title}: </span>
          {t.news.masthead}
        </h1>
        <p className="masthead-note">{t.news.mastheadNote}</p>
        <p className="masthead-lead">{t.news.lead}</p>
      </header>

      <div className="news-toolbar" role="search" aria-label={t.news.index}>
        <div className="search">
          <label htmlFor="news-search" className="sr-only">
            {t.news.search}
          </label>
          <Icon name="search" size={18} />
          <input id="news-search" type="search" placeholder={t.news.searchPlaceholder} value={q} onChange={(e) => set('q', e.target.value)} />
        </div>
        <div className="field field-inline">
          <label htmlFor="news-mode">{t.news.mode}</label>
          <select id="news-mode" value={scope} onChange={(e) => set('modo', e.target.value)}>
            <option value="">{t.news.allModes}</option>
            <option value={PLATFORM_SCOPE}>{t.news.platform}</option>
            {modes.map((m) => (
              <option key={m.slug} value={m.slug}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div className="cat-filter" role="group" aria-label={t.news.categories}>
          {CATS.map((c) => (
            <button key={c} type="button" className={`chip chip-${c}`} aria-pressed={cats.includes(c)} onClick={() => toggleCat(c)}>
              {t.categories[c]}
            </button>
          ))}
        </div>
      </div>

      <p className="results-count" aria-live="polite">
        {t.news.count(shown.length)}
      </p>

      {front ? (
        <>
          <Story release={front.r} changes={front.changes} q={q.trim()} filtered={filtered} lead />
          {rest.length > 0 && (
            <section className="older" aria-labelledby="older-title">
              <h2 id="older-title" className="older-title">
                {t.news.older}
              </h2>
              <div className="older-grid">
                {rest.map(({ r, changes }) => (
                  <Story key={r.version} release={r} changes={changes} q={q.trim()} filtered={filtered} lead={false} />
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <div className="empty">
          <h2>{t.news.emptyTitle}</h2>
          <p>{t.news.emptyBody}</p>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setCats([]);
              setParams(new URLSearchParams(), { replace: true });
            }}
          >
            {t.news.clear}
          </button>
        </div>
      )}
    </div>
  );
}
