import type { EngineInterface } from 'claude-code'

/**
 * What `$.telemetry.mark` takes, as the telemetry mod's contract declares
 * it: the feature, how it went, and why when not ok.
 */
export type TelemetryMark = Parameters<EngineInterface['telemetry']['mark']>[0]
