import type { LocalCommandResult } from '../../commands.js'
import { logEvent } from '../../services/analytics/index.js'
import { openBrowser } from '../../utils/browser.js'
import { saveGlobalConfig } from '../../utils/config.js'

const SLACK_APP_URL = 'https://slack.com/marketplace/A08SF47R6P4-claude'

export async function call(): Promise<LocalCommandResult> {
  logEvent('tengu_install_slack_app_clicked', {})

  // Track that user has clicked to install
  saveGlobalConfig(current => ({
    ...current,
    slackAppInstallCount: (current.slackAppInstallCount ?? 0) + 1,
  }))

  const success = await openBrowser(SLACK_APP_URL)

  if (success) {
    return {
      type: 'text',
      value: 'Opening Slack app installation page in browser…',
    }
  } else {
    return {
      type: 'text',
      value: `Couldn't open browser. Visit: ${SLACK_APP_URL}`,
    }
  }
}
