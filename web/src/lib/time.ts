export type DayPeriod = 'madrugada' | 'manha' | 'tarde' | 'noite';

/** Faixa do dia pela hora local do navegador: 0h-5h59, 6h-11h59, 12h-17h59, 18h-23h59. */
export function dayPeriod(date = new Date()): DayPeriod {
  const h = date.getHours();
  if (h < 6) return 'madrugada';
  if (h < 12) return 'manha';
  if (h < 18) return 'tarde';
  return 'noite';
}
