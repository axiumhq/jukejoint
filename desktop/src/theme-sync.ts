import { THEME_KEY, resolveTheme } from '@web/lib/theme';

/**
 * O tema inicial já vem do script inline de index.html (antes de pintar). Isto só segue as
 * trocas feitas depois em outra janela: o site e a tela Instalação são servidos da mesma origem
 * no app, então dividem o localStorage e o evento `storage` chega aqui quando o site troca o tema.
 * Em dev (portas 5280 e 5281) as origens são outras e a troca não chega; ao reabrir, sim.
 */
export function followThemeChanges(): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key !== THEME_KEY && e.key !== null) return;
    document.documentElement.dataset.theme = resolveTheme(e.key === null ? null : e.newValue, window.location.search);
  };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}
