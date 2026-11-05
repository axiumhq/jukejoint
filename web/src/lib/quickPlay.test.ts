import { describe, expect, it } from 'vitest';
import { joinNeedsDialog } from './quickPlay';

const ok = { appConnected: true, desktop: false, appCheck: null, hereId: null, targetId: 'l1' } as const;

describe('joinNeedsDialog', () => {
  it('com o app aberto e livre, entra direto', () => {
    expect(joinNeedsDialog(ok)).toBe(false);
  });
  it('sem o app, abriria o diálogo "Falta só o app"', () => {
    expect(joinNeedsDialog({ ...ok, appConnected: false })).toBe(true);
  });
  it('dentro do app, só entra direto com a checagem pronta', () => {
    expect(joinNeedsDialog({ ...ok, desktop: true, appCheck: 'ready' })).toBe(false);
    expect(joinNeedsDialog({ ...ok, desktop: true, appCheck: 'checking' })).toBe(true);
    expect(joinNeedsDialog({ ...ok, desktop: true, appCheck: 'problems' })).toBe(true);
  });
  it('estar em outro lobby abre a troca de sala; no mesmo, não', () => {
    expect(joinNeedsDialog({ ...ok, hereId: 'l2' })).toBe(true);
    expect(joinNeedsDialog({ ...ok, hereId: 'l1' })).toBe(false);
  });
});
