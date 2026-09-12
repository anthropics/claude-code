// biome-ignore-all lint/suspicious/noConsole: file uses console intentionally
/**
 * Chrome Native Host - Pure TypeScript Implementation
 *
 * This module provides the Chrome native messaging host functionality,
 * previously implemented as a Rust NAPI binding but now in pure TypeScript.
 */

import {
  appendFile,
  chmod,
  mkdir,
  readdir,
  rmdir,
  stat,
  unlink,
} from 'fs/promises'
import { createServer, type Server, type Socket } from 'net'
import { homedir, platform } from 'os'
import { join } from 'path'
import { z } from 'zod'
import { lazySchema } from '../lazySchema.js'
import { jsonParse, jsonStringify } from '../slowOperations.js'
import { getSecureSocketPath, getSocketDir } from './common.js'

const VERSION = '1.0.0'
const MAX_MESSAGE_SIZE = 1024 * 1024 // 1MB - Max message size that can be sent to Chrome

const LOG_FILE =
  process.env.USER_TYPE === 'ant'
    ? join(homedir(), '.claude', 'debug', 'chrome-native-host.txt')
    : undefined

function log(message: string, ...args: unknown[]): void {
  if (LOG_FILE) {
    const timestamp = new Date().toISOString()
    const formattedArgs = args.length > 0 ? ' ' + jsonStringify(args) : ''
    const logLine = `[${timestamp}] [Claude Chrome Native Host] ${message}${formattedArgs}\n`
    // Fire-and-forget: logging is best-effort and callers (including event
    // handlers) don't await
    void appendFile(LOG_FILE, logLine).catch(() => {
      // Ignore file write errors
    })
  }
  console.error(`[Claude Chrome Native Host] ${message}`, ...args)
}
/**
 * Send a message to stdout (Chrome native messaging protocol)
 */
export function sendChromeMessage(message: string): void {
  const jsonBytes = Buffer.from(message, 'utf-8')
  const lengthBuffer = Buffer.alloc(4)
  lengthBuffer.writeUInt32LE(jsonBytes.length, 0)

  process.stdout.write(lengthBuffer)
  process.stdout.write(jsonBytes)
}

export async function runChromeNativeHost(): Promise<void> {
  log('Initializing...')

  const host = new ChromeNativeHost()
  const messageReader = new ChromeMessageReader()

  // Start the native host server
  await host.start()

  // Process messages from Chrome until stdin closes
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    const message = await messageReader.read()
    if (message === null) {
      // stdin closed, Chrome disconnected
      break
    }

    await host.handleMessage(message)
  }

  // Stop the server
  await host.stop()
}

const messageSchema = lazySchema(() =>
  z
    .object({
      type: z.string(),
    })
    .passthrough(),
)

type ToolRequest = {
  method: string
  params?: unknown
}

type McpClient = {
  id: number
  socket: Socket
  buffer: Buffer
}

class ChromeNativeHost {
  private mcpClients = new Map<number, McpClient>()
  private nextClientId = 1
  private server: Server | null = null
  private running = false
  private socketPath: string | null = null

  async start(): Promise<void> {
    if (this.running) {
      return
    }

    this.socketPath = getSecureSocketPath()

    if (platform() !== 'win32') {
      const socketDir = getSocketDir()

      // Migrate legacy socket: if socket dir path exists as a file/socket, remove it
      try {
        const dirStats = await stat(socketDir)
        if (!dirStats.isDirectory()) {
          await unlink(socketDir)
        }
      } catch {
        // Doesn't exist, that's fine
      }

      // Create socket directory with secure permissions
      await mkdir(socketDir, { recursive: true, mode: 0o700 })

      // Fix perms if directory already existed
      await chmod(socketDir, 0o700).catch(() => {
        // Ignore
      })

      // Clean up stale sockets
      try {
        const files = await readdir(socketDir)
        for (const file of files) {
          if (!file.endsWith('.sock')) {
            continue
          }
          const pid = parseInt(file.replace('.sock', ''), 10)
          if (isNaN(pid)) {
            continue
          }
          try {
            process.kill(pid, 0)
            // Process is alive, leave it
          } catch {
            // Process is dead, remove stale socket
            await unlink(join(socketDir, file)).catch(() => {
              // Ignore
            })
            log(`Removed stale socket for PID ${pid}`)
          }
        }
      } catch {
        // Ignore errors scanning directory
      }
    }

    log(`Creating socket listener: ${this.socketPath}`)

    this.server = createServer(socket => this.handleMcpClient(socket))

    await new Promise<void>((resolve, reject) => {
      this.server!.listen(this.socketPath!, () => {
        log('Socket server listening for connections')
        this.running = true
        resolve()
      })

      this.server!.on('error', err => {
        log('Socket server error:', err)
        reject(err)
      })
    })

    // Set permissions on Unix (after listen resolves so socket file exists)
    if (platform() !== 'win32') {
      try {
        await chmod(this.socketPath!, 0o600)
        log('Socket permissions set to 0600')
      } catch (e) {
        log('Failed to set socket permissions:', e)
      }
    }
  }

  async stop(): Promise<void> {
    if (!this.running) {
      return
    }

    // Close all MCP clients
    for (const [, client] of this.mcpClients) {
      client.socket.destroy()
    }
    this.mcpClients.clear()

    // Close server
    if (this.server) {
      await new Promise<void>(resolve => {
        this.server!.close(() => resolve())
      })
      this.server = null
    }

    // Cleanup socket file
    if (platform() !== 'win32' && this.socketPath) {
      try {
        await unlink(this.socketPath)
        log('Cleaned up socket file')
      } catch {
        // ENOENT is fine, ignore
      }

      // Remove directory if empty
      try {
        const socketDir = getSocketDir()
        const remaining = await readdir(socketDir)
        if (remaining.length === 0) {
          await rmdir(socketDir)
          log('Removed empty socket directory')
        }
      } catch {
        // Ignore
      }
    }

    this.running = false
  }

  async isRunning(): Promise<boolean> {
    return this.running
  }

  async getClientCount(): Promise<number> {
    return this.mcpClients.size
  }

  async handleMessage(messageJson: string): Promise<void> {
    let rawMessage: unknown
    try {
      rawMessage = jsonParse(messageJson)
    } catch (e) {
      log('Invalid JSON from Chrome:', (e as Error).message)
      sendChromeMessage(
        jsonStringify({
          type: 'error',
          error: 'Invalid message format',
        }),
      )
      return
    }
    const parsed = messageSchema().safeParse(rawMessage)
    if (!parsed.success) {
      log('Invalid message from Chrome:', parsed.error.message)
      sendChromeMessage(
        jsonStringify({
          type: 'error',
          error: 'Invalid message format',
        }),
      )
      return
    }
    const message = parsed.data

    log(`Handling Chrome message type: ${message.type}`)

    switch (message.type) {
      case 'ping':
        log('Responding to ping')

        sendChromeMessage(
          jsonStringify({
            type: 'pong',
            timestamp: Date.now(),
          }),
        )
        break

      case 'get_status':
        sendChromeMessage(
          jsonStringify({
            type: 'status_response',
            native_host_version: VERSION,
          }),
        )
        break

      case 'tool_response': {
        if (this.mcpClients.size > 0) {
          log(`Forwarding tool response to ${this.mcpClients.size} MCP clients`)

          // Extract the data portion (everything except 'type')
          const { type: _, ...data } = message
          const responseData = Buffer.from(jsonStringify(data), 'utf-8')
          const lengthBuffer = Buffer.alloc(4)
          lengthBuffer.writeUInt32LE(responseData.length, 0)
          const responseMsg = Buffer.concat([lengthBuffer, responseData])

          for (const [id, client] of this.mcpClients) {
            try {
              client.socket.write(responseMsg)
            } catch (e) {
              log(`Failed to send to MCP client ${id}:`, e)
            }
          }
        }
        break
      }

      case 'notification': {
        if (this.mcpClients.size > 0) {
          log(`Forwarding notification to ${this.mcpClients.size} MCP clients`)

          // Extract the data portion (everything except 'type')
          const { type: _, ...data } = message
          const notificationData = Buffer.from(jsonStringify(data), 'utf-8')
          const lengthBuffer = Buffer.alloc(4)
          lengthBuffer.writeUInt32LE(notificationData.length, 0)
          const notificationMsg = Buffer.concat([
            lengthBuffer,
            notificationData,
          ])

          for (const [id, client] of this.mcpClients) {
            try {
              client.socket.write(notificationMsg)
            } catch (e) {
              log(`Failed to send notification to MCP client ${id}:`, e)
            }
          }
        }
        break
      }

      default:
        log(`Unknown message type: ${message.type}`)

        sendChromeMessage(
          jsonStringify({
            type: 'error',
            error: `Unknown message type: ${message.type}`,
          }),
        )
    }
  }

  private handleMcpClient(socket: Socket): void {
    const clientId = this.nextClientId++
    const client: McpClient = {
      id: clientId,
      socket,
      buffer: Buffer.alloc(0),
    }

    this.mcpClients.set(clientId, client)
    log(
      `MCP client ${clientId} connected. Total clients: ${this.mcpClients.size}`,
    )

    // Notify Chrome of connection
    sendChromeMessage(
      jsonStringify({
        type: 'mcp_connected',
      }),
    )

    socket.on('data', (data: Buffer) => {
      client.buffer = Buffer.concat([client.buffer, data])

      // Process complete messages
      while (client.buffer.length >= 4) {
        const length = client.buffer.readUInt32LE(0)

        if (length === 0 || length > MAX_MESSAGE_SIZE) {
          log(`Invalid message length from MCP client ${clientId}: ${length}`)
          socket.destroy()
          return
        }

        if (client.buffer.length < 4 + length) {
          break // Wait for more data
        }

        const messageBytes = client.buffer.slice(4, 4 + length)
        client.buffer = client.buffer.slice(4 + length)

        try {
          const request = jsonParse(
            messageBytes.toString('utf-8'),
          ) as ToolRequest
          log(
            `Forwarding tool request from MCP client ${clientId}: ${request.method}`,
          )

          // Forward to Chrome
          sendChromeMessage(
            jsonStringify({
              type: 'tool_request',
              method: request.method,
              params: request.params,
            }),
          )
        } catch (e) {
          log(`Failed to parse tool request from MCP client ${clientId}:`, e)
        }
      }
    })

    socket.on('error', err => {
      log(`MCP client ${clientId} error: ${err}`)
    })

    socket.on('close', () => {
      log(
        `MCP client ${clientId} disconnected. Remaining clients: ${this.mcpClients.size - 1}`,
      )
      this.mcpClients.delete(clientId)

      // Notify Chrome of disconnection
      sendChromeMessage(
        jsonStringify({
          type: 'mcp_disconnected',
        }),
      )
    })
  }
}

/**
 * Chrome message reader using async stdin. Synchronous reads can crash Bun, so we use
 * async reads with a buffer.
 */
class ChromeMessageReader {
  private buffer = Buffer.alloc(0)
  private pendingResolve: ((value: string | null) => void) | null = null
  private closed = false

  constructor() {
    process.stdin.on('data', (chunk: Buffer) => {
      this.buffer = Buffer.concat([this.buffer, chunk])
      this.tryProcessMessage()
    })

    process.stdin.on('end', () => {
      this.closed = true
      if (this.pendingResolve) {
        this.pendingResolve(null)
        this.pendingResolve = null
      }
    })

    process.stdin.on('error', () => {
      this.closed = true
      if (this.pendingResolve) {
        this.pendingResolve(null)
        this.pendingResolve = null
      }
    })
  }

  private tryProcessMessage(): void {
    if (!this.pendingResolve) {
      return
    }

    // Need at least 4 bytes for length prefix
    if (this.buffer.length < 4) {
      return
    }

    const length = this.buffer.readUInt32LE(0)

    if (length === 0 || length > MAX_MESSAGE_SIZE) {
      log(`Invalid message length: ${length}`)
      this.pendingResolve(null)
      this.pendingResolve = null
      return
    }

    // Check if we have the full message
    if (this.buffer.length < 4 + length) {
      return // Wait for more data
    }

    // Extract the message
    const messageBytes = this.buffer.subarray(4, 4 + length)
    this.buffer = this.buffer.subarray(4 + length)

    const message = messageBytes.toString('utf-8')
    this.pendingResolve(message)
    this.pendingResolve = null
  }

  async read(): Promise<string | null> {
    if (this.closed) {
      return null
    }

    // Check if we already have a complete message buffered
    if (this.buffer.length >= 4) {
      const length = this.buffer.readUInt32LE(0)
      if (
        length > 0 &&
        length <= MAX_MESSAGE_SIZE &&
        this.buffer.length >= 4 + length
      ) {
        const messageBytes = this.buffer.subarray(4, 4 + length)
        this.buffer = this.buffer.subarray(4 + length)
        return messageBytes.toString('utf-8')
      }
    }

    // Wait for more data
    return new Promise(resolve => {
      this.pendingResolve = resolve
      // In case data arrived between check and setting pendingResolve
      this.tryProcessMessage()
    })
  }
}
