/**
 * The one shell script the plugin runs, once a session, anywhere but
 * Windows; five lines come back.
 *
 * `uname -s`, `uname -r`, `uname -m`, then the package managers found of
 * npm, yarn and pnpm comma-joined, then the runtimes found of bun, deno and
 * node.
 */
export const PROBE_SCRIPT = [
  'uname -s',
  'uname -r',
  'uname -m',
  'for c in npm yarn pnpm; do command -v "$c" >/dev/null 2>&1 && ' +
    'printf "%s," "$c"; done; echo',
  'for c in bun deno node; do command -v "$c" >/dev/null 2>&1 && ' +
    'printf "%s," "$c"; done; echo',
].join('\n')
