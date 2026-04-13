const test = require("node:test");
const assert = require("node:assert/strict");

const { getPythonLaunchers, runPythonHook } = require("./run_python_hook.js");

test("prefers platform-appropriate Python launchers", () => {
  assert.deepEqual(getPythonLaunchers("win32"), [
    { command: "py", args: ["-3"] },
    { command: "python", args: [] },
    { command: "python3", args: [] },
  ]);

  assert.deepEqual(getPythonLaunchers("linux"), [
    { command: "python3", args: [] },
    { command: "python", args: [] },
  ]);
});

test("falls back to the next launcher when the first command is missing", () => {
  const calls = [];
  const exitCode = runPythonHook({
    scriptPath: "/tmp/hook.py",
    stdin: '{"tool_name":"Edit"}',
    platform: "win32",
    spawnImpl: (command, args, options) => {
      calls.push({ command, args, options });
      if (command === "py") {
        return { error: { code: "ENOENT" }, status: null, stdout: "", stderr: "" };
      }
      return { status: 0, stdout: "ok", stderr: "" };
    },
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(
    calls.map(({ command, args }) => ({ command, args })),
    [
      { command: "py", args: ["-3", "/tmp/hook.py"] },
      { command: "python", args: ["/tmp/hook.py"] },
    ],
  );
  assert.equal(calls[1].options.input, '{"tool_name":"Edit"}');
});

test("silently succeeds when no Python launcher is available", () => {
  const exitCode = runPythonHook({
    scriptPath: "/tmp/hook.py",
    stdin: "",
    platform: "win32",
    spawnImpl: () => ({ error: { code: "ENOENT" }, status: null, stdout: "", stderr: "" }),
  });

  assert.equal(exitCode, 0);
});
