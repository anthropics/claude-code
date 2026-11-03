/**
 * The lines of an armed ask: where it came from, then one hunk long enough
 * that two lines and the cut note take less room than the whole.
 */
export const ASK_LINES: readonly string[] = [
  'The user attached the diff of a.txt from the diff pane to this prompt:',
  '@@ -1,3 +1,3 @@',
  '-the first old line of a.txt, long enough to take up some room',
  '-the second old line of a.txt, long enough to take up some room',
  '+the first new line of a.txt, long enough to take up some room',
  '+the second new line of a.txt, long enough to take up some room',
]
