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

function replaceOneOfExactlyOnce(source, replacements, label) {
  for (const { before, after } of replacements) {
    if (source.includes(before)) {
      return replaceExactlyOnce(source, before, after, label);
    }
  }
  throw new Error(`Could not find expected snippet for ${label}`);
}

function replaceOneOfExactlyOnceIfPresent(source, replacements) {
  for (const { before, after } of replacements) {
    if (source.includes(before)) {
      return replaceExactlyOnce(source, before, after, "optional patch");
    }
  }
  return source;
}

function replaceAllExact(source, before, after, expectedCount, label) {
  const count = source.split(before).length - 1;
  if (count !== expectedCount) {
    throw new Error(
      `Expected ${expectedCount} occurrences for ${label}, found ${count}`
    );
  }
  return source.split(before).join(after);
}

function replaceAllExactIfPresent(source, before, after, expectedCount) {
  const count = source.split(before).length - 1;
  if (count === 0) {
    return source;
  }
  return replaceAllExact(source, before, after, expectedCount, "optional patch");
}

function applyPatch(source) {
  let out = source;

  out = replaceOneOfExactlyOnce(
    out,
    [
      {
        before: "callbackPort:x.number().int().positive().optional()}))",
        after:
          "callbackPort:x.number().int().positive().optional(),redirectUri:x.string().url().optional()}))",
      },
      {
        before:
          'callbackPort:h.number().int().positive().optional(),authServerMetadataUrl:h.string().url().startsWith("https://",{message:"authServerMetadataUrl must use https://"}).optional()}))',
        after:
          'callbackPort:h.number().int().positive().optional(),redirectUri:h.string().url().optional(),authServerMetadataUrl:h.string().url().startsWith("https://",{message:"authServerMetadataUrl must use https://"}).optional()}))',
      },
    ],
    "oauth schema redirectUri"
  );

  out = replaceOneOfExactlyOnce(
    out,
    [
      {
        before: "function NO4(A=PV8){return`http://localhost:${A}/callback`}function z8Y(){",
        after:
          'function NO4(A=PV8){return`http://localhost:${A}/callback`}function mcpOAuthParseExplicitPortW9(A){try{let q=new URL(A);if(!q.port)return;let K=parseInt(q.port,10);if(Number.isFinite(K)&&K>0)return K}catch{}}function mcpOAuthResolveRedirectW9(A,q){try{let K=new URL(A);if(K.protocol!=="http:"&&K.protocol!=="https:")throw Error("OAuth redirectUri must use http or https");let _=q??mcpOAuthParseExplicitPortW9(A);if(_==null)throw Error("OAuth redirectUri must include an explicit port or use callbackPort");return{redirectUri:K.toString(),listenPort:_}}catch(K){throw Error(`Invalid OAuth redirectUri in MCP config: ${K instanceof Error?K.message:String(K)}`)}}function z8Y(){',
      },
      {
        before: "function qk4(A=oS1){return`http://localhost:${A}/callback`}function $7_(){",
        after:
          'function qk4(A=oS1){return`http://localhost:${A}/callback`}function mcpOAuthParseExplicitPortW9(A){try{let q=new URL(A);if(!q.port)return;let K=parseInt(q.port,10);if(Number.isFinite(K)&&K>0)return K}catch{}}function mcpOAuthResolveRedirectW9(A,q){try{let K=new URL(A);if(K.protocol!=="http:"&&K.protocol!=="https:")throw Error("OAuth redirectUri must use http or https");let _=q??mcpOAuthParseExplicitPortW9(A);if(_==null)throw Error("OAuth redirectUri must include an explicit port or use callbackPort");return{redirectUri:K.toString(),listenPort:_}}catch(K){throw Error(`Invalid OAuth redirectUri in MCP config: ${K instanceof Error?K.message:String(K)}`)}}function $7_(){',
      },
    ],
    "redirectUri resolver"
  );

  out = replaceOneOfExactlyOnce(
    out,
    [
      {
        before:
          'let D=q.oauth?.callbackPort,X=D??await e8Y(),M=NO4(X);$8(A,`Using redirect port: ${X}${D?" (from config)":""}`);let P=new M96(A,q,M,!0,K,z?.skipBrowserOpen);',
        after:
          'let D=q.oauth?.callbackPort,X=q.oauth?.redirectUri,M=X?mcpOAuthResolveRedirectW9(X,D):null,mcpFallbackPortW9=D??await e8Y(),mcpRedirectUriW9=M?.redirectUri??NO4(mcpFallbackPortW9);X=M?.listenPort??mcpFallbackPortW9;$8(A,`Using redirect URI: ${mcpRedirectUriW9}${q.oauth?.redirectUri?" (from config)":D?" (from callbackPort config)":""}`);let P=new M96(A,q,mcpRedirectUriW9,!0,K,z?.skipBrowserOpen);',
      },
      {
        before:
          'let M=q.oauth?.callbackPort,X=M??await H7_(),D=qk4(X);a8(A,`Using redirect port: ${X}${M?" (from config)":""}`);let P=new HY6(A,q,D,!0,K,Y?.skipBrowserOpen);',
        after:
          'let M=q.oauth?.callbackPort,X=q.oauth?.redirectUri,D=X?mcpOAuthResolveRedirectW9(X,M):null,mcpFallbackPortW9=M??await H7_(),mcpRedirectUriW9=D?.redirectUri??qk4(mcpFallbackPortW9);X=D?.listenPort??mcpFallbackPortW9;a8(A,`Using redirect URI: ${mcpRedirectUriW9}${q.oauth?.redirectUri?" (from config)":M?" (from callbackPort config)":""}`);let P=new HY6(A,q,mcpRedirectUriW9,!0,K,Y?.skipBrowserOpen);',
      },
    ],
    "oauth redirect selection"
  );

  out = replaceOneOfExactlyOnceIfPresent(out, [
    {
      before:
        '.option("--callback-port <port>","Fixed port for OAuth callback (for servers requiring pre-registered redirect URIs)").helpOption(',
      after:
        '.option("--callback-port <port>","Fixed port for OAuth callback (for servers requiring pre-registered redirect URIs)").option("--redirect-uri <redirectUri>","OAuth redirect URI to use for MCP OAuth callbacks").helpOption(',
    },
  ]);

  out = replaceOneOfExactlyOnceIfPresent(out, [
    {
      before:
        'let J=Y.header?mS1(Y.header):void 0,M=Y.callbackPort?parseInt(Y.callbackPort,10):void 0,X=Y.clientId||M?{...Y.clientId?{clientId:Y.clientId}:{},...M?{callbackPort:M}:{}}:void 0,D=Y.clientSecret&&Y.clientId?await Jc6():void 0,P={type:"sse",url:z,headers:J,oauth:X};',
      after:
        'let J=Y.header?mS1(Y.header):void 0,M=Y.callbackPort?parseInt(Y.callbackPort,10):void 0,X=Y.clientId||M||Y.redirectUri?{...Y.clientId?{clientId:Y.clientId}:{},...M?{callbackPort:M}:{},...Y.redirectUri?{redirectUri:Y.redirectUri}:{}}:void 0,D=Y.clientSecret&&Y.clientId?await Jc6():void 0,P={type:"sse",url:z,headers:J,oauth:X};',
    },
  ]);

  out = replaceOneOfExactlyOnceIfPresent(out, [
    {
      before:
        'let J=Y.header?mS1(Y.header):void 0,M=Y.callbackPort?parseInt(Y.callbackPort,10):void 0,X=Y.clientId||M?{...Y.clientId?{clientId:Y.clientId}:{},...M?{callbackPort:M}:{}}:void 0,D=Y.clientSecret&&Y.clientId?await Jc6():void 0,P={type:"http",url:z,headers:J,oauth:X};',
      after:
        'let J=Y.header?mS1(Y.header):void 0,M=Y.callbackPort?parseInt(Y.callbackPort,10):void 0,X=Y.clientId||M||Y.redirectUri?{...Y.clientId?{clientId:Y.clientId}:{},...M?{callbackPort:M}:{},...Y.redirectUri?{redirectUri:Y.redirectUri}:{}}:void 0,D=Y.clientSecret&&Y.clientId?await Jc6():void 0,P={type:"http",url:z,headers:J,oauth:X};',
    },
  ]);

  out = replaceOneOfExactlyOnceIfPresent(out, [
    {
      before:
        "if(Y.clientId||Y.clientSecret||Y.callbackPort)process.stderr.write(`Warning: --client-id, --client-secret, and --callback-port are only supported for HTTP/SSE transports and will be ignored for stdio.\n`);",
      after:
        "if(Y.clientId||Y.clientSecret||Y.callbackPort||Y.redirectUri)process.stderr.write(`Warning: --client-id, --client-secret, --callback-port, and --redirect-uri are only supported for HTTP/SSE transports and will be ignored for stdio.\n`);",
    },
  ]);

  out = replaceAllExactIfPresent(
    out,
    'if(q.oauth?.clientId||q.oauth?.callbackPort){let _=[];if(q.oauth.clientId){if(_.push("client_id configured"),tS1(A,q)?.clientSecret)_.push("client_secret configured")}if(q.oauth.callbackPort)_.push(`callback_port ${q.oauth.callbackPort}`);console.log(`  OAuth: ${_.join(", ")}`)}',
    'if(q.oauth?.clientId||q.oauth?.callbackPort||q.oauth?.redirectUri){let _=[];if(q.oauth.clientId){if(_.push("client_id configured"),tS1(A,q)?.clientSecret)_.push("client_secret configured")}if(q.oauth.callbackPort)_.push(`callback_port ${q.oauth.callbackPort}`);if(q.oauth.redirectUri)_.push(`redirect_uri ${q.oauth.redirectUri}`);console.log(`  OAuth: ${_.join(", ")}`)}',
    2
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
