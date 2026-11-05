import {
  ArrowLeft,
  ArrowRight,
  ArrowRightToLine,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Crown,
  Dice5,
  Download,
  Gamepad2,
  Hand,
  Info,
  Layers,
  LayoutGrid,
  Link,
  Lock,
  LogOut,
  Mail,
  Palette,
  Pause,
  Play,
  Plus,
  Rows2,
  Rows3,
  Search,
  Settings,
  Shrink,
  Signal,
  SquarePlus,
  Star,
  Swords,
  User,
  Users,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/**
 * Ícones de linha do Lucide (ISC), num traço só: 1,75 na grade de 24. Decorativos por padrão
 * (aria-hidden); com `label`, viram imagem acessível. O tamanho sai do CSS pelo contexto
 * (`.ico` 16 px no texto, 18 px nos campos, 20 px na navegação) e a cor é a do texto (currentColor).
 * Os nomes são do produto, não do Lucide: as telas pedem `name="knock"`, e aqui se escolhe o desenho.
 */
const icons = {
  search: Search,
  arrow: ArrowRight,
  back: ArrowLeft,
  left: ChevronLeft,
  right: ChevronRight,
  chev: ChevronDown,
  x: X,
  check: Check,
  plus: Plus,
  play: Play,
  bolt: Zap,
  lobbies: Rows2,
  modes: Layers,
  users: Users,
  user: User,
  mail: Mail,
  plusSq: SquarePlus,
  download: Download,
  palette: Palette,
  star: Star,
  lock: Lock,
  bell: Bell,
  knock: Hand,
  enterMid: ArrowRightToLine,
  grid: LayoutGrid,
  rows: Rows3,
  signal: Signal,
  link: Link,
  crown: Crown,
  exit: LogOut,
  info: Info,
  pause: Pause,
  copy: Copy,
  /* regras do modo e atividade da sala */
  swords: Swords,
  shrink: Shrink,
  dice: Dice5,
  clock: Clock,
  pad: Gamepad2,
  /* navegação: Jogar, Modos, Hoje, Instalar e a sua lista */
  navPlay: Gamepad2,
  navModes: LayoutGrid,
  navToday: CalendarDays,
  navInstall: Download,
  navList: Users,
  gear: Settings,
} satisfies Record<string, LucideIcon>;

/* nomes do v6 */
const aliases = { arrowRight: 'arrow', close: 'x', chevronDown: 'chev' } as const;

export type IconName = keyof typeof icons | keyof typeof aliases;

/** O traço único do produto, na grade de 24 do Lucide. */
const STROKE = 1.75;

interface IconProps {
  name: IconName;
  /** Lado em px. Sem ele, vale o CSS do contexto (`.ico`, 16 px). */
  size?: number;
  className?: string;
  /** Se informado, o ícone vira imagem acessível. Sem label, é decorativo. */
  label?: string;
}

export function Icon({ name, size, className, label }: IconProps) {
  const key = (name in aliases ? aliases[name as keyof typeof aliases] : name) as keyof typeof icons;
  const Svg = icons[key];
  return (
    <Svg
      className={className ? `ico ${className}` : 'ico'}
      strokeWidth={STROKE}
      // O CSS de `.ico` define o traço; o estilo em linha garante o do Lucide (1,75) por cima dele.
      style={size ? { width: size, height: size, strokeWidth: STROKE } : { strokeWidth: STROKE }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    />
  );
}
