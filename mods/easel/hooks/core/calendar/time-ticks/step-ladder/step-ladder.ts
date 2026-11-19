import { CALENDAR_UNITS } from '../../calendar-units'
import type Types from '../../types'
import { typicalStepMs } from '../../typical-step-ms'
import { plainStepOf } from './plain-step-of'

/**
 * Every count of every unit, from the finest step to the coarsest.
 */
export const STEP_LADDER: readonly Types.Step[] = CALENDAR_UNITS.flatMap(unit =>
  unit.counts.map(count => plainStepOf(unit, count)),
).toSorted((finer, coarser) => typicalStepMs(finer) - typicalStepMs(coarser))
