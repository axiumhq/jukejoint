import { t } from '../i18n';
import { LOCALES } from '../i18n/locale';
import { useLocale } from '../i18n/useLocale';

export function LocaleSelect() {
  const { locale, setLocale } = useLocale();
  return (
    <label className="locale-pref">
      <span>{t.theme.language}</span>
      <select value={locale} onChange={(event) => setLocale(event.currentTarget.value as (typeof LOCALES)[number])}>
        <option value="pt-BR">Português (Brasil)</option>
        <option value="en">English</option>
      </select>
    </label>
  );
}
