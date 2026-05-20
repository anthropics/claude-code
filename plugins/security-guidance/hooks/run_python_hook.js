#!/usr/bin/env node

const fs = require("node:fs");
const { spawnSync } = require("node:child_process");

function getPythonLaunchers(platform = process.platform) {
  if (platform === "win32") {
    return [
      { command: "py", args: ["-3"] },
      { command: "python", args: [] },
      { command: "python3", args: [] },
    ];
  }

  return [
    { command: "python3", args: [] },
    { command: "python", args: [] },
  ];
}

function runPythonHook({
  scriptPath,
  stdin,
  env = process.env,
  platform = process.platform,
  spawnImpl = spawnSync,
}) {
  for (const launcher of getPythonLaunchers(platform)) {
    const result = spawnImpl(launcher.command, [...launcher.args, scriptPath], {
      env,
      input: stdin,
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf8",
    });

    if (result.error?.code === "ENOENT") {
      continue;
    }

    if (typeof result.stdout === "string" && result.stdout.length > 0) {
      process.stdout.write(result.stdout);
    }
    if (typeof result.stderr === "string" && result.stderr.length > 0) {
      process.stderr.write(result.stderr);
    }

    return result.status ?? (result.error ? 1 : 0);
  }

  return 0;
}

if (require.main === module) {
  const scriptPath = process.argv[2];
  if (!scriptPath) {
    process.exit(0);
  }

  const stdin = fs.readFileSync(0);
  process.exit(runPythonHook({ scriptPath, stdin }));
}

module.exports = {
  getPythonLaunchers,
  runPythonHook,
};
