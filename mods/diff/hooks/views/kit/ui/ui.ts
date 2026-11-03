import type { ElementTable } from 'claude-code'

/**
 * The element constructors the pane draws with, destructured from the
 * table `$.ui.resolve(e)` hands the render hook.
 *
 * The terminal and the desktop carry all five, as the mobile app does, but
 * the pane never draws on the mobile app (isOnPaneSurface).
 */
export type Ui = Pick<
  ElementTable<'terminal' | 'desktop'>,
  'Box' | 'Text' | 'Button' | 'Select' | 'Code'
>
