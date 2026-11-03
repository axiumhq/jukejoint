import { memo, type CSSProperties } from 'react';
import { avatarArt, type AvatarShape } from '../lib/avatar';

/**
 * Avatar gerado do nome (lib/avatar.ts), presença e pilha.
 * Os avatares não leem o tema: a cor é da pessoa, não da interface. O que encosta neles
 * (o ponto de presença, o vizinho na pilha) abre um recorte de verdade no desenho (máscara),
 * então ficam limpos sobre qualquer superfície.
 */

interface AvatarProps {
  name: string;
  /** Lado em px. */
  size?: number;
  /** Anel de acento: alguém da sua lista. */
  ring?: boolean;
  className?: string;
}

function Shape({ s }: { s: AvatarShape }) {
  if (s.t === 'circle') return <circle cx={s.cx} cy={s.cy} r={s.r} fill={s.fill} />;
  if (s.t === 'rect') return <rect x={s.x} y={s.y} width={s.w} height={s.h} fill={s.fill} />;
  return <path d={s.d} fill={s.fill} />;
}

export const Avatar = memo(function Avatar({ name, size = 28, ring = false, className }: AvatarProps) {
  const a = avatarArt(name);
  const cls = ['av', ring && 'ring', className].filter(Boolean).join(' ');
  return (
    <span className={cls} style={{ '--s': `${size}px` } as CSSProperties} title={name} aria-hidden="true">
      <svg viewBox="0 0 36 36" focusable="false">
        <rect width="36" height="36" fill={a.bg} />
        <g transform={a.rot ? `rotate(${a.rot} 18 18)` : undefined}>
          {a.shapes.map((s, i) => (
            <Shape key={i} s={s} />
          ))}
        </g>
        {/* fio interno: define a borda em fundo escuro sem contorno pesado */}
        <circle cx="18" cy="18" r="17.5" fill="none" stroke="#fff" strokeOpacity=".14" strokeWidth="1" />
      </svg>
    </span>
  );
});

/** Presença: em lobby (acento), no menu do jogo (ao vivo) ou offline (apagado). */
export type PresenceStatus = 'lobby' | 'menu' | 'offline';

export function Presence({ name, size = 32, status, ring }: { name: string; size?: number; status: PresenceStatus; ring?: boolean }) {
  return (
    <span className={`pres ${status}`} style={{ '--s': `${size}px` } as CSSProperties}>
      <Avatar name={name} size={size} ring={ring} />
      <i aria-hidden="true" />
    </span>
  );
}

interface StackProps {
  names: string[];
  size?: number;
  /** Total de pessoas (o "+N" conta o resto). Padrão: `names.length`. */
  total?: number;
  /** Quem ganha o anel de acento (da sua lista). */
  friends?: ReadonlySet<string> | string[];
  /** Quantos rostos antes do "+N". */
  max?: number;
  className?: string;
}

/** Pilha de avatares com "+N". Decorativa: o número de pessoas vai no texto ao lado. */
export function AvatarStack({ names, size = 22, total, friends, max = 4, className }: StackProps) {
  const shown = names.slice(0, max);
  const more = (total ?? names.length) - shown.length;
  const isFriend = (n: string) => (friends instanceof Set ? friends.has(n) : Array.isArray(friends) ? friends.includes(n) : false);
  return (
    <span className={className ? `stack ${className}` : 'stack'} style={{ '--s': `${size}px` } as CSSProperties} aria-hidden="true">
      {shown.map((n) => (
        <Avatar key={n} name={n} size={size} ring={isFriend(n)} />
      ))}
      {more > 0 && <span className="more">+{more}</span>}
    </span>
  );
}
