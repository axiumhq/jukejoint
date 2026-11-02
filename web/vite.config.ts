import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  // O chunk 3D (three + R3F + cena) passa de 500 kB sem gzip por natureza; o orçamento
  // do brief é medido em gzip (≤ 280 KB) e ele só carrega depois da primeira pintura.
  build: { chunkSizeWarningLimit: 1000 },
  preview: { port: 4173 },
});
