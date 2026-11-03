import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// A tela Instalação do app. Reaproveita os tokens, a base visual, o nome da marca e o tema do
// site importando direto de web/src (sem copiar), então os dois não divergem.
const webSrc = fileURLToPath(new URL('../web/src', import.meta.url));

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // No app empacotado a tela mora em /_app/, ao lado do site (que fica na raiz de dist/).
  base: command === 'build' ? '/_app/' : '/',
  resolve: { alias: { '@web': webSrc } },
  server: {
    port: 5281,
    strictPort: true,
    fs: { allow: ['.', webSrc] },
  },
  build: {
    outDir: 'dist/_app',
    emptyOutDir: false,
    target: 'es2022',
  },
  clearScreen: false,
}));
