/**
 * As cenas pintadas (WebP fixas, não repintam por tema): o destaque da Home e uma por modo.
 * Geradas fora do código a partir dos prompts de `.design/assets/chatgpt/`, sem nada da Valve.
 * Quem não tem pintura (um modo novo, por exemplo) continua com a cena em SVG (lib/cover.ts).
 */
const urls = import.meta.glob<string>('../assets/pintura/*.webp', { query: '?url', import: 'default', eager: true });

export function pintura(nome: string): string | undefined {
  return urls[`../assets/pintura/${nome}.webp`];
}

/** Onde fica o assunto de cada cena (entre 50 e 75% de x), para o recorte `object-fit: cover`. */
export const FOCO_CENA = '62% 50%';
/** O destaque: o juke joint e a porta acesa ficam no terço direito; no celular sobra só essa parte. */
export const FOCO_DESTAQUE = '100% 50%';
