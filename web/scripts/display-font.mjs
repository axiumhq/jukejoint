// Gera os arquivos de fonte que o site usa (src/fonts/*.woff2), a partir dos pacotes @fontsource
// (devDependencies: só servem de matéria-prima, o site não importa nada deles).
//
// Sistema de tipo do redesign (Design-System do Claude Design):
//   Young Serif     títulos (.display, h1, h2)       400 (estático, só existe esse peso)
//   Hanken Grotesk  interface                         pesos 400 a 600 (variável, faixa cortada)
//   Barlow Condensed números, ping, rótulos de dado  500 e 600 (estáticos)
//   JetBrains Mono  código e hash do instalador      500 (estático)
// O Hanken variável inteiro carrega carregam eixos que o CSS não usa; fixar ou cortar os eixos
// (instanciação do HarfBuzz, via subset-font) deixa o arquivo com poucas dezenas de kB.
//
// Uso: npm run fonts  (rodar de novo só se mudar a versão de um @fontsource ou uma faixa abaixo).
// Não acessa a rede: lê de node_modules e escreve em src/fonts/.
import { copyFile, readFile, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';

const root = new URL('..', import.meta.url);
const mod = (p) => new URL(`node_modules/${p}`, root);
const out = (f) => new URL(`src/fonts/${f}`, root);

/** Variáveis: eixo fixo (número) ou faixa ({ min, max, default }). */
const INSTANCES = [
  {
    from: '@fontsource-variable/hanken-grotesk/files/hanken-grotesk-latin-wght-normal.woff2',
    file: 'hanken-grotesk.woff2',
    axes: { wght: { min: 400, max: 600, default: 400 } },
  },
];

/** Estáticos: cópia direta do subconjunto latino. */
const COPIES = [
  ['@fontsource/young-serif/files/young-serif-latin-400-normal.woff2', 'young-serif-400.woff2'],
  ['@fontsource/barlow-condensed/files/barlow-condensed-latin-500-normal.woff2', 'barlow-condensed-500.woff2'],
  ['@fontsource/barlow-condensed/files/barlow-condensed-latin-600-normal.woff2', 'barlow-condensed-600.woff2'],
  ['@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff2', 'jetbrains-mono-500.woff2'],
];

const kb = (n) => `${(n / 1024).toFixed(1)} kB`;

for (const { from, file, axes } of INSTANCES) {
  const input = await readFile(mod(from));
  // keepAllGlyphs: o arquivo de origem já é o subconjunto latino do fontsource (mesmo
  // unicode-range de src/fonts/display.css); aqui só se fixam ou cortam os eixos.
  const data = await subsetFont(input, '', { targetFormat: 'woff2', variationAxes: axes, keepAllGlyphs: true });
  await writeFile(out(file), data);
  console.log(`${fileURLToPath(out(file))}  ${kb(data.length)}  ${JSON.stringify(axes)}`);
}

for (const [from, file] of COPIES) {
  await copyFile(mod(from), out(file));
  console.log(`${fileURLToPath(out(file))}  ${kb((await stat(out(file))).size)}`);
}
