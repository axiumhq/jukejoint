/**
 * Nome da plataforma (decidido em 03/11/2026). Troque aqui e o site inteiro acompanha (wordmark,
 * títulos, textos); o app desktop deriva dele o esquema do link (`jukejoint://`).
 * O <title> inicial em index.html também usa o nome; troque lá se quiser.
 */
export const BRAND_NAME = 'Jukejoint';

/** O repositório público do app no GitHub: as releases (e o instalador) e o código-fonte. */
export const REPO = 'axiumhq/jukejoint';

/** Dados do app de desktop do modo de demonstração (sem API). A página Instalar lê a release real (lib/release.ts). */
export const APP_RELEASE = {
  version: '0.9.3',
  fileName: `${BRAND_NAME}-Setup-0.9.3.exe`,
  sizeMb: 12.4,
  releasedAt: '2026-10-28',
  sha256: '9f2c4e81b7a05d3e6c19f4a2d8e7b0c35a61f9e24d7c08b3a5e1f6d29c4b7a80',
  sourceUrl: '#codigo-aberto',
} as const;
