/**
 * How one form of chart is named to the model, and how many it draws.
 */
export type Form = {
  label: string
  plural: string
  singular?: string
  defaultCount: number
  maxCount: number
}
