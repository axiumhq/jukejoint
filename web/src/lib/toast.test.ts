import { describe, expect, it } from 'vitest';
import { TOAST_MIN_LEFT_MS, TOAST_MS, toastLeft } from './toast';

describe('toastLeft', () => {
  it('desconta o que já passou', () => {
    expect(toastLeft(TOAST_MS, 1000)).toBe(TOAST_MS - 1000);
  });
  it('depois de pausar quase no fim, ainda sobra tempo para ler', () => {
    expect(toastLeft(TOAST_MS, TOAST_MS - 100)).toBe(TOAST_MIN_LEFT_MS);
    expect(toastLeft(500, 0)).toBe(TOAST_MIN_LEFT_MS);
  });
  it('ignora relógio negativo', () => {
    expect(toastLeft(TOAST_MS, -50)).toBe(TOAST_MS);
  });
});
