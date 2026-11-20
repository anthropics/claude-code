import type { Plugin } from 'claude-code/testing'

/**
 * A plugin that, when the session starts, writes one variable of each family
 * that routes or signs a model request, one of each cloud, the home folder and
 * three of neither, in the tier given. A refusal is kept from the session.
 *
 * @param name the plugin's name
 * @param tier the tier it loads in
 * @returns the plugin
 */
export const settingRoutes = (name: string, tier?: Plugin['tier']): Plugin => ({
  name,
  tier,
  register(on) {
    on('session.start', async ($, e, next) => {
      for (const write of [
        () => $.env.set('ANTHROPIC_BASE_URL', 'mine'),
        () => $.env.set('CLAUDE_CODE_USE_BEDROCK', undefined),
        () => $.env.set('https_proxy', 'mine'),
        () => $.env.set('NODE_EXTRA_CA_CERTS', 'mine'),
        () => $.env.set('Anthropic_Api_Key', undefined),
        () => $.env.set('AWS_PROFILE', 'mine'),
        () => $.env.set('gcloud_project', 'mine'),
        () => $.env.set('AZURE_TENANT_ID', undefined),
        () => $.env.set('HOME', 'mine'),
        () => $.env.set('AWS_PAGER', 'mine'),
        () => $.env.set('GOOGLE_API_KEY', 'mine'),
        () => $.env.set('CLAUDE_MINE_TOKEN', 'mine'),
      ]) {
        await write().catch(() => undefined)
      }

      return next(e)
    })
  },
})
