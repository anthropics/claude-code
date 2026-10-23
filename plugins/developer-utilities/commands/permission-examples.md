---
description: Show permission examples using your actual settings and explain how allow/ask/deny rules work
---

## Your Task

Help users understand how Claude Code permission rules work by showing their actual configuration and explaining the precedence rules.

**Related:** This addresses GitHub issue [#11655](https://github.com/anthropics/claude-code/issues/11655) regarding unclear documentation on allow vs deny precedence.

## Permission Rules Overview

Claude Code evaluates permissions in this order:

1. **DENY rules are checked first** - If matched, command is blocked
2. **ALLOW rules are checked second** - If matched, command runs without asking
3. **ASK rules are checked third** - If matched, user is prompted for approval
4. **Default behavior** - If no rules match, user is prompted (same as ASK)

**Key Principle: DENY takes precedence over ALLOW**

## Step 1: Check Which Permission Files Exist

Check for permission files:

```bash
echo "=== Permission Files Found ===" && echo ""
```

```bash
if [ -f .claude/settings.json ] && grep -q "permissions" .claude/settings.json 2>/dev/null; then echo "✓ Project settings (.claude/settings.json)"; fi
```

```bash
if [ -f ~/.claude/settings.json ] && grep -q "permissions" ~/.claude/settings.json 2>/dev/null; then echo "✓ Global settings (~/.claude/settings.json)"; fi
```

```bash
if [ -f .claude/settings.local.json ] && grep -q "permissions" .claude/settings.local.json 2>/dev/null; then echo "✓ Local settings (.claude/settings.local.json)"; fi
```

## Step 2: Ask User Which Settings to Show (If Multiple Exist)

**Count how many permission files exist from Step 1.**

**If 2 or more files have permissions:**
- Ask the user: "I found multiple permission configurations. Which would you like me to explain? (project/global/local)"
- Show only the one they choose
- Skip to Step 3 with their choice

**If exactly 1 file has permissions:**
- Automatically use that one
- Proceed to Step 3

**If 0 files have permissions:**
- Skip to Step 4 (show hard-coded examples)

## Step 3: Show User's Actual Permissions with Explanations

**Based on which file the user selected (or the only one that exists):**

**For Project settings (.claude/settings.json):**

```bash
echo "=== Your Project Permissions ===" && echo ""
```

```bash
cat .claude/settings.json 2>/dev/null | grep -A 50 "permissions"
```

```bash
echo "" && echo "=== How These Rules Work ===" && echo ""
```

**Then explain their specific rules:**
- Look at their actual allow/ask/deny arrays
- Explain what each rule means
- Point out if DENY rules override ALLOW rules
- Show examples of commands that would match each rule

**For Global settings (~/.claude/settings.json):**

```bash
echo "=== Your Global Permissions ===" && echo ""
```

```bash
cat ~/.claude/settings.json 2>/dev/null | grep -A 50 "permissions"
```

```bash
echo "" && echo "=== How These Rules Work ===" && echo ""
```

**Then explain their specific rules** (same as above)

**For Local settings (.claude/settings.local.json):**

```bash
echo "=== Your Local Permissions ===" && echo ""
```

```bash
cat .claude/settings.local.json 2>/dev/null | grep -A 50 "permissions"
```

```bash
echo "" && echo "=== How These Rules Work ===" && echo ""
```

**Then explain their specific rules** (same as above)

### Explanation Template

After showing their permissions, analyze and explain:

1. **ALLOW rules**: "These commands will run without asking:"
   - List each allow rule and what it matches

2. **ASK rules**: "These commands will prompt for confirmation:"
   - List each ask rule and what it matches

3. **DENY rules**: "These commands are blocked:"
   - List each deny rule and what it matches
   - If any DENY rules conflict with ALLOW rules, point this out

4. **Precedence conflicts**: Check if any rules conflict
   - Example: If they have `Bash(*)` in deny AND `Bash(ls:*)` in allow, explain that the deny wins

## Step 4: Show Hard-Coded Examples (Only If No Permissions Configured)

**Only run this step if NO permission files were found in Step 1.**

```bash
echo "=== No Permissions Configured ===" && echo ""
```

```bash
echo "You don't have any permissions configured yet. Here are some common examples:"
```

### Example 1: Deny Takes Precedence

```json
{
  "permissions": {
    "allow": [
      "Bash(ls:*)",
      "Bash(pwd)"
    ],
    "deny": [
      "Bash(*)"
    ]
  }
}
```

**Result:** All Bash commands are DENIED (deny overrides allow)

**Explanation:** Even though `ls` and `pwd` are in the allow list, the broader `Bash(*)` deny rule blocks ALL bash commands.

---

### Example 2: Specific Deny with General Allow

```json
{
  "permissions": {
    "allow": [
      "Bash(*)"
    ],
    "deny": [
      "Bash(rm:*)",
      "Bash(curl:*)",
      "Bash(wget:*)"
    ]
  }
}
```

**Result:** Most Bash commands are allowed, but rm/curl/wget are denied

**Explanation:** The allow rule permits all bash commands, but specific deny rules block dangerous operations.

---

### Example 3: File Access Control

```json
{
  "permissions": {
    "allow": [
      "Read(*)"
    ],
    "deny": [
      "Read(.env)",
      "Read(secrets/**)",
      "Read(**/*.key)",
      "Read(**/*.pem)"
    ]
  }
}
```

**Result:** Can read most files, but .env, secrets/, and key/pem files are blocked

**Explanation:** Broad file reading access with specific security-sensitive files denied.

---

### Example 4: Git Workflow Protection

```json
{
  "permissions": {
    "allow": [
      "Bash(git status)",
      "Bash(git diff:*)",
      "Bash(git log:*)"
    ],
    "ask": [
      "Bash(git push:*)",
      "Bash(git commit:*)",
      "Bash(git merge:*)"
    ],
    "deny": [
      "Bash(git push --force:*)",
      "Bash(rm:*)"
    ]
  }
}
```

**Result:**
- Read-only git commands are auto-allowed
- Write git commands require confirmation
- Force push and rm are completely blocked

---

## Step 5: Test Safe Commands (Optional)

Test that permissions are working with safe commands:

```bash
echo "=== Testing Safe Commands ===" && echo ""
```

```bash
echo "Test 1: echo (usually allowed)" && echo "Hello, permissions!"
```

```bash
echo "" && echo "Test 2: pwd (usually allowed)" && pwd
```

```bash
echo "" && echo "Test 3: git status (safe, read-only)" && git status --short
```

If these commands run without prompting, they're in your ALLOW list.
If you get a prompt, they're in your ASK list or not configured.
If they're blocked, they're in your DENY list.

## Permission Rule Syntax Reference

### Tool Patterns

| Pattern | Matches | Example |
|---------|---------|---------|
| `ToolName` | Exact tool | `WebFetch` blocks all web fetches |
| `ToolName(*)` | Tool with any args | `Bash(*)` matches all bash commands |
| `ToolName(pattern:*)` | Prefix match | `Bash(git:*)` matches git commands |
| `Read(path/**)` | Glob patterns | `Read(secrets/**)` matches all files in secrets/ |

### Important Notes

1. **Bash uses prefix matching**, not regex
   - `Bash(git:*)` matches `git status`, `git commit`, etc.
   - But prefix matching can be bypassed (see security limitations)

2. **More specific rules should be in DENY**
   - Deny specific dangerous operations
   - Allow broader categories

3. **DENY always wins**
   - If a command matches both DENY and ALLOW, it's denied
   - Order in the file doesn't matter - DENY is checked first

## Common Configurations

### Development Environment (Permissive)
```json
{
  "permissions": {
    "allow": [
      "Bash(*)",
      "Read(*)",
      "Write(*)",
      "Edit(*)"
    ],
    "ask": [
      "Bash(git push:*)"
    ],
    "deny": [
      "Bash(rm -rf /*)"
    ]
  }
}
```

### Production Environment (Restrictive)
```json
{
  "permissions": {
    "allow": [
      "Read(*)",
      "Bash(git status)",
      "Bash(git diff:*)"
    ],
    "ask": [
      "Bash(git:*)",
      "Edit(*)",
      "Write(*)"
    ],
    "deny": [
      "Bash(rm:*)",
      "Bash(curl:*)",
      "WebFetch",
      "Read(.env)",
      "Read(secrets/**)"
    ]
  }
}
```

## Expected Behavior

After running this command, you will understand:

1. **Your current configuration** (if any exists)
2. **Precedence order:** DENY → ALLOW → ASK → Default (ask)
3. **How to configure permissions** for different security needs
4. **Pattern matching syntax** for different tools
5. **Common gotchas** and best practices

## To Modify Permissions

Use the built-in `/permissions` command to interactively configure your permission rules.

## Documentation References

- [Official Permissions Documentation](https://code.claude.com/docs/en/settings#permission-settings)
- [IAM & Security](https://code.claude.com/docs/en/iam)
- [GitHub Issue #11655](https://github.com/anthropics/claude-code/issues/11655) - Permission precedence clarification
