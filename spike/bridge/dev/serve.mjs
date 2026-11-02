// Dev harness for the relay page: serves public/ and dev/ on :8090, and a fake
// controller relay on 127.0.0.1:4329 that streams packed screens the way
// modlock's session/relay.go does (CORS + Private Network Access headers).
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const pagePort = 8090
const relayPort = 4329
const pageOrigin = `http://localhost:${pagePort}`

// bytes and pack mirror the test helpers and the controller's packing.
const bytes = (n, seed) => Uint8Array.from({ length: n }, (_, i) => (i * 31 + seed) & 0xff)
const pack = (data) => Array.from(data, (b) => (b > 0x20 && b < 0x7f && b !== 0x5c ? String.fromCharCode(b) : String.fromCharCode(0x100 + b))).join('')
const sum = (data) => data.reduce((acc, b, i) => (acc * 31 + b + i) >>> 0, 7)

// The screens the relay sends, in order: small, multi-part, then updates.
const screens = [bytes(120, 1), bytes(10_000, 2), bytes(300, 3), bytes(9_001, 4), bytes(50, 5)]

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8' }

// Serve static files and the expected checksums.
createServer(async (req, res) => {
  const path = new URL(req.url, pageOrigin).pathname
  if (path === '/expected') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(screens.map((s) => ({ length: s.length, sum: sum(s) }))))
    return
  }
  const base = path.startsWith('/dev/') ? '' : 'public'
  const file = normalize(join(root, base, path))
  if (!file.startsWith(normalize(root))) {
    res.writeHead(403).end()
    return
  }
  try {
    const data = await readFile(file)
    res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' })
    res.end(data)
  } catch {
    res.writeHead(404).end()
  }
}).listen(pagePort, () => console.log(`page on ${pageOrigin}/dev/harness.html`))

// Stream the screens like the controller, one packed line each, 500 ms apart.
createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', pageOrigin)
  res.setHeader('Access-Control-Allow-Private-Network', 'true')
  res.setHeader('Vary', 'Origin')
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET')
    res.writeHead(204).end()
    return
  }
  if (req.url !== '/panorama/stream') {
    res.writeHead(404).end()
    return
  }
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' })
  let at = 0
  const timer = setInterval(() => {
    if (at >= screens.length) return
    res.write(`~${at + 1}:${pack(screens[at])}\n`)
    at++
  }, 500)
  req.on('close', () => clearInterval(timer))
}).listen(relayPort, '127.0.0.1', () => console.log(`fake relay on 127.0.0.1:${relayPort}`))
