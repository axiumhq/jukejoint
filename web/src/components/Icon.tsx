/**
 * Os poucos ícones de interface do v6 (seta, copiar, confirmar, fechar, cadeado, mais, abrir).
 * Traço fino e uniforme; decorativos por padrão (aria-hidden).
 */
const paths = {
  arrowRight: 'M3 12h16M13 6l6 6-6 6',
  check: 'M5 12.5 10 17.5 19.5 7',
  copy: 'M9 9h10v11H9zM6 15H5V4h10v1',
  close: 'M6 6l12 12M18 6 6 18',
  lock: 'M6.5 11h11v9.5h-11zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  plus: 'M12 5v14M5 12h14',
  chevronDown: 'M6.5 9.5 12 15l5.5-5.5',
} as const;

export type IconName = keyof typeof paths;

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  /** Se informado, o ícone vira imagem acessível. Sem label, é decorativo. */
  label?: string;
}

export function Icon({ name, size = 16, className, label }: IconProps) {
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="square"
      strokeLinejoin="miter"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <path d={paths[name]} />
    </svg>
  );
}
