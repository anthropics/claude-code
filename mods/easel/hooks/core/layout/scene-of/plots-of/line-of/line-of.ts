import type Shapes from '../../../../shapes'

/**
 * A line through some places of a scene, drawn in one colour.
 *
 * @param points the places that the line passes through, in cells
 * @param ink what the line is drawn in
 * @returns the shape
 */
export const lineOf = (
  points: Shapes.Point[],
  ink: Shapes.Ink,
): Shapes.LineShape => ({ kind: 'line', ink, points })
