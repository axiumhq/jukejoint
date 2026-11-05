import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Carga direta numa tela em chunk próprio: main.tsx espera o chunk da URL antes do primeiro render
 * (sem fallback, sem o rodapé pulando). Para essa espera não virar uma ida e volta a mais, um
 * script curto no <head> pede o chunk da URL (modulepreload) junto com o bundle principal.
 * Primeiro segmento do caminho → módulo da tela; o mesmo mapa de CHUNKS em src/App.tsx.
 */
const ROUTE_CHUNKS: Record<string, string> = {
  sala: 'src/pages/Room.tsx',
  jogar: 'src/pages/QuickPlay.tsx',
  modos: 'src/pages/Mode.tsx',
  instalar: 'src/pages/Install.tsx',
  novidades: 'src/pages/News.tsx',
};

function routePreload(): Plugin {
  return {
    name: 'route-preload',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const bundle = ctx.bundle;
        if (!bundle) return html;
        const chunks = Object.values(bundle).flatMap((c) => (c.type === 'chunk' ? [c] : []));
        const entry = chunks.find((c) => c.isEntry);
        // o que o index já pré-carrega não precisa entrar de novo
        const have = new Set([entry?.fileName, ...(entry?.imports ?? [])]);
        const deps = (file: string, out: Set<string>) => {
          if (have.has(file) || out.has(file)) return out;
          out.add(file);
          for (const d of chunks.find((c) => c.fileName === file)?.imports ?? []) deps(d, out);
          return out;
        };
        const map: Record<string, string[]> = {};
        for (const [seg, mod] of Object.entries(ROUTE_CHUNKS)) {
          const chunk = chunks.find((c) => c.facadeModuleId?.replace(/\\/g, '/').endsWith(mod));
          if (chunk) map[seg] = [...deps(chunk.fileName, new Set())].map((f) => '/' + f);
        }
        const script = `<script>(function(){var m=${JSON.stringify(map)};(m[location.pathname.split('/')[1]]||[]).forEach(function(h){var l=document.createElement('link');l.rel='modulepreload';l.crossOrigin='';l.href=h;document.head.appendChild(l)})})()</script>`;
        // antes do <link rel=stylesheet>: script inline depois de CSS espera o CSS chegar
        return html.replace('<script type="module"', `${script}\n    <script type="module"`);
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), routePreload()],
  test: { setupFiles: ['./src/test/setup.ts'] },
  server: { port: 5173 },
  preview: { port: 4173 },
});
