#!/usr/bin/env node
/**
 * Claude Code Hook: Session Auto-Title (JavaScript)
 * ==================================================
 * This hook runs as a UserPromptSubmit hook.
 * On the FIRST message of each new session it injects an additionalContext
 * instruction that tells Claude to set a meaningful session title (via whatever
 * title-setting mechanism is available — e.g. /rename or an MCP tool such as
 * mcp__happy__change_title from the Happy app).
 *
 * Without this hook, title-setting relies solely on the system prompt, which is
 * less reliable because MCP tool schemas are loaded lazily (deferred). Injecting
 * the instruction directly into the first user-message turn — the same technique
 * used for Codex / Gemini integrations — makes auto-titling deterministic.
 *
 * Read more about hooks here: https://docs.anthropic.com/en/docs/claude-code/hooks
 *
 * HOW IT WORKS
 * ------------
 * * Uses CLAUDE_SESSION_ID to create a tiny per-session flag file in the OS temp
 *   directory (/tmp on Linux/macOS, %TEMP% on Windows).
 * * First call  → writes flag, outputs additionalContext JSON → Claude sets title.
 * * Later calls → flag exists, hook exits 0 silently (no overhead).
 * * Flag files are cleaned up automatically by the OS on reboot.
 *
 * SETUP
 * -----
 * Add to ~/.claude/settings.json (global) or .claude/settings.json (project):
 *
 * {
 *   "hooks": {
 *     "UserPromptSubmit": [
 *       {
 *         "hooks": [
 *           {
 *             "type": "command",
 *             "command": "node /path/to/claude-code/examples/hooks/session_auto_title_example.js"
 *           }
 *         ]
 *       }
 *     ]
 *   }
 * }
 *
 * UserPromptSubmit hooks have no "matcher" field (they always run).
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

// Instruction injected into the model context on the first turn.
// Tells Claude to set a concise title that represents the session topic.
// If no title-setting tool is available, Claude is instructed to skip gracefully.
const TITLE_INSTRUCTION = [
  'IMPORTANT — this is the first message of a new session.',
  'Please set a short, descriptive session title (≤60 chars) that captures',
  'what this conversation is about.',
  '• If the mcp__happy__change_title tool is available:',
  '  call ToolSearch with query "select:mcp__happy__change_title",',
  '  then call mcp__happy__change_title with the title.',
  '• Otherwise, use the /rename slash command.',
  'Do this alongside your first response — not after.',
].join('\n');

/**
 * Return a per-session flag file path in the OS temp directory.
 * @param {string} sessionId
 * @returns {string}
 */
function flagPath(sessionId) {
  return path.join(os.tmpdir(), `cc-autotitle-${sessionId}.done`);
}

function main() {
  const sessionId = process.env.CLAUDE_SESSION_ID;

  if (!sessionId) {
    // No session ID — nothing to do.
    process.exit(0);
  }

  const flag = flagPath(sessionId);

  if (fs.existsSync(flag)) {
    // Not the first message — skip silently.
    process.exit(0);
  }

  // Mark this session so subsequent messages don't inject the instruction.
  try {
    // 'wx' flag = exclusive create; fails if the file already exists (race-safe).
    fs.writeFileSync(flag, '1', { flag: 'wx' });
  } catch (err) {
    if (err.code === 'EEXIST') {
      // Another process beat us to it — treat as "not first message".
      process.exit(0);
    }
    // On other errors, still proceed — worst case we inject the instruction
    // twice in a race, which is harmless.
  }

  // Output additionalContext to inject into the model's context window.
  const output = {
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: TITLE_INSTRUCTION,
    },
  };

  process.stdout.write(JSON.stringify(output));
}

main();
