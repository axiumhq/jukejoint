import { useCallback, useState } from 'react';
import { Link } from 'react-router';
import { HeroMedia } from '../components/HeroMedia';
import { Icon } from '../components/Icon';
import { LobbyBrowser } from '../components/LobbyBrowser';
import { useDocumentTitle } from '../hooks';
import { t } from '../i18n';

/**
 * Home v6.1: a home é o navegador de lobbies. Em cima, uma faixa de cinema baixa com a
 * arte-chave (o único efeito do site); logo abaixo, a lista ao vivo, sem rolar.
 */

function Band() {
  const [ready, setReady] = useState(false);
  // Um quadro no preto antes de revelar; o timeout cobre abas em que o rAF está parado.
  const onReady = useCallback(() => {
    requestAnimationFrame(() => setReady(true));
    window.setTimeout(() => setReady(true), 120);
  }, []);

  return (
    <section className={`hero${ready ? ' is-ready' : ''}`} aria-labelledby="hero-title">
      <div className="hero-plate">
        <HeroMedia onReady={onReady} />
        <div className="hero-scrim" aria-hidden="true" />
      </div>
      <div className="hero-shot">
        <div className="wrap">
          <div className="hero-copy">
            <h1 id="hero-title" className="display">
              {t.home.titleLines.map((line) => (
                <span key={line} className="hero-line">
                  {line}{' '}
                </span>
              ))}
            </h1>
            <p className="hero-lead">{t.home.lead}</p>
            <div className="hero-ctas">
              <Link to="/jogar" className="btn btn-primary btn-lg">
                {t.home.play}
                <Icon name="arrowRight" size={16} />
              </Link>
              <Link to="/instalar" className="link-line">
                {t.home.firstTime}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Home() {
  useDocumentTitle(t.meta.home);
  return (
    <>
      <Band />
      <LobbyBrowser />
    </>
  );
}
