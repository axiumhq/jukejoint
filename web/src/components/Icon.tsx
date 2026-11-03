/**
 * Ícones v8: traço único de 1,4 em grade de 16 (porte do v8.js). Decorativos por padrão (aria-hidden).
 * Os nomes antigos do v6 (arrowRight, close, chevronDown) seguem valendo para as telas da fase 2.
 */
const paths = {
  search: '<circle cx="7" cy="7" r="4.6"/><path d="m10.5 10.5 3.6 3.6"/>',
  arrow: '<path d="M3.5 8h9M9 4.5 12.5 8 9 11.5"/>',
  back: '<path d="M12.5 8h-9M7 4.5 3.5 8 7 11.5"/>',
  left: '<path d="M10 3.5 5.5 8l4.5 4.5"/>',
  right: '<path d="M6 3.5 10.5 8 6 12.5"/>',
  chev: '<path d="m4.5 6.2 3.5 3.5 3.5-3.5"/>',
  x: '<path d="m4 4 8 8M12 4l-8 8"/>',
  check: '<path d="m3.5 8.4 3 3 6-6.4"/>',
  plus: '<path d="M8 3.5v9M3.5 8h9"/>',
  play: '<path d="M5.2 3.6v8.8L12.3 8z"/>',
  bolt: '<path d="M8.8 1.8 3.8 9h4l-.6 5.2L12.2 7h-4z"/>',
  lobbies:
    '<rect x="2.2" y="2.6" width="11.6" height="4.4" rx="1.3"/><rect x="2.2" y="9" width="11.6" height="4.4" rx="1.3"/><path d="M4.6 4.8h3M4.6 11.2h3"/>',
  modes: '<path d="M8 1.9 14 5 8 8.1 2 5z"/><path d="m2 8 6 3.1L14 8M2 11l6 3.1 6-3.1"/>',
  users:
    '<circle cx="6" cy="5.5" r="2.4"/><path d="M1.8 13.2c.4-2.3 2-3.6 4.2-3.6s3.8 1.3 4.2 3.6"/><circle cx="11.4" cy="5.9" r="1.9"/><path d="M11.6 9.6c1.6.2 2.6 1.3 2.9 3.1"/>',
  user: '<circle cx="8" cy="5.6" r="2.7"/><path d="M2.8 13.6c.5-2.7 2.5-4.2 5.2-4.2s4.7 1.5 5.2 4.2"/>',
  mail: '<rect x="2" y="3.5" width="12" height="9" rx="1.6"/><path d="m2.6 4.6 5.4 4 5.4-4"/>',
  plusSq: '<rect x="2.3" y="2.3" width="11.4" height="11.4" rx="2.4"/><path d="M8 5.2v5.6M5.2 8h5.6"/>',
  download: '<path d="M8 2.5v7.2M5 6.9 8 9.8l3-2.9M2.8 11.2v1.2c0 .7.5 1.2 1.2 1.2h8c.7 0 1.2-.5 1.2-1.2v-1.2"/>',
  palette:
    '<path d="M8 2a6 6 0 1 0 0 12c.9 0 1.3-.6 1.1-1.3-.3-.9.3-1.7 1.2-1.7H12a2 2 0 0 0 2-2A6 6 0 0 0 8 2Z"/><circle cx="5" cy="7" r=".9" fill="currentColor"/><circle cx="7.6" cy="4.8" r=".9" fill="currentColor"/><circle cx="10.6" cy="5.8" r=".9" fill="currentColor"/>',
  star: '<path d="m8 2.4 1.7 3.5 3.8.5-2.8 2.6.7 3.8L8 11l-3.4 1.8.7-3.8-2.8-2.6 3.8-.5z"/>',
  lock: '<rect x="3.5" y="7" width="9" height="6.5" rx="1.6"/><path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7"/>',
  bell: '<path d="M4 11.5V7.2a4 4 0 0 1 8 0v4.3l1 1.2H3z"/><path d="M6.6 14.2a1.5 1.5 0 0 0 2.8 0"/>',
  knock:
    '<path d="M5 8.5V4.2a1.1 1.1 0 0 1 2.2 0V8M7.2 7.4V3.4a1.1 1.1 0 0 1 2.2 0v4M9.4 7.6V4.4a1.1 1.1 0 0 1 2.2 0v5.2c0 2.6-1.7 4.4-4.2 4.4-1.8 0-2.7-.8-3.7-2.2L2.4 9.4a1.1 1.1 0 0 1 1.8-1.2L5 9.2"/>',
  enterMid: '<path d="M2.5 8h7M7 5l3 3-3 3"/><path d="M12.5 3v10"/>',
  grid: '<rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1.2"/><rect x="9" y="2.5" width="4.5" height="4.5" rx="1.2"/><rect x="2.5" y="9" width="4.5" height="4.5" rx="1.2"/><rect x="9" y="9" width="4.5" height="4.5" rx="1.2"/>',
  rows: '<path d="M2.5 4h11M2.5 8h11M2.5 12h11"/>',
  signal: '<path d="M3 12.5v-1.5M6.3 12.5V9M9.6 12.5V6.5M12.9 12.5V4"/>',
  link: '<path d="M6.8 9.2a2.6 2.6 0 0 0 3.7 0l2-2a2.6 2.6 0 0 0-3.7-3.7l-.7.7"/><path d="M9.2 6.8a2.6 2.6 0 0 0-3.7 0l-2 2a2.6 2.6 0 0 0 3.7 3.7l.7-.7"/>',
  crown: '<path d="M2.6 5.2 5.4 8 8 3.6 10.6 8l2.8-2.8-1 6.6H3.6z"/><path d="M3.6 13.4h8.8"/>',
  exit: '<path d="M9.5 3.5h3v9h-3M7 5.2 4.2 8 7 10.8M4.4 8h6"/>',
  info: '<circle cx="8" cy="8" r="6"/><path d="M8 7.2v3.8M8 5v.2"/>',
  pause: '<path d="M5.6 3.8v8.4M10.4 3.8v8.4"/>',
  copy: '<rect x="5.2" y="5.2" width="8.3" height="8.3" rx="1.6"/><path d="M10.8 5.2V3.8c0-.7-.6-1.3-1.3-1.3H3.8c-.7 0-1.3.6-1.3 1.3v5.7c0 .7.6 1.3 1.3 1.3h1.4"/>',
  /* regras do modo e atividade da sala (fase 2) */
  swords: '<path d="m2.5 2.5 7 7M2.5 2.5h3M2.5 2.5v3M13.5 2.5l-7 7M13.5 2.5h-3M13.5 2.5v3M5 11l-2 2M11 11l2 2M4 9.5 6.5 12M12 9.5 9.5 12"/>',
  shrink: '<circle cx="8" cy="8" r="5.6"/><circle cx="8" cy="8" r="2.6"/><path d="M8 .9v1.6M8 13.5v1.6M.9 8h1.6M13.5 8h1.6"/>',
  dice: '<rect x="2.6" y="2.6" width="10.8" height="10.8" rx="2.4"/><circle cx="5.7" cy="5.7" r=".7" fill="currentColor"/><circle cx="10.3" cy="10.3" r=".7" fill="currentColor"/><circle cx="8" cy="8" r=".7" fill="currentColor"/>',
  clock: '<circle cx="8" cy="8" r="6"/><path d="M8 4.6V8l2.4 1.6"/>',
  pad: '<path d="M4.8 4.6h6.4a3 3 0 0 1 2.9 2.3l.7 3.1a1.8 1.8 0 0 1-3.1 1.6l-1.2-1.3H5.5l-1.2 1.3a1.8 1.8 0 0 1-3.1-1.6l.7-3.1a3 3 0 0 1 2.9-2.3Z"/><path d="M5.4 6.6v2M4.4 7.6h2"/><circle cx="10.6" cy="7.6" r=".6" fill="currentColor"/>',
  gear: '<circle cx="8" cy="8" r="2.2"/><path d="M8 1.8v1.7M8 12.5v1.7M1.8 8h1.7M12.5 8h1.7M3.6 3.6l1.2 1.2M11.2 11.2l1.2 1.2M3.6 12.4l1.2-1.2M11.2 4.8l1.2-1.2"/><circle cx="8" cy="8" r="4.6"/>',
} as const;

/* nomes do v6 */
const aliases = { arrowRight: 'arrow', close: 'x', chevronDown: 'chev' } as const;

export type IconName = keyof typeof paths | keyof typeof aliases;

interface IconProps {
  name: IconName;
  /** Lado em px (padrão 16). */
  size?: number;
  className?: string;
  /** Se informado, o ícone vira imagem acessível. Sem label, é decorativo. */
  label?: string;
}

export function Icon({ name, size, className, label }: IconProps) {
  const key = (name in aliases ? aliases[name as keyof typeof aliases] : name) as keyof typeof paths;
  return (
    <svg
      className={className ? `ico ${className}` : 'ico'}
      viewBox="0 0 16 16"
      style={size ? { width: size, height: size } : undefined}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      dangerouslySetInnerHTML={{ __html: paths[key] }}
    />
  );
}

/** Marca provisória (original): anel aberto com um nó, lido como "porta". */
export function BrandMark() {
  return (
    <svg className="mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeLinecap="round">
      <path d="M19.6 7.4A8.6 8.6 0 1 0 20.6 12" strokeWidth="2.2" />
      <path d="M12 7.2v9.6" strokeWidth="2.2" />
      <path d="M8.4 9.4v5.2M15.6 9.4v5.2" strokeWidth="1.4" opacity=".55" />
      <circle cx="20.2" cy="4.6" r="1.7" fill="currentColor" stroke="none" />
    </svg>
  );
}
