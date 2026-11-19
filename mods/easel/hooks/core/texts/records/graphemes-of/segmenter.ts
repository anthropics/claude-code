let made: Intl.Segmenter | undefined

/**
 * Splits a string into graphemes; one instance serves every call. It is made
 * at the first call, so that loading the module needs no `Intl`.
 */
export const SEGMENTER: Pick<Intl.Segmenter, 'segment'> = {
  segment: text => (made ??= new Intl.Segmenter('en')).segment(text),
}
