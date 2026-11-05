/** Quanto um aviso fica na tela (RF-111). */
export const TOAST_MS = 5200;
/** Depois de uma pausa, sobra pelo menos isto para terminar de ler. */
export const TOAST_MIN_LEFT_MS = 1500;

/** Tempo que falta para o aviso sumir depois de `elapsed` ms contados (a pausa guarda o resto). */
export function toastLeft(left: number, elapsed: number): number {
  return Math.max(TOAST_MIN_LEFT_MS, left - Math.max(0, elapsed));
}
