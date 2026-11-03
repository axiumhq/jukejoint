import { describe, expect, it } from 'vitest';
import { cannotRunApp } from './device';

const WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
const ANDROID_TABLET = 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

describe('cannotRunApp', () => {
  it('PC com Windows e mouse: o app roda', () => {
    expect(cannotRunApp({ userAgent: WIN, coarse: false, narrow: false })).toBe(false);
  });

  it('janela estreita no PC continua sendo PC', () => {
    expect(cannotRunApp({ userAgent: WIN, coarse: false, narrow: true })).toBe(false);
  });

  it('notebook com tela de toque (largo) continua sendo PC', () => {
    expect(cannotRunApp({ userAgent: WIN, coarse: true, narrow: false })).toBe(false);
  });

  it('iPhone, Android e tablet Android: não roda, pelo UA', () => {
    expect(cannotRunApp({ userAgent: IPHONE, coarse: true, narrow: true })).toBe(true);
    expect(cannotRunApp({ userAgent: ANDROID, coarse: true, narrow: true })).toBe(true);
    expect(cannotRunApp({ userAgent: ANDROID_TABLET, coarse: true, narrow: false })).toBe(true);
  });

  it('UA reduzido: vale o sinal do navegador ou toque com tela estreita', () => {
    expect(cannotRunApp({ userAgent: WIN, uaMobile: true, coarse: false, narrow: false })).toBe(true);
    expect(cannotRunApp({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64)', coarse: true, narrow: true })).toBe(true);
  });
});
