#!/usr/bin/env node
/**
 * PreToolUse hook for the Bash tool — redirects to Pwsh when available.
 *
 * Only blocks Bash if the Pwsh tool is registered (cli.js has been patched).
 * If Pwsh isn't available, allows Bash through but suggests using pwsh syntax.
 */

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

let input = "";
process.stdin.setEncoding("utf-8");
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  try {
    const data = JSON.parse(input);
    const toolName = data.tool_name || "";
    const command = data.tool_input?.command || "";

    // Only intercept Bash tool calls
    if (toolName !== "Bash") {
      process.exit(0);
      return;
    }

    // Check if the Pwsh tool exists in cli.js (was patched)
    const pwshToolInstalled = isPwshToolInstalled();

    if (pwshToolInstalled) {
      // Pwsh tool exists — block Bash, force Pwsh
      output("deny",
        "The powershell-default plugin is active. " +
        "Use the Pwsh tool instead of Bash. " +
        "The Pwsh tool accepts PowerShell syntax directly — no pwsh prefix needed."
      );
      return;
    }

    // Pwsh tool NOT installed — allow Bash but block bad patterns
    // Block powershell.exe (5.1)
    if (/\bpowershell(\.exe)?\b/i.test(command) && !/\bpwsh\b/i.test(command)) {
      output("deny",
        "Use pwsh (PowerShell 7+), not powershell.exe (5.1). " +
        "Wrap as: pwsh -NoProfile -NonInteractive -Command \"...\""
      );
      return;
    }

    // Block backslash paths
    if (/[A-Za-z]:\\[A-Za-z]/.test(command)) {
      output("deny",
        "Use forward slashes in paths (C:/path/file) not backslashes."
      );
      return;
    }

    // Allow Bash through
    process.exit(0);

  } catch (e) {
    process.exit(0);
  }
});

function isPwshToolInstalled() {
  try {
    // Check if any cli.js in known locations has the Pwsh tool
    const candidates = [
      process.env.APPDATA && path.join(process.env.APPDATA, "npm/node_modules/@anthropic-ai/claude-code/cli.js"),
      process.env.HOME && path.join(process.env.HOME, ".local/lib/node_modules/@anthropic-ai/claude-code/cli.js"),
    ].filter(Boolean);

    for (const p of candidates) {
      try {
        const content = fs.readFileSync(p, "utf-8", { flag: "r" });
        // Quick check — just look for the marker in first 50KB
        if (content.slice(0, 50000).includes("_pwshTool_")) return true;
      } catch {}
    }
    return false;
  } catch {
    return false;
  }
}

function output(decision, reason) {
  const result = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: decision,
      permissionDecisionReason: reason
    }
  };
  process.stdout.write(JSON.stringify(result));
  process.exit(0);
}
