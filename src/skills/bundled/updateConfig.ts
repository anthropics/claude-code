import { toJSONSchema } from 'zod/v4'
import { SettingsSchema } from '../../utils/settings/types.js'
import { jsonStringify } from '../../utils/slowOperations.js'
import { registerBundledSkill } from '../bundledSkills.js'

/**
 * Generate JSON Schema from the settings Zod schema.
 * This keeps the skill prompt in sync with the actual types.
 */
function generateSettingsSchema(): string {
  const jsonSchema = toJSONSchema(SettingsSchema(), { io: 'input' })
  return jsonStringify(jsonSchema, null, 2)
}

const SETTINGS_EXAMPLES_DOCS = `## Settings File Locations

Choose the appropriate file based on scope:

| File | Scope | Git | Use For |
|------|-------|-----|---------|
| \`~/.claude/settings.json\` | Global | N/A | Personal preferences for all projects |
| \`.claude/settings.json\` | Project | Commit | Team-wide hooks, permissions, plugins |
| \`.claude/settings.local.json\` | Project | Gitignore | Personal overrides for this project |

Settings load in order: user → project → local (later overrides earlier).

## Settings Schema Reference

### Permissions
\`\`\`json
{
  "permissions": {
    "allow": ["Bash(npm:*)", "Edit(.claude)", "Read"],
    "deny": ["Bash(rm -rf:*)"],
    "ask": ["Write(/etc/*)"],
    "defaultMode": "default" | "plan" | "acceptEdits" | "dontAsk",
    "additionalDirectories": ["/extra/dir"]
  }
}
\`\`\`

**Permission Rule Syntax:**
- Exact match: \`"Bash(npm run test)"\`
- Prefix wildcard: \`"Bash(git:*)"\` - matches \`git status\`, \`git commit\`, etc.
- Tool only: \`"Read"\` - allows all Read operations

### Environment Variables
\`\`\`json
{
  "env": {
    "DEBUG": "true",
    "MY_API_KEY": "value"
  }
}
\`\`\`

### Model & Agent
\`\`\`json
{
  "model": "sonnet",  // or "opus", "haiku", full model ID
  "agent": "agent-name",
  "alwaysThinkingEnabled": true
}
\`\`\`

### Attribution (Commits & PRs)
\`\`\`json
{
  "attribution": {
    "commit": "Custom commit trailer text",
    "pr": "Custom PR description text"
  }
}
\`\`\`
Set \`commit\` or \`pr\` to empty string \`""\` to hide that attribution.

### MCP Server Management
\`\`\`json
{
  "enableAllProjectMcpServers": true,
  "enabledMcpjsonServers": ["server1", "server2"],
  "disabledMcpjsonServers": ["blocked-server"]
}
\`\`\`

### Plugins
\`\`\`json
{
  "enabledPlugins": {
    "formatter@anthropic-tools": true
  }
}
\`\`\`
Plugin syntax: \`plugin-name@source\` where source is \`claude-code-marketplace\`, \`claude-plugins-official\`, or \`builtin\`.

### Other Settings
- \`language\`: Preferred response language (e.g., "japanese")
- \`cleanupPeriodDays\`: Days to keep transcripts (default: 30; 0 disables persistence entirely)
- \`respectGitignore\`: Whether to respect .gitignore (default: true)
- \`spinnerTipsEnabled\`: Show tips in spinner
- \`spinnerVerbs\`: Customize spinner verbs (\`{ "mode": "append" | "replace", "verbs": [...] }\`)
- \`spinnerTipsOverride\`: Override spinner tips (\`{ "excludeDefault": true, "tips": ["Custom tip"] }\`)
- \`syntaxHighlightingDisabled\`: Disable diff highlighting
`

// Note: We keep hand-written examples for common patterns since they're more
// actionable than auto-generated schema docs. The generated schema list
// provides completeness while examples provide clarity.

const HOOKS_DOCS = `## Hooks Configuration

Hooks run commands at specific points in Claude Code's lifecycle.

### Hook Structure
\`\`\`json
{
  "hooks": {
    "EVENT_NAME": [
      {
        "matcher": "ToolName|OtherTool",
        "hooks": [
          {
            "type": "command",
            "command": "your-command-here",
            "timeout": 60,
            "statusMessage": "Running..."
          }
        ]
      }
    ]
  }
}
\`\`\`

### Hook Events

| Event | Matcher | Purpose |
|-------|---------|---------|
| PermissionRequest | Tool name | Run before permission prompt |
| PreToolUse | Tool name | Run before tool, can block |
| PostToolUse | Tool name | Run after successful tool |
| PostToolUseFailure | Tool name | Run after tool fails |
| Notification | Notification type | Run on notifications |
| Stop | - | Run when Claude stops (including clear, resume, compact) |
| PreCompact | "manual"/"auto" | Before compaction |
| PostCompact | "manual"/"auto" | After compaction (receives summary) |
| UserPromptSubmit | - | When user submits |
| SessionStart | - | When session starts |

**Common tool matchers:** \`Bash\`, \`Write\`, \`Edit\`, \`Read\`, \`Glob\`, \`Grep\`

### Hook Types

**1. Command Hook** - Runs a shell command:
\`\`\`json
{ "type": "command", "command": "prettier --write $FILE", "timeout": 30 }
\`\`\`

**2. Prompt Hook** - Evaluates a condition with LLM:
\`\`\`json
{ "type": "prompt", "prompt": "Is this safe? $ARGUMENTS" }
\`\`\`
Only available for tool events: PreToolUse, PostToolUse, PermissionRequest.

**3. Agent Hook** - Runs an agent with tools:
\`\`\`json
{ "type": "agent", "prompt": "Verify tests pass: $ARGUMENTS" }
\`\`\`
Only available for tool events: PreToolUse, PostToolUse, PermissionRequest.

### Hook Input (stdin JSON)
\`\`\`json
{
  "session_id": "abc123",
  "tool_name": "Write",
  "tool_input": { "file_path": "/path/to/file.txt", "content": "..." },
  "tool_response": { "success": true }  // PostToolUse only
}
\`\`\`

### Hook JSON Output

Hooks can return JSON to control behavior:

\`\`\`json
{
  "systemMessage": "Warning shown to user in UI",
  "continue": false,
  "stopReason": "Message shown when blocking",
  "suppressOutput": false,
  "decision": "block",
  "reason": "Explanation for decision",
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "Context injected back to model"
  }
}
\`\`\`

**Fields:**
- \`systemMessage\` - Display a message to the user (all hooks)
- \`continue\` - Set to \`false\` to block/stop (default: true)
- \`stopReason\` - Message shown when \`continue\` is false
- \`suppressOutput\` - Hide stdout from transcript (default: false)
- \`decision\` - "block" for PostToolUse/Stop/UserPromptSubmit hooks (deprecated for PreToolUse, use hookSpecificOutput.permissionDecision instead)
- \`reason\` - Explanation for decision
- \`hookSpecificOutput\` - Event-specific output (must include \`hookEventName\`):
  - \`additionalContext\` - Text injected into model context
  - \`permissionDecision\` - "allow", "deny", or "ask" (PreToolUse only)
  - \`permissionDecisionReason\` - Reason for the permission decision (PreToolUse only)
  - \`updatedInput\` - Modified tool input (PreToolUse only)

### Common Patterns

**Auto-format after writes:**
\`\`\`json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Write|Edit",
      "hooks": [{
        "type": "command",
        "command": "jq -r '.tool_response.filePath // .tool_input.file_path' | { read -r f; prettier --write \\"$f\\"; } 2>/dev/null || true"
      }]
    }]
  }
}
\`\`\`

**Log all bash commands:**
\`\`\`json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Bash",
      "hooks": [{
        "type": "command",
        "command": "jq -r '.tool_input.command' >> ~/.claude/bash-log.txt"
      }]
    }]
  }
}
\`\`\`

**Stop hook that displays message to user:**

Command must output JSON with \`systemMessage\` field:
\`\`\`bash
# Example command that outputs: {"systemMessage": "Session complete!"}
echo '{"systemMessage": "Session complete!"}'
\`\`\`

**Run tests after code changes:**
\`\`\`json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Write|Edit",
      "hooks": [{
        "type": "command",
        "command": "jq -r '.tool_input.file_path // .tool_response.filePath' | grep -E '\\\\.(ts|js)$' && npm test || true"
      }]
    }]
  }
}
\`\`\`
`

const HOOK_VERIFICATION_FLOW = `## Constructing a Hook (with verification)

Given an event, matcher, target file, and desired behavior, follow this flow. Each step catches a different failure class — a hook that silently does nothing is worse than no hook.

1. **Dedup check.** Read the target file. If a hook already exists on the same event+matcher, show the existing command and ask: keep it, replace it, or add alongside.

2. **Construct the command for THIS project — don't assume.** The hook receives JSON on stdin. Build a command that:
   - Extracts any needed payload safely — use \`jq -r\` into a quoted variable or \`{ read -r f; ... "$f"; }\`, NOT unquoted \`| xargs\` (splits on spaces)
   - Invokes the underlying tool the way this project runs it (npx/bunx/yarn/pnpm? Makefile target? globally-installed?)
   - Skips inputs the tool doesn't handle (formatters often have \`--ignore-unknown\`; if not, guard by extension)
   - Stays RAW for now — no \`|| true\`, no stderr suppression. You'll wrap it after the pipe-test passes.

3. **Pipe-test the raw command.** Synthesize the stdin payload the hook will receive and pipe it directly:
   - \`Pre|PostToolUse\` on \`Write|Edit\`: \`echo '{"tool_name":"Edit","tool_input":{"file_path":"<a real file from this repo>"}}' | <cmd>\`
   - \`Pre|PostToolUse\` on \`Bash\`: \`echo '{"tool_name":"Bash","tool_input":{"command":"ls"}}' | <cmd>\`
   - \`Stop\`/\`UserPromptSubmit\`/\`SessionStart\`: most commands don't read stdin, so \`echo '{}' | <cmd>\` suffices

   Check exit code AND side effect (file actually formatted, test actually ran). If it fails you get a real error — fix (wrong package manager? tool not installed? jq path wrong?) and retest. Once it works, wrap with \`2>/dev/null || true\` (unless the user wants a blocking check).

4. **Write the JSON.** Merge into the target file (schema shape in the "Hook Structure" section above). If this creates \`.claude/settings.local.json\` for the first time, add it to .gitignore — the Write tool doesn't auto-gitignore it.

5. **Validate syntax + schema in one shot:**

   \`jq -e '.hooks.<event>[] | select(.matcher == "<matcher>") | .hooks[] | select(.type == "command") | .command' <target-file>\`

   Exit 0 + prints your command = correct. Exit 4 = matcher doesn't match. Exit 5 = malformed JSON or wrong nesting. A broken settings.json silently disables ALL settings from that file — fix any pre-existing malformation too.

6. **Prove the hook fires** — only for \`Pre|PostToolUse\` on a matcher you can trigger in-turn (\`Write|Edit\` via Edit, \`Bash\` via Bash). \`Stop\`/\`UserPromptSubmit\`/\`SessionStart\` fire outside this turn — skip to step 7.

   For a **formatter** on \`PostToolUse\`/\`Write|Edit\`: introduce a detectable violation via Edit (two consecutive blank lines, bad indentation, missing semicolon — something this formatter corrects; NOT trailing whitespace, Edit strips that before writing), re-read, confirm the hook **fixed** it. For **anything else**: temporarily prefix the command in settings.json with \`echo "$(date) hook fired" >> /tmp/claude-hook-check.txt; \`, trigger the matching tool (Edit for \`Write|Edit\`, a harmless \`true\` for \`Bash\`), read the sentinel file.

   **Always clean up** — revert the violation, strip the sentinel prefix — whether the proof passed or failed.

   **If proof fails but pipe-test passed and \`jq -e\` passed**: the settings watcher isn't watching \`.claude/\` — it only watches directories that had a settings file when this session started. The hook is written correctly. Tell the user to open \`/hooks\` once (reloads config) or restart — you can't do this yourself; \`/hooks\` is a user UI menu and opening it ends this turn.

7. **Handoff.** Tell the user the hook is live (or needs \`/hooks\`/restart per the watcher caveat). Point them at \`/hooks\` to review, edit, or disable it later. The UI only shows "Ran N hooks" if a hook errors or is slow — silent success is invisible by design.
`

const UPDATE_CONFIG_PROMPT = `# Update Config Skill

Modify Claude Code configuration by updating settings.json files.

## When Hooks Are Required (Not Memory)

If the user wants something to happen automatically in response to an EVENT, they need a **hook** configured in settings.json. Memory/preferences cannot trigger automated actions.

**These require hooks:**
- "Before compacting, ask me what to preserve" → PreCompact hook
- "After writing files, run prettier" → PostToolUse hook with Write|Edit matcher
- "When I run bash commands, log them" → PreToolUse hook with Bash matcher
- "Always run tests after code changes" → PostToolUse hook

**Hook events:** PreToolUse, PostToolUse, PreCompact, PostCompact, Stop, Notification, SessionStart

## CRITICAL: Read Before Write

**Always read the existing settings file before making changes.** Merge new settings with existing ones - never replace the entire file.

## CRITICAL: Use AskUserQuestion for Ambiguity

When the user's request is ambiguous, use AskUserQuestion to clarify:
- Which settings file to modify (user/project/local)
- Whether to add to existing arrays or replace them
- Specific values when multiple options exist

## Decision: Config Tool vs Direct Edit

**Use the Config tool** for these simple settings:
- \`theme\`, \`editorMode\`, \`verbose\`, \`model\`
- \`language\`, \`alwaysThinkingEnabled\`
- \`permissions.defaultMode\`

**Edit settings.json directly** for:
- Hooks (PreToolUse, PostToolUse, etc.)
- Complex permission rules (allow/deny arrays)
- Environment variables
- MCP server configuration
- Plugin configuration

## Workflow

1. **Clarify intent** - Ask if the request is ambiguous
2. **Read existing file** - Use Read tool on the target settings file
3. **Merge carefully** - Preserve existing settings, especially arrays
4. **Edit file** - Use Edit tool (if file doesn't exist, ask user to create it first)
5. **Confirm** - Tell user what was changed

## Merging Arrays (Important!)

When adding to permission arrays or hook arrays, **merge with existing**, don't replace:

**WRONG** (replaces existing permissions):
\`\`\`json
{ "permissions": { "allow": ["Bash(npm:*)"] } }
\`\`\`

**RIGHT** (preserves existing + adds new):
\`\`\`json
{
  "permissions": {
    "allow": [
      "Bash(git:*)",      // existing
      "Edit(.claude)",    // existing
      "Bash(npm:*)"       // new
    ]
  }
}
\`\`\`

${SETTINGS_EXAMPLES_DOCS}

${HOOKS_DOCS}

${HOOK_VERIFICATION_FLOW}

## Example Workflows

### Adding a Hook

User: "Format my code after Claude writes it"

1. **Clarify**: Which formatter? (prettier, gofmt, etc.)
2. **Read**: \`.claude/settings.json\` (or create if missing)
3. **Merge**: Add to existing hooks, don't replace
4. **Result**:
\`\`\`json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Write|Edit",
      "hooks": [{
        "type": "command",
        "command": "jq -r '.tool_response.filePath // .tool_input.file_path' | { read -r f; prettier --write \\"$f\\"; } 2>/dev/null || true"
      }]
    }]
  }
}
\`\`\`

### Adding Permissions

User: "Allow npm commands without prompting"

1. **Read**: Existing permissions
2. **Merge**: Add \`Bash(npm:*)\` to allow array
3. **Result**: Combined with existing allows

### Environment Variables

User: "Set DEBUG=true"

1. **Decide**: User settings (global) or project settings?
2. **Read**: Target file
3. **Merge**: Add to env object
\`\`\`json
{ "env": { "DEBUG": "true" } }
\`\`\`

## Common Mistakes to Avoid

1. **Replacing instead of merging** - Always preserve existing settings
2. **Wrong file** - Ask user if scope is unclear
3. **Invalid JSON** - Validate syntax after changes
4. **Forgetting to read first** - Always read before write

## Troubleshooting Hooks

If a hook isn't running:
1. **Check the settings file** - Read ~/.claude/settings.json or .claude/settings.json
2. **Verify JSON syntax** - Invalid JSON silently fails
3. **Check the matcher** - Does it match the tool name? (e.g., "Bash", "Write", "Edit")
4. **Check hook type** - Is it "command", "prompt", or "agent"?
5. **Test the command** - Run the hook command manually to see if it works
6. **Use --debug** - Run \`claude --debug\` to see hook execution logs
`

export function registerUpdateConfigSkill(): void {
  registerBundledSkill({
    name: 'update-config',
    description:
      'Use this skill to configure the Claude Code harness via settings.json. Automated behaviors ("from now on when X", "each time X", "whenever X", "before/after X") require hooks configured in settings.json - the harness executes these, not Claude, so memory/preferences cannot fulfill them. Also use for: permissions ("allow X", "add permission", "move permission to"), env vars ("set X=Y"), hook troubleshooting, or any changes to settings.json/settings.local.json files. Examples: "allow npm commands", "add bq permission to global settings", "move permission to user settings", "set DEBUG=true", "when claude stops show X". For simple settings like theme/model, use Config tool.',
    allowedTools: ['Read'],
    userInvocable: true,
    async getPromptForCommand(args) {
      if (args.startsWith('[hooks-only]')) {
        const req = args.slice('[hooks-only]'.length).trim()
        let prompt = HOOKS_DOCS + '\n\n' + HOOK_VERIFICATION_FLOW
        if (req) {
          prompt += `\n\n## Task\n\n${req}`
        }
        return [{ type: 'text', text: prompt }]
      }

      // Generate schema dynamically to stay in sync with types
      const jsonSchema = generateSettingsSchema()

      let prompt = UPDATE_CONFIG_PROMPT
      prompt += `\n\n## Full Settings JSON Schema\n\n\`\`\`json\n${jsonSchema}\n\`\`\``

      if (args) {
        prompt += `\n\n## User Request\n\n${args}`
      }

      return [{ type: 'text', text: prompt }]
    },
  })
}
