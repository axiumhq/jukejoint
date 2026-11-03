/**
 * O app só roda no Windows. Esta regra decide quando o site deve dizer isso em vez de oferecer
 * "Abrir o app" ou "Instalar": celular e tablet pelo navegador (UA de Android, iPhone, iPad, iPod
 * ou "Mobile"), ou, quando o UA não diz, tela estreita com toque como ponteiro principal.
 * Um notebook com tela de toque não entra: o ponteiro principal dele é o mouse ou o touchpad.
 */

export interface DeviceSignals {
  userAgent: string;
  /** `navigator.userAgentData.mobile`, quando o navegador expõe. */
  uaMobile?: boolean;
  /** `(pointer: coarse)`: o ponteiro principal é o dedo. */
  coarse: boolean;
  /** `(max-width: 760px)`, o mesmo corte de celular do CSS. */
  narrow: boolean;
}

const MOBILE_UA = /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i;

export function cannotRunApp({ userAgent, uaMobile, coarse, narrow }: DeviceSignals): boolean {
  if (uaMobile) return true;
  if (MOBILE_UA.test(userAgent)) return true;
  return coarse && narrow;
}
