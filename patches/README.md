# Claude-in-Chrome Windows Fix — Patched Files

Fixes the `tengu_copper_bridge` feature flag forcing WebSocket bridge over working local named pipes on Windows.

## Source Versions

### Claude Code CLI (`cli.js`)
| | Value |
|---|---|
| **Version** | 2.1.76 |
| **Build Time** | 2026-03-14T00:12:49Z |
| **npm Package** | `@anthropic-ai/claude-code@2.1.76` |
| **Original SHA-256** | `38b8fd29d0817e5f75202b2bb211fe959d4b6a4f2224b8118dabf876e503b50b` |
| **Original Size** | 12,158,258 bytes |
| **Patched SHA-256** | `6ea2a57ddd49c3f0869e77e027f3de0c2116c390a0d338963f70bec9b92b537c` |
| **Patched Size** | 12,158,265 bytes |

### Chrome Extension (`Claude`)
| | Value |
|---|---|
| **Name** | Claude |
| **Version** | 1.0.61 |
| **Manifest Version** | 3 |
| **Extension ID** | `fcoeoabgfenejglbffodgkkbkcdhcgfn` |
| **Service Worker** | `assets/service-worker.ts-C4SRwdsa.js` |
| **Service Worker SHA-256** | `fa55ffbb749310582e7aab3b5154fc899bdfcf65c92ed916f8b05834b6ccddf9` |
| **Native Host Names** | `com.anthropic.claude_browser_extension`, `com.anthropic.claude_code_browser_extension` |

## Patch Description

### `cli.js.patch` — Disables WebSocket bridge, forces local socket

**One-line change:** early `return` in `_Oz()` (bridge URL resolver) so it always returns `undefined`, preventing `bridgeConfig` from being set. This forces `Xd1()` to use the local socket pool (`pzA`) instead of `BridgeClient` (`y61`).

### `chrome-native-host.bat` — Routes native host through Node.js

Replaces the standalone binary (`claude.exe`) with `node.exe` + patched `cli.js` for the native messaging host process, ensuring both the native host and MCP server use the patched code path.

### No changes to Chrome extension

The Chrome extension itself is **not patched**. The bug is entirely in the CLI's MCP server (`--claude-in-chrome-mcp`), not the extension. The extension's native messaging and tool handling work correctly.

## How to apply

```powershell
powershell -ExecutionPolicy Bypass -File ..\scripts\fix-windows-chrome.ps1
```

Then run Claude Code via `%APPDATA%\npm\claude.cmd`.
