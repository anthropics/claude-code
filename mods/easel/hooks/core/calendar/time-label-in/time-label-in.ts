import type { Timeline } from '../../reading/types/timeline/timeline'
import { timeLabels } from '../time-labels'
import { labellingIn } from './labelling-in'

/**
 * States every field from the first in which the two ends differ.
 *
 * @param timeline the ends that are compared, and the precision to write to
 * @param ms the instant to label
 * @returns the label
 */
export const timeLabelIn = (timeline: Timeline, ms: number): string =>
  timeLabels([ms], timeline.precision, labellingIn(timeline, ms))[0] ?? ''
