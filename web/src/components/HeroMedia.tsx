import { useEffect, useRef, useState } from 'react';
import { useMediaQuery, useReducedMotion } from '../hooks';

/**
 * A arte-chave do herói: o único efeito do site (brief v6, regra 1).
 *
 * Sempre há a imagem parada (AVIF, WebP, JPG; retrato no celular), que é completa sozinha.
 * O loop de vídeo do Blender entra por cima dela só quando:
 *  1. o arquivo existia no build (vite.config.ts `__HERO_VIDEO__`, sem pedido que dê 404);
 *  2. o visitante não pediu movimento reduzido nem economia de dados;
 *  3. o vídeo realmente começou a tocar (evento `playing`). Até lá, e se falhar, fica a imagem.
 * O vídeo pausa fora da tela e com a aba oculta.
 */

const V = __HERO_VIDEO__;
const PORTRAIT = '(orientation: portrait)';

interface Conn {
  saveData?: boolean;
}

function saveData() {
  const c = (navigator as Navigator & { connection?: Conn }).connection;
  return !!c?.saveData || window.matchMedia('(prefers-reduced-data: reduce)').matches;
}

export function HeroMedia({ onReady }: { onReady: () => void }) {
  const reduced = useReducedMotion();
  const portrait = useMediaQuery(PORTRAIT);
  const img = useRef<HTMLImageElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const readyFired = useRef(false);

  const sources = portrait
    ? [V.mobileWebm && { src: '/media/heroi-mobile.webm', type: 'video/webm' }, V.mobileMp4 && { src: '/media/heroi-mobile.mp4', type: 'video/mp4' }]
    : [V.webm && { src: '/media/heroi.webm', type: 'video/webm' }, V.mp4 && { src: '/media/heroi.mp4', type: 'video/mp4' }];
  const list = sources.filter((s): s is { src: string; type: string } => !!s);
  const useVideo = list.length > 0 && !reduced && !saveData();

  // A abertura começa quando a imagem decodifica (ou em até 700 ms, para não segurar a página).
  useEffect(() => {
    const fire = () => {
      if (readyFired.current) return;
      readyFired.current = true;
      onReady();
    };
    const el = img.current;
    const timer = window.setTimeout(fire, 700);
    if (el?.complete) fire();
    else el?.addEventListener('load', fire, { once: true });
    el?.addEventListener('error', fire, { once: true });
    return () => window.clearTimeout(timer);
  }, [onReady]);

  // Vídeo: toca só visível e com a aba ativa.
  useEffect(() => {
    const v = video.current;
    if (!useVideo || !v) return;
    const tryPlay = () => {
      if (document.hidden) return;
      v.play().catch(() => setPlaying(false));
    };
    const io = new IntersectionObserver(([e]) => (e?.isIntersecting ? tryPlay() : v.pause()), { threshold: 0.05 });
    io.observe(v);
    const onVis = () => (document.hidden ? v.pause() : tryPlay());
    document.addEventListener('visibilitychange', onVis);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [useVideo, portrait]);

  return (
    <div className={`hero-cam${playing ? ' has-video' : ''}`}>
      <picture>
        <source media={PORTRAIT} type="image/avif" srcSet="/media/heroi-m-600.avif 600w, /media/heroi-m-900.avif 900w" sizes="100vw" />
        <source media={PORTRAIT} type="image/webp" srcSet="/media/heroi-m-600.webp 600w, /media/heroi-m-900.webp 900w" sizes="100vw" />
        <source media={PORTRAIT} srcSet="/media/heroi-m-600.jpg 600w, /media/heroi-m-900.jpg 900w" sizes="100vw" />
        <source type="image/avif" srcSet="/media/heroi-1280.avif 1280w, /media/heroi-1920.avif 1920w" sizes="100vw" />
        <source type="image/webp" srcSet="/media/heroi-1280.webp 1280w, /media/heroi-1920.webp 1920w" sizes="100vw" />
        <img
          ref={img}
          className="hero-still"
          src="/media/heroi-1920.jpg"
          srcSet="/media/heroi-1280.jpg 1280w, /media/heroi-1920.jpg 1920w"
          sizes="100vw"
          width={1920}
          height={1080}
          alt=""
          decoding="async"
          fetchPriority="high"
        />
      </picture>
      {useVideo && (
        <video
          key={portrait ? 'm' : 'd'}
          ref={video}
          className="hero-video"
          muted
          loop
          playsInline
          autoPlay
          preload="auto"
          poster={!portrait && V.poster ? '/media/heroi-poster.jpg' : undefined}
          aria-hidden="true"
          tabIndex={-1}
          onPlaying={() => setPlaying(true)}
          onError={() => setPlaying(false)}
        >
          {list.map((s) => (
            <source key={s.src} src={s.src} type={s.type} />
          ))}
        </video>
      )}
    </div>
  );
}
