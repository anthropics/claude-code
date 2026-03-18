#!/usr/bin/env node
/**
 * install.js — Patches cli.js to add a native Pwsh tool alongside the Bash tool.
 *
 * This creates a real "Pwsh" tool that shows as ● Pwsh(...) in the UI.
 * Commands are passed directly in PowerShell syntax — no pwsh prefix needed.
 *
 * Usage:
 *   node install.js [path-to-cli.js]
 *   node install.js --uninstall [path-to-cli.js]
 */

"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const MARKER = "_pwshTool_";

// The Pwsh tool definition — injected right before the tool list function.
// It clones the Bash tool (X4), overrides name/description/call to use pwsh,
// and inserts itself into the pl() tool array.
//
// The call function wraps the user's PowerShell command in:
//   pwsh -NoProfile -NonInteractive -Command "..."
// so the Bash tool's shell executor handles process management, timeout, etc.
function buildPatch(bashToolVar) {
  // Build a Pwsh tool as a plain object that delegates getters to the Bash tool.
  // Uses dynamic import() (ESM-compatible) and writes commands to temp .ps1 files
  // to avoid bash variable expansion issues with -Command.
  const pwshDef = `var ${MARKER}={` +
    `name:"Pwsh",` +
    `searchHint:"execute PowerShell commands",` +
    `maxResultSizeChars:1e5,` +
    `userFacingName(){return"Pwsh"},` +
    `get inputSchema(){return ${bashToolVar}.inputSchema},` +
    `get outputSchema(){return ${bashToolVar}.outputSchema},` +
    `shouldDefer:!1,` +
    `isEnabled(){return true},` +
    `isConcurrencySafe(A){return ${bashToolVar}.isConcurrencySafe(A)},` +
    `isReadOnly(A){return ${bashToolVar}.isReadOnly(A)},` +
    `backfillObservableInput(A){return ${bashToolVar}.backfillObservableInput?.(A)},` +
    `toAutoClassifierInput(A){return ${bashToolVar}.toAutoClassifierInput?.(A)},` +
    `async checkPermissions(A,q){return ${bashToolVar}.checkPermissions(A,q)},` +
    `async validateInput(A,q){return ${bashToolVar}.validateInput(A,q)},` +
    `async description(){return"Execute a PowerShell command using pwsh (PowerShell 7+). Use PowerShell syntax, not Bash."},` +
    `async prompt(){return"Use this tool to execute PowerShell commands via pwsh (PowerShell 7+). Use PowerShell syntax: Get-ChildItem (not ls), Get-Content (not cat), Select-String (not grep), $env:VAR (not $VAR). Use forward slashes in paths."},` +
    `renderToolUseMessage:(...a)=>${bashToolVar}.renderToolUseMessage?.(...a),` +
    `renderToolUseProgressMessage:(...a)=>${bashToolVar}.renderToolUseProgressMessage?.(...a),` +
    `renderToolUseRejectedMessage:(...a)=>${bashToolVar}.renderToolUseRejectedMessage?.(...a),` +
    `renderToolUseErrorMessage:(...a)=>${bashToolVar}.renderToolUseErrorMessage?.(...a),` +
    `renderToolResultMessage:(...a)=>${bashToolVar}.renderToolResultMessage?.(...a),` +
    `mapToolResultToToolResultBlockParam:(...a)=>${bashToolVar}.mapToolResultToToolResultBlockParam?.(...a),` +
    // call: write to temp .ps1 file, detect pwsh path, run via -File
    `async call(A,q,z){` +
    `var cmd=A.command;` +
    `var {writeFileSync:_wf,unlinkSync:_ul}=await import("node:fs");` +
    `var {tmpdir:_td}=await import("node:os");` +
    `var {join:_jn}=await import("node:path");` +
    `var {execFileSync:_ef}=await import("node:child_process");` +
    `var _tf=_jn(_td(),"claude-pwsh-"+Math.random().toString(36).slice(2)+".ps1");` +
    `_wf(_tf,cmd,"utf-8");` +
    `var _pb="";` +
    `var _paths=process.platform==="win32"?` +
    `["C:/Program Files/PowerShell/7-preview/pwsh.exe","C:/Program Files/PowerShell/7/pwsh.exe","pwsh-preview","pwsh"]` +
    `:["pwsh-preview","pwsh","/usr/local/bin/pwsh","/usr/bin/pwsh","/snap/bin/pwsh-preview"];` +
    `for(var _pp of _paths){try{` +
    `if(_pp.includes("/")){try{(await import("node:fs")).accessSync(_pp);_pb=_pp;break}catch{continue}}` +
    `else{_ef(process.platform==="win32"?"where":"which",[_pp],{timeout:2e3,stdio:"pipe"});_pb=_pp;break}` +
    `}catch{}}` +
    `if(!_pb)_pb="pwsh";` +
    `var _tfp=_tf.replace(/\\\\\\\\/g,"/");` +
    `A={...A,command:'"'+_pb+'" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "'+_tfp+'"'};` +
    `var _r=${bashToolVar}.call.call(this,A,q,z);` +
    `if(_r&&_r.result)_r.result.then(function(){try{_ul(_tf)}catch{}});` +
    `return _r}` +
    `};`;
  return pwshDef;
}

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

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
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

  if (uninstall) {
    if (!content.includes(MARKER)) {
      console.log("Pwsh tool not found — nothing to remove.");
      return;
    }
    // Remove the tool definition
    const defRegex = new RegExp(`var ${MARKER}=\\(function\\(\\)\\{.*?\\}\\)\\(\\);`, "s");
    content = content.replace(defRegex, "");
    // Remove from tool array
    content = content.replace(new RegExp(`,${MARKER},`, "g"), ",");
    content = content.replace(new RegExp(`${MARKER},`, "g"), "");
    fs.writeFileSync(cliPath, content);
    console.log("Pwsh tool removed from " + cliPath);
    console.log("SHA-256: " + sha256(content));
    return;
  }

  if (content.includes(MARKER)) {
    console.log("Pwsh tool already installed in " + cliPath);
    return;
  }

  // 1. Find the Bash tool variable: <VAR>={name:<nameVar>,searchHint:"execute shell commands"
  const bashToolMatch = content.match(/(\w+)=\{name:(\w+),searchHint:"execute shell commands"/);
  if (!bashToolMatch) {
    console.error("Could not find Bash tool definition in cli.js.");
    process.exit(1);
  }
  const bashToolVar = bashToolMatch[1]; // e.g., "X4"

  // 2. Find the tool list function: function pl(){return[...,<bashToolVar>,...
  const toolListRegex = new RegExp(`(function \\w+\\(\\)\\{return\\[[^\\]]*?)${bashToolVar},`);
  const toolListMatch = content.match(toolListRegex);
  if (!toolListMatch) {
    console.error("Could not find tool list containing Bash tool.");
    process.exit(1);
  }

  // 3. Inject Pwsh tool definition before the tool list function
  const pwshDef = buildPatch(bashToolVar);
  const toolListFunc = toolListMatch[0];
  const newToolListFunc = toolListFunc.replace(
    `${bashToolVar},`,
    `${bashToolVar},${MARKER},`
  );

  content = content.replace(toolListFunc, pwshDef + newToolListFunc);

  fs.writeFileSync(cliPath, content);
  console.log("Pwsh tool installed in " + cliPath);
  console.log("  Bash tool var: " + bashToolVar);
  console.log("  Original SHA-256: " + origHash);
  console.log("  Patched  SHA-256: " + sha256(content));
}

main();
