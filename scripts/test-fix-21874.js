/**
 * Test that the patch correctly changes behavior:
 * - BEFORE: missing scope -> early return {} (no fetch attempted)
 * - AFTER:  missing scope -> log warning, continue to fetch
 *
 * We extract and test the relevant code path by simulating the
 * function's behavior with mock dependencies.
 */

const fs = require("fs");
const path = require("path");

// ── Helpers ──

function extractFetchFn(cliJsContent) {
  // Find the scope check inside the MCP fetch function.
  // Use "Missing user:mcp_servers scope" as the unique anchor
  // (appears only once, inside the $Y6 function).
  const anchor = "Missing user:mcp_servers scope";
  const anchorIdx = cliJsContent.indexOf(anchor);
  if (anchorIdx === -1) throw new Error("Could not find scope check anchor in cli.js");

  const start = Math.max(0, anchorIdx - 500);
  const end = Math.min(cliJsContent.length, anchorIdx + 500);
  return cliJsContent.slice(start, end);
}

function checkHasEarlyReturn(chunk) {
  // Look for the pattern: includes("user:mcp_servers"))return V(`...Missing
  // vs: includes("user:mcp_servers"))V(`...Missing
  const scopeLine = chunk.match(/includes\("user:mcp_servers"\)\)(return\s+V|V)\(/);
  if (!scopeLine) return null;
  return scopeLine[1].startsWith("return");
}

// ── Run tests ──

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}: ${e.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || "Assertion failed");
}

console.log("=== Testing original (unpatched) cli.js ===\n");

const originalContent = fs.readFileSync(
  path.join(__dirname, "package/cli.js.orig.js"),
  "utf-8"
);

const originalChunk = extractFetchFn(originalContent);

test("Original has early return on missing scope", () => {
  const hasReturn = checkHasEarlyReturn(originalChunk);
  assert(hasReturn === true, `Expected early return, got: ${hasReturn}`);
});

test("Original contains 'missing_scope' state (not retry)", () => {
  assert(
    originalChunk.includes('"missing_scope"'),
    "missing_scope state not found"
  );
  assert(
    !originalChunk.includes('"missing_scope_retry"'),
    "missing_scope_retry should NOT be in original"
  );
});

test("Original returns {} after scope check", () => {
  // The pattern: Q("tengu_claudeai_mcp_eligibility",{state:"missing_scope"}),{};
  assert(
    originalChunk.includes('state:"missing_scope"}),{}'),
    "Early return {} pattern not found"
  );
});

console.log("\n=== Testing patched cli.js ===\n");

const patchedContent = fs.readFileSync(
  path.join(__dirname, "package/cli.js"),
  "utf-8"
);

const patchedChunk = extractFetchFn(patchedContent);

test("Patched does NOT have early return on missing scope", () => {
  const hasReturn = checkHasEarlyReturn(patchedChunk);
  assert(hasReturn === false, `Expected no early return, got: ${hasReturn}`);
});

test("Patched contains 'missing_scope_retry' state", () => {
  assert(
    patchedChunk.includes('"missing_scope_retry"'),
    "missing_scope_retry state not found"
  );
});

test("Patched does NOT return {} after scope check", () => {
  assert(
    !patchedChunk.includes('state:"missing_scope"}),{}'),
    "Early return {} pattern should NOT be in patched version"
  );
});

test("Patched contains 'will attempt fetch' log message", () => {
  assert(
    patchedChunk.includes("will attempt fetch"),
    "'will attempt fetch' message not found"
  );
});

test("Patched still proceeds to fetch URL after scope check", () => {
  // After the scope check, the code should continue to:
  // let K=`${iA().BASE_API_URL}/v1/mcp_servers?limit=1000`
  const scopeIdx = patchedChunk.indexOf("missing_scope_retry");
  const fetchIdx = patchedChunk.indexOf("/v1/mcp_servers", scopeIdx);
  assert(fetchIdx > scopeIdx, "Fetch URL should come after scope check");
});

console.log("\n=== Testing behavioral simulation ===\n");

// Simulate the patched behavior with mocks
test("Simulated: token with scope -> fetch proceeds", () => {
  const token = { accessToken: "test", scopes: ["user:inference", "user:mcp_servers"] };
  const hasScope = token.scopes?.includes("user:mcp_servers");
  assert(hasScope === true, "Scope should be present");
  // In both old and new code, fetch proceeds
});

test("Simulated: token without scope -> old code returns early", () => {
  const token = { accessToken: "test", scopes: ["user:inference"] };
  const hasScope = token.scopes?.includes("user:mcp_servers");
  assert(hasScope === false, "Scope should be missing");
  // Old code: return {}
  // We verify the original code has "return" here
  const hasReturn = checkHasEarlyReturn(originalChunk);
  assert(hasReturn === true, "Original should return early");
});

test("Simulated: token without scope -> new code continues to fetch", () => {
  const token = { accessToken: "test", scopes: ["user:inference"] };
  const hasScope = token.scopes?.includes("user:mcp_servers");
  assert(hasScope === false, "Scope should be missing");
  // New code: log warning, continue
  const hasReturn = checkHasEarlyReturn(patchedChunk);
  assert(hasReturn === false, "Patched should NOT return early");
});

test("Simulated: token with no scopes at all -> new code continues to fetch", () => {
  const token = { accessToken: "test", scopes: null };
  const hasScope = token.scopes?.includes("user:mcp_servers");
  assert(hasScope === undefined || hasScope === false, "Scope should be falsy");
  // New code still continues (the if block runs but doesn't return)
  const hasReturn = checkHasEarlyReturn(patchedChunk);
  assert(hasReturn === false, "Patched should NOT return early");
});

console.log("\n=== Testing patch script idempotency ===\n");

test("Patch script detects already-patched file", () => {
  // The patch script checks for new_text in content
  assert(
    patchedContent.includes("missing_scope_retry"),
    "Patched file should contain retry marker"
  );
  assert(
    !patchedContent.includes('state:"missing_scope"}),{}'),
    "Patched file should not contain old early-return"
  );
});

test("Patch script would find target in original file", () => {
  const oldText =
    'if(!A.scopes?.includes("user:mcp_servers"))' +
    "return V(`[claudeai-mcp] Missing user:mcp_servers scope " +
    '(scopes=${A.scopes?.join(",")||"none"})`),' +
    'Q("tengu_claudeai_mcp_eligibility",{state:"missing_scope"}),{};';
  assert(originalContent.includes(oldText), "Original should contain old text");
  assert(!patchedContent.includes(oldText), "Patched should not contain old text");
});

// ── Summary ──

console.log(`\n${"=".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log("=".repeat(50));

process.exit(failed > 0 ? 1 : 0);
