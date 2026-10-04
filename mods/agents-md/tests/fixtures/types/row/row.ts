/**
 * One entry the plugin handed the telemetry noun, as RECORDING wrote it:
 * which call (`log` or `mark`) and the entry.
 */
export type Row = [op: string, entry: unknown]
