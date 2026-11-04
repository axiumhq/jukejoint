import { describe, expect, it } from 'vitest';
import { inviteLink, inviteLinkLabel } from './invite';

describe('inviteLink', () => {
  it('usa o site público quando ele existe, no app ou fora', () => {
    expect(inviteLink('l01', { site: 'https://jukejoint.gg', inApp: true, scheme: 'jukejoint' })).toBe('https://jukejoint.gg/sala/l01');
    expect(inviteLink('l01', { site: 'https://jukejoint.gg', inApp: false, origin: 'http://localhost:5173' })).toBe('https://jukejoint.gg/sala/l01');
  });

  it('no navegador sem site público, usa a origem da página', () => {
    expect(inviteLink('l01', { site: null, inApp: false, origin: 'http://localhost:5173' })).toBe('http://localhost:5173/sala/l01');
  });

  it('no app sem site público, nunca sai com tauri.localhost: vira o deep link', () => {
    expect(inviteLink('l01', { site: null, inApp: true, scheme: 'jukejoint' })).toBe('jukejoint://join/l01');
    // Sem o esquema informado pelo app, deriva do nome da marca.
    expect(inviteLink('l01', { site: null, inApp: true })).toBe('jukejoint://join/l01');
  });

  it('codifica o id e tira o https:// só para mostrar', () => {
    expect(inviteLink('a b', { site: 'https://x.gg' })).toBe('https://x.gg/sala/a%20b');
    expect(inviteLinkLabel('https://x.gg/sala/l01')).toBe('x.gg/sala/l01');
    expect(inviteLinkLabel('jukejoint://join/l01')).toBe('jukejoint://join/l01');
  });
});
