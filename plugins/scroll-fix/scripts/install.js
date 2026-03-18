#!/usr/bin/env node
/**
 * install.js — Applies the scroll-to-top fix to Claude Code's cli.js
 *
 * Uses git diff compatible patches when possible, falls back to string replacement.
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

const PATCH_MARKER = "/* SCROLL_FIX */";

const PATCH_CODE =
  ';(function(){var _ow=process.stdout.write.bind(process.stdout);var _frozen=false,_buf=[];' +
  'setTimeout(function(){try{process.stdin.on("data",function(d){if(d.toString().indexOf("\\x1e")!==-1){' +
  '_frozen=!_frozen;if(_frozen){_ow("\\x1b]0;Claude Code [FROZEN - Ctrl+6 to resume]\\x07")}' +
  'else{if(_buf.length>0){var a="";for(var i=0;i<_buf.length;i++)a+=_buf[i];_buf=[];_ow(a)}' +
  '_ow("\\x1b]0;Claude Code\\x07")}}})}catch(e){}},2000);' +
  'process.stdout.write=function(d,e,c){if(typeof e==="function"){c=e;e=void 0}' +
  'var s=typeof d==="string"?d:Buffer.isBuffer(d)?d.toString("utf-8"):String(d);' +
  'var maxUp=process.stdout.rows||24;var upBudget=maxUp;' +
  's=s.replace(/\\x1b\\[(\\d*)A/g,function(m,p){var n=parseInt(p)||1;' +
  'if(upBudget<=0)return"";var allowed=n>upBudget?upBudget:n;upBudget-=allowed;' +
  'return"\\x1b["+allowed+"A"});' +
  'if(_frozen){_buf.push(s);if(c)c();return true}' +
  'if(typeof d==="string")return _ow(s,e,c);return _ow(Buffer.from(s,"utf-8"),e,c)};})();';

function findCliJs(userPath) {
  if (userPath && fs.existsSync(userPath)) return userPath;
  const candidates = [
    "./cli.js",
    path.join(process.env.APPDATA || "", "npm/node_modules/@anthropic-ai/claude-code/cli.js"),
    path.join(process.env.HOME || "", ".local/lib/node_modules/@anthropic-ai/claude-code/cli.js"),
    "/usr/local/lib/node_modules/@anthropic-ai/claude-code/cli.js",
    "/usr/lib/node_modules/@anthropic-ai/claude-code/cli.js",
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
  const patchFile = path.join(__dirname, "..", "patches", "scroll-fix.patch");
  if (!fs.existsSync(patchFile)) return false;

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
    console.error("Could not find cli.js. Pass the path as an argument:");
    console.error("  node install.js /path/to/cli.js");
    process.exit(1);
  }

  let content = fs.readFileSync(cliPath, "utf-8");
  const origHash = sha256(content);

  if (uninstall) {
    if (!content.includes(PATCH_MARKER)) {
      console.log("Patch not found — nothing to remove.");
      return;
    }
    const patched = content.replace(
      new RegExp("^.*" + PATCH_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ".*\\n", "m"), ""
    );
    fs.writeFileSync(cliPath, patched);
    console.log("Patch removed from " + cliPath);
    console.log("SHA-256: " + sha256(patched));
    return;
  }

  if (content.includes(PATCH_MARKER)) {
    console.log("Patch already applied to " + cliPath);
    return;
  }

  // Try git apply first (git diff compatible)
  if (tryGitApply(cliPath)) {
    console.log("Patch applied via git apply to " + cliPath);
    console.log("Original SHA-256: " + origHash);
    console.log("Patched  SHA-256: " + sha256(fs.readFileSync(cliPath, "utf-8")));
    return;
  }

  // Fallback: string injection before first import{ or var
  let idx = content.indexOf("import{");
  if (idx === -1) idx = content.indexOf("\nvar ");
  if (idx === -1) {
    console.error("Could not find injection point in cli.js");
    process.exit(1);
  }

  const PATCH = PATCH_MARKER + PATCH_CODE + "\n";
  const patched = content.slice(0, idx) + PATCH + content.slice(idx);
  fs.writeFileSync(cliPath, patched);

  console.log("Patch applied to " + cliPath);
  console.log("Original SHA-256: " + origHash);
  console.log("Patched  SHA-256: " + sha256(patched));
}

main();
