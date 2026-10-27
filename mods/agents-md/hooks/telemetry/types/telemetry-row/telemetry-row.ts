import type { EngineInterface } from 'claude-code'

/**
 * What `$.telemetry.log` takes, as the telemetry mod's contract declares
 * it: the event's name and its properties by snake_case key.
 */
export type TelemetryRow = Parameters<EngineInterface['telemetry']['log']>[0]
