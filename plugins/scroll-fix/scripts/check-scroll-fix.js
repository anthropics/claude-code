#!/usr/bin/env node
/**
 * SessionStart hook — checks if the scroll fix preload is active.
 * If NODE_OPTIONS includes scroll-fix.cjs, we know the fix is loaded.
 * Otherwise, output installation instructions as context.
 */

const nodeOpts = process.env.NODE_OPTIONS || "";
const isActive = nodeOpts.includes("scroll-fix");

const output = {
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: isActive
      ? "Scroll-to-top fix is active. Ctrl+6 toggles output freeze for manual scrolling."
      : "NOTE: The scroll-to-top fix preload is not active. To enable it, set:\n  NODE_OPTIONS=\"--require <plugin-path>/scroll-fix.cjs\"\nor run: node <plugin-path>/scripts/install.js"
  }
};

process.stdout.write(JSON.stringify(output));
process.exit(0);
