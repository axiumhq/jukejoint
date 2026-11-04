import { BRAND_NAME } from '../config/brand';
import { SITE_URL } from '../data/source';
import { desktopInfo } from './desktop';

/*
 * O link de convite de uma sala. Precisa abrir no PC de outra pessoa, então nunca sai com a origem do
 * app (`tauri.localhost` só existe dentro dele):
 * - com `VITE_SITE_URL`, o site público (`https://…/sala/<id>`);
 * - no navegador, a origem da página, como sempre;
 * - no app sem site público, o deep link `<esquema>://join/<id>`, que abre direto no app de quem tem.
 */

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

export function inviteLink(lobbyId: string, opts: { site?: string | null; origin?: string; inApp?: boolean; scheme?: string } = {}): string {
  const id = encodeURIComponent(lobbyId);
  const site = opts.site !== undefined ? opts.site : SITE_URL;
  if (site) return `${site}/sala/${id}`;
  const info = opts.inApp === undefined ? desktopInfo() : opts.inApp ? { scheme: opts.scheme ?? '' } : null;
  if (info) return `${opts.scheme || info.scheme || slug(BRAND_NAME)}://join/${id}`;
  return `${opts.origin ?? window.location.origin}/sala/${id}`;
}

/** O mesmo link para mostrar na tela: sem o `https://` do começo. */
export const inviteLinkLabel = (link: string) => link.replace(/^https?:\/\//, '');
