import type { Command } from '../../commands.js'
import { isEnvTruthy } from '../../utils/envUtils.js'

const installGitHubApp = {
  type: 'local-jsx',
  name: 'install-github-app',
  description: 'Set up Claude GitHub Actions for a repository',
  availability: ['claude-ai', 'console'],
  isEnabled: () => !isEnvTruthy(process.env.DISABLE_INSTALL_GITHUB_APP_COMMAND),
  load: () => import('./install-github-app.js'),
} satisfies Command

export default installGitHubApp
