// Emulates the game's renderer (modlock panorama/src/bridge.ts) in a browser:
// it reads the relay page's title, joins the parts, and acks each one.
const titlePrefix = 'modlock:frame:'
const frame = document.getElementById('state')
const log = document.getElementById('log')
const expected = await (await fetch('/expected')).json()

const sum = (data) => data.reduce((acc, b, i) => (acc * 31 + b + i) >>> 0, 7)
function unpack(text) {
  const out = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    if (c >= 1 && c <= 127) out[i] = c
    else if (c >= 0x100 && c <= 0x1ff) out[i] = c - 0x100
    else return null
  }
  return out
}

// results is read by tests driving this page.
window.results = { screens: [], statuses: [], errors: [], trace: [] }
let parts = null
let lastTitle = ''
let acked = false

function read(title) {
  if (title === lastTitle) return
  lastTitle = title
  if (!title.startsWith(titlePrefix)) {
    parts = null
    window.results.statuses.push(title)
    return
  }
  const fields = title.slice(titlePrefix.length).split(':', 4)
  const [id, offset, total] = fields.map(Number)
  const chunk = title.slice(titlePrefix.length + fields.join(':').length + 1)
  window.results.trace.push(`${Math.round(performance.now())} ${fields.join(':')} chunk=${chunk.length} hash=${frame.contentWindow.location.hash}`)
  if (offset === 0) parts = { id, total, text: '' }
  if (!parts || parts.id !== id || parts.text.length !== offset) {
    window.results.errors.push(`missing part at ${offset} of ${id}`)
    parts = null
    return
  }
  parts.text += chunk
  acked = !acked
  frame.contentWindow.location.hash = acked ? '1' : '0'
  if (parts.text.length < parts.total) return
  const data = unpack(parts.text)
  parts = null
  const got = { length: data.length, sum: sum(data) }
  const index = window.results.screens.length
  const ok = expected.some((e) => e.length === got.length && e.sum === got.sum)
  window.results.screens.push({ ...got, ok })
  const li = document.createElement('li')
  li.className = ok ? 'ok' : 'bad'
  li.textContent = `screen ${index + 1}: ${got.length} bytes ${ok ? 'matches' : 'DOES NOT MATCH'}`
  log.append(li)
}

// The game raises HTMLTitle on each change; poll the same-origin frame instead.
setInterval(() => {
  try { read(frame.contentDocument.title) } catch (e) { window.results.errors.push(String(e)) }
}, 10)
