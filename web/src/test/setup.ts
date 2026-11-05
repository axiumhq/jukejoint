import { setLocale } from '../i18n/locale';

// Existing unit expectations describe the Portuguese source catalog. Keep tests deterministic
// regardless of the operating system locale used by the CI runner.
setLocale('pt-BR');
