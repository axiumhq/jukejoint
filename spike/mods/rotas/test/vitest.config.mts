import { fileURLToPath } from 'node:url'

// As Rotas rodam contra test/fake-modlock.ts no lugar da SDK do Modlock. Esta pasta não tem
// node_modules próprio: rode com o Vitest do site (ver ../README.md), com globals ligados.
const fakeSdk = fileURLToPath(new URL('./fake-modlock.ts', import.meta.url))

export default {
  resolve: {
    alias: [
      { find: /^modlock\/console$/, replacement: fakeSdk },
      { find: /^modlock\/jsx-(dev-)?runtime$/, replacement: fakeSdk },
      { find: /^modlock$/, replacement: fakeSdk },
    ],
  },
  test: { include: ['test/**/*.test.ts'], globals: true, root: fileURLToPath(new URL('..', import.meta.url)) },
}
