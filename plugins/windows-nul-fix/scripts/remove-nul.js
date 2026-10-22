#!/usr/bin/env node
/**
 * Windows NUL File Remover
 *
 * Workaround for https://github.com/anthropics/claude-code/issues/4928
 *
 * On Windows, when Claude Code runs bash commands with '2>nul' redirection
 * (intended for Windows CMD), it creates a literal file named 'nul' instead
 * of redirecting to the null device. This is because Git Bash and other
 * Unix-like shells on Windows treat 'nul' as a regular filename.
 *
 * This script removes any 'nul' files from the current working directory
 * after Bash tool execution.
 */

import { stdin } from "node:process";
import { rmSync, existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";

// Only run on Windows
if (os.platform() !== "win32") {
  process.exit(0);
}

let inputData = "";

stdin.setEncoding("utf8");

stdin.on("data", (chunk) => {
  inputData += chunk;
});

stdin.on("end", () => {
  try {
    if (!inputData || !inputData.trim().startsWith("{")) {
      // No valid JSON input, exit silently
      process.exit(0);
    }

    const event = JSON.parse(inputData);
    const cwd = event.cwd || process.cwd();
    const nulPath = path.join(cwd, "nul");

    // Check if nul file exists and remove it
    if (existsSync(nulPath)) {
      rmSync(nulPath, { force: true });

      // Output message for transcript (optional - can be removed for silent operation)
      // console.log(`Removed 'nul' file from ${cwd}`);
    }

    process.exit(0);
  } catch (error) {
    // Exit silently on errors - don't interrupt the workflow
    process.exit(0);
  }
});

// Handle timeout gracefully
setTimeout(() => {
  process.exit(0);
}, 4000);
