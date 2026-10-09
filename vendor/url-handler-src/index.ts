import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

type UrlHandlerNapi = {
  waitForUrlEvent(timeoutMs: number): string | null
}

let cachedModule: UrlHandlerNapi | null = null

function loadModule(): UrlHandlerNapi | null {
  if (cachedModule) {
    return cachedModule
  }

  // Only works on macOS
  if (process.platform !== 'darwin') {
    return null
  }

  try {
    if (process.env.URL_HANDLER_NODE_PATH) {
      // Bundled mode - use the env var path
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      cachedModule = require(process.env.URL_HANDLER_NODE_PATH) as UrlHandlerNapi
    } else {
      // Dev mode - load from vendor directory
      const modulePath = join(
        dirname(fileURLToPath(import.meta.url)),
        '..',
        'url-handler',
        `${process.arch}-darwin`,
        'url-handler.node',
      )
      cachedModule = createRequire(import.meta.url)(modulePath) as UrlHandlerNapi
    }
    return cachedModule
  } catch {
    return null
  }
}

/**
 * Wait for a macOS URL event (Apple Event kAEGetURL).
 *
 * Initializes NSApplication, registers for the URL event, and pumps
 * the event loop for up to `timeoutMs` milliseconds.
 *
 * Returns the URL string if one was received, or null.
 * Only functional on macOS — returns null on other platforms.
 */
export function waitForUrlEvent(timeoutMs: number): string | null {
  const mod = loadModule()
  if (!mod) {
    return null
  }
  return mod.waitForUrlEvent(timeoutMs)
}
