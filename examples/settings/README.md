# Claude Code Settings Examples

This directory contains example configuration files for common Claude Code use cases.

## Available Examples

### `reduced-animations.json`
Configuration for users experiencing terminal flickering or who prefer minimal visual motion. Useful for:
- Small terminal windows
- Remote SSH sessions
- Accessibility needs (motion sensitivity)
- Low-bandwidth connections

### Usage

Copy the desired configuration to your project's `.claude/settings.json`:

```bash
# For reduced animations
cp examples/settings/reduced-animations.json .claude/settings.json
```

Or merge specific settings into your existing configuration.

## Documentation

For complete settings documentation, see:
- [Settings Documentation](https://code.claude.com/docs/en/settings.md)
- [Terminal Configuration](https://code.claude.com/docs/en/terminal-config.md)
