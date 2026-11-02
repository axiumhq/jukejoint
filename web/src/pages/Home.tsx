import { Link } from 'react-router';
import { Rail, useRail } from '../components/Rail';
import { AvatarStack } from '../components/Avatar';
import { LiveDot, SectionTitle } from '../components/Common';
import { Arrivals } from '../components/Arrivals';
import { SocialRail } from '../components/Friends';
import { Icon } from '../components/Icon';
import { LobbyBrowser } from '../components/LobbyBrowser';
import { ModeCover } from '../components/ModeCover';
import { MobilePlayBar, RecommendedCard } from '../components/Recommended';
import { modes } from '../data/modes';
import { useDocumentTitle, useFriends, useIncomingInvite, useLiveStats, usePref } from '../hooks';
import { useFeaturedLobby } from '../hooks/useFeatured';
import { useLobbyFilters } from '../hooks/useFilters';
import { useNow } from '../hooks/useNow';
import { formatNumber, t } from '../i18n';
import { busiestMode } from '../lib/stats';
import { useSession } from '../state/session';

/**
 * Home v8 (docs/design/v8-estrutura.md): aviso dispensável, recomendado com barra de dados,
 * modos ao vivo, lobbies abertos e chegando agora. O trilho social vem por `<Rail>`.
 */

function Notice() {
  const [dismissed, setDismissed] = usePref('noticeX', false);
  if (dismissed) return null;
  return (
    <div className="notice" role="note">
      <Icon name="info" />
      <span>
        <b>{t.notice.title}</b> {t.notice.body}
      </span>
      <span className="sp" />
      <Link to="/novidades" className="link">
        {t.notice.link}
      </Link>
      <button type="button" className="icon-btn" aria-label={t.notice.dismiss} onClick={() => setDismissed(true)}>
        <Icon name="x" />
      </button>
    </div>
  );
}

/** Abaixo de 960 px: o cartão "Amigos · N online" abre o trilho como folha de baixo. */
function FriendsCard() {
  const { user } = useSession();
  const friends = useFriends();
  const invite = useIncomingInvite();
  const { openSheet } = useRail();
  const inLobbies = friends.filter((f) => f.lobbyId).length;
  return (
    <button type="button" className="mfriends" aria-haspopup="dialog" onClick={(e) => openSheet(e.currentTarget)}>
      {user && <AvatarStack names={friends.map((f) => f.name)} size={26} />}
      <span className="t">
        <b>{user ? t.social.mobileTitle(friends.length) : t.social.mobileOutTitle}</b>
        <span>{user ? t.social.mobileSub(inLobbies, invite ? 1 : 0) : t.social.mobileOutSub}</span>
      </span>
      <Icon name="chev" />
    </button>
  );
}

function ModesLive() {
  const stats = useLiveStats();
  const { f, update } = useLobbyFilters();
  const pick = (slug: string) => {
    const next = f.mode === slug ? '' : slug;
    update({ mode: next });
    if (next)
      document
        .getElementById('lobbies')
        ?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  };
  return (
    <section className="sec" aria-labelledby="modes-title">
      <SectionTitle id="modes-title" words={t.home.modesTitle} meta={t.home.modesMeta(modes.length, formatNumber(stats.players))}>
        <Link to="/modos" className="link">
          {t.home.seeAll}
          <Icon name="arrow" />
        </Link>
      </SectionTitle>
      <div className="modes">
        {modes.map((m) => {
          const c = stats.byMode[m.slug];
          return (
            <button
              key={m.slug}
              type="button"
              className="mcard has-cover"
              aria-pressed={f.mode === m.slug}
              aria-label={t.home.modeFilter(m.name)}
              onClick={() => pick(m.slug)}
            >
              <ModeCover slug={m.slug} />
              <span className="mcard-top tag">{t.home.modeLobbies(c?.lobbies ?? 0)}</span>
              <span className="mcard-b">
                <span className="mcard-n display">{m.name}</span>
                <span className="mcard-c">
                  <LiveDot small />
                  <span>
                    <span className="num">{formatNumber(c?.players ?? 0)}</span> {t.header.live}
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function Home() {
  useDocumentTitle(t.meta.home);
  const { lobbies, openHost } = useSession();
  const stats = useLiveStats();
  const now = useNow(5000);
  const featured = useFeaturedLobby(lobbies, undefined, now);

  return (
    <>
      <Notice />
      <RecommendedCard lobby={featured} now={now} onCreate={() => openHost()} fallbackMode={busiestMode(stats).slug} />
      <FriendsCard />
      <ModesLive />
      <LobbyBrowser featured={featured} now={now} />
      <Arrivals now={now} />
      <MobilePlayBar lobby={featured} />
      <Rail title={t.social.sheet}>
        <SocialRail />
      </Rail>
    </>
  );
}
