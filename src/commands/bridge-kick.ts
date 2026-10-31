import { getBridgeDebugHandle } from '../bridge/bridgeDebug.js'
import type { Command } from '../commands.js'
import type { LocalCommandCall } from '../types/command.js'

/**
 * Ant-only: inject bridge failure states to manually test recovery paths.
 *
 *   /bridge-kick close 1002            — fire ws_closed with code 1002
 *   /bridge-kick close 1006            — fire ws_closed with code 1006
 *   /bridge-kick poll 404              — next poll throws 404/not_found_error
 *   /bridge-kick poll 404 <type>       — next poll throws 404 with error_type
 *   /bridge-kick poll 401              — next poll throws 401 (auth)
 *   /bridge-kick poll transient        — next poll throws axios-style rejection
 *   /bridge-kick register fail         — next register (inside doReconnect) transient-fails
 *   /bridge-kick register fail 3       — next 3 registers transient-fail
 *   /bridge-kick register fatal        — next register 403s (terminal)
 *   /bridge-kick reconnect-session fail — POST /bridge/reconnect fails (→ Strategy 2)
 *   /bridge-kick heartbeat 401         — next heartbeat 401s (JWT expired)
 *   /bridge-kick reconnect             — call doReconnect directly (= SIGUSR2)
 *   /bridge-kick status                — print current bridge state
 *
 * Workflow: connect Remote Control, run a subcommand, `tail -f debug.log`
 * and watch [bridge:repl] / [bridge:debug] lines for the recovery reaction.
 *
 * Composite sequences — the failure modes in the BQ data are chains, not
 * single events. Queue faults then fire the trigger:
 *
 *   # #22148 residual: ws_closed → register transient-blips → teardown?
 *   /bridge-kick register fail 2
 *   /bridge-kick close 1002
 *   → expect: doReconnect tries register, fails, returns false → teardown
 *     (demonstrates the retry gap that needs fixing)
 *
 *   # Dead gate: poll 404/not_found_error → does onEnvironmentLost fire?
 *   /bridge-kick poll 404
 *   → expect: tengu_bridge_repl_fatal_error (gate is dead — 147K/wk)
 *     after fix: tengu_bridge_repl_env_lost → doReconnect
 */

const USAGE = `/bridge-kick <subcommand>
  close <code>              fire ws_closed with the given code (e.g. 1002)
  poll <status> [type]      next poll throws BridgeFatalError(status, type)
  poll transient            next poll throws axios-style rejection (5xx/net)
  register fail [N]         next N registers transient-fail (default 1)
  register fatal            next register 403s (terminal)
  reconnect-session fail    next POST /bridge/reconnect fails
  heartbeat <status>        next heartbeat throws BridgeFatalError(status)
  reconnect                 call reconnectEnvironmentWithSession directly
  status                    print bridge state`

const call: LocalCommandCall = async args => {
  const h = getBridgeDebugHandle()
  if (!h) {
    return {
      type: 'text',
      value:
        'No bridge debug handle registered. Remote Control must be connected (USER_TYPE=ant).',
    }
  }

  const [sub, a, b] = args.trim().split(/\s+/)

  switch (sub) {
    case 'close': {
      const code = Number(a)
      if (!Number.isFinite(code)) {
        return { type: 'text', value: `close: need a numeric code\n${USAGE}` }
      }
      h.fireClose(code)
      return {
        type: 'text',
        value: `Fired transport close(${code}). Watch debug.log for [bridge:repl] recovery.`,
      }
    }

    case 'poll': {
      if (a === 'transient') {
        h.injectFault({
          method: 'pollForWork',
          kind: 'transient',
          status: 503,
          count: 1,
        })
        h.wakePollLoop()
        return {
          type: 'text',
          value:
            'Next poll will throw a transient (axios rejection). Poll loop woken.',
        }
      }
      const status = Number(a)
      if (!Number.isFinite(status)) {
        return {
          type: 'text',
          value: `poll: need 'transient' or a status code\n${USAGE}`,
        }
      }
      // Default to what the server ACTUALLY sends for 404 (BQ-verified),
      // so `/bridge-kick poll 404` reproduces the real 147K/week state.
      const errorType =
        b ?? (status === 404 ? 'not_found_error' : 'authentication_error')
      h.injectFault({
        method: 'pollForWork',
        kind: 'fatal',
        status,
        errorType,
        count: 1,
      })
      h.wakePollLoop()
      return {
        type: 'text',
        value: `Next poll will throw BridgeFatalError(${status}, ${errorType}). Poll loop woken.`,
      }
    }

    case 'register': {
      if (a === 'fatal') {
        h.injectFault({
          method: 'registerBridgeEnvironment',
          kind: 'fatal',
          status: 403,
          errorType: 'permission_error',
          count: 1,
        })
        return {
          type: 'text',
          value:
            'Next registerBridgeEnvironment will 403. Trigger with close/reconnect.',
        }
      }
      const n = Number(b) || 1
      h.injectFault({
        method: 'registerBridgeEnvironment',
        kind: 'transient',
        status: 503,
        count: n,
      })
      return {
        type: 'text',
        value: `Next ${n} registerBridgeEnvironment call(s) will transient-fail. Trigger with close/reconnect.`,
      }
    }

    case 'reconnect-session': {
      h.injectFault({
        method: 'reconnectSession',
        kind: 'fatal',
        status: 404,
        errorType: 'not_found_error',
        count: 2,
      })
      return {
        type: 'text',
        value:
          'Next 2 POST /bridge/reconnect calls will 404. doReconnect Strategy 1 falls through to Strategy 2.',
      }
    }

    case 'heartbeat': {
      const status = Number(a) || 401
      h.injectFault({
        method: 'heartbeatWork',
        kind: 'fatal',
        status,
        errorType: status === 401 ? 'authentication_error' : 'not_found_error',
        count: 1,
      })
      return {
        type: 'text',
        value: `Next heartbeat will ${status}. Watch for onHeartbeatFatal → work-state teardown.`,
      }
    }

    case 'reconnect': {
      h.forceReconnect()
      return {
        type: 'text',
        value: 'Called reconnectEnvironmentWithSession(). Watch debug.log.',
      }
    }

    case 'status': {
      return { type: 'text', value: h.describe() }
    }

    default:
      return { type: 'text', value: USAGE }
  }
}

const bridgeKick = {
  type: 'local',
  name: 'bridge-kick',
  description: 'Inject bridge failure states for manual recovery testing',
  isEnabled: () => process.env.USER_TYPE === 'ant',
  supportsNonInteractive: false,
  load: () => Promise.resolve({ call }),
} satisfies Command

export default bridgeKick
