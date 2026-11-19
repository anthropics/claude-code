/**
 * `empty` leaves a gap. `unread` is counted and quoted, with `why`.
 */
export type NotRead =
  | { kind: 'empty'; why: 'empty' }
  | { kind: 'unread'; why: string }
