import { existsSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Loop de vídeo do herói (render do Blender, ver README): o site só pede os arquivos que
 * existem quando o servidor ou o build começa. Assim não há 404 no console enquanto o render
 * não chega. Colocou os arquivos em public/media? Reinicie o `npm run dev` ou rode o build de novo.
 */
const media = (file: string) => existsSync(new URL(`./public/media/${file}`, import.meta.url));

const heroVideo = {
  webm: media('heroi.webm'),
  mp4: media('heroi.mp4'),
  poster: media('heroi-poster.jpg'),
  mobileWebm: media('heroi-mobile.webm'),
  mobileMp4: media('heroi-mobile.mp4'),
};

export default defineConfig({
  plugins: [react()],
  define: {
    __HERO_VIDEO__: JSON.stringify(heroVideo),
  },
  server: { port: 5173 },
  preview: { port: 4173 },
});
