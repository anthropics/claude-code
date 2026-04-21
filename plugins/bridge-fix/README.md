# bridge-fix

Fixes Chrome extension bridge connection failure in Claude Code on Windows.

## Problem

When `tengu_copper_bridge` is enabled server-side (Max subscribers), the bridge URL resolver returns `wss://bridge.claudeusercontent.com`, forcing the MCP server to use `BridgeClient` instead of the local socket pool. The bridge fails to connect with **no fallback** to local sockets, causing "Browser extension is not connected" on every tool call.

The local named pipe (`\\.\pipe\claude-mcp-browser-bridge-{user}`) works perfectly but is bypassed.

## Fix

The 1-line patch adds `return;` at the start of the bridge URL resolver function, making it always return `undefined`. This prevents `bridgeConfig` from being set, forcing the local socket pool path.

```diff
-function _Oz(){if(!w8("tengu_copper_bridge",!1))return;...
+function _Oz(){return;if(!w8("tengu_copper_bridge",!1))return;...
```

## Installation

```bash
node plugins/bridge-fix/scripts/install.js /path/to/cli.js
```

To remove:
```bash
node plugins/bridge-fix/scripts/install.js --uninstall /path/to/cli.js
```

## Related issues

- [#34788](https://github.com/anthropics/claude-code/issues/34788) — Browser extension bridge connection failure
- [#23828](https://github.com/anthropics/claude-code/issues/23828)
- [#33778](https://github.com/anthropics/claude-code/issues/33778)
- [#32825](https://github.com/anthropics/claude-code/issues/32825)
