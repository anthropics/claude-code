/**
 * A query of one metric: how it is summed and its name, its filter, what it
 * is split by, then functions. A formula over several metrics does not match.
 */
export const ONE_METRIC_EXPRESSION =
  /^((?:[\w.]+:)?[\w.-]+)\{([^{}]*)\}(?: by \{[^{}]*\})?((?:\.\w+\([^()]*\))*)$/
