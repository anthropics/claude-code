# Quick Wins Plugin 🎯

Community-driven plugin providing practical workarounds and utilities for common Claude Code issues.

## What This Solves

Real issues reported by the community with 500+ combined reactions:

| Command | Issue | Impact | Status |
|---------|-------|--------|--------|
| `/upgrade-smart` | #12347 | pnpm upgrade fails | ✅ Workaround |
| `/mcp-debug` | #12314 | MCP not detected | ✅ Diagnostic |
| `/terminal-cleanup` | #12345 | Green line persists | ✅ Workaround |
| `/memory-check` | #12327 | 20GB+ memory leak | ✅ Monitoring |

## Installation

```bash
# Copy to plugins directory
cp -r plugins/quick-wins ~/.claude/plugins/

# Restart Claude Code
claude
```

## Commands

### 🔄 `/upgrade-smart`
Auto-detects package manager and runs correct upgrade:
```bash
> /upgrade-smart
Detected: pnpm
✅ Upgraded to 2.0.53
```

### 🐛 `/mcp-debug`
Validates MCP configuration:
```bash
> /mcp-debug
✅ ~/.claude/mcp.json - Valid
📋 Merged config: {...}
```

### 🧹 `/terminal-cleanup`
Fixes corrupted terminal state:
```bash
> /terminal-cleanup
✅ Terminal reset complete
```

### 📊 `/memory-check`
Monitors memory usage:
```bash
> /memory-check
Current: 2.4 GB
Status: ✅ Normal
```

## Contributing

Add new commands:
1. Create `commands/your-command.md`
2. Use skill format (see examples)
3. Link to GitHub issue
4. Submit PR

## License

MIT

---

**Created to help the community while official fixes are in progress.**
