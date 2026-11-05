import { Link } from 'react-router';
import { Arrivals } from '../components/Arrivals';
import { Icon } from '../components/Icon';
import { LobbyBrowser } from '../components/LobbyBrowser';
import { ModesLive } from '../components/ModesLive';
import { MobilePlayBar, RecommendedCard } from '../components/Recommended';
import { useDocumentTitle, usePref } from '../hooks';
import { useFeaturedLobby } from '../hooks/useFeatured';
import { useNow } from '../hooks/useNow';
import { t } from '../i18n';
import { useSession } from '../state/session';

/**
 * Home do redesign (Main, Home-1366 e Celular-390 do Claude Design): aviso dispensável, o destaque
 * com o recomendado, a lista de lobbies ("Jogar agora"), modos ao vivo e chegando agora.
 * Em 1366×768 os lobbies aparecem na primeira tela. No celular o slogan abre a página, os modos
 * viram uma fileira acima dos filtros e o recomendado mora na barra fixa de baixo.
 * A sua lista (o social) mora na barra lateral da casca; abaixo de 960 px, na aba "Sua lista".
 */

function Notice() {
  const [dismissed, setDismissed] = usePref('noticeX', false);
  if (dismissed) return null;
  return (
    <div className="notice" role="note">
      <span>
        {t.notice.title} {t.notice.body}
      </span>
      <Link to="/novidades" className="link">
        {t.notice.link}
      </Link>
      <span className="sp" />
      <button type="button" className="icon-btn" aria-label={t.notice.dismiss} onClick={() => setDismissed(true)}>
        <Icon name="x" />
      </button>
    </div>
  );
}

export function Home() {
  useDocumentTitle(t.meta.home);
  const { lobbies, openHost } = useSession();
  const now = useNow(5000);
  const featured = useFeaturedLobby(lobbies, undefined, now);

  return (
    <div className="home">
      <Notice />
      <RecommendedCard lobby={featured} now={now} onCreate={() => openHost()} />
      <LobbyBrowser featured={featured} now={now} />
      <ModesLive />
      <Arrivals now={now} />
      <MobilePlayBar lobby={featured} />
    </div>
  );
}
