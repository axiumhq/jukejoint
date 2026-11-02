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

/** Cidade quieta: silhueta com as janelas apagadas e uma só acesa. Estados vazios e 404. */
export function QuietSkyline({ className, lit = true }: { className?: string; lit?: boolean }) {
  return (
    <svg className={className ? `quiet-skyline ${className}` : 'quiet-skyline'} viewBox="0 0 160 84" aria-hidden="true" focusable="false">
      <path className="qs-line" d="M2 83V44h16V30h10v14h8V14h8V6h12v8h8v69M64 83V36h20v-8h12v8h12v47M108 83V52h14V40h10v12h14v31M0 83.5h160" />
      {[
        [40, 22], [48, 22], [40, 34], [52, 34], [40, 46], [48, 58], [70, 44], [78, 56], [90, 44], [96, 66], [114, 60], [128, 70], [8, 54], [24, 66],
      ].map(([x, y]) => (
        <rect key={`${x}-${y}`} className="qs-win" x={x} y={y} width="4" height="6" />
      ))}
      {lit && <rect className="qs-lit" x="48" y="46" width="4" height="6" />}
    </svg>
  );
}
