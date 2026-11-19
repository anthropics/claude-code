import type Charting from '../../../charting'
import type { SparksForm } from './sparks-form'

/**
 * The form that draws each series as a spark in its legend row.
 */
export type SparksChart = Extract<Charting.Chart, SparksForm>
