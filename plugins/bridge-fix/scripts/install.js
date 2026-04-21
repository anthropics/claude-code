#!/usr/bin/env node
/**
 * install.js — Patches cli.js to disable the remote bridge URL resolver
 *
 * Uses git diff compatible patch when possible, falls back to string replacement.
 *
 * Usage:
 *   node install.js [path-to-cli.js]
 *   node install.js --uninstall [path-to-cli.js]
 */

"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

function findCliJs(userPath) {
  if (userPath && fs.existsSync(userPath)) return userPath;
  const candidates = [
    "./cli.js",
    path.join(process.env.APPDATA || "", "npm/node_modules/@anthropic-ai/claude-code/cli.js"),
    path.join(process.env.HOME || "", ".local/lib/node_modules/@anthropic-ai/claude-code/cli.js"),
    "/usr/local/lib/node_modules/@anthropic-ai/claude-code/cli.js",
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function tryGitApply(cliPath) {
  const patchFile = path.join(__dirname, "..", "patches", "bridge-fix.patch");
  if (!fs.existsSync(patchFile) || fs.statSync(patchFile).size === 0) return false;

  const cliDir = path.dirname(cliPath);
  try {
    execFileSync("git", ["apply", "-C0", "--check", patchFile], {
      cwd: cliDir,
      timeout: 5000,
      stdio: "pipe"
    });
    execFileSync("git", ["apply", "-C0", patchFile], {
      cwd: cliDir,
      timeout: 5000,
      stdio: "pipe"
    });
    return true;
  } catch {
    return false;
  }
}

function main() {
  const args = process.argv.slice(2);
  const uninstall = args.includes("--uninstall");
  const userPath = args.find(a => !a.startsWith("-"));
  const cliPath = findCliJs(userPath);

  if (!cliPath) {
    console.error("Could not find cli.js. Pass the path as an argument.");
    process.exit(1);
  }

  let content = fs.readFileSync(cliPath, "utf-8");
  const origHash = sha256(content);

  // Pattern: function XXXX(){if(!YY("tengu_copper_bridge"...
  // Also match already-patched: function XXXX(){return;if(!YY("tengu_copper_bridge"...
  const bridgePattern = /function\s+(\w+)\(\)\{(return;)?if\(!(\w+)\("tengu_copper_bridge"/;
  const match = content.match(bridgePattern);

  if (uninstall) {
    if (!match || !match[2]) {
      console.log("Bridge patch not found — nothing to remove.");
      return;
    }
    const funcName = match[1];
    const checkFunc = match[3];
    content = content.replace(
      "function " + funcName + "(){return;if(!" + checkFunc,
      "function " + funcName + "(){if(!" + checkFunc
    );
    fs.writeFileSync(cliPath, content);
    console.log("Bridge patch removed from " + cliPath);
    console.log("SHA-256: " + sha256(content));
    return;
  }

  // Already patched?
  if (match && match[2]) {
    console.log("Bridge patch already applied to " + cliPath);
    return;
  }

  // Try git apply first
  if (tryGitApply(cliPath)) {
    console.log("Bridge patch applied via git apply to " + cliPath);
    console.log("Original SHA-256: " + origHash);
    console.log("Patched  SHA-256: " + sha256(fs.readFileSync(cliPath, "utf-8")));
    return;
  }

  // Fallback: string replacement
  if (!match) {
    console.error("Could not find bridge URL resolver function in cli.js");
    console.error("The function pattern may have changed in this version.");
    process.exit(1);
  }

  const funcName = match[1];
  const checkFunc = match[3];

  content = content.replace(
    "function " + funcName + "(){if(!" + checkFunc,
    "function " + funcName + "(){return;if(!" + checkFunc
  );

  fs.writeFileSync(cliPath, content);
  console.log("Bridge patch applied to " + cliPath);
  console.log("Original SHA-256: " + origHash);
  console.log("Patched  SHA-256: " + sha256(content));
}

main();
