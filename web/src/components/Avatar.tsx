import { memo, useEffect, useState, type CSSProperties } from 'react';
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
  /** A foto da Steam (https). Sem ela, ou se não carregar, vale o glifo gerado do nome. */
  src?: string;
  className?: string;
}

export const Avatar = memo(function Avatar({ name, size = 28, ring = false, src, className }: AvatarProps) {
  const d = avatarGlyph(name);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const photo = !!src && !failed;
  const cls = ['av', photo && 'photo', ring && 'ring', className].filter(Boolean).join(' ');
  return (
    <span className={cls} style={{ '--s': `${size}px` } as CSSProperties} title={name} aria-hidden="true">
      {photo ? (
        <img src={src} alt="" width={size} height={size} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      ) : (
        <svg viewBox="0 0 32 32" focusable="false">
          <circle cx="16" cy="16" r="15.5" strokeWidth="1" />
          <path d={d} />
        </svg>
      )}
    </span>
  );
});

/** Presença: em lobby (ponto cheio), no menu do jogo (anel vazado) ou offline (apagado). */
export type PresenceStatus = 'lobby' | 'menu' | 'offline';

export function Presence({ name, size = 32, status, ring, src }: { name: string; size?: number; status: PresenceStatus; ring?: boolean; src?: string }) {
  return (
    <span className={`pres ${status}`} style={{ '--s': `${size}px` } as CSSProperties}>
      <Avatar name={name} size={size} ring={ring} src={src} />
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
  /** Fotos da Steam por nome. */
  avatars?: Readonly<Record<string, string>>;
  className?: string;
}

/** Pilha de avatares com "+N". Decorativa: o número de pessoas vai no texto ao lado. */
export function AvatarStack({ names, size = 22, total, friends, max = 4, avatars, className }: StackProps) {
  const shown = names.slice(0, max);
  const more = (total ?? names.length) - shown.length;
  const isFriend = (n: string) => (friends instanceof Set ? friends.has(n) : Array.isArray(friends) ? friends.includes(n) : false);
  return (
    <span className={className ? `stack ${className}` : 'stack'} style={{ '--s': `${size}px` } as CSSProperties} aria-hidden="true">
      {shown.map((n) => (
        <Avatar key={n} name={n} size={size} ring={isFriend(n)} src={avatars?.[n]} />
      ))}
      {more > 0 && <span className="more">+{more}</span>}
    </span>
  );
}
