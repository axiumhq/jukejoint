import { Link } from 'react-router';
import { Icon } from '../components/Icon';
import { NotFoundArt } from '../components/NotFoundArt';
import { useDocumentTitle } from '../hooks';
import { t } from '../i18n';
import '../styles/info.css';

/**
 * 404 no v8: a rua da cidade da marca com o ônibus parado, o título e um caminho de volta (os lobbies,
 * que são a home). Os outros destinos ficam na linha "Ou vá para"; nada de dois botões para o mesmo lugar.
 * `toModes` serve ao "modo que saiu de cartaz": o primeiro passo vira a lista de modos.
 */
export function NotFound({ title = t.notFound.title, body = t.notFound.body, toModes = false }: { title?: string; body?: string; toModes?: boolean }) {
  useDocumentTitle(t.meta.notFound);
  return (
    <section className="nf" aria-labelledby="nf-title">
      <NotFoundArt />
      <div className="nf-body">
        <span className="nf-code" aria-hidden="true">
          {t.notFound.code}
        </span>
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
