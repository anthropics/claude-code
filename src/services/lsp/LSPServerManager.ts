import * as path from 'path'
import { pathToFileURL } from 'url'
import { logForDebugging } from '../../utils/debug.js'
import { errorMessage } from '../../utils/errors.js'
import { logError } from '../../utils/log.js'
import { getAllLspServers } from './config.js'
import {
  createLSPServerInstance,
  type LSPServerInstance,
} from './LSPServerInstance.js'
import type { ScopedLspServerConfig } from './types.js'
/**
 * LSP Server Manager interface returned by createLSPServerManager.
 * Manages multiple LSP server instances and routes requests based on file extensions.
 */
export type LSPServerManager = {
  /** Initialize the manager by loading all configured LSP servers */
  initialize(): Promise<void>
  /** Shutdown all running servers and clear state */
  shutdown(): Promise<void>
  /** Get the LSP server instance for a given file path */
  getServerForFile(filePath: string): LSPServerInstance | undefined
  /** Ensure the appropriate LSP server is started for the given file */
  ensureServerStarted(filePath: string): Promise<LSPServerInstance | undefined>
  /** Send a request to the appropriate LSP server for the given file */
  sendRequest<T>(
    filePath: string,
    method: string,
    params: unknown,
  ): Promise<T | undefined>
  /** Get all running server instances */
  getAllServers(): Map<string, LSPServerInstance>
  /** Synchronize file open to LSP server (sends didOpen notification) */
  openFile(filePath: string, content: string): Promise<void>
  /** Synchronize file change to LSP server (sends didChange notification) */
  changeFile(filePath: string, content: string): Promise<void>
  /** Synchronize file save to LSP server (sends didSave notification) */
  saveFile(filePath: string): Promise<void>
  /** Synchronize file close to LSP server (sends didClose notification) */
  closeFile(filePath: string): Promise<void>
  /** Check if a file is already open on a compatible LSP server */
  isFileOpen(filePath: string): boolean
}

/**
 * Creates an LSP server manager instance.
 *
 * Manages multiple LSP server instances and routes requests based on file extensions.
 * Uses factory function pattern with closures for state encapsulation (avoiding classes).
 *
 * @returns LSP server manager instance
 *
 * @example
 * const manager = createLSPServerManager()
 * await manager.initialize()
 * const result = await manager.sendRequest('/path/to/file.ts', 'textDocument/definition', params)
 * await manager.shutdown()
 */
export function createLSPServerManager(): LSPServerManager {
  // Private state managed via closures
  const servers: Map<string, LSPServerInstance> = new Map()
  const extensionMap: Map<string, string[]> = new Map()
  // Track which files have been opened on which servers (URI -> server name)
  const openedFiles: Map<string, string> = new Map()

  /**
   * Initialize the manager by loading all configured LSP servers.
   *
   * @throws {Error} If configuration loading fails
   */
  async function initialize(): Promise<void> {
    let serverConfigs: Record<string, ScopedLspServerConfig>

    try {
      const result = await getAllLspServers()
      serverConfigs = result.servers
      logForDebugging(
        `[LSP SERVER MANAGER] getAllLspServers returned ${Object.keys(serverConfigs).length} server(s)`,
      )
    } catch (error) {
      const err = error as Error
      logError(
        new Error(`Failed to load LSP server configuration: ${err.message}`),
      )
      throw error
    }

    // Build extension → server mapping
    for (const [serverName, config] of Object.entries(serverConfigs)) {
      try {
        // Validate config before using it
        if (!config.command) {
          throw new Error(
            `Server ${serverName} missing required 'command' field`,
          )
        }
        if (
          !config.extensionToLanguage ||
          Object.keys(config.extensionToLanguage).length === 0
        ) {
          throw new Error(
            `Server ${serverName} missing required 'extensionToLanguage' field`,
          )
        }

        // Map file extensions to this server (derive from extensionToLanguage)
        const fileExtensions = Object.keys(config.extensionToLanguage)
        for (const ext of fileExtensions) {
          const normalized = ext.toLowerCase()
          if (!extensionMap.has(normalized)) {
            extensionMap.set(normalized, [])
          }
          const serverList = extensionMap.get(normalized)
          if (serverList) {
            serverList.push(serverName)
          }
        }

        // Create server instance
        const instance = createLSPServerInstance(serverName, config)
        servers.set(serverName, instance)

        // Register handler for workspace/configuration requests from the server
        // Some servers (like TypeScript) send these even when we say we don't support them
        instance.onRequest(
          'workspace/configuration',
          (params: { items: Array<{ section?: string }> }) => {
            logForDebugging(
              `LSP: Received workspace/configuration request from ${serverName}`,
            )
            // Return empty/null config for each requested item
            // This satisfies the protocol without providing actual configuration
            return params.items.map(() => null)
          },
        )
      } catch (error) {
        const err = error as Error
        logError(
          new Error(
            `Failed to initialize LSP server ${serverName}: ${err.message}`,
          ),
        )
        // Continue with other servers - don't fail entire initialization
      }
    }

    logForDebugging(`LSP manager initialized with ${servers.size} servers`)
  }

  /**
   * Shutdown all running servers and clear state.
   * Only servers in 'running' state are explicitly stopped;
   * servers in other states are cleared without shutdown.
   *
   * @throws {Error} If one or more servers fail to stop
   */
  async function shutdown(): Promise<void> {
    const toStop = Array.from(servers.entries()).filter(
      ([, s]) => s.state === 'running' || s.state === 'error',
    )

    const results = await Promise.allSettled(
      toStop.map(([, server]) => server.stop()),
    )

    servers.clear()
    extensionMap.clear()
    openedFiles.clear()

    const errors = results
      .map((r, i) =>
        r.status === 'rejected'
          ? `${toStop[i]![0]}: ${errorMessage(r.reason)}`
          : null,
      )
      .filter((e): e is string => e !== null)

    if (errors.length > 0) {
      const err = new Error(
        `Failed to stop ${errors.length} LSP server(s): ${errors.join('; ')}`,
      )
      logError(err)
      throw err
    }
  }

  /**
   * Get the LSP server instance for a given file path.
   * If multiple servers handle the same extension, returns the first registered server.
   * Returns undefined if no server handles this file type.
   */
  function getServerForFile(filePath: string): LSPServerInstance | undefined {
    const ext = path.extname(filePath).toLowerCase()
    const serverNames = extensionMap.get(ext)

    if (!serverNames || serverNames.length === 0) {
      return undefined
    }

    // Use first server (can add priority later)
    const serverName = serverNames[0]
    if (!serverName) {
      return undefined
    }

    return servers.get(serverName)
  }

  /**
   * Ensure the appropriate LSP server is started for the given file.
   * Returns undefined if no server handles this file type.
   *
   * @throws {Error} If server fails to start
   */
  async function ensureServerStarted(
    filePath: string,
  ): Promise<LSPServerInstance | undefined> {
    const server = getServerForFile(filePath)
    if (!server) return undefined

    if (server.state === 'stopped' || server.state === 'error') {
      try {
        await server.start()
      } catch (error) {
        const err = error as Error
        logError(
          new Error(
            `Failed to start LSP server for file ${filePath}: ${err.message}`,
          ),
        )
        throw error
      }
    }

    return server
  }

  /**
   * Send a request to the appropriate LSP server for the given file.
   * Returns undefined if no server handles this file type.
   *
   * @throws {Error} If server fails to start or request fails
   */
  async function sendRequest<T>(
    filePath: string,
    method: string,
    params: unknown,
  ): Promise<T | undefined> {
    const server = await ensureServerStarted(filePath)
    if (!server) return undefined

    try {
      return await server.sendRequest<T>(method, params)
    } catch (error) {
      const err = error as Error
      logError(
        new Error(
          `LSP request failed for file ${filePath}, method '${method}': ${err.message}`,
        ),
      )
      throw error
    }
  }

  // Return public interface
  function getAllServers(): Map<string, LSPServerInstance> {
    return servers
  }

  async function openFile(filePath: string, content: string): Promise<void> {
    const server = await ensureServerStarted(filePath)
    if (!server) return

    const fileUri = pathToFileURL(path.resolve(filePath)).href

    // Skip if already opened on this server
    if (openedFiles.get(fileUri) === server.name) {
      logForDebugging(
        `LSP: File already open, skipping didOpen for ${filePath}`,
      )
      return
    }

    // Get language ID from server's extensionToLanguage mapping
    const ext = path.extname(filePath).toLowerCase()
    const languageId = server.config.extensionToLanguage[ext] || 'plaintext'

    try {
      await server.sendNotification('textDocument/didOpen', {
        textDocument: {
          uri: fileUri,
          languageId,
          version: 1,
          text: content,
        },
      })
      // Track that this file is now open on this server
      openedFiles.set(fileUri, server.name)
      logForDebugging(
        `LSP: Sent didOpen for ${filePath} (languageId: ${languageId})`,
      )
    } catch (error) {
      const err = new Error(
        `Failed to sync file open ${filePath}: ${errorMessage(error)}`,
      )
      logError(err)
      // Re-throw to propagate error to caller
      throw err
    }
  }

  async function changeFile(filePath: string, content: string): Promise<void> {
    const server = getServerForFile(filePath)
    if (!server || server.state !== 'running') {
      return openFile(filePath, content)
    }

    const fileUri = pathToFileURL(path.resolve(filePath)).href

    // If file hasn't been opened on this server yet, open it first
    // LSP servers require didOpen before didChange
    if (openedFiles.get(fileUri) !== server.name) {
      return openFile(filePath, content)
    }

    try {
      await server.sendNotification('textDocument/didChange', {
        textDocument: {
          uri: fileUri,
          version: 1,
        },
        contentChanges: [{ text: content }],
      })
      logForDebugging(`LSP: Sent didChange for ${filePath}`)
    } catch (error) {
      const err = new Error(
        `Failed to sync file change ${filePath}: ${errorMessage(error)}`,
      )
      logError(err)
      // Re-throw to propagate error to caller
      throw err
    }
  }

  /**
   * Save a file in LSP servers (sends didSave notification)
   * Called after file is written to disk to trigger diagnostics
   */
  async function saveFile(filePath: string): Promise<void> {
    const server = getServerForFile(filePath)
    if (!server || server.state !== 'running') return

    try {
      await server.sendNotification('textDocument/didSave', {
        textDocument: {
          uri: pathToFileURL(path.resolve(filePath)).href,
        },
      })
      logForDebugging(`LSP: Sent didSave for ${filePath}`)
    } catch (error) {
      const err = new Error(
        `Failed to sync file save ${filePath}: ${errorMessage(error)}`,
      )
      logError(err)
      // Re-throw to propagate error to caller
      throw err
    }
  }

  /**
   * Close a file in LSP servers (sends didClose notification)
   *
   * NOTE: Currently available but not yet integrated with compact flow.
   * TODO: Integrate with compact - call closeFile() when compact removes files from context
   * This will notify LSP servers that files are no longer in active use.
   */
  async function closeFile(filePath: string): Promise<void> {
    const server = getServerForFile(filePath)
    if (!server || server.state !== 'running') return

    const fileUri = pathToFileURL(path.resolve(filePath)).href

    try {
      await server.sendNotification('textDocument/didClose', {
        textDocument: {
          uri: fileUri,
        },
      })
      // Remove from tracking so file can be reopened later
      openedFiles.delete(fileUri)
      logForDebugging(`LSP: Sent didClose for ${filePath}`)
    } catch (error) {
      const err = new Error(
        `Failed to sync file close ${filePath}: ${errorMessage(error)}`,
      )
      logError(err)
      // Re-throw to propagate error to caller
      throw err
    }
  }

  function isFileOpen(filePath: string): boolean {
    const fileUri = pathToFileURL(path.resolve(filePath)).href
    return openedFiles.has(fileUri)
  }

  return {
    initialize,
    shutdown,
    getServerForFile,
    ensureServerStarted,
    sendRequest,
    getAllServers,
    openFile,
    changeFile,
    saveFile,
    closeFile,
    isFileOpen,
  }
}
