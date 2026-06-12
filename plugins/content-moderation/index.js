const ContentModerationPlugin = require('./plugin');

async function contentModeration(claude) {
  const plugin = new ContentModerationPlugin();
  claude.addCommand('moderate', async (args) => {
    const content = args.join(' ');
    const result = await plugin.moderateContent(content);
    if (result.flagged) {
      claude.print(`Content flagged: ${result.reason}`);
    } else {
      claude.print('Content is legitimate');
    }
  });
}

module.exports = contentModeration;