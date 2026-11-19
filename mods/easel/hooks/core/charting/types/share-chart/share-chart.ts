import type { Frame } from '../frame'
import type { Slice } from '../slice'

/**
 * A chart of the parts of one whole.
 */
export type ShareChart = Frame & { form: 'share'; rows: Slice[] }
