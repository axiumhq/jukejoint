import type { ReactNode } from 'react';

/**
 * Cabeçalho das telas internas v8 (modos, instalar, hoje): título grande em serifa condensada,
 * segunda parte no acento ("Modos *ao vivo*"), rótulo de dado ao lado e o texto de apoio embaixo.
 */
interface PageHeadProps {
  words: readonly [string, string];
  meta?: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
}

export function PageHead({ words, meta, lead, children }: PageHeadProps) {
  return (
    <header className="ph">
      <div className="ph-t">
        <h1 className="display two">
          {words[0]} <em>{words[1]}</em>
        </h1>
        {meta != null && <span className="lbl">{meta}</span>}
      </div>
      {lead != null && <p className="ph-lead">{lead}</p>}
      {children}
    </header>
  );
}
