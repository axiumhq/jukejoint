const paths = {
  home: 'M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z',
  door: 'M6 21V4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21M3.5 21h17M14.5 12.5v.01',
  sigil: 'M12 3l2.6 6.1L21 12l-6.4 2.9L12 21l-2.6-6.1L3 12l6.4-2.9z M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5',
  scroll: 'M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7M7 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2M9 9h6M9 13h6M9 17h3',
  download: 'M12 4v11M7 10.5 12 15.5l5-5M5 20h14',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5',
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13M15.5 15.5 20 20',
  sliders: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',
  check: 'M5 12.5 10 17.5 19.5 7',
  copy: 'M9 9h10v11H9zM6 15H5V4h10v1',
  shield: 'M12 3.5 19 6v5.5c0 4.4-2.9 7.8-7 9-4.1-1.2-7-4.6-7-9V6zM9 12l2.2 2.2L15.5 10',
  chevronDown: 'M6.5 9.5 12 15l5.5-5.5',
  close: 'M6 6l12 12M18 6 6 18',
  play: 'M8 5.5v13l10.5-6.5z',
  pause: 'M8 5.5v13M16 5.5v13',
  users: 'M9 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M2.5 20c.9-3 3.4-4.8 6.5-4.8s5.6 1.8 6.5 4.8M16 4.8a3.5 3.5 0 0 1 0 6.6M18 15.4c1.7.6 3 2.2 3.5 4.6',
  lock: 'M6.5 11h11v9.5h-11zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  bell: 'M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0',
  bot: 'M6 9h12v10H6zM12 5v4M9.5 13.5v1M14.5 13.5v1M3.5 13v3M20.5 13v3',
  plus: 'M12 5v14M5 12h14',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  folder: 'M3.5 6.5a1 1 0 0 1 1-1h5l2 2.5h8a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z',
  arrowLeft: 'M19 12H5M11 6l-6 6 6 6',
  code: 'M8.5 7 3.5 12l5 5M15.5 7l5 5-5 5',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4',
  moon: 'M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10',
} as const;

export type IconName = keyof typeof paths;

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  /** Se informado, o ícone vira imagem acessível. Sem label, é decorativo. */
  label?: string;
}

export function Icon({ name, size = 20, className, label }: IconProps) {
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <path d={paths[name]} />
    </svg>
  );
}
