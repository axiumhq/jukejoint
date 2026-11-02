import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { modes } from '../data/modes';
import { useDocumentTitle } from '../hooks';
import { t } from '../i18n';
import { pickBestLobby } from '../lib/lobbies';
import { useSession } from '../state/session';

/**
 * /jogar: o "Jogar agora". Escolhe com `pickBestLobby()` (o mesmo pool da lista, nada de fila
 * paralela), pede para entrar e leva para /lobbies, onde "Em cartaz agora" mostra o mesmo lobby.
 * Sem candidato, abre o criar lobby no modo mais jogado. `?modo=` restringe a um modo.
 * A home pode linkar direto para cá (`<Link to="/jogar">`).
 */
export function QuickPlay() {
  useDocumentTitle(t.quickPlay.title);
  const { lobbies, lobbyCtx, requestJoin, openHost } = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const done = useRef(false);
  const mode = params.get('modo') ?? undefined;

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const best = pickBestLobby(lobbies, { mode, ctx: lobbyCtx });
    navigate(mode ? `/lobbies?modo=${encodeURIComponent(mode)}` : '/lobbies', { replace: true });
    if (best) {
      requestJoin({ kind: 'lobby', lobby: best });
    } else {
      const top = mode ?? [...modes].sort((a, b) => b.playersNow - a.playersNow)[0]?.slug;
      openHost(top);
    }
  }, [lobbies, lobbyCtx, mode, navigate, openHost, requestJoin]);

  return (
    <div className="container page">
      <p className="tech-line" role="status">
        {t.quickPlay.searching}
      </p>
    </div>
  );
}
