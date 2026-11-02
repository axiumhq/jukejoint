// The relay page carries the local player's screen from the Modlock controller
// on loopback into the game. Deadlock loads only https pages into HTML panels,
// so the game's renderer (modlock panorama/src/bridge.ts) loads this page from
// our https origin and reads each screen from its title, in parts it
// acknowledges by moving the page between the fragments #0 and #1.

/** titlePrefix marks a part: "<prefix><id>:<offset>:<total>:<sequence>:<chunk>". */
export const titlePrefix = 'modlock:frame:'

/**
 * chunkChars is the most screen characters one title carries. Chromium keeps
 * at most 4096 characters of a title; the header takes the rest.
 */
export const chunkChars = 4000

/** ackTimeout is how long a part may wait for its acknowledgment before the newest screen is sent again. */
export const ackTimeout = 2000

/** reconnectDelay is how long the page waits before reading the stream again. */
export const reconnectDelay = 1000

/**
 * createBridge returns the page's sender. It takes the controller's lines
 * ("~<sequence>:<packed>") through push, sends the newest screen in parts
 * through setTitle, and moves to the next part on each ack.
 */
export function createBridge({ setTitle, schedule, cancel }) {
  /** latest is the newest screen read: { sequence, text }. */
  let latest = null
  /** sending is the screen whose parts are going out: { id, sequence, text, offset, size }. */
  let sending = null
  /** nextId numbers each sending; the renderer requires a nonzero id. */
  let nextId = 1
  /** timer is the pending ack deadline. */
  let timer = null

  // Send the part at the current offset and wait for its ack.
  function sendPart() {
    const { id, sequence, text, offset } = sending
    const chunk = text.slice(offset, offset + chunkChars)
    sending.size = chunk.length
    setTitle(`${titlePrefix}${id}:${offset}:${text.length}:${sequence}:${chunk}`)
    if (timer !== null) cancel(timer)
    timer = schedule(() => {
      // The renderer missed a part; start the newest screen over.
      timer = null
      sending = null
      sendLatest()
    }, ackTimeout)
  }

  // Start sending the newest screen, unless it is empty: the renderer takes an
  // empty title as "no screen".
  function sendLatest() {
    if (!latest) return
    if (latest.text.length === 0) {
      setTitle('')
      return
    }
    sending = { id: nextId++, sequence: latest.sequence, text: latest.text, offset: 0, size: 0 }
    sendPart()
  }

  return {
    /** push reads one line of the stream. */
    push(line) {
      if (!line.startsWith('~')) return
      const colon = line.indexOf(':')
      const sequence = Number(line.slice(1, colon))
      if (colon < 0 || !Number.isSafeInteger(sequence)) return
      latest = { sequence, text: line.slice(colon + 1) }
      // A screen in flight finishes first; the newest one follows it.
      if (!sending) sendLatest()
    },

    /** ack takes the renderer's acknowledgment of the part it read. */
    ack() {
      if (!sending) return
      sending.offset += sending.size
      if (sending.offset < sending.text.length) {
        sendPart()
        return
      }
      if (timer !== null) cancel(timer)
      timer = null
      const done = sending
      sending = null
      if (latest && latest.sequence !== done.sequence) sendLatest()
    },

    /** status shows a state that is not a screen, such as connecting. */
    status(text) {
      if (timer !== null) cancel(timer)
      timer = null
      sending = null
      setTitle(text)
    },

    /** reset forgets the screen, as when the stream ends. */
    reset() {
      latest = null
      this.status('')
    },
  }
}

/**
 * readLines streams the controller's screen from port and hands each complete
 * line to onLine. It resolves when the stream ends.
 */
export async function readLines(port, onLine, fetchImpl = fetch) {
  const response = await fetchImpl(`http://127.0.0.1:${port}/panorama/stream`, { cache: 'no-store' })
  if (!response.ok || !response.body) throw new Error(`stream answered ${response.status}`)
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffered = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) return
    buffered += decoder.decode(value, { stream: true })
    let newline
    while ((newline = buffered.indexOf('\n')) >= 0) {
      onLine(buffered.slice(0, newline))
      buffered = buffered.slice(newline + 1)
    }
  }
}

// In the game's HTML panel: read the port, stream, and answer acks.
if (typeof document !== 'undefined') {
  const port = Number(new URLSearchParams(location.search).get('port'))
  const bridge = createBridge({
    setTitle: (title) => { document.title = title },
    schedule: (fn, ms) => setTimeout(fn, ms),
    cancel: (handle) => clearTimeout(handle),
  })
  addEventListener('hashchange', () => bridge.ack())

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    bridge.status('modlock:bad-port')
  } else {
    const run = async () => {
      bridge.status('modlock:connecting')
      try {
        await readLines(port, (line) => bridge.push(line))
      } catch (error) {
        console.warn('[bridge]', error)
      }
      bridge.reset()
      setTimeout(run, reconnectDelay)
    }
    run()
  }
}
