import { existsSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Kits da Torre e da cidade (docs/design/contrato-kit-torre.md): só tenta carregar se o arquivo existir
  // quando o servidor ou o build começa. Colocou o .glb? Reinicie o `npm run dev`.
  define: {
    __TORRE_KIT__: JSON.stringify(existsSync(new URL('./public/models/torre-kit.glb', import.meta.url))),
    __CIDADE_KIT__: JSON.stringify(existsSync(new URL('./public/models/cidade-kit.glb', import.meta.url))),
  },
  server: { port: 5173 },
  // O chunk 3D (three + R3F + cena) passa de 500 kB sem gzip por natureza; o orçamento
  // do brief é medido em gzip (≤ 280 KB) e ele só carrega depois da primeira pintura.
  build: { chunkSizeWarningLimit: 1000 },
  preview: { port: 4173 },
});
