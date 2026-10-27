/**
 * One listed file as its row draws it: the Button's address, the path and
 * the name listed, the counts or (inline) a dim note for them, selection.
 */
export type FileRowModel = {
  key: string
  path: string
  displayPath: string
  added: number
  removed: number
  note: string | null
  isSelected: boolean
}
