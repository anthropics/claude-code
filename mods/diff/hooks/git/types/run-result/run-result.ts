/**
 * What one git child left: its exit code and both output streams; a child
 * that never ran or was killed reads as exit code -1 with no output.
 */
export type RunResult = {
  exitCode: number
  stdout: string
  stderr: string
}
