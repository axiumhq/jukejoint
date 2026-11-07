import { memo, useLayoutEffect, useState, type CSSProperties } from 'react';
import { coverFraming, loadScene, MEDALLION_DEFS, modeIcon, sceneId, sceneSlug, type CoverVariant, type IconKind, type PreparedScene } from '../lib/cover';
import { FOCO_CENA, pintura } from '../lib/pintura';

/**
 * A capa de um modo: a cena noturna do kit (1600×900, foco à direita, faixa calma embaixo à esquerda
 * para o título), pintada só com variáveis do tema: trocar o tema repinta. Estática: o único
 * movimento é o zoom de 5% no hover de quem a contém (classe `has-cover`), desligado com movimento
 * reduzido. Preenche o pai (position: absolute); o pai define o tamanho e o canto.
 *
 * Custo: cada cena é um chunk próprio, carregado só quando um modo a pede, e mora uma vez só no
 * sprite de `<CoverDefs />`; a capa é um `<svg>` com um `<use>`. Antes de a cena chegar o contêiner
 * já tem o tamanho e o fundo (`--k0`), então nada muda de lugar. `content-visibility: auto` pula
 * estilo, layout e pintura das capas fora da tela.
 */
interface ModeCoverProps {
  /** Slug do modo (src/data/modes.ts). */
  slug: string;
  /** Versão larga do herói: recorte em faixa centrado no foco da cena. */
  wide?: boolean;
  className?: string;
}

/* ---------- cenas carregadas: lidas por <CoverDefs /> ---------- */

const loaded = new Map<string, PreparedScene>();
const pending = new Set<string>();
const listeners = new Set<() => void>();
let snapshot: readonly string[] = [];

/** Pede a cena do modo (uma vez só por modo); ao chegar, avisa o sprite. */
function ensureScene(slug: string) {
  const s = sceneSlug(slug);
  if (loaded.has(s) || pending.has(s)) return;
  pending.add(s);
  loadScene(s)
    .then((p) => {
      loaded.set(s, p);
      snapshot = [...loaded.keys()].sort();
      for (const l of listeners) l();
    })
    .catch(() => pending.delete(s));
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/** Um `<svg>` com a cena do modo recortada pela variante; usado pela capa e pela faixa do lobby. */
function SceneSvg({ slug, variant, className }: { slug: string; variant: CoverVariant; className?: string }) {
  const { viewBox, preserveAspectRatio } = coverFraming(slug, variant);
  return (
    <svg className={className} viewBox={viewBox} preserveAspectRatio={preserveAspectRatio} focusable="false" aria-hidden="true">
      <use href={`#${sceneId(slug)}`} />
    </svg>
  );
}

/** A cena pintada do modo (WebP), quando existe; o recorte segue o foco do assunto. */
function ScenePaint({ src, className }: { src: string; className?: string }) {
  return <img className={className} src={src} alt="" loading="lazy" decoding="async" style={{ objectPosition: FOCO_CENA }} />;
}

export const ModeCover = memo(function ModeCover({ slug, wide = false, className }: ModeCoverProps) {
  const paint = pintura(slug);
  // Efeito de layout: o pedido sai no mesmo commit; a cena entra no DOM assim que o chunk chega.
  // Com a cena pintada, o SVG nem é pedido.
  useLayoutEffect(() => {
    if (!paint) ensureScene(slug);
  }, [slug, paint]);
  return (
    <div className={className ? `cover ${className}` : 'cover'} style={{ contentVisibility: 'auto' } as CSSProperties} aria-hidden="true">
      {paint ? <ScenePaint src={paint} /> : <SceneSvg slug={slug} variant={wide ? 'wide' : 'card'} />}
    </div>
  );
});

/**
 * O ícone do modo, sem disco: glifo 24 (traço `currentColor`, para listas e texto) ou detalhe 48
 * (duas cores de latão, para medalhões de 40 px ou mais). Decorativo: o rótulo vem do texto ao lado.
 */
export function ModeIcon({ slug, kind = 'glyph', size, className }: { slug: string; kind?: IconKind; size?: number; className?: string }) {
  const { viewBox, attrs, inner } = modeIcon(slug, kind);
  return (
    <svg className={className ? `mi ${className}` : 'mi'} viewBox={viewBox} width={size} height={size} aria-hidden="true" focusable="false">
      <g {...jsxAttrs(attrs)} dangerouslySetInnerHTML={{ __html: inner }} />
    </svg>
  );
}

const jsxAttrs = (a: Record<string, string>) =>
  Object.fromEntries(Object.entries(a).map(([k, v]) => [k.replace(/-(\w)/g, (_m, c: string) => c.toUpperCase()), v]));

/**
 * O medalhão do modo (disco com anel de latão e o ícone dentro). Decorativo. O tamanho vem do CSS
 * (`.med`) ou de `size`: a partir de 40 px usa o detalhe de duas cores; abaixo, o glifo (a classe
 * `med-sm` também liga o glifo nos contextos pequenos do CSS).
 */
export function ModeMedallion({ slug, size, className }: { slug: string; size?: number; className?: string }) {
  const sm = size != null && size < 40;
  const g = modeIcon(slug, 'glyph');
  const d = modeIcon(slug, 'detalhe');
  return (
    <svg
      className={['med', sm ? 'med-sm' : '', className ?? ''].filter(Boolean).join(' ')}
      viewBox="0 0 84 84"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="42" cy="42" r="40" fill="url(#jj-med)" stroke="url(#jj-lat)" strokeWidth="2.5" />
      <svg className="med-d" x="17" y="17" width="50" height="50" viewBox={d.viewBox}>
        <g {...jsxAttrs(d.attrs)} dangerouslySetInnerHTML={{ __html: d.inner }} />
      </svg>
      <svg className="med-g" x="24" y="24" width="36" height="36" viewBox={g.viewBox}>
        <g {...jsxAttrs(g.attrs)} dangerouslySetInnerHTML={{ __html: g.inner }} />
      </svg>
    </svg>
  );
}

/** A coluna de arte do cartão de lobby: fatia vertical da cena, centrada no foco. Decorativa. */
export function ModeStrip({ slug, className }: { slug: string; className?: string }) {
  const paint = pintura(slug);
  useLayoutEffect(() => {
    if (!paint) ensureScene(slug);
  }, [slug, paint]);
  const cls = className ? `strip ${className}` : 'strip';
  return paint ? <ScenePaint src={paint} className={cls} /> : <SceneSvg slug={slug} variant="strip" className={cls} />;
}

/**
 * Os gradientes do medalhão e as cenas já carregadas (estilo + defs + desenho, uma vez cada).
 * Renderizado uma vez, na casca.
 */
export function CoverDefs() {
  // Assinatura no efeito de layout: a casca vem antes do conteúdo na árvore, então já escuta
  // quando a cena chega, e a atualização sai antes da pintura seguinte.
  const [ids, setIds] = useState(() => snapshot);
  useLayoutEffect(() => {
    const update = () => setIds(snapshot);
    update();
    return subscribe(update);
  }, []);
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs dangerouslySetInnerHTML={{ __html: MEDALLION_DEFS }} />
      {ids.map((s) => {
        const p = loaded.get(s);
        return p ? <SceneSprite key={s} slug={s} scene={p} /> : null;
      })}
    </svg>
  );
}

const SceneSprite = memo(function SceneSprite({ slug, scene }: { slug: string; scene: PreparedScene }) {
  return (
    <>
      <style>{scene.css}</style>
      <defs>
        <g id={sceneId(slug)} dangerouslySetInnerHTML={{ __html: scene.body }} />
      </defs>
    </>
  );
});
