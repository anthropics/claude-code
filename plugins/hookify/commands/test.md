---
description: Test a hookify rule against sample input
argument-hint: "[optional rule file path]"
allowed-tools: ["Glob", "Read", "AskUserQuestion", "Bash(python3 ${CLAUDE_PLUGIN_ROOT}/scripts/diagnostics.py test:*)"]
---

# Hookify Test

Test a hookify rule against sample input using the official diagnostics script.

## Workflow

1. Resolve the rule file to test
   - If `$ARGUMENTS` is present, treat it as the rule file path
   - Otherwise, find `.claude/hookify.*.local.md`
   - If there are no rules, tell the user to create one with `/hookify`
   - If there are multiple rules, ask the user which one to test

2. Read the selected rule file
   - Determine the `event`
   - Determine which condition fields are relevant
   - For simple `pattern:` rules, use the default field for the event:
     - `bash` -> `command`
     - `file` -> `content`
     - `stop` -> `reason`
     - `prompt` -> `user_prompt`

3. Ask the user for sample values
   - Always ask only for the fields the rule actually uses
   - Common fields:
     - `command`
     - `file_path`
     - `content`
     - `new_text`
     - `old_text`
     - `reason`
     - `transcript`
     - `user_prompt`

4. Run the diagnostics script
   - Build one `--value field=value` argument per collected field
   - Use this command shape:
     - `python3 ${CLAUDE_PLUGIN_ROOT}/scripts/diagnostics.py test --rule-file "<rule-path>" --value "field=value"`

5. Report the outcome
   - Say whether the rule matched
   - Show which conditions matched or failed
   - If it did not match, suggest the next thing to refine in the rule or sample input

## Important Notes

- Prefer the diagnostics script over ad-hoc regex testing so the result matches real hookify behavior
- For `stop` rules using `transcript`, ask for raw transcript text and pass it as `--value "transcript=..."`
- For `file` rules:
  - Use `content` for `Write`
  - Use `new_text` / `old_text` for `Edit`
