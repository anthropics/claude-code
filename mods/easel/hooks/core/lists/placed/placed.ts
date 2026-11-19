/**
 * One piece, with the point where it ends on the axis it was laid along.
 */
export type Placed<Part> = {
  part: Part
  end: number
}
