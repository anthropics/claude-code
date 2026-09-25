import { z } from 'zod/v4'

/**
 * Number that also accepts numeric string literals like "30", "-5", "3.14".
 *
 * Tool inputs arrive as model-generated JSON. The model occasionally quotes
 * numbers — `"head_limit":"30"` instead of `"head_limit":30` — and z.number()
 * rejects that with a type error. z.coerce.number() is the wrong fix: it
 * accepts values like "" or null by converting them via JS Number(), masking
 * bugs rather than surfacing them.
 *
 * Only strings that are valid decimal number literals (matching /^-?\d+(\.\d+)?$/)
 * are coerced. Anything else passes through and is rejected by the inner schema.
 *
 * z.preprocess emits {"type":"number"} to the API schema, so the model is
 * still told this is a number — the string tolerance is invisible client-side
 * coercion, not an advertised input shape.
 *
 * .optional()/.default() go INSIDE (on the inner schema), not chained after:
 * chaining them onto ZodPipe widens z.output<> to unknown in Zod v4.
 *
 *   semanticNumber()                              → number
 *   semanticNumber(z.number().optional())         → number | undefined
 *   semanticNumber(z.number().default(0))         → number
 */
export function semanticNumber<T extends z.ZodType>(
  inner: T = z.number() as unknown as T,
) {
  return z.preprocess((v: unknown) => {
    if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v)) {
      const n = Number(v)
      if (Number.isFinite(n)) return n
    }
    return v
  }, inner)
}
