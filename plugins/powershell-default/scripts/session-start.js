#!/usr/bin/env node
/**
 * SessionStart hook — auto-patches cli.js with the Pwsh tool if not already
 * patched, then injects PowerShell instructions into Claude's context.
 */

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// ── Auto-patch cli.js ───────────────────────────────────────────────
// Find cli.js and apply the Pwsh tool patch if missing
const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || path.dirname(__dirname);
const installScript = path.join(pluginRoot, "scripts", "install.js");

try {
  if (fs.existsSync(installScript)) {
    // install.js is idempotent — skips if already patched
    execFileSync(process.execPath, [installScript], {
      timeout: 10000,
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf-8"
    });
  }
} catch (e) {
  // Non-fatal — plugin still works as hook-only mode
}

// ── Detect pwsh ─────────────────────────────────────────────────────
let pwshPath = null;
let pwshVersion = null;

// Try full paths first (bash PATH may not include pwsh)
const candidates = process.platform === "win32"
  ? [
      "C:\\Program Files\\PowerShell\\7-preview\\pwsh.exe",
      "C:\\Program Files\\PowerShell\\7\\pwsh.exe",
      "pwsh-preview",
      "pwsh"
    ]
  : ["pwsh-preview", "pwsh", "/usr/local/bin/pwsh", "/snap/bin/pwsh-preview"];

for (const bin of candidates) {
  try {
    const ver = execFileSync(bin, ["-NoProfile", "-Command", "$PSVersionTable.PSVersion.ToString()"], {
      timeout: 5000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"]
    }).trim();
    pwshPath = bin;
    pwshVersion = ver;
    break;
  } catch {
    // not found, try next
  }
}

// ── Check if Pwsh tool is in cli.js ─────────────────────────────────
let pwshToolInstalled = false;
try {
  const cliCandidates = [
    process.env.APPDATA && path.join(process.env.APPDATA, "npm/node_modules/@anthropic-ai/claude-code/cli.js"),
    process.env.HOME && path.join(process.env.HOME, ".local/lib/node_modules/@anthropic-ai/claude-code/cli.js"),
  ].filter(Boolean);
  for (const p of cliCandidates) {
    try {
      const head = Buffer.alloc(50000);
      const fd = fs.openSync(p, "r");
      fs.readSync(fd, head, 0, 50000, 0);
      fs.closeSync(fd);
      if (head.toString("utf-8").includes("_pwshTool_")) {
        pwshToolInstalled = true;
        break;
      }
    } catch {}
  }
} catch {}

// ── Output context ──────────────────────────────────────────────────
const context = [];

if (pwshPath) {
  context.push(`PowerShell Default plugin is active. Using ${pwshPath} (v${pwshVersion}).`);
}

if (pwshToolInstalled) {
  context.push("");
  context.push("The native Pwsh tool is available. Use Pwsh(...) for ALL shell commands.");
  context.push("Do NOT use the Bash tool — it will be blocked.");
  context.push("The Pwsh tool accepts PowerShell syntax directly — no pwsh prefix needed.");
} else {
  context.push("");
  context.push("IMPORTANT SHELL RULES for Bash tool calls:");
  context.push(`1. Wrap commands as: ${pwshPath || "pwsh"} -NoProfile -NonInteractive -Command "..."`);
  context.push("2. For multi-line scripts, write a .ps1 file then: pwsh -NoProfile -File script.ps1");
  context.push("3. Use forward slashes in paths (C:/path not C:\\path)");
  context.push("4. Use PowerShell syntax: Get-ChildItem, Get-Content, Select-String, $env:VAR");
  if (!pwshPath) {
    context.push("");
    context.push("WARNING: pwsh not found. Install from https://github.com/PowerShell/PowerShell/releases");
  }
}

const output = {
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: context.join("\n")
  }
};

process.stdout.write(JSON.stringify(output));
process.exit(0);
