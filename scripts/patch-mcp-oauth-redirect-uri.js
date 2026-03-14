#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const path = require("node:path");

function replaceExactlyOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first === -1) {
    throw new Error(`Could not find expected snippet for ${label}`);
  }
  const second = source.indexOf(before, first + 1);
  if (second !== -1) {
    throw new Error(`Found multiple snippets for ${label}; refusing unsafe patch`);
  }
  return source.replace(before, after);
}

function applyPatch(source) {
  let out = source;

  out = replaceExactlyOnce(
    out,
    "callbackPort:x.number().int().positive().optional()}))",
    "callbackPort:x.number().int().positive().optional(),redirectUri:x.string().url().optional()}))",
    "oauth schema redirectUri"
  );

  out = replaceExactlyOnce(
    out,
    "function NO4(A=PV8){return`http://localhost:${A}/callback`}",
    "function NO4(A=PV8){return`http://localhost:${A}/callback`}function mcpOAuthParseExplicitPortW9(A){try{let q=new URL(A);if(!q.port)return;let K=parseInt(q.port,10);if(Number.isFinite(K)&&K>0)return K}catch{}}function mcpOAuthResolveRedirectW9(A,q){try{let K=new URL(A);if(K.protocol!==\"http:\"&&K.protocol!==\"https:\")throw Error(\"OAuth redirectUri must use http or https\");return{redirectUri:K.toString(),listenPort:q??mcpOAuthParseExplicitPortW9(A)}}catch(K){throw Error(`Invalid OAuth redirectUri in MCP config: ${K instanceof Error?K.message:String(K)}`)}}",
    "redirectUri resolver"
  );

  out = replaceExactlyOnce(
    out,
    "let D=q.oauth?.callbackPort,X=D??await e8Y(),M=NO4(X);$8(A,`Using redirect port: ${X}${D?\" (from config)\":\"\"}`);let P=new M96(A,q,M,!0,K,z?.skipBrowserOpen);",
    "let D=q.oauth?.callbackPort,X=q.oauth?.redirectUri,M=X?mcpOAuthResolveRedirectW9(X,D):null,W0=D??await e8Y(),G0=M?.redirectUri??NO4(W0),Z0=M?.listenPort??W0;$8(A,`Using redirect URI: ${G0}${X?\" (from config)\":D?\" (from callbackPort config)\":\"\"}`);let P=new M96(A,q,G0,!0,K,z?.skipBrowserOpen);",
    "oauth redirect selection"
  );

  out = replaceExactlyOnce(
    out,
    "G.listen(X,async()=>{",
    "G.listen(Z0,async()=>{",
    "callback listener port"
  );

  return out;
}

function main() {
  const target = process.argv[2];
  if (!target) {
    console.error("Usage: node scripts/patch-mcp-oauth-redirect-uri.js <path-to-cli.js>");
    process.exit(1);
  }

  const filePath = path.resolve(target);
  const input = fs.readFileSync(filePath, "utf8");

  if (input.includes("mcpOAuthResolveRedirectW9")) {
    console.log("Patch already applied:", filePath);
    return;
  }

  const patched = applyPatch(input);
  const backupPath = `${filePath}.bak`;
  fs.copyFileSync(filePath, backupPath);
  fs.writeFileSync(filePath, patched, "utf8");

  console.log("Patched:", filePath);
  console.log("Backup :", backupPath);
}

main();
