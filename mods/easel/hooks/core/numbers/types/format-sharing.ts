/**
 * What written numbers share their format with, and how small one may be.
 */
export type FormatSharing = {
  /**
   * The numbers whose format the written ones share: themselves if left out.
   */
  peers?: number[]

  /**
   * The least a written number may be, in the shared multiple: 0 if left out.
   */
  minWritten?: number
}
