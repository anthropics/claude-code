import { build } from "bun";
import { readFileSync } from "fs";

// Read changelog for MACRO.VERSION_CHANGELOG
let changelog = "";
try {
  changelog = readFileSync("../../CHANGELOG.md", "utf8").slice(0, 5000);
} catch {
  changelog = "No changelog available";
}

const result = await build({
  entrypoints: ["./src/entrypoints/cli.tsx"],
  outdir: "./dist",
  target: "node",
  format: "esm",
  splitting: false,
  sourcemap: "none",
  minify: false,
  external: [
    // Native modules we can't bundle
    "sharp",
    "fsevents",
    // Node builtins
    "node:*",
    "fs",
    "fs/promises",
    "path",
    "os",
    "crypto",
    "child_process",
    "net",
    "tls",
    "http",
    "https",
    "stream",
    "events",
    "util",
    "url",
    "querystring",
    "zlib",
    "buffer",
    "assert",
    "dns",
    "readline",
    "string_decoder",
    "worker_threads",
    "perf_hooks",
    "async_hooks",
    "v8",
    "inspector",
    "cluster",
    "dgram",
  ],
  define: {
    "MACRO.VERSION": JSON.stringify("2.0.74-src"),
    "MACRO.BUILD_TIME": JSON.stringify(new Date().toISOString()),
    "MACRO.ISSUES_EXPLAINER": JSON.stringify("https://github.com/anthropics/claude-code/issues"),
    "MACRO.FEEDBACK_CHANNEL": JSON.stringify("https://github.com/anthropics/claude-code/issues"),
    "MACRO.PACKAGE_URL": JSON.stringify("https://www.npmjs.com/package/@anthropic-ai/claude-code"),
    "MACRO.NATIVE_PACKAGE_URL": JSON.stringify(""),
    "MACRO.VERSION_CHANGELOG": JSON.stringify(changelog),
  },
  plugins: [
    {
      name: "bun-bundle-shim",
      setup(build) {
        // Shim bun:bundle
        build.onResolve({ filter: /^bun:bundle$/ }, () => ({
          path: new URL("./src/shims/bun-bundle.ts", import.meta.url).pathname,
        }));

        // Handle .node native modules
        build.onResolve({ filter: /\.node$/ }, (args) => ({
          path: args.path,
          external: true,
        }));

        // Handle @ant/* internal packages (not available)
        build.onResolve({ filter: /^@ant\// }, () => ({
          path: "empty-module",
          namespace: "empty",
        }));

        // Handle native napi modules
        build.onResolve({ filter: /^(color-diff-napi|modifiers-napi)$/ }, () => ({
          path: "empty-module",
          namespace: "empty",
        }));

        // Handle missing .md and .txt files (return empty string)
        build.onResolve({ filter: /.*/ }, (args) => {
          const missingPatterns = [
            'connectorText', 'TungstenTool', 'WorkflowTool', 'REPLTool',
            'SuggestBackgroundPRTool', 'VerifyPlanExecutionTool',
            'cachedMicrocompact', 'devtools.js', 'protectedNamespace',
            'coreTypes.generated', 'snipCompact',
            'agents-platform', 'assistant/assistant',
            'SnapshotUpdateDialog', 'AssistantSessionChooser',
            'sdk/runtimeTypes', 'sdk/toolTypes', 'global.d.ts',
            'contextCollapse',
            'filePersistence/types.js',
          ];
          // .md and .txt files → return as text
          if (/\.(md|txt)$/.test(args.path)) {
            return { path: args.path, namespace: "text-stub" };
          }
          if (missingPatterns.some(p => args.path.includes(p))) {
            return { path: "empty-module", namespace: "empty" };
          }
          return undefined;
        });

        build.onLoad({ filter: /.*/, namespace: "text-stub" }, () => ({
          contents: `export default "";`,
          loader: "js",
        }));

        // For empty/stub modules, we need to figure out what names are imported
        // and generate matching exports. We'll do this by scanning the source files
        // that import from missing modules.
        build.onLoad({ filter: /.*/, namespace: "empty" }, (args) => {
          return {
            contents: `
var noop = function() { return noop; };
noop.map = function() { return []; };
noop.filter = function() { return []; };
noop.forEach = function() {};
noop.find = function() {};
noop.some = function() { return false; };
noop.every = function() { return true; };
noop.reduce = function(fn, init) { return init; };
Object.defineProperty(noop, 'length', { value: 0, writable: true, configurable: true });
noop[Symbol.iterator] = [][Symbol.iterator];
noop.toString = function() { return ''; };

export default noop;
export var BROWSER_TOOLS = [];
export var REPL_TOOL_NAME = 'REPLTool';
export var REPL_ONLY_TOOLS = [];
export var isReplModeEnabled = noop;
export var getReplPrimitiveTools = function() { return []; };
export var TUNGSTEN_TOOL_NAME = 'TungstenTool';
export var TungstenTool = noop;
export var TungstenLiveMonitor = noop;
export var WORKFLOW_TOOL_NAME = 'WorkflowTool';
export var start = noop;
export var stop = noop;
export var isModifierPressed = function() { return false; };
export var ciede2000 = function() { return 0; };
export var labToRgb = function(l) { return l; };
export var rgbToLab = function(r) { return r; };
export var isConnectorTextBlock = function() { return false; };
export var ColorDiff = noop;
export var ColorFile = noop;
export var getSyntaxTheme = function() { return {}; };
export var SuggestBackgroundPRTool = noop;
export var VerifyPlanExecutionTool = noop;
export var AssistantSessionChooser = noop;
export var SnapshotUpdateDialog = noop;
export var ConnectorTextBlock = noop;
export var isConnectorText = function() { return false; };
export var snipCompact = noop;
export var contextCollapse = noop;
export var createClaudeForChromeMcpServer = noop;
export var devtools = noop;
export var runtimeTypes = noop;
export var toolTypes = noop;
export var coreTypes = noop;
`,
            loader: "js",
          };
        });
      },
    },
  ],
});

if (result.success) {
  console.log("Build succeeded!");
  console.log("Output:", result.outputs.map((o) => o.path));
} else {
  console.error("Build failed:");
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}
