import { groupNoteOf } from './group-note-of'

/**
 * `ctrl+o` and `/config` exist only in the terminal, so no app shows this.
 *
 * @param callCount how many calls the auto chart is the newest of
 * @returns the line that names an auto chart and says where to turn it off
 */
export const autoFooter = (callCount: number): string =>
  `auto chart · ${groupNoteOf(callCount)}turn off in /config: Auto charts`
