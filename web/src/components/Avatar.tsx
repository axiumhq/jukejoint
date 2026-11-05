import { memo, type CSSProperties } from 'react';
import { avatarGlyph } from '../lib/avatar';

/**
 * Avatar gerado do nome (lib/avatar.ts `avatarGlyph`), presença e pilha.
 * O desenho do redesign: disco na superfície com o glifo de linha da pessoa em latão (cores em
 * base.css, `.av`), então segue o tema. O que encosta neles (o ponto de presença, o vizinho na
 * pilha) abre um recorte de verdade no desenho (máscara), limpo sobre qualquer superfície.
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
  const d = avatarGlyph(name);
  const cls = ['av', ring && 'ring', className].filter(Boolean).join(' ');
  return (
    <span className={cls} style={{ '--s': `${size}px` } as CSSProperties} title={name} aria-hidden="true">
      <svg viewBox="0 0 32 32" focusable="false">
        <circle cx="16" cy="16" r="15.5" strokeWidth="1" />
        <path d={d} />
      </svg>
    </span>
  );
});

/** Presença: em lobby (ponto cheio), no menu do jogo (anel vazado) ou offline (apagado). */
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
