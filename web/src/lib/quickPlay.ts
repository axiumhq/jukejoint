/**
 * Entrar num lobby pelo Jogar agora: o `requestJoin` da sessão abre o diálogo "Falta só o app" (ou a
 * troca de sala) quando o app não está pronto ou você já está noutro lobby. O /jogar não dispara isso
 * sozinho por cima do próprio painel: mostra o resultado e deixa a pessoa acionar a entrada.
 */
export function joinNeedsDialog(o: {
  appConnected: boolean;
  /** Dentro do app desktop. */
  desktop: boolean;
  /** Dentro do app: a checagem do motor ('ready' = tudo certo). */
  appCheck: 'checking' | 'ready' | 'problems' | null;
  hereId: string | null;
  targetId: string;
}): boolean {
  if (!o.appConnected) return true;
  if (o.desktop && o.appCheck !== 'ready') return true;
  return !!o.hereId && o.hereId !== o.targetId;
}
