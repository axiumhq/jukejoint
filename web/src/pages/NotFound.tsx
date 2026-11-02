import { Link } from 'react-router';
import { useDocumentTitle } from '../hooks';
import { t } from '../i18n';

export function NotFound({ title = t.notFound.title, body = t.notFound.body }: { title?: string; body?: string }) {
  useDocumentTitle(t.meta.notFound);
  return (
    <div className="page not-found">
      <div className="wrap">
        <h1>{title}</h1>
        <p className="lead">{body}</p>
        <div className="actions">
          <Link to="/" className="btn btn-primary">
            {t.notFound.back}
          </Link>
          <Link to="/lobbies" className="link-line">
            {t.notFound.lobbies}
          </Link>
        </div>
      </div>
    </div>
  );
}
