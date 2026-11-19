import { GIB } from '../../gib'
import Limits from '../../limits'
import { MIB } from '../../mib'
import { TIB } from './tib'

/**
 * By base unit. The long words are Grafana's unit names.
 *
 * `UNIT_LADDERS`, where numbers are written, is the table for writing: it has
 * one spelling of each.
 */
export const SUFFIX_SIZES: readonly (readonly [
  unit: string,
  sizes: Readonly<Record<string, number>>,
])[] = [
  [
    '',
    {
      k: Limits.THOUSAND,
      K: Limits.THOUSAND,
      M: Limits.MILLION,
      G: Limits.BILLION,
      T: Limits.TRILLION,
      short: 1,
      none: 1,
    },
  ],
  [
    'B',
    {
      B: 1,
      kB: Limits.THOUSAND,
      KB: Limits.THOUSAND,
      MB: Limits.MILLION,
      GB: Limits.BILLION,
      TB: Limits.TRILLION,
      PB: Limits.QUADRILLION,
    },
  ],
  ['B', { Ki: Limits.KIB, Mi: MIB, Gi: GIB, Ti: TIB }],
  ['B', { KiB: Limits.KIB, MiB: MIB, GiB: GIB, TiB: TIB }],
  ['B', { bytes: 1, decbytes: 1 }],
  [
    's',
    {
      ns: Limits.NANO,
      us: Limits.MICRO,
      µs: Limits.MICRO,
      ms: Limits.MILLI,
      s: 1,
    },
  ],
  [
    's',
    {
      min: Limits.SECONDS_PER_MINUTE,
      h: Limits.SECONDS_PER_HOUR,
      d: Limits.SECONDS_PER_DAY,
    },
  ],
  ['%', { '%': 1, percent: 1, percentunit: Limits.PERCENT_PER_UNIT }],
]
