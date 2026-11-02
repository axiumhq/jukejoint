import { Link } from 'react-router';
import { useDocumentTitle } from '../hooks';
import { t } from '../i18n';

export function NotFound({ title = t.notFound.title, body = t.notFound.body }: { title?: string; body?: string }) {
  useDocumentTitle(t.meta.notFound);
  return (
    <div className="container page page-narrow">
      <h1>{title}</h1>
      <p className="page-lead">{body}</p>
      <Link to="/" className="btn btn-primary">
        {t.notFound.back}
      </Link>
    </div>
  );
}
