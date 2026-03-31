import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.js'
import type { Command } from '../commands.js'
import type { ToolUseContext } from '../Tool.js'

type Options = {
  name: string
  description: string
  progressMessage: string
  pluginName: string
  pluginCommand: string
  /**
   * The prompt to use while the marketplace is private.
   * External users will get this prompt. Once the marketplace is public,
   * this parameter and the fallback logic can be removed.
   */
  getPromptWhileMarketplaceIsPrivate: (
    args: string,
    context: ToolUseContext,
  ) => Promise<ContentBlockParam[]>
}

export function createMovedToPluginCommand({
  name,
  description,
  progressMessage,
  pluginName,
  pluginCommand,
  getPromptWhileMarketplaceIsPrivate,
}: Options): Command {
  return {
    type: 'prompt',
    name,
    description,
    progressMessage,
    contentLength: 0, // Dynamic content
    userFacingName() {
      return name
    },
    source: 'builtin',
    async getPromptForCommand(
      args: string,
      context: ToolUseContext,
    ): Promise<ContentBlockParam[]> {
      if (process.env.USER_TYPE === 'ant') {
        return [
          {
            type: 'text',
            text: `This command has been moved to a plugin. Tell the user:

1. To install the plugin, run:
   claude plugin install ${pluginName}@claude-code-marketplace

2. After installation, use /${pluginName}:${pluginCommand} to run this command

3. For more information, see: https://github.com/anthropics/claude-code-marketplace/blob/main/${pluginName}/README.md

Do not attempt to run the command. Simply inform the user about the plugin installation.`,
          },
        ]
      }

      return getPromptWhileMarketplaceIsPrivate(args, context)
    },
  }
}
