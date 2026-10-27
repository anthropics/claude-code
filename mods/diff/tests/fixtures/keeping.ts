/**
 * A hook that keeps each input it is asked with, and answers, beside what
 * it kept.
 *
 * @returns the hook, and each input in the order it came
 */
export function keeping<E>() {
  const kept: E[] = []

  function hook(_engine: unknown, e: E) {
    kept.push(e)

    return { value: undefined }
  }

  return { hook, kept }
}
