/**
 * The status line for a file whose diff the pane does not attach.
 *
 * @param name the file's printable name
 * @param why `denied` under a Read rule, `unsure` for anything else
 * @returns the line
 */
export const askRefusedTextOf = (name: string, why: 'denied' | 'unsure') =>
  why === 'denied'
    ? `${name} is read-denied; its diff was not attached`
    : `${name}'s diff can't be attached from here`
