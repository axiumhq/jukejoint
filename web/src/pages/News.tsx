import { useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Icon } from '../components/Icon';
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

function ReleaseCard({ release, changes, q, filtered }: { release: Release; changes: Change[]; q: string; filtered: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const showAll = expanded || filtered || changes.length <= VISIBLE + 1;
  const visible = showAll ? changes : changes.slice(0, VISIBLE);
  const counts = CATS.map((c) => [c, changes.filter((x) => x.category === c).length] as const).filter(([, n]) => n > 0);
  const scopes = [...new Set(release.changes.map((c) => c.scope))];
  const listId = `changes-${release.version}`;

  return (
    <article className="release" aria-labelledby={`rel-${release.version}`}>
      <header className="release-head">
        <h2 id={`rel-${release.version}`} className="release-version">
          {release.version}
        </h2>
        <time dateTime={release.date} className="release-date">
          {formatDate(release.date)}
        </time>
        <ul className="release-counts" aria-label={t.news.categories}>
          {counts.map(([c, n]) => (
            <li key={c} className={`cat cat-${c}`}>
              {t.categories[c]} <span className="cat-n">{n}</span>
            </li>
          ))}
        </ul>
      </header>
      <p className="release-tldr">
        <strong>{t.news.tldr}</strong> {highlight(release.tldr, q)}
      </p>
      <p className="release-scopes">
        {t.news.affects}:{' '}
        {scopes.map((s, i) => (
          <span key={s}>
            {s === PLATFORM_SCOPE ? scopeName(s) : <Link to={`/modos/${s}`}>{scopeName(s)}</Link>}
            {i < scopes.length - 1 ? ', ' : ''}
          </span>
        ))}
      </p>
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
      {!filtered && changes.length > VISIBLE + 1 && (
        <button type="button" className="link-btn" aria-expanded={expanded} aria-controls={listId} onClick={() => setExpanded((v) => !v)}>
          {expanded ? t.news.showLess : t.news.showMore(changes.length - VISIBLE)}
        </button>
      )}
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
      const tldrHit = nq !== '' && norm(r.tldr).includes(nq);
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

  return (
    <div className="container page">
      <header className="page-head">
        <h1>{t.news.title}</h1>
        <p className="page-lead">{t.news.lead}</p>
      </header>

      <div className="news-toolbar">
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

      {shown.length > 0 ? (
        <div className="releases">
          {shown.map(({ r, changes }) => (
            <ReleaseCard key={r.version} release={r} changes={changes} q={q.trim()} filtered={filtered} />
          ))}
        </div>
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
