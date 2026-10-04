import type { ProcessRunResult } from 'claude-code'

/**
 * What the one machine probe prints on the session's Mac: Darwin on arm64,
 * npm and pnpm on the PATH, bun and node too.
 */
export const PROBED: ProcessRunResult = {
  exitCode: 0,
  stdout: 'Darwin\n25.6.0\narm64\nnpm,pnpm,\nbun,node,\n',
  stderr: '',
}
