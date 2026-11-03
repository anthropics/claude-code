/**
 * The `$.telemetry` noun as every caller sees it: the one contract for the
 * noun, its types exported here and the noun declared on `EngineInterface`.
 *
 * The telemetry mod hooks the noun's two events, `telemetry.log` and
 * `telemetry.mark`, and is what queues and sends a row; on an engine that
 * has no `telemetry` of its own it also adds the noun in the `engine.create`
 * fold, checked against `EngineInterface['telemetry']`. Its hooks import
 * these types from this folder, a mod that calls the noun and a test that
 * answers it read them by including it in their tsconfig. Nothing here is
 * imported, so it stands on its own.
 */

/**
 * A plugin's analytics, queued through `$.telemetry` and sent in batches.
 *
 * The telemetry mod serves the plugins built into the CLI alone: a call from
 * an installed plugin rejects. Where the mod is off or absent nothing is
 * queued, and on an engine without the noun there is no `$.telemetry`.
 */
export type Telemetry = {
  /**
   * Queues one event, `tengu_plugin_<event>`, as one first-party row, sent
   * with the next batch; resolves once queued, rejects a malformed entry.
   *
   * The calling mod names itself in `event`; one already named `tengu_…` is
   * sent as named. A value is a finite number, a boolean or a
   * TelemetryChoice; free text is refused. One input, as every op on `$`
   * takes. Whether a batch went out is a line in the debug log.
   *
   * @param entry the event's name, a snake_case token, and its properties by
   *   snake_case key
   * @example
   * await $.telemetry.log({
   *   event: "suggest_learning_survey_answered",
   *   props: {
   *     answer: 2,
   *     page: { value: "ready", of: ["ready", "later"] },
   *   },
   * })
   */
  log: (entry: TelemetryLogEntry) => Promise<void>

  /**
   * Marks one use of a feature as the CLI's own feature events do, one
   * `tengu_feature_<kind>` row queued for the next batch; resolves once
   * queued, rejects a malformed entry.
   *
   * The row carries `feature_name`, `error_code` on sad or bad (`reason`,
   * required there and refused on ok) and the entry's `props`, checked as
   * `log`'s are; it joins the product-wide feature surface, so no prefix.
   *
   * @param entry the feature, how it went, why when not ok, and the row's
   *   properties by snake_case key
   * @example
   * await $.telemetry.mark({ feature: "learn_page", kind: "ok" })
   * await $.telemetry.mark({
   *   feature: "learn_page",
   *   kind: "sad",
   *   reason: "blocked",
   * })
   */
  mark: (entry: TelemetryMarkEntry) => Promise<void>
}

/**
 * Where a logged record goes: `anthropic`, the first-party analytics this
 * mod sends, or `collector`, the telemetry collector a session's operator
 * configured, which this mod leaves to whatever is beneath it.
 */
export type TelemetryDestination = 'anthropic' | 'collector'

/**
 * What `$.telemetry.log` takes: the event's name after the prefix, and its
 * properties by snake_case key.
 *
 * `to` names the destination and is never part of the row; left out, it
 * reads as `anthropic`. An entry for `collector` is not this mod's: its
 * hook passes it on beneath untouched.
 */
export type TelemetryLogEntry = {
  to?: TelemetryDestination
  event: string
  props?: Readonly<Record<string, TelemetryProp>>
}

/**
 * What `$.telemetry.mark` takes: the feature, how it went, why when not
 * ok, and the properties the row carries beside them by snake_case key.
 */
export type TelemetryMarkEntry = {
  feature: string
  kind: TelemetryMarkKind
  reason?: string
  props?: Readonly<Record<string, TelemetryProp>>
}

/**
 * How a feature went, as the CLI's own feature events count it.
 *
 * `ok`: used, the person got what they asked. `sad`: degraded, a fallback
 * or a partial, the person still got something. `bad`: failed, the person
 * got nothing.
 */
export type TelemetryMarkKind = 'ok' | 'sad' | 'bad'

/**
 * A property's value: a finite number, a boolean, or a TelemetryChoice;
 * never free text.
 */
export type TelemetryProp = number | boolean | TelemetryChoice

/**
 * A string property: the value and the list it is chosen from, declared
 * beside it, so no free text reaches the row.
 *
 * Every member of `of` is a lowercase token of letters, digits, `_` and
 * `-`, which may start with a digit, at most 32 of them; `value` is one of
 * them.
 */
export type TelemetryChoice = { value: string; of: readonly string[] }

declare module 'claude-code' {
  interface EngineInterface {
    /**
     * A built-in plugin's analytics, first-party rows sent in batches;
     * present where the telemetry mod is seated, refused to installed plugins.
     */
    telemetry: Telemetry
  }
}
