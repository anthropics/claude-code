/**
 * An event input that carries who provides its subject (`tool.describe`,
 * `tool.offer`, `command.describe`, `agent.offer`, `agent.spawn`,
 * `agent.report`), read for its tier.
 *
 * Typed loosely on purpose: a missing or odd provider fails closed.
 */
export type Provided = {
  readonly provider?: { readonly tier?: unknown } | null
}
