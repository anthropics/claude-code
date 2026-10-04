import type { TelemetryRow } from '../telemetry-row'

/**
 * One property value a `$.telemetry` row may carry.
 *
 * As the telemetry mod's contract declares it: a finite number, a boolean,
 * or a string chosen from the list declared beside it.
 */
export type TelemetryProp = NonNullable<TelemetryRow['props']>[string]
