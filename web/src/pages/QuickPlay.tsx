import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useDocumentTitle } from '../hooks';
import { t } from '../i18n';
import { pickBestLobby } from '../lib/lobbies';
import { busiestMode, liveStats } from '../lib/stats';
import { useSession } from '../state/session';

/**
 * /jogar: o "Jogar agora". Escolhe com `pickBestLobby()` (o mesmo pool da lista, nada de fila
 * paralela), pede para entrar e leva para a lista da home, onde o mesmo lobby é a primeira linha (Recomendado).
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
    navigate({ pathname: '/', search: mode ? `?modo=${encodeURIComponent(mode)}` : '', hash: '#lobbies' }, { replace: true });
    if (best) {
      requestJoin({ kind: 'lobby', lobby: best });
    } else {
      const top = mode ?? busiestMode(liveStats(lobbies)).slug;
      openHost(top);
    }
  }, [lobbies, lobbyCtx, mode, navigate, openHost, requestJoin]);

  return (
    <div className="page">
      <div className="wrap">
        <p className="fine" role="status">
          {t.quickPlay.searching}
        </p>
      </div>
    </div>
  );
}
