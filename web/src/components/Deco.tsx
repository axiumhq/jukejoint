/**
 * Ornamentos da direção visual. Uma única forma, o recuo escalonado
 * (setback) dos arranha-céus dos anos 1920, desenhada em linha fina.
 * A janela acesa no topo é o mesmo sinal das vagas: luz acesa = gente.
 * Usar com parcimônia: painel ao vivo da home, arte do modo, painel de download.
 */

export function Setback({ className }: { className?: string }) {
  return (
    <svg className={className ? `setback ${className}` : 'setback'} viewBox="0 0 120 12" aria-hidden="true" focusable="false">
      <path className="setback-line" d="M0 11.5H38V9H45V6.5H52V4H56V1H64V4H68V6.5H75V9H82V11.5H120" />
      <rect className="setback-lit" x="58.75" y="5.5" width="2.5" height="3" />
    </svg>
  );
}

/** Marca provisória: torre escalonada com uma janela acesa. Sem texto (o nome fica em BRAND_NAME). */
export function TowerMark({ className }: { className?: string }) {
  return (
    <svg className={className ? `tower-mark ${className}` : 'tower-mark'} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path className="tower-line" d="M10 2.75h4v3h2.25v4H18.5v11.5h-13V9.75h2.25v-4H10z" />
      <rect className="tower-lit" x="10.75" y="12.5" width="2.5" height="3.5" />
    </svg>
  );
}
