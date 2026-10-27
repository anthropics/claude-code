/**
 * One file of a scripted hunks answer: its path, its unified diff after the
 * opening line, and that line where git would quote the name in it.
 */
export type PrintedFile = readonly [
  path: string,
  body: string,
  opening?: string,
]
