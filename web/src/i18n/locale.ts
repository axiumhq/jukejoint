export const LOCALES = ['pt-BR', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

const STORAGE_KEY = 'jukejoint.locale';
const listeners = new Set<() => void>();
const DEFAULT_LOCALE = 'pt-BR' satisfies Locale;

function supported(value: string | null | undefined): Locale | null {
  if (!value) return null;
  const language = value.toLowerCase();
  if (language === 'pt' || language.startsWith('pt-')) return 'pt-BR';
  if (language === 'en' || language.startsWith('en-')) return 'en';
  return null;
}

function initialLocale(): Locale {
  try {
    const saved = typeof window === 'undefined' ? null : supported(window.localStorage.getItem(STORAGE_KEY));
    if (saved) return saved;
  } catch {
    // Storage may be unavailable in private browsing or a restricted WebView.
  }
  if (typeof navigator !== 'undefined') {
    for (const language of navigator.languages ?? [navigator.language]) {
      const detected = supported(language);
      if (detected) return detected;
    }
  }
  return DEFAULT_LOCALE;
}

let currentLocale = initialLocale();

function notify() {
  for (const listener of listeners) listener();
}

export function getLocale(): Locale {
  return currentLocale;
}

export function setLocale(locale: Locale) {
  if (!LOCALES.includes(locale) || locale === currentLocale) return;
  currentLocale = locale;
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Keep the selection for this session if storage is unavailable.
  }
  if (typeof document !== 'undefined') document.documentElement.lang = locale;
  notify();
}

export function subscribeLocale(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    currentLocale = supported(event.newValue) ?? initialLocale();
    if (typeof document !== 'undefined') document.documentElement.lang = currentLocale;
    notify();
  };
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
  };
}

export function getServerLocale() {
  return DEFAULT_LOCALE;
}
