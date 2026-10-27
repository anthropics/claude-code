import type Git from '../../../hooks/git'

/**
 * A working-tree source whose backend names its own base, a short sha.
 */
export const AT_SHA: Git.DiffSource = {
  kind: 'working-tree',
  base: '8634408015c1',
}
