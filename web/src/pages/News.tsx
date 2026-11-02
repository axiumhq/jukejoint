import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Icon } from '../components/Icon';
import { getMode, modes } from '../data/modes';
import { PLATFORM_SCOPE, releases, type Change, type ChangeCategory, type Release } from '../data/patches';
import { useDocumentTitle } from '../hooks';
import { formatDate, t } from '../i18n';

const CATS: ChangeCategory[] = ['novo', 'correcao', 'balanceamento'];

const scopeName = (scope: string) => (scope === PLATFORM_SCOPE ? t.news.platform : (getMode(scope)?.name ?? scope));

/** Uma versão: data com ano e número à esquerda; manchete, resumo, categorias e as mudanças (recolhidas). */
function Entry({ release, changes, filtered }: { release: Release; changes: Change[]; filtered: boolean }) {
  const counts = CATS.map((c) => [c, changes.filter((x) => x.category === c).length] as const).filter(([, n]) => n > 0);
  const scopes = [...new Set(release.changes.map((c) => c.scope))];
  return (
    <article className="nw-entry" aria-labelledby={`rel-${release.version}`}>
      <p className="nw-date">
        <time dateTime={release.date}>{formatDate(release.date)}</time>
        <span>
          {t.news.version} <span className="num">{release.version}</span>
        </span>
      </p>
      <div className="nw-body">
        <h2 id={`rel-${release.version}`} className="nw-title">
          {release.headline}
        </h2>
        <p className="nw-tldr">{release.tldr}</p>
        <p className="nw-cats">{counts.map(([c, n]) => t.news.catCount[c](n)).join(', ')}</p>
        <details className="nw-changes" open={filtered || undefined}>
          <summary>
            {t.news.showChanges(changes.length)}
            <Icon name="chevronDown" size={14} />
          </summary>
          <ul>
            {changes.map((c) => (
              <li key={c.text}>
                <span className="nw-cat">{t.categories[c.category]}</span>
                <span>
                  {c.text} <span className="fine">{scopeName(c.scope)}</span>
                </span>
              </li>
            ))}
          </ul>
        </details>
        <p className="fine nw-scopes">
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
    <div className="page news-page">
      <div className="wrap">
        <header className="page-head">
          <div>
            <h1>{t.news.title}</h1>
            <p className="lead">{t.news.lead}</p>
          </div>
        </header>

        <div className="filters" role="group" aria-label={t.news.filters}>
          <label className="f-select">
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
            <Icon name="chevronDown" size={14} />
          </label>
          <div className="f-seg" role="group" aria-label={t.news.categories}>
            {CATS.map((c) => (
              <button key={c} type="button" aria-pressed={cats.includes(c)} onClick={() => toggleCat(c)}>
                {t.categories[c]}
              </button>
            ))}
          </div>
          <p className="f-count" aria-live="polite">
            {t.news.count(shown.length)}
            {filtered && (
              <button
                type="button"
                className="link-quiet"
                onClick={() => {
                  setCats([]);
                  setScope('');
                }}
              >
                {t.news.clear}
              </button>
            )}
          </p>
        </div>

        {shown.length > 0 ? (
          <div className="nw-list">
            {shown.map(({ r, changes }) => (
              <Entry key={r.version} release={r} changes={changes} filtered={filtered} />
            ))}
          </div>
        ) : (
          <div className="empty">
            <h2>{t.news.emptyTitle}</h2>
            <p>{t.news.emptyBody}</p>
          </div>
        )}
      </div>
    </div>
  );
}
