import { Link } from 'react-router';
import { QuietSkyline } from '../components/Deco';
import { useDocumentTitle } from '../hooks';
import { t } from '../i18n';

export function NotFound({ title = t.notFound.title, body = t.notFound.body }: { title?: string; body?: string }) {
  useDocumentTitle(t.meta.notFound);
  return (
    <div className="container page page-narrow not-found">
      <QuietSkyline className="not-found-art" lit={false} />
      <h1>{title}</h1>
      <p className="page-lead">{body}</p>
      <div className="hero-actions">
        <Link to="/" className="btn btn-primary">
          {t.notFound.back}
        </Link>
        <Link to="/lobbies" className="btn btn-ghost">
          {t.notFound.lobbies}
        </Link>
      </div>
    </div>
  );
}
