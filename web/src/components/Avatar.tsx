import { memo, useEffect, useId, useState, type CSSProperties } from 'react';
import { retrato } from '../lib/retrato';

/**
 * Avatar: a foto da Steam e, sem ela, o retrato em silhueta gerado do nome (lib/retrato.ts), no
 * estilo das cenas. Presença e pilha. O que encosta neles (o ponto de presença, o vizinho na
 * pilha) abre um recorte de verdade no desenho (máscara), limpo sobre qualquer superfície.
 */

/** A silhueta de reserva. Os ids do gradiente e do recorte são únicos por cópia: um retrato
 *  repetido dentro de algo escondido (display: none) apagaria o gradiente dos outros. */
function Silhueta({ name }: { name: string }) {
  const r = retrato(name);
  const id = `rt${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <svg className="retrato" viewBox="0 0 40 40" focusable="false">
      <defs>
        <radialGradient id={`${id}g`} cx="0.28" cy="0.3" r="0.95">
          <stop offset="0" stopColor={r.claro} />
          <stop offset="1" stopColor={r.escuro} />
        </radialGradient>
        <clipPath id={`${id}c`}>
          <circle cx="20" cy="20" r="20" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}c)`}>
        <rect width="40" height="40" fill={`url(#${id}g)`} />
        <g transform={r.espelho ? 'matrix(-1 0 0 1 40 0)' : undefined}>
          <path d={r.forma} fill="#e8c88f" opacity="0.42" transform="translate(-0.9 -0.3)" />
          <path d={r.silhueta} fill="#110d0f" />
        </g>
      </g>
    </svg>
  );
}

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
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const photo = !!src && !failed;
  const cls = ['av', photo && 'photo', ring && 'ring', className].filter(Boolean).join(' ');
  return (
    <span className={cls} style={{ '--s': `${size}px` } as CSSProperties} title={name} aria-hidden="true">
      {photo ? (
        <img src={src} alt="" width={size} height={size} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      ) : (
        <Silhueta name={name} />
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
