/**
 * A sum that is 0 where it is within the most that rounding can add.
 *
 * Numbers that cancel leave what the rounding of binary fractions added:
 * 0.1 + 0.2 - 0.3 is 5.6e-17.
 *
 * @param values the numbers to add
 * @returns their sum, or 0 where only rounding is left of it
 */
export function sumOf(values: number[]): number {
  const total = values.reduce((sum, value) => sum + value, 0)
  const size = values.reduce((sum, value) => sum + Math.abs(value), 0)

  return Math.abs(total) > values.length * Number.EPSILON * size ? total : 0
}
