import type * as https from 'https'
import { Agent as HttpsAgent } from 'https'
import memoize from 'lodash-es/memoize.js'
import type * as tls from 'tls'
import type * as undici from 'undici'
import { getCACertificates } from './caCerts.js'
import { logForDebugging } from './debug.js'
import { getFsImplementation } from './fsOperations.js'

export type MTLSConfig = {
  cert?: string
  key?: string
  passphrase?: string
}

export type TLSConfig = MTLSConfig & {
  ca?: string | string[] | Buffer
}

/**
 * Get mTLS configuration from environment variables
 */
export const getMTLSConfig = memoize((): MTLSConfig | undefined => {
  const config: MTLSConfig = {}

  // Note: NODE_EXTRA_CA_CERTS is automatically handled by Node.js at runtime
  // We don't need to manually load it - Node.js appends it to the built-in CAs automatically

  // Client certificate
  if (process.env.CLAUDE_CODE_CLIENT_CERT) {
    try {
      config.cert = getFsImplementation().readFileSync(
        process.env.CLAUDE_CODE_CLIENT_CERT,
        { encoding: 'utf8' },
      )
      logForDebugging(
        'mTLS: Loaded client certificate from CLAUDE_CODE_CLIENT_CERT',
      )
    } catch (error) {
      logForDebugging(`mTLS: Failed to load client certificate: ${error}`, {
        level: 'error',
      })
    }
  }

  // Client key
  if (process.env.CLAUDE_CODE_CLIENT_KEY) {
    try {
      config.key = getFsImplementation().readFileSync(
        process.env.CLAUDE_CODE_CLIENT_KEY,
        { encoding: 'utf8' },
      )
      logForDebugging('mTLS: Loaded client key from CLAUDE_CODE_CLIENT_KEY')
    } catch (error) {
      logForDebugging(`mTLS: Failed to load client key: ${error}`, {
        level: 'error',
      })
    }
  }

  // Key passphrase
  if (process.env.CLAUDE_CODE_CLIENT_KEY_PASSPHRASE) {
    config.passphrase = process.env.CLAUDE_CODE_CLIENT_KEY_PASSPHRASE
    logForDebugging('mTLS: Using client key passphrase')
  }

  // Only return config if at least one option is set
  if (Object.keys(config).length === 0) {
    return undefined
  }

  return config
})

/**
 * Create an HTTPS agent with mTLS configuration
 */
export const getMTLSAgent = memoize((): HttpsAgent | undefined => {
  const mtlsConfig = getMTLSConfig()
  const caCerts = getCACertificates()

  if (!mtlsConfig && !caCerts) {
    return undefined
  }

  const agentOptions: https.AgentOptions = {
    ...mtlsConfig,
    ...(caCerts && { ca: caCerts }),
    // Enable keep-alive for better performance
    keepAlive: true,
  }

  logForDebugging('mTLS: Creating HTTPS agent with custom certificates')
  return new HttpsAgent(agentOptions)
})

/**
 * Get TLS options for WebSocket connections
 */
export function getWebSocketTLSOptions(): tls.ConnectionOptions | undefined {
  const mtlsConfig = getMTLSConfig()
  const caCerts = getCACertificates()

  if (!mtlsConfig && !caCerts) {
    return undefined
  }

  return {
    ...mtlsConfig,
    ...(caCerts && { ca: caCerts }),
  }
}

/**
 * Get fetch options with TLS configuration (mTLS + CA certs) for undici
 */
export function getTLSFetchOptions(): {
  tls?: TLSConfig
  dispatcher?: undici.Dispatcher
} {
  const mtlsConfig = getMTLSConfig()
  const caCerts = getCACertificates()

  if (!mtlsConfig && !caCerts) {
    return {}
  }

  const tlsConfig: TLSConfig = {
    ...mtlsConfig,
    ...(caCerts && { ca: caCerts }),
  }

  if (typeof Bun !== 'undefined') {
    return { tls: tlsConfig }
  }
  logForDebugging('TLS: Created undici agent with custom certificates')
  // Create a custom undici Agent with TLS options. Lazy-required so that
  // the ~1.5MB undici package is only loaded when mTLS/CA certs are configured.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const undiciMod = require('undici') as typeof undici
  const agent = new undiciMod.Agent({
    connect: {
      cert: tlsConfig.cert,
      key: tlsConfig.key,
      passphrase: tlsConfig.passphrase,
      ...(tlsConfig.ca && { ca: tlsConfig.ca }),
    },
    pipelining: 1,
  })

  return { dispatcher: agent }
}

/**
 * Clear the mTLS configuration cache.
 */
export function clearMTLSCache(): void {
  getMTLSConfig.cache.clear?.()
  getMTLSAgent.cache.clear?.()
  logForDebugging('Cleared mTLS configuration cache')
}

/**
 * Configure global Node.js TLS settings
 */
export function configureGlobalMTLS(): void {
  const mtlsConfig = getMTLSConfig()

  if (!mtlsConfig) {
    return
  }

  // NODE_EXTRA_CA_CERTS is automatically handled by Node.js at runtime
  if (process.env.NODE_EXTRA_CA_CERTS) {
    logForDebugging(
      'NODE_EXTRA_CA_CERTS detected - Node.js will automatically append to built-in CAs',
    )
  }
}
