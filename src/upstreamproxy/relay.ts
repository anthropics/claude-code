/* eslint-disable eslint-plugin-n/no-unsupported-features/node-builtins */
/**
 * CONNECT-over-WebSocket relay for CCR upstreamproxy.
 *
 * Listens on localhost TCP, accepts HTTP CONNECT from curl/gh/kubectl/etc,
 * and tunnels bytes over WebSocket to the CCR upstreamproxy endpoint.
 * The CCR server-side terminates the tunnel, MITMs TLS, injects org-configured
 * credentials (e.g. DD-API-KEY), and forwards to the real upstream.
 *
 * WHY WebSocket and not raw CONNECT: CCR ingress is GKE L7 with path-prefix
 * routing; there's no connect_matcher in cdk-constructs. The session-ingress
 * tunnel (sessions/tunnel/v1alpha/tunnel.proto) already uses this pattern.
 *
 * Protocol: bytes are wrapped in UpstreamProxyChunk protobuf messages
 * (`message UpstreamProxyChunk { bytes data = 1; }`) for compatibility with
 * gateway.NewWebSocketStreamAdapter on the server side.
 */

import { createServer, type Socket as NodeSocket } from 'node:net'
import { logForDebugging } from '../utils/debug.js'
import { getWebSocketTLSOptions } from '../utils/mtls.js'
import { getWebSocketProxyAgent, getWebSocketProxyUrl } from '../utils/proxy.js'

// The CCR container runs behind an egress gateway — direct outbound is
// blocked, so the WS upgrade must go through the same HTTP CONNECT proxy
// everything else uses. undici's globalThis.WebSocket does not consult
// the global dispatcher for the upgrade, so under Node we use the ws package
// with an explicit agent (same pattern as SessionsWebSocket). Bun's native
// WebSocket takes a proxy URL directly. Preloaded in startNodeRelay so
// openTunnel stays synchronous and the CONNECT state machine doesn't race.
type WSCtor = typeof import('ws').default
let nodeWSCtor: WSCtor | undefined

// Intersection of the surface openTunnel touches. Both undici's
// globalThis.WebSocket and the ws package satisfy this via property-style
// onX handlers.
type WebSocketLike = Pick<
  WebSocket,
  | 'onopen'
  | 'onmessage'
  | 'onerror'
  | 'onclose'
  | 'send'
  | 'close'
  | 'readyState'
  | 'binaryType'
>

// Envoy per-request buffer cap. Week-1 Datadog payloads won't hit this, but
// design for it so git-push doesn't need a relay rewrite.
const MAX_CHUNK_BYTES = 512 * 1024

// Sidecar idle timeout is 50s; ping well inside that.
const PING_INTERVAL_MS = 30_000

/**
 * Encode an UpstreamProxyChunk protobuf message by hand.
 *
 * For `message UpstreamProxyChunk { bytes data = 1; }` the wire format is:
 *   tag = (field_number << 3) | wire_type = (1 << 3) | 2 = 0x0a
 *   followed by varint length, followed by the bytes.
 *
 * protobufjs would be the general answer; for a single-field bytes message
 * the hand encoding is 10 lines and avoids a runtime dep in the hot path.
 */
export function encodeChunk(data: Uint8Array): Uint8Array {
  const len = data.length
  // varint encoding of length — most chunks fit in 1–3 length bytes
  const varint: number[] = []
  let n = len
  while (n > 0x7f) {
    varint.push((n & 0x7f) | 0x80)
    n >>>= 7
  }
  varint.push(n)
  const out = new Uint8Array(1 + varint.length + len)
  out[0] = 0x0a
  out.set(varint, 1)
  out.set(data, 1 + varint.length)
  return out
}

/**
 * Decode an UpstreamProxyChunk. Returns the data field, or null if malformed.
 * Tolerates the server sending a zero-length chunk (keepalive semantics).
 */
export function decodeChunk(buf: Uint8Array): Uint8Array | null {
  if (buf.length === 0) return new Uint8Array(0)
  if (buf[0] !== 0x0a) return null
  let len = 0
  let shift = 0
  let i = 1
  while (i < buf.length) {
    const b = buf[i]!
    len |= (b & 0x7f) << shift
    i++
    if ((b & 0x80) === 0) break
    shift += 7
    if (shift > 28) return null
  }
  if (i + len > buf.length) return null
  return buf.subarray(i, i + len)
}

export type UpstreamProxyRelay = {
  port: number
  stop: () => void
}

type ConnState = {
  ws?: WebSocketLike
  connectBuf: Buffer
  pinger?: ReturnType<typeof setInterval>
  // Bytes that arrived after the CONNECT header but before ws.onopen fired.
  // TCP can coalesce CONNECT + ClientHello into one packet, and the socket's
  // data callback can fire again while the WS handshake is still in flight.
  // Both cases would silently drop bytes without this buffer.
  pending: Buffer[]
  wsOpen: boolean
  // Set once the server's 200 Connection Established has been forwarded and
  // the tunnel is carrying TLS. After that, writing a plaintext 502 would
  // corrupt the client's TLS stream — just close instead.
  established: boolean
  // WS onerror is always followed by onclose; without a guard the second
  // handler would sock.end() an already-ended socket. First caller wins.
  closed: boolean
}

/**
 * Minimal socket abstraction so the CONNECT parser and WS tunnel plumbing
 * are runtime-agnostic. Implementations handle write backpressure internally:
 * Bun's sock.write() does partial writes and needs explicit tail-queueing;
 * Node's net.Socket buffers unconditionally and never drops bytes.
 */
type ClientSocket = {
  write: (data: Uint8Array | string) => void
  end: () => void
}

function newConnState(): ConnState {
  return {
    connectBuf: Buffer.alloc(0),
    pending: [],
    wsOpen: false,
    established: false,
    closed: false,
  }
}

/**
 * Start the relay. Returns the ephemeral port it bound and a stop function.
 * Uses Bun.listen when available, otherwise Node's net.createServer — the CCR
 * container runs the CLI under Node, not Bun.
 */
export async function startUpstreamProxyRelay(opts: {
  wsUrl: string
  sessionId: string
  token: string
}): Promise<UpstreamProxyRelay> {
  const authHeader =
    'Basic ' + Buffer.from(`${opts.sessionId}:${opts.token}`).toString('base64')
  // WS upgrade itself is auth-gated (proto authn: PRIVATE_API) — the gateway
  // wants the session-ingress JWT on the upgrade request, separate from the
  // Proxy-Authorization that rides inside the tunneled CONNECT.
  const wsAuthHeader = `Bearer ${opts.token}`

  const relay =
    typeof Bun !== 'undefined'
      ? startBunRelay(opts.wsUrl, authHeader, wsAuthHeader)
      : await startNodeRelay(opts.wsUrl, authHeader, wsAuthHeader)

  logForDebugging(`[upstreamproxy] relay listening on 127.0.0.1:${relay.port}`)
  return relay
}

function startBunRelay(
  wsUrl: string,
  authHeader: string,
  wsAuthHeader: string,
): UpstreamProxyRelay {
  // Bun TCP sockets don't auto-buffer partial writes: sock.write() returns
  // the byte count actually handed to the kernel, and the remainder is
  // silently dropped. When the kernel buffer fills, we queue the tail and
  // let the drain handler flush it. Per-socket because the adapter closure
  // outlives individual handler calls.
  type BunState = ConnState & { writeBuf: Uint8Array[] }

  // eslint-disable-next-line custom-rules/require-bun-typeof-guard -- caller dispatches on typeof Bun
  const server = Bun.listen<BunState>({
    hostname: '127.0.0.1',
    port: 0,
    socket: {
      open(sock) {
        sock.data = { ...newConnState(), writeBuf: [] }
      },
      data(sock, data) {
        const st = sock.data
        const adapter: ClientSocket = {
          write: payload => {
            const bytes =
              typeof payload === 'string'
                ? Buffer.from(payload, 'utf8')
                : payload
            if (st.writeBuf.length > 0) {
              st.writeBuf.push(bytes)
              return
            }
            const n = sock.write(bytes)
            if (n < bytes.length) st.writeBuf.push(bytes.subarray(n))
          },
          end: () => sock.end(),
        }
        handleData(adapter, st, data, wsUrl, authHeader, wsAuthHeader)
      },
      drain(sock) {
        const st = sock.data
        while (st.writeBuf.length > 0) {
          const chunk = st.writeBuf[0]!
          const n = sock.write(chunk)
          if (n < chunk.length) {
            st.writeBuf[0] = chunk.subarray(n)
            return
          }
          st.writeBuf.shift()
        }
      },
      close(sock) {
        cleanupConn(sock.data)
      },
      error(sock, err) {
        logForDebugging(`[upstreamproxy] client socket error: ${err.message}`)
        cleanupConn(sock.data)
      },
    },
  })

  return {
    port: server.port,
    stop: () => server.stop(true),
  }
}

// Exported so tests can exercise the Node path directly — the test runner is
// Bun, so the runtime dispatch in startUpstreamProxyRelay always picks Bun.
export async function startNodeRelay(
  wsUrl: string,
  authHeader: string,
  wsAuthHeader: string,
): Promise<UpstreamProxyRelay> {
  nodeWSCtor = (await import('ws')).default
  const states = new WeakMap<NodeSocket, ConnState>()

  const server = createServer(sock => {
    const st = newConnState()
    states.set(sock, st)
    // Node's sock.write() buffers internally — a false return signals
    // backpressure but the bytes are already queued, so no tail-tracking
    // needed for correctness. Week-1 payloads won't stress the buffer.
    const adapter: ClientSocket = {
      write: payload => {
        sock.write(typeof payload === 'string' ? payload : Buffer.from(payload))
      },
      end: () => sock.end(),
    }
    sock.on('data', data =>
      handleData(adapter, st, data, wsUrl, authHeader, wsAuthHeader),
    )
    sock.on('close', () => cleanupConn(states.get(sock)))
    sock.on('error', err => {
      logForDebugging(`[upstreamproxy] client socket error: ${err.message}`)
      cleanupConn(states.get(sock))
    })
  })

  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      if (addr === null || typeof addr === 'string') {
        reject(new Error('upstreamproxy: server has no TCP address'))
        return
      }
      resolve({
        port: addr.port,
        stop: () => server.close(),
      })
    })
  })
}

/**
 * Shared per-connection data handler. Phase 1 accumulates the CONNECT request;
 * phase 2 forwards client bytes over the WS tunnel.
 */
function handleData(
  sock: ClientSocket,
  st: ConnState,
  data: Buffer,
  wsUrl: string,
  authHeader: string,
  wsAuthHeader: string,
): void {
  // Phase 1: accumulate until we've seen the full CONNECT request
  // (terminated by CRLF CRLF). curl/gh send this in one packet, but
  // don't assume that.
  if (!st.ws) {
    st.connectBuf = Buffer.concat([st.connectBuf, data])
    const headerEnd = st.connectBuf.indexOf('\r\n\r\n')
    if (headerEnd === -1) {
      // Guard against a client that never sends CRLFCRLF.
      if (st.connectBuf.length > 8192) {
        sock.write('HTTP/1.1 400 Bad Request\r\n\r\n')
        sock.end()
      }
      return
    }
    const reqHead = st.connectBuf.subarray(0, headerEnd).toString('utf8')
    const firstLine = reqHead.split('\r\n')[0] ?? ''
    const m = firstLine.match(/^CONNECT\s+(\S+)\s+HTTP\/1\.[01]$/i)
    if (!m) {
      sock.write('HTTP/1.1 405 Method Not Allowed\r\n\r\n')
      sock.end()
      return
    }
    // Stash any bytes that arrived after the CONNECT header so
    // openTunnel can flush them once the WS is open.
    const trailing = st.connectBuf.subarray(headerEnd + 4)
    if (trailing.length > 0) {
      st.pending.push(Buffer.from(trailing))
    }
    st.connectBuf = Buffer.alloc(0)
    openTunnel(sock, st, firstLine, wsUrl, authHeader, wsAuthHeader)
    return
  }
  // Phase 2: WS exists. If it isn't OPEN yet, buffer; ws.onopen will
  // flush. Once open, pump client bytes to WS in chunks.
  if (!st.wsOpen) {
    st.pending.push(Buffer.from(data))
    return
  }
  forwardToWs(st.ws, data)
}

function openTunnel(
  sock: ClientSocket,
  st: ConnState,
  connectLine: string,
  wsUrl: string,
  authHeader: string,
  wsAuthHeader: string,
): void {
  // core/websocket/stream.go picks JSON vs binary-proto from the upgrade
  // request's Content-Type header (defaults to JSON). Without application/proto
  // the server protojson.Unmarshals our hand-encoded binary chunks and fails
  // silently with EOF.
  const headers = {
    'Content-Type': 'application/proto',
    Authorization: wsAuthHeader,
  }
  let ws: WebSocketLike
  if (nodeWSCtor) {
    ws = new nodeWSCtor(wsUrl, {
      headers,
      agent: getWebSocketProxyAgent(wsUrl),
      ...getWebSocketTLSOptions(),
    }) as unknown as WebSocketLike
  } else {
    ws = new globalThis.WebSocket(wsUrl, {
      // @ts-expect-error — Bun extension; not in lib.dom WebSocket types
      headers,
      proxy: getWebSocketProxyUrl(wsUrl),
      tls: getWebSocketTLSOptions() || undefined,
    })
  }
  ws.binaryType = 'arraybuffer'
  st.ws = ws

  ws.onopen = () => {
    // First chunk carries the CONNECT line plus Proxy-Authorization so the
    // server can auth the tunnel and know the target host:port. Server
    // responds with its own "HTTP/1.1 200" over the tunnel; we just pipe it.
    const head =
      `${connectLine}\r\n` + `Proxy-Authorization: ${authHeader}\r\n` + `\r\n`
    ws.send(encodeChunk(Buffer.from(head, 'utf8')))
    // Flush anything that arrived while the WS handshake was in flight —
    // trailing bytes from the CONNECT packet and any data() callbacks that
    // fired before onopen.
    st.wsOpen = true
    for (const buf of st.pending) {
      forwardToWs(ws, buf)
    }
    st.pending = []
    // Not all WS implementations expose ping(); empty chunk works as an
    // application-level keepalive the server can ignore.
    st.pinger = setInterval(sendKeepalive, PING_INTERVAL_MS, ws)
  }

  ws.onmessage = ev => {
    const raw =
      ev.data instanceof ArrayBuffer
        ? new Uint8Array(ev.data)
        : new Uint8Array(Buffer.from(ev.data))
    const payload = decodeChunk(raw)
    if (payload && payload.length > 0) {
      st.established = true
      sock.write(payload)
    }
  }

  ws.onerror = ev => {
    const msg = 'message' in ev ? String(ev.message) : 'websocket error'
    logForDebugging(`[upstreamproxy] ws error: ${msg}`)
    if (st.closed) return
    st.closed = true
    if (!st.established) {
      sock.write('HTTP/1.1 502 Bad Gateway\r\n\r\n')
    }
    sock.end()
    cleanupConn(st)
  }

  ws.onclose = () => {
    if (st.closed) return
    st.closed = true
    sock.end()
    cleanupConn(st)
  }
}

function sendKeepalive(ws: WebSocketLike): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(encodeChunk(new Uint8Array(0)))
  }
}

function forwardToWs(ws: WebSocketLike, data: Buffer): void {
  if (ws.readyState !== WebSocket.OPEN) return
  for (let off = 0; off < data.length; off += MAX_CHUNK_BYTES) {
    const slice = data.subarray(off, off + MAX_CHUNK_BYTES)
    ws.send(encodeChunk(slice))
  }
}

function cleanupConn(st: ConnState | undefined): void {
  if (!st) return
  if (st.pinger) clearInterval(st.pinger)
  if (st.ws && st.ws.readyState <= WebSocket.OPEN) {
    try {
      st.ws.close()
    } catch {
      // already closing
    }
  }
  st.ws = undefined
}
