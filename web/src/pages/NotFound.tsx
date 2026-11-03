import { Link } from 'react-router';
import { Icon } from '../components/Icon';
import { ModeCover } from '../components/ModeCover';
import { useDocumentTitle } from '../hooks';
import { t } from '../i18n';

/**
 * 404 no v8: a capa da bússola na neblina, o título e o caminho de volta para os lobbies.
 * `toModes` serve ao "modo que saiu de cartaz": o primeiro passo vira a lista de modos.
 */
export function NotFound({ title = t.notFound.title, body = t.notFound.body, toModes = false }: { title?: string; body?: string; toModes?: boolean }) {
  useDocumentTitle(t.meta.notFound);
  return (
    <section className="nf" aria-labelledby="nf-title">
      <ModeCover slug="neblina" wide />
      <div className="nf-shade" aria-hidden="true" />
      <span className="nf-code lbl" aria-hidden="true">
        {t.notFound.code}
      </span>
      <div className="nf-body">
        <h1 className="display" id="nf-title">
          {title}
        </h1>
        <p className="nf-lead">{body}</p>
        <div className="nf-act">
          {toModes ? (
            <Link to="/modos" className="btn btn-p btn-lg">
              {t.modes.seeAll}
              <Icon name="arrow" />
            </Link>
          ) : (
            <Link to="/#lobbies" className="btn btn-p btn-lg">
              {t.notFound.lobbies}
              <Icon name="arrow" />
            </Link>
          )}
          <Link to="/" className="btn btn-s btn-lg">
            {t.notFound.back}
          </Link>
        </div>
        <nav className="nf-else" aria-label={t.notFound.elsewhere}>
          <span>{t.notFound.elsewhere}</span>
          {!toModes && <Link to="/modos">{t.header.nav.modes}</Link>}
          {toModes && <Link to="/#lobbies">{t.notFound.lobbies}</Link>}
          <Link to="/novidades">{t.header.nav.today}</Link>
          <Link to="/instalar">{t.header.nav.install}</Link>
        </nav>
      </div>
    </section>
  );
}
