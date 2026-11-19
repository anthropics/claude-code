import type Charting from '../../../../../charting'

/**
 * The ticks that stand within the values drawn, both ends counted.
 *
 * @param plot the plot, whose ticks stand along its value axis
 * @param lowest the position of the lowest value drawn
 * @param highest the position of the highest value drawn
 * @returns those ticks, in their order
 */
export const ticksAtInk = (
  plot: Charting.Plot,
  lowest: number,
  highest: number,
): Charting.Plot['ticks'] =>
  plot.ticks.filter(tick => tick.position >= lowest && tick.position <= highest)
