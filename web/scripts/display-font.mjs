// Gera as duas instâncias estáticas da Roboto Serif que o site usa (src/fonts/*.woff2).
//
// O CSS só pede a serifa em dois pontos fixos do espaço de variação:
//   .display / logotipo: largura 50%, peso 700, opsz 144
//   .cap (rótulo espaçado): largura 75%, peso 650, opsz 12
// O arquivo variável do @fontsource ("standard", subconjunto latino) tem ~370 kB porque carrega
// os três eixos inteiros. Fixar os eixos nesses pontos (instanciação do HarfBuzz, via subset-font)
// dá o mesmo desenho em arquivos de poucas dezenas de kB.
//
// Uso: npm run fonts  (rodar de novo só se mudar a versão do @fontsource ou um desses pontos).
// Não acessa a rede: lê o woff2 de node_modules e escreve em src/fonts/.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';

const root = new URL('..', import.meta.url);
const src = new URL('node_modules/@fontsource-variable/roboto-serif/files/roboto-serif-latin-standard-normal.woff2', root);

/** Pontos do espaço de variação, iguais aos de src/styles/base.css e shell.css. */
const INSTANCES = [
  { file: 'roboto-serif-display.woff2', axes: { wdth: 50, wght: 700, opsz: 144 } },
  { file: 'roboto-serif-cap.woff2', axes: { wdth: 75, wght: 650, opsz: 12 } },
];

const input = await readFile(src);
for (const { file, axes } of INSTANCES) {
  // keepAllGlyphs: o arquivo de origem já é o subconjunto latino do fontsource (mesmo
  // unicode-range de src/fonts/display.css); aqui só se fixam os eixos.
  const out = await subsetFont(input, '', { targetFormat: 'woff2', variationAxes: axes, keepAllGlyphs: true });
  const dest = new URL(`src/fonts/${file}`, root);
  await writeFile(dest, out);
  console.log(`${fileURLToPath(dest)}  ${(out.length / 1024).toFixed(1)} kB  ${JSON.stringify(axes)}`);
}
