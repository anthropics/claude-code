/**
 * The managed policy a test's session reads: the settings' keys, or the
 * word `unreadable` when the settings cannot be read at all.
 */
export type PolicyOption =
  | {
      readonly kind: 'settings'
      readonly settings: Readonly<Record<string, unknown>>
    }
  | { readonly kind: 'unreadable' }
