import type { Command } from '../../commands.js'

const exportCommand = {
  type: 'local-jsx',
  name: 'export',
  description: 'Export the current conversation to a file or clipboard',
  argumentHint: '[filename]',
  load: () => import('./export.js'),
} satisfies Command

export default exportCommand
