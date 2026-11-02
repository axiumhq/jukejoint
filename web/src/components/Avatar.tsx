import { memo, type CSSProperties } from 'react';
import { avatarArt } from '../lib/avatar';

/**
 * Avatar gerado do nome (lib/avatar.ts), presença e pilha.
 * Os avatares não leem o tema: a cor é da pessoa, não da interface.
 */

interface AvatarProps {
  name: string;
  /** Lado em px. */
  size?: number;
  /** Anel de acento: alguém da sua lista. */
  ring?: boolean;
  className?: string;
}

export const Avatar = memo(function Avatar({ name, size = 28, ring = false, className }: AvatarProps) {
  const a = avatarArt(name);
  const s = a.second;
  const cls = ['av', ring && 'ring', className].filter(Boolean).join(' ');
  return (
    <span className={cls} style={{ '--s': `${size}px` } as CSSProperties} title={name} aria-hidden="true">
      <svg viewBox="0 0 36 36" focusable="false">
        <rect width="36" height="36" fill={a.bg} />
        <circle cx={a.main.cx} cy={a.main.cy} r={a.main.r} fill={a.main.fill} />
        {s.kind === 'band' && (
          <rect x="-4" y={s.y} width="44" height={s.h} transform={`rotate(${s.rot} 18 18)`} fill={s.fill} style={{ mixBlendMode: 'screen' }} opacity=".82" />
        )}
        {s.kind === 'disc' && <circle cx={s.cx} cy={s.cy} r={s.r} fill={s.fill} style={{ mixBlendMode: 'screen' }} opacity=".85" />}
        {s.kind === 'wave' && <path d={s.d} fill={s.fill} style={{ mixBlendMode: 'screen' }} opacity=".8" />}
        <circle cx="18" cy="18" r="17.4" fill="none" stroke="#fff" strokeOpacity=".10" strokeWidth="1.2" />
      </svg>
    </span>
  );
});

/** Presença: em lobby (acento), no menu do jogo (ao vivo) ou offline (apagado). */
export type PresenceStatus = 'lobby' | 'menu' | 'offline';

export function Presence({ name, size = 32, status, ring }: { name: string; size?: number; status: PresenceStatus; ring?: boolean }) {
  return (
    <span className={`pres ${status}`}>
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
