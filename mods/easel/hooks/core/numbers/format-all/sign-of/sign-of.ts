/**
 * Gives the minus that goes before a number below zero.
 *
 * @param value The number to be written.
 * @returns A minus, or nothing for zero and above.
 */
export const signOf = (value: number): string => (value < 0 ? '-' : '')
