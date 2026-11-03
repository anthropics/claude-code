import type { DetailModel } from '../../detail-model'

/**
 * A file as its name row draws it: the detail, whether its body was cut,
 * and whether it can be asked about (it has hunks to attach).
 */
export type NamedDetail = DetailModel & {
  isTruncated: boolean
  isAskable: boolean
}
