/**
 * One entry after the check: the event's full name and the properties as
 * they go into the row's metadata.
 */
export type Fields = {
  name: string
  props: Readonly<Record<string, string | number | boolean>>
}
