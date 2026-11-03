/**
 * What became of an open: the pane is drawn (`placed`), kept until something
 * attaches that draws it (`awaited`), or taken back (`withdrawn`).
 */
export type OpenOutcome = 'placed' | 'awaited' | 'withdrawn'
