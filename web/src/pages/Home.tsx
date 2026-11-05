import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Arrivals } from '../components/Arrivals';
import { HeroScene } from '../components/HeroArt';
import { Icon } from '../components/Icon';
import { LobbyBrowser } from '../components/LobbyBrowser';
import { ModesLive } from '../components/ModesLive';
import { MobilePlayBar, RecommendedCard } from '../components/Recommended';
import { useDocumentTitle, usePref } from '../hooks';
import { useFeaturedLobby } from '../hooks/useFeatured';
import { useNow } from '../hooks/useNow';
import { t } from '../i18n';
import { mesa as M } from '../i18n/mesa';
import { useSession } from '../state/session';

/**
 * Home v4: aviso dispensável, a cena do topo (letreiro e slogan sobre a arte), a placa da mesa com o
 * melhor lobby (Recommended.tsx), a lista de lobbies, modos ao vivo e chegando agora.
 * No celular a cena vira uma imagem com o letreiro e o slogan embaixo, a placa ocupa a largura toda
 * e a barra fixa de baixo só traz o recomendado depois que a placa sai da tela.
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

/** A cena do topo: a arte ancorada à direita, o brilho safira e, à esquerda, o letreiro e o slogan. */
function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <HeroScene />
      <div className="hero-in">
        <p className="marq">{M.marquee}</p>
        <h1 className="display hero-t" id="hero-title">
          {t.home.heroTitle}
        </h1>
      </div>
    </section>
  );
}

/** Se o elemento está na tela (abaixo da barra de cima). Sem IntersectionObserver, diz que não. */
function useOnScreen(el: HTMLElement | null) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setOn(false);
      return;
    }
    const io = new IntersectionObserver(([entry]) => setOn(!!entry?.isIntersecting), { rootMargin: '-60px 0px 0px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [el]);
  return on;
}

export function Home() {
  useDocumentTitle(t.meta.home);
  const { lobbies, openHost } = useSession();
  const now = useNow(5000);
  const featured = useFeaturedLobby(lobbies, undefined, now);
  const [placa, setPlaca] = useState<HTMLElement | null>(null);
  const placaOnScreen = useOnScreen(placa);

  return (
    <div className="home">
      <Notice />
      <Hero />
      <RecommendedCard lobby={featured} now={now} onCreate={() => openHost()} placaRef={setPlaca} />
      <LobbyBrowser featured={featured} now={now} />
      <ModesLive />
      <Arrivals now={now} />
      <MobilePlayBar lobby={featured} placaOnScreen={placaOnScreen} />
    </div>
  );
}
