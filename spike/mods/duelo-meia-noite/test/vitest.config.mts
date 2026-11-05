import { fileURLToPath } from 'node:url'

// The duel's rules run against test/fake-modlock.ts in place of the Modlock SDK. This folder has
// no node_modules of its own: run it with the web's Vitest (see ../README.md), globals on.
const fakeSdk = fileURLToPath(new URL('./fake-modlock.ts', import.meta.url))

export default {
  resolve: {
    alias: [
      { find: /^modlock\/console$/, replacement: fakeSdk },
      { find: /^modlock$/, replacement: fakeSdk },
    ],
  },
  test: { include: ['test/**/*.test.ts'], globals: true, root: fileURLToPath(new URL('..', import.meta.url)) },
}
