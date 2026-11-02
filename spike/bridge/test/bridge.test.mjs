// Runs the bridge against a copy of the game renderer's title reader
// (modlock v0.1.68 panorama/src/bridge.ts, read()) to check the protocol end to end.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ackTimeout, chunkChars, createBridge, readLines } from '../public/app/relay/bridge.js'

const titlePrefix = 'modlock:frame:'

// pack mirrors the controller's panorama.AppendPacked.
function pack(bytes) {
  let text = ''
  for (const b of bytes) {
    text += b > 0x20 && b < 0x7f && b !== 0x5c ? String.fromCharCode(b) : String.fromCharCode(0x100 + b)
  }
  return text
}

// unpack mirrors the renderer's unpackBytes.
function unpack(text) {
  const bytes = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (code >= 1 && code <= 127) bytes[i] = code
    else if (code >= 0x100 && code <= 0x1ff) bytes[i] = code - 0x100
    else return null
  }
  return bytes
}

// renderer mirrors Bridge.read in the game: it joins parts and acks each one.
function renderer() {
  const shown = []
  let parts = null
  let lastTitle = ''
  let acks = 0
  return {
    shown,
    get acks() { return acks },
    read(title, ack) {
      if (!title.startsWith(titlePrefix)) {
        parts = null
        lastTitle = ''
        if (title === '') shown.push(null)
        return
      }
      if (title === lastTitle) return
      lastTitle = title
      const fields = title.slice(titlePrefix.length).split(':', 4)
      const [id, offset, total] = fields.map(Number)
      const chunk = title.slice(titlePrefix.length + fields.join(':').length + 1)
      assert.equal(fields.length, 4)
      assert.ok(id && total, 'id and total are nonzero')
      assert.ok(title.length <= 4096, 'a title fits in Chromium')
      if (offset === 0) parts = { id, total, text: '' }
      assert.ok(parts && parts.id === id && parts.text.length === offset, 'no part is missing')
      parts.text += chunk
      acks++
      if (parts.text.length >= parts.total) {
        shown.push(unpack(parts.text))
        parts = null
      }
      ack()
    },
  }
}

// harness wires a bridge to a renderer with a manual clock.
function harness({ dropAcks = 0 } = {}) {
  const view = renderer()
  const timers = new Map()
  let nextTimer = 1
  let bridge
  let dropped = 0
  bridge = createBridge({
    setTitle: (title) =>
      view.read(title, () => {
        if (dropped < dropAcks) { dropped++; return }
        queueMicrotask(() => bridge.ack())
      }),
    schedule: (fn, ms) => { const id = nextTimer++; timers.set(id, { fn, ms }); return id },
    cancel: (id) => timers.delete(id),
  })
  const fire = () => { const all = [...timers.values()]; timers.clear(); all.forEach((t) => t.fn()) }
  return { view, bridge, timers, fire }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))
const bytes = (n, seed = 0) => Uint8Array.from({ length: n }, (_, i) => (i * 31 + seed) & 0xff)

test('a small screen arrives whole', async () => {
  const { view, bridge } = harness()
  const screen = bytes(300)
  bridge.push(`~1:${pack(screen)}`)
  await settle()
  assert.deepEqual(view.shown, [screen])
})

test('a large screen arrives in acknowledged parts', async () => {
  const { view, bridge } = harness()
  const screen = bytes(chunkChars * 3 + 17, 7)
  bridge.push(`~1:${pack(screen)}`)
  for (let i = 0; i < 10; i++) await settle()
  assert.deepEqual(view.shown, [screen])
  assert.equal(view.acks, 4)
})

test('the newest screen follows the one in flight, skipping stale ones', async () => {
  const { view, bridge } = harness()
  const first = bytes(chunkChars * 2, 1)
  bridge.push(`~1:${pack(first)}`)
  bridge.push(`~2:${pack(bytes(10, 2))}`)
  const newest = bytes(20, 3)
  bridge.push(`~3:${pack(newest)}`)
  for (let i = 0; i < 10; i++) await settle()
  assert.deepEqual(view.shown, [first, newest])
})

test('a lost ack resends the newest screen after the timeout', async () => {
  const { view, bridge, timers, fire } = harness({ dropAcks: 1 })
  const screen = bytes(chunkChars + 5, 9)
  bridge.push(`~1:${pack(screen)}`)
  await settle()
  assert.equal(view.shown.length, 0)
  assert.equal([...timers.values()][0].ms, ackTimeout)
  fire()
  for (let i = 0; i < 10; i++) await settle()
  assert.deepEqual(view.shown, [screen])
})

test('an empty screen and a reset clear the screen', async () => {
  const { view, bridge } = harness()
  bridge.push('~1:')
  bridge.reset()
  assert.deepEqual(view.shown, [null, null])
})

test('readLines splits a chunked stream into lines', async () => {
  const encoder = new TextEncoder()
  const line1 = `~1:${pack(bytes(50, 4))}`
  const line2 = `~2:${pack(bytes(70, 5))}`
  const raw = encoder.encode(`${line1}\n${line2}\n`)
  // Split in the middle of a two-byte character to exercise streaming decode.
  const cut = encoder.encode(line1).length + 3
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(raw.slice(0, cut))
      controller.enqueue(raw.slice(cut))
      controller.close()
    },
  })
  const lines = []
  await readLines(4320, (line) => lines.push(line), async () => ({ ok: true, body }))
  assert.deepEqual(lines, [line1, line2])
})
