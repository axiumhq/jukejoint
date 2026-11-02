/**
 * Preferências locais (tema, aviso dispensado, favoritos, visão da lista).
 * Mesmo prefixo e formato do protótipo v8: `lobby.<chave>` com valor em JSON.
 * Tudo em try/catch: aba anônima, cota cheia ou storage bloqueado não quebram a tela.
 */
const PREFIX = 'lobby.';

export function readPref<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writePref(key: string, value: unknown) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* sem storage: a escolha vale só nesta visita */
  }
}
