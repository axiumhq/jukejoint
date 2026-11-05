/** A rua do 404: prédios, o ônibus parado sob dois postes e a lua, nas cores do tema (variáveis --sky-*, --bldg, --ground). */
export function NotFoundArt() {
  const bld: [number, number, number, number][] = [
    [0, 96, 84, 164],
    [92, 60, 70, 200],
    [170, 110, 64, 150],
    [240, 80, 90, 180],
    [338, 120, 60, 140],
    [404, 70, 84, 190],
    [496, 104, 60, 156],
    [562, 84, 78, 176],
  ];
  const wins =
    'M64 106h5v7h-5zM36 124h5v7h-5zM50 124h5v7h-5zM8 142h5v7h-5zM22 142h5v7h-5zM50 178h5v7h-5zM100 70h5v7h-5zM114 70h5v7h-5zM128 88h5v7h-5zM156 106h5v7h-5zM114 124h5v7h-5zM142 142h5v7h-5zM100 160h5v7h-5zM142 178h5v7h-5zM178 120h5v7h-5zM206 138h5v7h-5zM192 156h5v7h-5zM220 174h5v7h-5zM248 90h5v7h-5zM318 90h5v7h-5zM290 108h5v7h-5zM262 126h5v7h-5zM304 126h5v7h-5zM248 144h5v7h-5zM276 162h5v7h-5zM304 180h5v7h-5zM346 130h5v7h-5zM374 130h5v7h-5zM360 148h5v7h-5zM388 166h5v7h-5zM346 184h5v7h-5zM440 80h5v7h-5zM468 80h5v7h-5zM412 98h5v7h-5zM454 116h5v7h-5zM482 134h5v7h-5zM426 152h5v7h-5zM468 170h5v7h-5zM440 188h5v7h-5zM504 114h5v7h-5zM532 114h5v7h-5zM546 150h5v7h-5zM518 168h5v7h-5zM584 94h5v7h-5zM626 94h5v7h-5zM570 112h5v7h-5zM612 130h5v7h-5zM584 148h5v7h-5zM598 166h5v7h-5zM626 184h5v7h-5z';
  return (
    <svg className="nf-art" viewBox="0 0 852 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="nf-ceu" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--sky-1)' }} />
          <stop offset="1" style={{ stopColor: 'var(--sky-2)' }} />
        </linearGradient>
        <radialGradient id="nf-halo">
          <stop offset="0" stopColor="#F2D9A4" stopOpacity=".34" />
          <stop offset=".45" stopColor="#C8A46A" stopOpacity=".1" />
          <stop offset="1" stopColor="#C8A46A" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="nf-lua" cx="40%" cy="35%">
          <stop offset="0" stopColor="#F6EBD3" />
          <stop offset="1" stopColor="#D9C39A" />
        </radialGradient>
        <linearGradient id="nf-lat" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F0DDB4" />
          <stop offset=".5" stopColor="#C8A46A" />
          <stop offset="1" stopColor="#6F5228" />
        </linearGradient>
      </defs>
      <rect width="852" height="260" fill="url(#nf-ceu)" />
      <path d="M0 220H852V260H0z" style={{ fill: 'var(--ground)' }} />
      <g transform="translate(212 0)">
        <circle cx="540" cy="46" r="24" fill="url(#nf-lua)" />
        {bld.map(([x, y, w, h]) => (
          <rect key={x} x={x} y={y} width={w} height={h} style={{ fill: 'var(--bldg)' }} />
        ))}
        <path d={wins} fill="#F2D9A4" opacity=".8" />
        <path d="M0 74q320 26 640 0M0 92q320 24 640 0" fill="none" style={{ stroke: 'var(--ground)' }} strokeWidth="1.2" />
        <rect x="214" y="118" width="212" height="94" rx="16" style={{ fill: 'var(--ground)' }} />
        {[232, 264, 296, 328, 360, 392].map((x) => (
          <rect key={x} x={x} y="146" width="24" height="26" rx="2" fill="#F2D9A4" opacity=".9" />
        ))}
        <rect x="214" y="180" width="212" height="4" fill="url(#nf-lat)" />
        <circle cx="418" cy="196" r="46" fill="url(#nf-halo)" />
        <circle cx="418" cy="196" r="4" fill="#F2D9A4" />
        <circle cx="262" cy="214" r="9" style={{ fill: 'var(--bldg-2)' }} />
        <circle cx="378" cy="214" r="9" style={{ fill: 'var(--bldg-2)' }} />
        <path d="M0 260v-40h640v40z" style={{ fill: 'var(--ground)' }} />
        <path d="M0 232h640M0 244h640" stroke="url(#nf-lat)" strokeWidth="1" opacity=".5" />
        <path d="M130 222v-86h14" fill="none" style={{ stroke: 'var(--ground)' }} strokeWidth="3" />
        <circle cx="144" cy="140" r="26" fill="url(#nf-halo)" />
        <circle cx="144" cy="140" r="3.5" fill="#F2D9A4" />
        <path d="M540 222v-86h-14" fill="none" style={{ stroke: 'var(--ground)' }} strokeWidth="3" />
        <circle cx="526" cy="140" r="26" fill="url(#nf-halo)" />
        <circle cx="526" cy="140" r="3.5" fill="#F2D9A4" />
      </g>
    </svg>
  );
}
