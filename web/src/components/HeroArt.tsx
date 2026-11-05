/** A cidade da capa do Hoje: céu, lua, prédios e chão no tema ativo (as cores vêm das variáveis do tema). */
export function HeroArt() {
  return (
    <svg className="nh-art" viewBox="0 0 1128 220" preserveAspectRatio="xMaxYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id="nh-ceu" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--sky-1)' }} />
          <stop offset="1" style={{ stopColor: 'var(--sky-2)' }} />
        </linearGradient>
        <radialGradient id="nh-halo">
          <stop offset="0" stopColor="#F2D9A4" stopOpacity=".34" />
          <stop offset=".45" stopColor="#C8A46A" stopOpacity=".1" />
          <stop offset="1" stopColor="#C8A46A" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="nh-lua" cx="40%" cy="35%">
          <stop offset="0" stopColor="#F6EBD3" />
          <stop offset="1" stopColor="#D9C39A" />
        </radialGradient>
        <linearGradient id="nh-nev" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--sky-2)', stopOpacity: 0 }} />
          <stop offset="1" style={{ stopColor: 'var(--sky-2)', stopOpacity: 0.55 }} />
        </linearGradient>
      </defs>
      <rect width="1128" height="220" fill="url(#nh-ceu)" />
      <circle cx="800" cy="74" r="170" fill="url(#nh-halo)" />
      <path d="M800 170L560 170M800 170L590 92M800 170L640 32M800 170L716 -14M800 170L884 -14M800 170L960 32M800 170L1010 92M800 170L1040 170" stroke="#C8A46A" strokeWidth="1" opacity=".22" fill="none" />
      <circle cx="800" cy="72" r="36" fill="url(#nh-lua)" />
      <path d="M380 220V128h34v-26h26v-24h22v24h24v26h30v-42h36v-20h18v20h36v42h30V96l14-22 14 22v46h34v-34h44v-26h26v-34h16v34h26v26h44v34h28V92h30v-22h22v22h30v50h44v-30h52v-24h30v24h26v108z" style={{ fill: 'var(--bldg)' }} />
      <rect x="0" y="120" width="1128" height="100" fill="url(#nh-nev)" />
      <path d="M520 220v-58h40v-22h26v-30h10v-22h6v22h10v30h26v22h30v58zM700 220v-96h20v-20h18v-18h14V52l8-16 8 16v34h14v18h18v20h20v96zM880 220v-70h44v-20h34v20h30v-36h36v36h38v70z" style={{ fill: 'var(--bldg-2)' }} />
      <path d="M716 132h6v8h-6zM730 132h6v8h-6zM760 118h6v8h-6zM774 118h6v8h-6zM788 132h6v8h-6zM802 132h6v8h-6zM730 152h6v8h-6zM788 152h6v8h-6zM552 150h5v7h-5zM574 150h5v7h-5zM602 124h5v7h-5zM618 124h5v7h-5zM904 162h5v7h-5zM944 142h5v7h-5zM1002 130h5v7h-5zM1018 130h5v7h-5zM1036 164h5v7h-5z" fill="#F2D9A4" opacity=".85" />
      <path d="M430 220v-44h60v-20h44v20h50v-14h60v18h56v-10h70v14h66v-16h50v18h60v-14h50v18h132v30z" style={{ fill: 'var(--ground)' }} />
    </svg>
  );
}
