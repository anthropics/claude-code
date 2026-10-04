import type Detail from '../../../detail'
import type Entries from '../../../entries'
import type { HunkSegment } from './hunk-segment'

/**
 * One piece of the docked pane's scrolling body: a hunk some rows tall
 * (HunkSegment), or one row of another kind, top to bottom.
 *
 * A file is a `rule` (its top, what a row's press scrolls to), its `name`,
 * a `rule`, then hunks or `note`s and a `footer` when cut; `text` is an
 * empty state's line, `toggle` and `legend` the pre-session section's.
 */
export type Segment =
  | HunkSegment
  | { kind: 'rule'; path: string | null }
  | { kind: 'blank' }
  | { kind: 'name'; name: Detail.NamedDetail }
  | { kind: 'note'; text: string }
  | { kind: 'footer' }
  | { kind: 'text'; text: string }
  | { kind: 'toggle'; label: string }
  | { kind: 'legend'; entry: Entries.BodyEntry }
