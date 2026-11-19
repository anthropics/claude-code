/**
 * How one group of values is written: the multiple they share, what stands
 * around the digits and how many decimals follow them.
 */
export type NumberFormat = {
  /**
   * How many of the written multiple one base unit is: 1000 for s as ms.
   */
  multiplesPerUnit: number

  /**
   * What stands before the digits: a currency sign, or nothing.
   */
  before: string

  /**
   * What stands after the digits: the multiple's suffix, then a unit word.
   */
  after: string

  /**
   * What stands after a zero, which has no multiple: `0` beside `2M`.
   */
  afterZero: string

  /**
   * The most decimals a value is written with.
   */
  decimals: number
}
