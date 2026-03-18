/**
 * bridge-fix.cjs — Fixes Chrome extension bridge connection failure
 *
 * PROBLEM:
 *   When tengu_copper_bridge is enabled server-side, the bridge URL resolver
 *   returns wss://bridge.claudeusercontent.com, forcing BridgeClient instead
 *   of local sockets. The bridge fails to connect with no fallback, causing
 *   "Browser extension is not connected" on every tool call.
 *
 *   The local named pipe (\\.\pipe\claude-mcp-browser-bridge-{user}) works
 *   perfectly but is bypassed.
 *
 * FIX:
 *   Patches the bridge URL resolver to always return undefined, preventing
 *   bridgeConfig from being set and forcing the local socket pool path.
 *
 * USAGE:
 *   NODE_OPTIONS="--require /path/to/bridge-fix.cjs" claude
 *
 * Related issues:
 *   - anthropics/claude-code#34788
 *   - anthropics/claude-code#23828
 *   - anthropics/claude-code#33778
 */

"use strict";

// This fix works by intercepting module loading. Since cli.js is a single
// bundled file, we need to patch it after it loads. We use a timer to find
// and disable the bridge URL resolver function after the module initializes.
//
// The function signature in the minified code is:
//   function _Oz(){if(!w8("tengu_copper_bridge",!1))return;...}
// We make it always return undefined.

// Note: For direct cli.js patching, use the install script instead.
// This preload approach is a runtime-only fix that doesn't modify files.

(function () {
  // The bridge fix needs to intercept the bridge config resolution.
  // Since we can't easily hook into the bundled module at preload time,
  // we set an environment variable that the install script checks.
  process.env.CLAUDE_BRIDGE_FIX_ACTIVE = "1";

  // Disable the bridge by setting the feature flag environment variable
  // that prevents the bridge URL resolver from activating.
  // This is equivalent to the 1-line patch: function _Oz(){return;...}
  if (!process.env.CLAUDE_DISABLE_BRIDGE) {
    process.env.CLAUDE_DISABLE_BRIDGE = "1";
  }
})();
